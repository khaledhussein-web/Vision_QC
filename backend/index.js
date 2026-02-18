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
const HOST = process.env.HOST || '0.0.0.0';

// Base URL for your FastAPI/Python prediction service
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

// Models used by OpenAI endpoint (main + optional fallback)
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || '';
const DEFAULT_LOCAL_PYTHON_SERVICE_URL = 'http://127.0.0.1:8000';

// -------------------- Middleware --------------------

// Enable CORS so your frontend can call this backend
app.use(cors());

// Parse JSON bodies (req.body) automatically
app.use(express.json());

// -------------------- Uploads folder setup --------------------

// Create absolute path: <project>/uploads
const uploadsDir = path.join(__dirname, 'uploads');
const reportsDir = path.join(__dirname, 'reports');

// If uploads folder doesn't exist, create it
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Serve uploaded images publicly:
// example: http://localhost:5000/uploads/yourfile.png
app.use('/uploads', express.static(uploadsDir));
app.use('/reports', express.static(reportsDir));

const toCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const normalized = String(value).replace(/"/g, '""');
  return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
};

const toCsv = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(','))
  ];

  return lines.join('\n');
};

const buildFallbackChatReply = (message) => {
  const prompt = String(message || '').trim();
  if (!prompt) {
    return 'Please share plant symptoms and I will suggest next steps.';
  }

  return [
    'I could not reach the AI provider right now, but here is a quick guide:',
    `1) Isolate the affected plant and remove heavily damaged leaves.`,
    '2) Keep leaves dry and improve airflow around the plant.',
    '3) Upload a clear close-up photo in VisionQC for a better diagnosis.',
    `Your question: "${prompt.slice(0, 180)}${prompt.length > 180 ? '...' : ''}"`
  ].join('\n');
};

const extractOriginalQuestion = (message) => {
  const text = String(message || '').trim();
  if (!text) return '';

  // If user pasted the fallback block, recover the original question.
  const questionMatch = text.match(/Your question:\s*"([^"]+)"/i);
  if (questionMatch && questionMatch[1]) {
    return questionMatch[1].trim();
  }

  return text;
};

const normalizeBaseUrl = (urlValue) => String(urlValue || '').trim().replace(/\/$/, '');

const buildSuggestionFallback = (label, confidence) => {
  const normalizedLabel = String(label || '').trim();
  const normalizedConfidence = Number(confidence);
  const confidenceText = Number.isFinite(normalizedConfidence)
    ? `Model confidence: ${Math.round(normalizedConfidence * 100)}%.`
    : '';

  if (!normalizedLabel) {
    return `No treatment text was returned by the prediction service. ${confidenceText}`.trim();
  }

  return `Predicted condition: ${normalizedLabel}. Follow crop-specific treatment guidance and monitor the plant for 3-5 days. ${confidenceText}`.trim();
};

// -------------------- Multer (file upload) configuration --------------------

// diskStorage defines WHERE and HOW to name uploaded files
const storage = multer.diskStorage({
  // destination callback: decides the folder where multer stores the file
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir); // store inside /uploads
  },

  // filename callback: decides the stored filename
  filename: (_req, file, cb) => {
    // Keep only extension from original file (like .png/.jpg)
    const safeExt = path.extname(file.originalname || '').toLowerCase();

    // Make unique filename to avoid collisions: timestamp-random.ext
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;

    cb(null, uniqueName);
  }
});

// upload middleware instance:
// - uses the storage above
// - limits max file size (10MB)
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// -------------------- Database connection --------------------

// Create a PostgreSQL connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// -------------------- Test database connection --------------------

