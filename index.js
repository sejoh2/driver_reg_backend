const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { pool, initializeDatabase, dropScheduledRidesTable, dropDriversTable } = require('./db');
require('dotenv').config();
const axios = require('axios');

const admin = require('firebase-admin');
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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
    await dropDriversTable();   
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
  const { name, subname, carName, plate, driverImageUrl, carImageUrl, tasks, fcmToken} = req.body;

  try {
    const result = await pool.query(
  `INSERT INTO drivers (name, subname, car_name, plate, driver_image_url, car_image_url, tasks, fcm_token)
   VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8)
   RETURNING *`,
  [name, subname, carName, plate, driverImageUrl, carImageUrl, tasks, fcmToken]
);


    res.status(200).json({ success: true, driver: result.rows[0] });
  } catch (error) {
    console.error('Error inserting driver:', error);
    res.status(500).json({ success: false, error: 'Failed to register driver' });
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


// Health check
app.get('/', (req, res) => {
  res.send('CelebRide Backend is running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

