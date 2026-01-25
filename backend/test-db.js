const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT 1 AS connected');
      const schemaResult = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
      );

      console.log('Database connection OK');
      console.log('Test query result:', result.rows[0]);
      console.log('Tables found:', schemaResult.rows.map(row => row.table_name));
      process.exitCode = 0;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection FAILED');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();