// pool.connect tries to get a client from the pool (to confirm DB is reachable)
pool.connect((err, client, release) => {
  if (err) {
    // If DB is down / wrong credentials / wrong url
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to database');

  // release the client back to the pool
  release();
});

// -------------------- Login endpoint --------------------

// POST /api/login
// Purpose: authenticate a user using email + password, then return JWT token
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const passwordValue = typeof password === 'string' ? password : '';

  try {
    if (!normalizedEmail || !passwordValue) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 1) Fetch user row by email (only ACTIVE users), and join role name
    const userQuery = `
      SELECT u.user_id, u.email, u.password_hash, r.name as role_name
      FROM users u
      JOIN role r ON u.role_id = r.role_id
      WHERE LOWER(u.email) = LOWER($1) AND u.status = 'ACTIVE'
    `;
    const userResult = await pool.query(userQuery, [normalizedEmail]);

    // If no user found -> invalid credentials
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // 2) Compare plain password with stored bcrypt hash
    const isValidPassword = await bcrypt.compare(passwordValue, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3) Generate JWT token with payload {user_id, role}
    // - signed using JWT_SECRET from .env
    // - expires in 24 hours
    const token = jwt.sign(
      { user_id: user.user_id, role: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 4) Update last login timestamp for tracking
    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);

    // 5) Return token + user_id + role to frontend
    res.json({
      token,
      user_id: user.user_id,
      role: user.role_name
    });
    
  } catch (error) {
    // Any unexpected error -> 500
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------- Auth middleware: authenticateToken --------------------

// Purpose: protect routes by requiring a valid JWT
// How it works:
// - Reads Authorization header: "Bearer <token>"
// - Verifies the token
// - Saves decoded payload in req.user
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // If no token -> 401
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    // Verify token signature + expiration
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Store decoded info for later routes (user_id, role)
    req.user = payload;

    // Continue to next middleware/route handler
    return next();
  } catch (error) {
    // Invalid token or expired token -> 401
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// -------------------- Admin middleware: requireAdmin --------------------

// Purpose: allow only admins to access certain endpoints
// Requires authenticateToken before it, so req.user exists.
const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};

const normalizeRoleName = (roleValue) => String(roleValue || '').trim().toLowerCase();
const ALLOWED_ROLES = new Set(['user', 'admin']);
const ALLOWED_USER_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

const isValidEmail = (emailValue) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

const validatePassword = (passwordValue) => {
  if (passwordValue.length < 8 || passwordValue.length > 128) {
    return 'Password must be between 8 and 128 characters long';
  }

  if (!/[A-Za-z]/.test(passwordValue) || !/[0-9]/.test(passwordValue)) {
    return 'Password must contain at least one letter and one number';
  }

  return null;
};

const getRoleIdByName = async (roleName) => {
  const roleQuery = 'SELECT role_id FROM role WHERE LOWER(name) = LOWER($1)';
  const roleResult = await pool.query(roleQuery, [roleName]);
  if (roleResult.rows.length === 0) {
    return null;
  }
  return roleResult.rows[0].role_id;
};

// -------------------- Register endpoint --------------------

