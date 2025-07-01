const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { pool, initializeDatabase } = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize DB on server start
initializeDatabase();

// === POST: Register a new driver
app.post('/register-driver', async (req, res) => {
  const { name, subname, carName, plate, driverImageUrl, carImageUrl, tasks } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO drivers (name, subname, car_name, plate, driver_image_url, car_image_url, tasks)
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[])
       RETURNING *`,
      [ name, subname, carName, plate, driverImageUrl, carImageUrl, tasks ]
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
