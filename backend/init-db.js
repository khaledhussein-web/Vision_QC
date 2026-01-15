const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  try {
    // Create tables (run schema)
    const fs = require('fs');
    const schema = fs.readFileSync('../src/database/schema.sql', 'utf8');
    await pool.query(schema);

    console.log('Schema created');

    // Insert roles
    await pool.query(`
      INSERT INTO role (name) VALUES ('user'), ('admin'), ('operator')
      ON CONFLICT (name) DO NOTHING
    `);

    // Insert permissions (if needed, but schema has permissions)
    // For simplicity, skip permissions for now

    // Get role IDs
    const roles = await pool.query('SELECT role_id, name FROM role');
    const roleMap = {};
    roles.rows.forEach(r => roleMap[r.name] = r.role_id);

    // Insert users
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedUserPassword = await bcrypt.hash('password123', 10);

    await pool.query(`
      INSERT INTO users (full_name, email, password_hash, role_id, status)
      VALUES
        ('Admin User', 'admin@visionqc.com', $1, $2, 'ACTIVE'),
        ('Test User', 'user@visionqc.com', $3, $4, 'ACTIVE')
      ON CONFLICT (email) DO NOTHING
    `, [hashedAdminPassword, roleMap.admin, hashedUserPassword, roleMap.user]);

    console.log('Initial data inserted');
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    pool.end();
  }
}

initDatabase();