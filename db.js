const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const createDriversTable = `
  CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    uid TEXT UNIQUE,
    name TEXT NOT NULL,
    subname TEXT NOT NULL,
    car_name TEXT NOT NULL,
    plate TEXT NOT NULL,
    driver_image_url TEXT,
    car_image_url TEXT,
    tasks TEXT[] NOT NULL,
    FCM_token TEXT
  );
`;

const createScheduledRidesTable = `
  CREATE TABLE IF NOT EXISTS scheduled_rides (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    driver_name TEXT NOT NULL,
    car TEXT NOT NULL,
    plate TEXT NOT NULL,
    pickup TEXT NOT NULL,
    destination TEXT NOT NULL,
    datetime TEXT NOT NULL,
    payment TEXT NOT NULL,
    distance TEXT,
    est_time TEXT,
    price TEXT,
    status TEXT DEFAULT 'Pending'
  );
`;

const createCustomerProfileTable = `
  CREATE TABLE IF NOT EXISTS customer_profile (
    id SERIAL PRIMARY KEY,
    uid TEXT UNIQUE NOT NULL,
    name TEXT,
    profile_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const createdriverNotificationsTable = `
  CREATE TABLE IF NOT EXISTS Driver_Notifications (
     id SERIAL PRIMARY KEY,
  driver_uid TEXT NOT NULL,         -- The driver UID to whom the notification belongs
  title TEXT NOT NULL,              -- Notification title (e.g., "Ride Assigned", "Ride Completed")
  pickup_location TEXT,             -- The ride pickup location
  destination TEXT,                 -- The ride destination
  image_url TEXT,                   -- Optional image (e.g., profile, car, or icon)
  is_read BOOLEAN DEFAULT FALSE,    -- Track whether the driver has read the notification
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;


const dropScheduledRidesTable = async () => {
  try {
    await pool.query('DROP TABLE IF EXISTS scheduled_rides;');
    console.log("🗑️ Table 'scheduled_rides' has been dropped.");
  } catch (err) {
    console.error("❌ Failed to drop table:", err);
  }
};

const dropdriverNotificationsTable = async () => {
  try {
    await pool.query('DROP TABLE IF EXISTS notifications;');
    console.log("🗑️ Table 'Driver_Notifications' has been dropped.");
  } catch (err) {
    console.error("❌ Failed to drop 'Driver_Notifications' table:", err);
  }
};


// ✅ Add this function
const dropDriversTable = async () => {
  try {
    await pool.query('DROP TABLE IF EXISTS drivers;');
    console.log("🗑️ Table 'drivers' has been dropped.");
  } catch (err) {
    console.error("❌ Failed to drop 'drivers' table:", err);
  }
};

const initializeDatabase = async () => {
  try {
    await pool.query(createDriversTable);
    console.log("✅ Table 'drivers' is ready.");

    await pool.query(createScheduledRidesTable);
    console.log("✅ Table 'scheduled_rides' is ready.");

    
    await pool.query(createCustomerProfileTable);
    console.log("✅ Table 'customer_profile' is ready.");

    await pool.query(createdriverNotificationsTable);
    console.log("✅ Table 'Driver_Notifications' is ready.");
  } catch (err) {
    console.error("❌ Failed to create tables:", err);
  }
};

module.exports = {
  pool,
  initializeDatabase,
  dropScheduledRidesTable,
  dropDriversTable,
  dropdriverNotificationsTable
};
