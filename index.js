const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { pool, initializeDatabase, dropScheduledRidesTable, dropDriversTable, dropdriverNotificationsTable} = require('./db');
require('dotenv').config();
const axios = require('axios');

const admin = require('firebase-admin');
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_ADMIN_SDK_JSON, 'base64').toString('utf8')
);


//send notification route
const sendNotification = async (fcmToken, title, body, data = {}) => {
  const message = {
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: data, // custom key-value pairs
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent:', response);
    return { success: true, response };
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return { success: false, error };
  }
};


const app = express();
app.use(cors());
app.use(bodyParser.json());
 // path to your downloaded file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


// DROP and recreate the table (optional during development)
if (process.env.NODE_ENV === 'development') {
  (async () => {
    console.log('🛠️ Dev mode: Initializing DB');
    // await dropDriversTable(); 
    // await dropScheduledRidesTable();
    // await dropdriverNotificationsTable();
    await initializeDatabase();
  })();
}


// === POST: Add a scheduled ride
app.post('/scheduled-rides', async (req, res) => {
  const {
    user_id,
    driver_name,
    car,
    plate,
    pickup,
    destination,
    datetime,
    payment,
    distance,
    est_time,
    price,
    status
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO scheduled_rides 
        (user_id, driver_name, car, plate, pickup, destination, datetime, payment, distance, est_time, price, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        user_id || null,
      
        driver_name,
        car,
        plate,
        pickup,
        destination,
        datetime,
        payment,
        distance,
        est_time,
        price,
        status || 'Pending'
      ]
    );

    res.status(201).json({ success: true, ride: result.rows[0] });
  } catch (error) {
    console.error('Error inserting scheduled ride:', error);
    res.status(500).json({ success: false, error: 'Failed to schedule ride' });
  }
});

// === POST: Add a driver notification
app.post('/driver-notifications', async (req, res) => {
  const { driverUid, title, pickupLocation, destination, imageUrl } = req.body;

  if (!driverUid || !title) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Driver_Notifications (driver_uid, title, pickup_location, destination, image_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [driverUid, title, pickupLocation || null, destination || null, imageUrl || null]
    );

    res.status(201).json({ success: true, notification: result.rows[0] });
  } catch (error) {
    console.error('❌ Error inserting driver notification:', error);
    res.status(500).json({ success: false, error: 'Failed to insert driver notification' });
  }
});

// === GET: Fetch notifications for a driver by UID
app.get('/driver-notifications/:driverUid', async (req, res) => {
  const { driverUid } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM Driver_Notifications WHERE driver_uid = $1 ORDER BY created_at DESC',
      [driverUid]
    );

    res.json({ success: true, notifications: result.rows });
  } catch (error) {
    console.error('❌ Error fetching driver notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch driver notifications' });
  }
});





// === GET: Fetch scheduled rides by UserId
app.get('/scheduled-rides', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM scheduled_rides WHERE user_id = $1 ORDER BY datetime DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scheduled rides:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// === POST: Register a new driver
app.post('/register-driver', async (req, res) => {
  const { uid, name, subname, carName, plate, driverImageUrl, carImageUrl, tasks, fcmToken} = req.body;

  try {
    const result = await pool.query(
  `INSERT INTO drivers (uid, name, subname, car_name, plate, driver_image_url, car_image_url, tasks, fcm_token)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9)
   RETURNING *`,
  [uid, name, subname, carName, plate, driverImageUrl, carImageUrl, tasks, fcmToken]
);


    res.status(200).json({ success: true, driver: result.rows[0] });
  } catch (error) {
    console.error('Error inserting driver:', error);
    res.status(500).json({ success: false, error: 'Failed to register driver' });
  }
});

// GET /driver-exists/:uid
app.get('/driver-exists/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM drivers WHERE uid = $1',
      [uid]
    );
    if (result.rows.length > 0) {
      res.json({ exists: true, driver: result.rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error('Error checking driver existence:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// 🔍 GET /driver/:uid
// Fetches a driver's profile data (e.g. image URL) by their Firebase UID.
// This is used by the CelebRide driver app to display the logged-in driver's profile info.

app.get('/driver/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM drivers WHERE uid = $1',
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(result.rows[0]);  // Send all driver details
  } catch (error) {
    console.error('Error fetching driver details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




// === GET: Fetch all drivers
app.get('/drivers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM drivers');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

//Sending ride request notification via FCM token.
app.post('/notify-driver', async (req, res) => {
  const { driverId, title, body, data } = req.body;

  try {
    const result = await pool.query('SELECT fcm_token FROM drivers WHERE id = $1', [driverId]);
    if (result.rows.length === 0 || !result.rows[0].fcm_token) {
      return res.status(404).json({ success: false, error: 'Driver not found or FCM token missing' });
    }

    const fcmToken = result.rows[0].fcm_token;
    const notificationResult = await sendNotification(fcmToken, title, body, data);

    if (!notificationResult.success) {
      return res.status(500).json({ success: false, error: notificationResult.error });
    }

    res.status(200).json({ success: true, fcmResponse: notificationResult.response });
  } catch (error) {
    console.error('Error in /notify-driver:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// === PATCH: Update FCM token
app.patch('/update-fcm-token', async (req, res) => {
  const { uid, fcmToken } = req.body;

  if (!uid || !fcmToken) {
    return res.status(400).json({ success: false, error: 'uid and fcmToken are required' });
  }

  try {
    const result = await pool.query(
      `UPDATE drivers SET fcm_token = $1 WHERE uid = $2 RETURNING *`,
      [fcmToken, uid]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }

    res.status(200).json({ success: true, driver: result.rows[0] });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    res.status(500).json({ success: false, error: 'Failed to update FCM token' });
  }
});

// === GET: Fetch driver by ID (to get UID and other info)
app.get('/drivers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, uid, name, subname, car_name, plate, driver_image_url, car_image_url FROM drivers WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }

    res.status(200).json({ success: true, driver: result.rows[0] });
  } catch (error) {
    console.error('❌ Error fetching driver by ID:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});



// POST or UPDATE customer profile image
app.post('/customer-profile', async (req, res) => {
  const { uid, name, profileImageUrl } = req.body;

  if (!uid || !profileImageUrl) {
    return res.status(400).json({ success: false, error: 'uid and profileImageUrl are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO customer_profile (uid, name, profile_image_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (uid) DO UPDATE 
       SET profile_image_url = EXCLUDED.profile_image_url,
           name = COALESCE(EXCLUDED.name, customer_profile.name)
       RETURNING *`,
      [uid, name || null, profileImageUrl]
    );

    res.status(200).json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Error saving customer profile:', error);
    res.status(500).json({ success: false, error: 'Failed to save profile' });
  }
});


app.get('/customer-profile/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM customer_profile WHERE uid = $1',
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    res.status(200).json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});




// Health check
app.get('/', (req, res) => {
  res.send('CelebRide Backend is running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