// POST /api/register
// Purpose: create a new user account with role "user"
app.post('/api/register', async (req, res) => {
  const { full_name, email, password, password_confirm } = req.body;

  try {
    // ---- 1) Normalize / validate input ----
    const trimmedName = typeof full_name === 'string' ? full_name.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const passwordValue = typeof password === 'string' ? password : '';
    const confirmValue = typeof password_confirm === 'string' ? password_confirm : '';

    // Check missing fields
    if (!trimmedName || !normalizedEmail || !passwordValue || !confirmValue) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Name length check
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      return res.status(400).json({ error: 'Full name must be between 2 and 120 characters' });
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Password confirmation check
    if (passwordValue !== confirmValue) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Password length check
    if (passwordValue.length < 8 || passwordValue.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters long' });
    }

    // Password strength check (at least 1 letter and 1 number)
    if (!/[A-Za-z]/.test(passwordValue) || !/[0-9]/.test(passwordValue)) {
      return res.status(400).json({ error: 'Password must contain at least one letter and one number' });
    }

    // ---- 2) Check if email already exists ----
    const emailCheckQuery = 'SELECT user_id FROM users WHERE email = $1';
    const emailCheckResult = await pool.query(emailCheckQuery, [normalizedEmail]);
    if (emailCheckResult.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // ---- 3) Hash password using bcrypt ----
    const hashedPassword = await bcrypt.hash(password, 10);

    // ---- 4) Get role_id for "user" role ----
    const roleQuery = 'SELECT role_id FROM role WHERE LOWER(name) = LOWER($1)';
    const roleResult = await pool.query(roleQuery, ['user']);
    if (roleResult.rows.length === 0) {
      return res.status(500).json({ error: 'User role not found' });
    }
    const roleId = roleResult.rows[0].role_id;

    // ---- 5) Insert user into DB ----
    const insertQuery = `
      INSERT INTO users (full_name, email, password_hash, role_id, status)
      VALUES ($1, $2, $3, $4, 'ACTIVE')
      RETURNING user_id
    `;
    const insertResult = await pool.query(insertQuery, [trimmedName, normalizedEmail, hashedPassword, roleId]);

    const userId = insertResult.rows[0].user_id;

    // ---- 6) Create JWT token immediately after registration ----
    const token = jwt.sign(
       { user_id: userId, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // ---- 7) Return user_id + token ----
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

// -------------------- Analyze endpoint --------------------

// POST /api/analyze
// Purpose:
// - accept an image upload
// - forward it to FastAPI (/predict)
// - save image record + prediction record in DB
// Protected by authenticateToken.
// upload.single('image') means it expects multipart/form-data with field name "image".
app.post('/api/analyze', authenticateToken, upload.single('image'), async (req, res) => {
  console.log('Analyze request received', {
    userId: req.user?.user_id,
    role: req.user?.role,
    hasFile: Boolean(req.file),
    contentType: req.headers['content-type']
  });

  // If multer did not receive a file
  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  try {
    // Log file info (debugging)
    console.log('Analyze file info', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // 1) Build a FormData payload to send to FastAPI
    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path), {
      filename: req.file.originalname || path.basename(req.file.path),
      contentType: req.file.mimetype || 'application/octet-stream'
    });

    // 2) Forward image to Python service
    console.log('Forwarding to Python service', {
      url: `${PYTHON_SERVICE_URL}/predict`
    });

    const predictionServiceUrls = [
      normalizeBaseUrl(PYTHON_SERVICE_URL),
      DEFAULT_LOCAL_PYTHON_SERVICE_URL
    ].filter((url, index, self) => Boolean(url) && self.indexOf(url) === index);

    let response = null;
    let lastServiceError = null;

    for (const serviceBaseUrl of predictionServiceUrls) {
      try {
        response = await fetch(`${serviceBaseUrl}/predict`, {
          method: 'POST',
          body: formData,
          headers: formData.getHeaders(),
          timeout: 15000 // stop waiting after 15s
        });

        if (response.ok) {
          break;
        }

        const text = await response.text();
        lastServiceError = `HTTP ${response.status} from ${serviceBaseUrl}/predict`;
        console.error('FastAPI error:', {
          serviceBaseUrl,
          status: response.status,
          body: text
        });
        response = null;
      } catch (serviceError) {
        lastServiceError = serviceError.message || 'Prediction service unreachable';
        console.error('FastAPI request failed:', {
          serviceBaseUrl,
          error: lastServiceError
        });
      }
    }

    if (!response) {
      return res.status(500).json({
        error: 'Prediction service error',
        detail: lastServiceError || 'Failed to reach prediction service'
      });
    }

    // 3) Read JSON response from FastAPI (label/confidence/heatmap_url/suggested_sc...)
    const data = await response.json();

    // 4) Save uploaded image path to DB
    // imagePath becomes something like: "uploads/12345.png"
    const imagePath = path.relative(__dirname, req.file.path).replace(/\\/g, '/');

    const insertImageQuery = `
      INSERT INTO image (user_id, image_path)
      VALUES ($1, $2)
      RETURNING image_id
    `;
    const imageResult = await pool.query(insertImageQuery, [req.user.user_id, imagePath]);
    const imageId = imageResult.rows[0].image_id;

    // 5) Save prediction to DB, linked to image_id
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
      data.suggested_sc || buildSuggestionFallback(data.label, data.confidence)
    ]);

    // 6) Return saved prediction row to frontend
    res.json(predictionResult.rows[0]);
  } catch (error) {
    // This catch tries to extract info like axios style,
    // but you are using node-fetch so error.response is usually undefined.
    const status = error.response?.status || 500;
    const detail = error.response?.data || { error: 'Prediction service error' };
    const responseData = error.response?.data;
    const responseStatus = error.response?.status;
    const responseHeaders = error.response?.headers;

    console.error('Analyze error:', error.message || error);

    // Extra logs if upstream response exists (mostly not with node-fetch)
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

// -------------------- Chat endpoint (OpenAI) --------------------

// POST /api/chat
// Purpose:
// - accept message (+ optional history) from frontend
// - call OpenAI Responses API
// - return assistant reply
// Protected by authenticateToken.
app.post('/api/chat', authenticateToken, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  // message: user text
  // history: optional array of previous messages (role/content)
  const { message, history } = req.body || {};

  // Basic validation for message
  const trimmedMessage = extractOriginalQuestion(message);
  if (!trimmedMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // If key is missing, still return a useful fallback message.
  if (!apiKey) {
    return res.json({ reply: buildFallbackChatReply(trimmedMessage), source: 'fallback' });
  }

  // Keep only last 8 valid history messages (to limit tokens/cost)
  const safeHistory = Array.isArray(history)
    ? history
        .filter(item => item && typeof item.role === 'string' && typeof item.content === 'string')
        .slice(-8)
    : [];

  try {
    // Create OpenAI client using api key
    const client = new OpenAI({ apiKey });

    // Build conversation input:
    // - system message defines assistant behavior
    // - include recent history
    // - append the new user message
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

    // Decide if fallback model is usable (only if different from main model)
    const envFallbackModel = String(OPENAI_FALLBACK_MODEL || '').trim();
    const defaultFallbackModel = 'gpt-4o-mini';
    const resolvedFallbackModel = envFallbackModel || defaultFallbackModel;
    const fallbackModel =
      resolvedFallbackModel && resolvedFallbackModel !== OPENAI_MODEL
        ? resolvedFallbackModel
        : null;

    // Helper: detect errors that indicate "model not found" / wrong model
    const isModelError = (err) => {
      const message = String(err?.error?.message || err?.message || '').toLowerCase();
      const code = String(err?.error?.code || err?.code || '').toLowerCase();
      const status = Number(err?.status || err?.error?.status || 0);
      return status === 404 || code.includes('model') || message.includes('model');
    };

    let response;

    // Try main model first
    try {
      response = await client.responses.create({
        model: OPENAI_MODEL,
        input,
      });
    } catch (error) {
      // If it's a model-related error and fallback exists -> try fallback model
      if (fallbackModel && isModelError(error)) {
        response = await client.responses.create({
          model: fallbackModel,
          input,
        });
      } else {
        // Otherwise rethrow to outer catch
        throw error;
      }
    }

    // output_text is a convenience property containing plain text output
    const reply = response.output_text || 'Sorry, I could not generate a response.';
    return res.json({ reply });
  } catch (error) {
    // Convert OpenAI error into response status/message
    const status = Number(error?.status || error?.error?.status || 500);
    const message = error?.error?.message || error?.message || 'Chat service error';

    // Detailed server-side logging
    console.error('Chat error:', {
      status,
      message,
      code: error?.error?.code || error?.code,
      type: error?.error?.type || error?.type,
    });

    // Return graceful fallback to keep chat usable even when provider fails.
    return res.json({
      reply: buildFallbackChatReply(trimmedMessage),
      source: 'fallback',
      error: process.env.NODE_ENV === 'production' ? 'Chat provider unavailable' : message
    });
  }
});

// -------------------- Bookmark toggle endpoint --------------------

// POST /api/predictions/:predictionId/bookmark
// Purpose:
// - Add bookmark: insert into bookmark table
// - Remove bookmark: delete from bookmark table
// Protected by authenticateToken.
// Also checks: user can only bookmark for themselves unless admin.
app.post('/api/predictions/:predictionId/bookmark', authenticateToken, async (req, res) => {
  // Read predictionId from URL params and convert to number
  const predictionId = Number(req.params.predictionId);

  // user_id is the target user, action is "add" or "remove"
  const { user_id: userIdFromBody, action } = req.body || {};

  // Validate predictionId
  if (!predictionId) {
    return res.status(400).json({ error: 'Invalid prediction ID' });
  }

  // requester = person making the request (from JWT)
  const requesterId = Number(req.user?.user_id);
  const requesterRole = String(req.user?.role || '').toLowerCase();
  const isAdmin = requesterRole === 'admin';

  // target user that the bookmark will be saved for
  const targetUserId = Number(userIdFromBody);

  if (!targetUserId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // If not admin, requester must equal targetUserId
  if (!isAdmin && requesterId !== targetUserId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Validate action
  const normalizedAction = String(action || '').toLowerCase();
  if (normalizedAction !== 'add' && normalizedAction !== 'remove') {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    // ---- Add bookmark ----
    if (normalizedAction === 'add') {
      const insertQuery = `
        INSERT INTO bookmark (user_id, prediction_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, prediction_id) DO NOTHING
        RETURNING bookmark_id, user_id, prediction_id, created_at
      `;

      // If already exists, DO NOTHING and rows[0] will be undefined
      const insertResult = await pool.query(insertQuery, [targetUserId, predictionId]);

      return res.json({
        status: 'added',
        bookmark: insertResult.rows[0] || null
      });
    }

    // ---- Remove bookmark ----
    const deleteQuery = `
      DELETE FROM bookmark
      WHERE user_id = $1 AND prediction_id = $2
      RETURNING bookmark_id
    `;
    const deleteResult = await pool.query(deleteQuery, [targetUserId, predictionId]);

    return res.json({
      status: 'removed',
      deleted: deleteResult.rows.length > 0
    });
  } catch (error) {
    console.error('Bookmark toggle error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------- User history endpoint --------------------

// GET /api/users/:userId/history
// Purpose:
// - Return paginated predictions history for a user
// - Only the same user OR an admin can access it
app.get('/api/users/:userId/history', authenticateToken, async (req, res) => {
  const requestedUserId = Number(req.params.userId);

  // Pagination params
  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 100);

  if (!requestedUserId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const requesterId = Number(req.user?.user_id);
  const requesterRole = String(req.user?.role || '').toLowerCase();
  const isAdmin = requesterRole === 'admin';

  // Security check: non-admin can only access their own history
  if (!isAdmin && requesterId !== requestedUserId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const offset = (page - 1) * perPage;

  try {
    // 1) Total count for pagination
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM prediction p
      JOIN image i ON p.image_id = i.image_id
      WHERE i.user_id = $1
    `;
    const countResult = await pool.query(countQuery, [requestedUserId]);
    const total = Number(countResult.rows[0]?.total || 0);

    // 2) Fetch paginated history
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
        i.uploaded_at,
        b.bookmark_id
      FROM prediction p
      JOIN image i ON p.image_id = i.image_id
      LEFT JOIN bookmark b
        ON b.prediction_id = p.prediction_id
       AND b.user_id = $1
      WHERE i.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const historyResult = await pool.query(historyQuery, [requestedUserId, perPage, offset]);

    // 3) Build absolute image URL that frontend can open
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const data = historyResult.rows.map(row => ({
      ...row,
      image_url: row.image_path ? `${baseUrl}/${row.image_path.replace(/\\/g, '/')}` : null
    }));

    // 4) Return final paginated response
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

// -------------------- Admin: list users --------------------

// GET /api/admin/users
// Purpose: admin-only paginated list of users (with role info)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 100);
  const offset = (page - 1) * perPage;

  try {
    // Count all users for pagination
    const countResult = await pool.query('SELECT COUNT(*) AS total FROM users');
    const total = Number(countResult.rows[0]?.total || 0);

    // Fetch paginated users
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

// -------------------- Admin: list images with predictions --------------------

// GET /api/admin/images
// Purpose: admin-only paginated list of images, joined with users and predictions
app.get('/api/admin/images', authenticateToken, requireAdmin, async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 100);
  const offset = (page - 1) * perPage;

  try {
    // Count images (including ones without prediction)
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM image i
      LEFT JOIN prediction p ON p.image_id = i.image_id
    `;
    const countResult = await pool.query(countQuery);
    const total = Number(countResult.rows[0]?.total || 0);

    // Fetch paginated images + user info + prediction info
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

    // Build absolute URLs for images
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

// -------------------- Admin: list reports --------------------

// GET /api/admin/reports
// Purpose: admin-only paginated list of generated reports
app.get('/api/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 100);
  const offset = (page - 1) * perPage;

  try {
    // Count reports for pagination
    const countResult = await pool.query('SELECT COUNT(*) AS total FROM report');
    const total = Number(countResult.rows[0]?.total || 0);

    // Fetch  reports joined with operator user info
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

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const data = reportsResult.rows.map((row) => ({
      ...row,
      download_link: row.download_link && row.download_link.startsWith('/')
        ? `${baseUrl}${row.download_link}`
        : row.download_link
    }));

    return res.json({
      data,
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

// -------------------- Admin: create user --------------------

// POST /api/admin/users
// Purpose: admin-only user creation with role assignment
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
  const normalizedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const passwordValue = typeof req.body?.password === 'string' ? req.body.password : '';
  const confirmValue = typeof req.body?.password_confirm === 'string' ? req.body.password_confirm : '';
  const normalizedRole = normalizeRoleName(req.body?.role || 'user');
  const statusValue = String(req.body?.status || 'ACTIVE').trim().toUpperCase();

  if (!fullName || !normalizedEmail || !passwordValue || !confirmValue) {
    return res.status(400).json({ error: 'full_name, email, password, and password_confirm are required' });
  }

  if (fullName.length < 2 || fullName.length > 120) {
    return res.status(400).json({ error: 'Full name must be between 2 and 120 characters' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  if (passwordValue !== confirmValue) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  const passwordValidationError = validatePassword(passwordValue);
  if (passwordValidationError) {
    return res.status(400).json({ error: passwordValidationError });
  }

  if (!ALLOWED_ROLES.has(normalizedRole)) {
    return res.status(400).json({ error: 'Invalid role. Use user or admin.' });
  }

  if (!ALLOWED_USER_STATUSES.has(statusValue)) {
    return res.status(400).json({ error: 'Invalid status. Use ACTIVE, INACTIVE, or SUSPENDED.' });
  }

  try {
    const emailCheckResult = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    if (emailCheckResult.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const roleId = await getRoleIdByName(normalizedRole);
    if (!roleId) {
      return res.status(500).json({ error: 'Role not found' });
    }

    const passwordHash = await bcrypt.hash(passwordValue, 10);

    const insertQuery = `
      INSERT INTO users (full_name, email, password_hash, role_id, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING user_id, full_name, email, status, created_at, updated_at, last_login
    `;

    const insertResult = await pool.query(insertQuery, [fullName, normalizedEmail, passwordHash, roleId, statusValue]);
    const createdUser = insertResult.rows[0];

    return res.status(201).json({
      user: {
        ...createdUser,
        role: normalizedRole
      }
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------- Admin: update user --------------------

// PATCH /api/admin/users/:userId
// Purpose: admin-only user updates (name/email/role/status/password)
app.patch('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const updates = [];
  const values = [];
  let index = 1;

  try {
    const existingResult = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (typeof req.body?.full_name === 'string') {
      const fullName = req.body.full_name.trim();
      if (fullName.length < 2 || fullName.length > 120) {
        return res.status(400).json({ error: 'Full name must be between 2 and 120 characters' });
      }
      updates.push(`full_name = $${index++}`);
      values.push(fullName);
    }

    if (typeof req.body?.email === 'string') {
      const emailValue = req.body.email.trim().toLowerCase();
      if (!isValidEmail(emailValue)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }

      const emailCheckResult = await pool.query(
        'SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) AND user_id <> $2',
        [emailValue, userId]
      );
      if (emailCheckResult.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      updates.push(`email = $${index++}`);
      values.push(emailValue);
    }

    if (typeof req.body?.role === 'string') {
      const normalizedRole = normalizeRoleName(req.body.role);
      if (!ALLOWED_ROLES.has(normalizedRole)) {
        return res.status(400).json({ error: 'Invalid role. Use user or admin.' });
      }

      const roleId = await getRoleIdByName(normalizedRole);
      if (!roleId) {
        return res.status(500).json({ error: 'Role not found' });
      }

      updates.push(`role_id = $${index++}`);
      values.push(roleId);
    }

    if (typeof req.body?.status === 'string') {
      const statusValue = req.body.status.trim().toUpperCase();
      if (!ALLOWED_USER_STATUSES.has(statusValue)) {
        return res.status(400).json({ error: 'Invalid status. Use ACTIVE, INACTIVE, or SUSPENDED.' });
      }
      updates.push(`status = $${index++}`);
      values.push(statusValue);
    }

    if (typeof req.body?.password === 'string' && req.body.password.length > 0) {
      const passwordValidationError = validatePassword(req.body.password);
      if (passwordValidationError) {
        return res.status(400).json({ error: passwordValidationError });
      }
      const passwordHash = await bcrypt.hash(req.body.password, 10);
      updates.push(`password_hash = $${index++}`);
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    const updateQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE user_id = $${index}
    `;

    await pool.query(updateQuery, values);

    const userQuery = `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.status,
        u.created_at,
        u.updated_at,
        u.last_login,
        r.name AS role
      FROM users u
      JOIN role r ON u.role_id = r.role_id
      WHERE u.user_id = $1
    `;

    const updatedResult = await pool.query(userQuery, [userId]);
    return res.json({ user: updatedResult.rows[0] });
  } catch (error) {
    console.error('Admin update user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------- Admin: delete user --------------------

// DELETE /api/admin/users/:userId
// Purpose: admin-only user deletion
app.delete('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  if (Number(req.user?.user_id) === userId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    const deleteResult = await pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id, full_name, email',
      [userId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      status: 'deleted',
      user: deleteResult.rows[0]
    });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------- Admin: generate report --------------------

// POST /api/admin/reports/generate
// Purpose: admin-only report generation (CSV or JSON), persisted in report table.
app.get('/api/admin/reports/generate', authenticateToken, requireAdmin, (_req, res) => {
  return res.status(405).json({
    error: 'Method not allowed. Use POST /api/admin/reports/generate with { report_type, format }.'
  });
});

app.post('/api/admin/reports/generate', authenticateToken, requireAdmin, async (req, res) => {
  const reportType = String(req.body?.report_type || 'images').trim().toLowerCase();
  const format = String(req.body?.format || 'csv').trim().toLowerCase();

  if (!['users', 'images', 'predictions'].includes(reportType)) {
    return res.status(400).json({ error: 'Invalid report_type. Use users, images, or predictions.' });
  }

  if (!['csv', 'json'].includes(format)) {
    return res.status(400).json({ error: 'Invalid format. Use csv or json.' });
  }

  try {
    let reportRows = [];

    if (reportType === 'users') {
      const result = await pool.query(`
        SELECT
          u.user_id,
          u.full_name,
          u.email,
          r.name AS role,
          u.status,
          u.created_at,
          u.last_login
        FROM users u
        JOIN role r ON r.role_id = u.role_id
        ORDER BY u.created_at DESC
      `);
      reportRows = result.rows;
    }

    if (reportType === 'images') {
      const result = await pool.query(`
        SELECT
          i.image_id,
          i.user_id,
          u.full_name,
          u.email,
          i.image_path,
          i.uploaded_at,
          p.prediction_id,
          p.label,
          p.confidence,
          p.created_at AS predicted_at
        FROM image i
        JOIN users u ON u.user_id = i.user_id
        LEFT JOIN prediction p ON p.image_id = i.image_id
        ORDER BY i.uploaded_at DESC
      `);
      reportRows = result.rows;
    }

    if (reportType === 'predictions') {
      const result = await pool.query(`
        SELECT
          p.prediction_id,
          p.image_id,
          i.user_id,
          u.full_name,
          u.email,
          p.label,
          p.confidence,
          p.created_at,
          p.updated_at
        FROM prediction p
        JOIN image i ON i.image_id = p.image_id
        JOIN users u ON u.user_id = i.user_id
        ORDER BY p.created_at DESC
      `);
      reportRows = result.rows;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = format === 'csv' ? 'csv' : 'json';
    const filename = `${reportType}-report-${timestamp}.${extension}`;
    const filePath = path.join(reportsDir, filename);

    if (format === 'csv') {
      fs.writeFileSync(filePath, toCsv(reportRows), 'utf8');
    } else {
      fs.writeFileSync(filePath, JSON.stringify(reportRows, null, 2), 'utf8');
    }

    const downloadLink = `/reports/${filename}`;

    const insertReportQuery = `
      INSERT INTO report (operator_id, report_type, format, download_link)
      VALUES ($1, $2, $3, $4)
      RETURNING report_id, operator_id, report_type, format, download_link, created_at
    `;

    const insertResult = await pool.query(insertReportQuery, [
      req.user.user_id,
      reportType,
      format,
      downloadLink
    ]);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const report = {
      ...insertResult.rows[0],
      download_link: `${baseUrl}${downloadLink}`
    };

    return res.status(201).json({ report });
  } catch (error) {
    console.error('Generate report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------- Start server --------------------

// app.listen starts Express HTTP server on PORT
app.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
});

