const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Middleware
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname || '').toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to database');
  release();
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Get user from database
    const userQuery = `
      SELECT u.user_id, u.email, u.password_hash, r.name as role_name
      FROM users u
      JOIN role r ON u.role_id = r.role_id
      WHERE u.email = $1 AND u.status = 'ACTIVE'
    `;
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.user_id, role: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);

    res.json({
      token,
      user_id: user.user_id
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { full_name, email, password, password_confirm } = req.body;

  try {
    // Validate input
    const trimmedName = typeof full_name === 'string' ? full_name.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const passwordValue = typeof password === 'string' ? password : '';
    const confirmValue = typeof password_confirm === 'string' ? password_confirm : '';

    if (!trimmedName || !normalizedEmail || !passwordValue || !confirmValue) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (trimmedName.length < 2 || trimmedName.length > 120) {
      return res.status(400).json({ error: 'Full name must be between 2 and 120 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (passwordValue !== confirmValue) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (passwordValue.length < 8 || passwordValue.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters long' });
    }

    if (!/[A-Za-z]/.test(passwordValue) || !/[0-9]/.test(passwordValue)) {
      return res.status(400).json({ error: 'Password must contain at least one letter and one number' });
    }

    // Check if email already exists
    const emailCheckQuery = 'SELECT user_id FROM users WHERE email = $1';
    const emailCheckResult = await pool.query(emailCheckQuery, [normalizedEmail]);
    if (emailCheckResult.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get user role ID
    const roleQuery = 'SELECT role_id FROM role WHERE LOWER(name) = LOWER($1)';
    const roleResult = await pool.query(roleQuery, ['user']);
    if (roleResult.rows.length === 0) {
      return res.status(500).json({ error: 'User role not found' });
    }
    const roleId = roleResult.rows[0].role_id;

    // Insert new user
    const insertQuery = `
      INSERT INTO users (full_name, email, password_hash, role_id, status)
      VALUES ($1, $2, $3, $4, 'ACTIVE')
      RETURNING user_id
    `;
    const insertResult = await pool.query(insertQuery, [trimmedName, normalizedEmail, hashedPassword, roleId]);

    const userId = insertResult.rows[0].user_id;

    // Generate JWT token
    const token = jwt.sign(
       { user_id: userId, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      status: 'success',
      user_id: userId,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analyze endpoint - forwards image to Python service
app.post('/api/analyze', authenticateToken, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  try {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path), {
      filename: req.file.originalname || path.basename(req.file.path),
      contentType: req.file.mimetype || 'application/octet-stream'
    });

    const response = await axios.post(`${PYTHON_SERVICE_URL}/predict`, formData, {
      headers: formData.getHeaders(),
      timeout: 15000
    });

    const imagePath = path.relative(__dirname, req.file.path).replace(/\\/g, '/');
    const insertImageQuery = `
      INSERT INTO image (user_id, image_path)
      VALUES ($1, $2)
      RETURNING image_id
    `;
    const imageResult = await pool.query(insertImageQuery, [req.user.user_id, imagePath]);
    const imageId = imageResult.rows[0].image_id;

    const insertPredictionQuery = `
      INSERT INTO prediction (image_id, label, confidence, heatmap_url, suggested_sc)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING prediction_id, image_id, label, confidence, heatmap_url, suggested_sc, created_at, updated_at
    `;
    const predictionResult = await pool.query(insertPredictionQuery, [
      imageId,
      response.data.label,
      response.data.confidence,
      response.data.heatmap_url || null,
      response.data.suggested_sc || null
    ]);

    res.json(predictionResult.rows[0]);
  } catch (error) {
    const status = error.response?.status || 500;
    const detail = error.response?.data || { error: 'Prediction service error' };
    console.error('Analyze error:', error.message || error);
    res.status(status).json(detail);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
