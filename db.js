const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Auto-create drivers table if it doesn't exist
const initializeDatabase = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS drivers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      subname TEXT NOT NULL,
      car_name TEXT NOT NULL,
      plate TEXT NOT NULL,
      driver_image_url TEXT,
      car_image_url TEXT,
      tasks TEXT[] NOT NULL
    );
  `;

  try {
    await pool.query(createTableQuery);
    console.log("✅ Table 'drivers' is ready.");
  } catch (err) {
    console.error("❌ Failed to create table:", err);
  }
};

module.exports = { pool, initializeDatabase };
