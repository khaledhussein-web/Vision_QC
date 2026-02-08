const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

// Middleware
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));

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

const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
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
  console.log('Analyze request received', {
    userId: req.user?.user_id,
    role: req.user?.role,
    hasFile: Boolean(req.file),
    contentType: req.headers['content-type']
  });
  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  try {
    console.log('Analyze file info', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });
    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path), {
      filename: req.file.originalname || path.basename(req.file.path),
      contentType: req.file.mimetype || 'application/octet-stream'
    });

    console.log('Forwarding to Python service', {
      url: `${PYTHON_SERVICE_URL}/predict`
    });
    const response = await fetch(`${PYTHON_SERVICE_URL}/predict`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
      timeout: 15000
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('FastAPI error:', text);
      return res.status(500).json({ error: 'Prediction service error' });
    }

    const data = await response.json();

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
      data.label,
      data.confidence,
      data.heatmap_url || null,
      data.suggested_sc || null
    ]);

    res.json(predictionResult.rows[0]);
  } catch (error) {
    const status = error.response?.status || 500;
    const detail = error.response?.data || { error: 'Prediction service error' };
    const responseData = error.response?.data;
    const responseStatus = error.response?.status;
    const responseHeaders = error.response?.headers;
    console.error('Analyze error:', error.message || error);
    if (responseStatus || responseData || responseHeaders) {
      console.error('Analyze upstream response:', {
        status: responseStatus,
        data: responseData,
        headers: responseHeaders
      });
    }
    res.status(status).json(
      typeof detail === 'object' && detail !== null
        ? detail
        : { error: 'Prediction service error', detail }
    );
  }
});

// Chat endpoint - forwards messages to OpenAI
app.post('/api/chat', authenticateToken, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  }

  const { message, history } = req.body || {};
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (!trimmedMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const safeHistory = Array.isArray(history)
    ? history
        .filter(item => item && typeof item.role === 'string' && typeof item.content === 'string')
        .slice(-8)
    : [];

  try {
    const client = new OpenAI({ apiKey });
    const input = [
      {
        role: 'system',
        content:
          'You are VisionQC, an AI assistant for plant disease detection. Provide concise, practical guidance. ' +
          'If unsure, ask for a clear photo and suggest using the Upload screen for analysis. ' +
          'Avoid medical claims; this is general plant-care advice.',
      },
      ...safeHistory.map(item => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content,
      })),
      { role: 'user', content: trimmedMessage },
    ];

    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input,
    });

    const reply = response.output_text || 'Sorry, I could not generate a response.';
    return res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error?.message || error);
    return res.status(500).json({ error: 'Chat service error' });
  }
});

app.get('/api/users/:userId/history', authenticateToken, async (req, res) => {
  const requestedUserId = Number(req.params.userId);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 100);

  if (!requestedUserId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const requesterId = Number(req.user?.user_id);
  const requesterRole = String(req.user?.role || '').toLowerCase();
  const isAdmin = requesterRole === 'admin';

  if (!isAdmin && requesterId !== requestedUserId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const offset = (page - 1) * perPage;

  try {
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM prediction p
      JOIN image i ON p.image_id = i.image_id
      WHERE i.user_id = $1
    `;
    const countResult = await pool.query(countQuery, [requestedUserId]);
    const total = Number(countResult.rows[0]?.total || 0);

    const historyQuery = `
      SELECT
        p.prediction_id,
        p.label,
        p.confidence,
        p.heatmap_url,
        p.suggested_sc,
        p.created_at,
        p.updated_at,
        i.image_id,
        i.image_path,
        i.uploaded_at
      FROM prediction p
      JOIN image i ON p.image_id = i.image_id
      WHERE i.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const historyResult = await pool.query(historyQuery, [requestedUserId, perPage, offset]);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const data = historyResult.rows.map(row => ({
      ...row,
      image_url: row.image_path ? `${baseUrl}/${row.image_path.replace(/\\/g, '/')}` : null
    }));

    return res.json({
      data,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    console.error('History error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: list users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 100);
  const offset = (page - 1) * perPage;

  try {
    const countResult = await pool.query('SELECT COUNT(*) AS total FROM users');
    const total = Number(countResult.rows[0]?.total || 0);

    const usersQuery = `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.status,
        u.created_at,
        u.last_login,
        r.name AS role
      FROM users u
      JOIN role r ON u.role_id = r.role_id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const usersResult = await pool.query(usersQuery, [perPage, offset]);

    return res.json({
      data: usersResult.rows,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: list images with predictions
app.get('/api/admin/images', authenticateToken, requireAdmin, async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 100);
  const offset = (page - 1) * perPage;

  try {
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM image i
      LEFT JOIN prediction p ON p.image_id = i.image_id
    `;
    const countResult = await pool.query(countQuery);
    const total = Number(countResult.rows[0]?.total || 0);

    const imagesQuery = `
      SELECT
        i.image_id,
        i.image_path,
        i.uploaded_at,
        i.user_id,
        u.full_name,
        u.email,
        p.prediction_id,
        p.label,
        p.confidence,
        p.heatmap_url,
        p.suggested_sc,
        p.created_at AS predicted_at
      FROM image i
      JOIN users u ON i.user_id = u.user_id
      LEFT JOIN prediction p ON p.image_id = i.image_id
      ORDER BY i.uploaded_at DESC
      LIMIT $1 OFFSET $2
    `;
    const imagesResult = await pool.query(imagesQuery, [perPage, offset]);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const data = imagesResult.rows.map(row => ({
      ...row,
      image_url: row.image_path ? `${baseUrl}/${row.image_path.replace(/\\/g, '/')}` : null
    }));

    return res.json({
      data,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    console.error('Admin images error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: list reports
app.get('/api/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 100);
  const offset = (page - 1) * perPage;

  try {
    const countResult = await pool.query('SELECT COUNT(*) AS total FROM report');
    const total = Number(countResult.rows[0]?.total || 0);

    const reportsQuery = `
      SELECT
        r.report_id,
        r.report_type,
        r.format,
        r.download_link,
        r.created_at,
        r.operator_id,
        u.full_name AS operator_name,
        u.email AS operator_email
      FROM report r
      JOIN users u ON r.operator_id = u.user_id
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const reportsResult = await pool.query(reportsQuery, [perPage, offset]);

    return res.json({
      data: reportsResult.rows,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    console.error('Admin reports error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
