const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const cors = require('cors');
const multer = require('multer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Base URL for your FastAPI/Python prediction service
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

// Ollama config for local chat endpoint
const OLLAMA_BASE_URL = String(process.env.OLLAMA_BASE_URL || 'http://localhost:11434').trim().replace(/\/$/, '');
const OLLAMA_MODEL = String(process.env.OLLAMA_MODEL || 'llama3').trim();
const OLLAMA_FALLBACK_MODEL = String(process.env.OLLAMA_FALLBACK_MODEL || '').trim();
const DEFAULT_LOCAL_PYTHON_SERVICE_URL = 'http://127.0.0.1:8000';
const PASSWORD_RESET_TOKEN_PREFIX = 'pwreset:';
const PASSWORD_RESET_HASH_ALGO = 'sha256';
const PASSWORD_RESET_EXPIRY_MINUTES = Math.min(
  Math.max(Number(process.env.PASSWORD_RESET_EXPIRY_MINUTES) || 30, 5),
  180
);
const SMTP_URL = String(process.env.SMTP_URL || '').trim();
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Math.max(Number(process.env.SMTP_PORT) || 587, 1);
const SMTP_SECURE = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.SMTP_SECURE || '').trim().toLowerCase()
);
const SMTP_CONNECTION_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.SMTP_CONNECTION_TIMEOUT_MS) || 15000, 1000),
  300000
);
const SMTP_GREETING_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.SMTP_GREETING_TIMEOUT_MS) || 15000, 1000),
  300000
);
const SMTP_SOCKET_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 20000, 1000),
  300000
);
const SMTP_DNS_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.SMTP_DNS_TIMEOUT_MS) || 2000, 1000),
  300000
);
const SMTP_SEND_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.SMTP_SEND_TIMEOUT_MS) || 15000, 1000),
  300000
);
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const SMTP_FROM_NAME = String(process.env.SMTP_FROM_NAME || 'VisionQC').trim();
const SMTP_FROM_EMAIL = String(process.env.SMTP_FROM_EMAIL || '').trim();
const SMTP_SUBJECT = String(process.env.SMTP_SUBJECT || 'VisionQC Password Reset').trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const RESEND_FROM_EMAIL = String(process.env.RESEND_FROM_EMAIL || '').trim().toLowerCase();
const RESEND_FROM_NAME = String(process.env.RESEND_FROM_NAME || SMTP_FROM_NAME || 'VisionQC').trim();
const RESEND_API_BASE_URL = String(process.env.RESEND_API_BASE_URL || 'https://api.resend.com').trim().replace(/\/$/, '');
const RESEND_SEND_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.RESEND_SEND_TIMEOUT_MS) || 15000, 1000),
  300000
);
const GRAPH_TENANT_ID = String(process.env.GRAPH_TENANT_ID || '').trim();
const GRAPH_CLIENT_ID = String(process.env.GRAPH_CLIENT_ID || '').trim();
const GRAPH_CLIENT_SECRET = String(process.env.GRAPH_CLIENT_SECRET || '').trim();
const GRAPH_SENDER_EMAIL = String(process.env.GRAPH_SENDER_EMAIL || '').trim().toLowerCase();
const GRAPH_API_BASE_URL = String(process.env.GRAPH_API_BASE_URL || 'https://graph.microsoft.com/v1.0').trim().replace(/\/$/, '');
const PASSWORD_RESET_DELIVERY_MODE = String(process.env.PASSWORD_RESET_DELIVERY_MODE || 'auto').trim().toLowerCase();
const RESET_PASSWORD_URL = String(process.env.RESET_PASSWORD_URL || 'http://localhost:5173/reset-password').trim();
const EXPOSE_RESET_TOKEN_IN_RESPONSE = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.EXPOSE_RESET_TOKEN_IN_RESPONSE ?? (process.env.NODE_ENV !== 'production')).trim().toLowerCase()
);

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

const isCodingSpecializedModel = (modelName) =>
  /(deepseek-coder|codellama|coder|codeqwen|starcoder)/i.test(String(modelName || '').trim());

const looksOffDomainChatReply = (replyText) => {
  const text = String(replyText || '').trim();
  if (!text) return true;

  const offDomainSignals =
    /(programming assistant|deepseek|computer science|software engineering|software development|coding questions|not my area of expertise|outside my (domain|expertise))/i.test(
      text
    );
  const plantDomainSignals =
    /(plant|leaf|leaves|crop|disease|fung|bacter|blight|mildew|watering|soil|prun|spray|treat|pest|orchard|fruit tree)/i.test(
      text
    );

  return offDomainSignals && !plantDomainSignals;
};

const buildPlantDomainRecoveryReply = (message, predictionContext = null) => {
  const normalizedMessage = String(message || '').trim();
  const label = String(predictionContext?.label || '').trim();

  const line1 = label
    ? `1: Your image context suggests "${label}", so isolate the plant and remove the most affected leaves.`
    : '1: Isolate the plant and remove the most affected leaves to limit spread.';
  const line2 =
    '2: Keep foliage dry, water at soil level only, and improve airflow around the plant.';
  const line3 = normalizedMessage
    ? `3: Upload a clearer close-up in VisionQC and follow crop-specific treatment guidance for: "${normalizedMessage.slice(0, 90)}${normalizedMessage.length > 90 ? '...' : ''}".`
    : '3: Upload a clearer close-up in VisionQC to get a more accurate crop-specific treatment plan.';

  return [line1, line2, line3].join('\n');
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

const normalizeActionLine = (value) =>
  String(value || '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[\s\-*•]+/, '')
    .replace(/^\d+\s*[:.)-]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:;,.]+$/, '');

const extractSectionHeadings = (replyText) => {
  const text = String(replyText || '');
  const boldMatches = [...text.matchAll(/\*\*([^*\n:]{3,100}):\*\*/g)].map((match) => match[1]);
  const plainMatches = [...text.matchAll(/(?:^|\n)\s*([A-Z][^:\n]{3,100}):\s*(?=\n|$)/gm)].map((match) => match[1]);
  const rawCandidates = [...boldMatches, ...plainMatches];

  return rawCandidates
    .map((candidate) => normalizeActionLine(candidate))
    .filter((candidate) => candidate.length > 3)
    .filter((candidate) => !/^(to|tips?|steps?|instructions?|remember|note)\b/i.test(candidate));
};

const extractNumberedSteps = (replyText) => {
  const text = String(replyText || '')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return [];

  const matches = [
    ...text.matchAll(/(?:^|\s)\d+\s*[:.)-]\s*(.+?)(?=(?:\s+\d+\s*[:.)-]\s)|$)/g)
  ];

  return matches
    .map((match) => normalizeActionLine(match[1]))
    .filter((candidate) => candidate.length > 3);
};

const extractSentences = (replyText) => {
  const normalized = String(replyText || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  return (normalized.match(/[^.!?]+[.!?]?/g) || [])
    .map((sentence) => normalizeActionLine(sentence))
    .filter((candidate) => candidate.length > 10);
};

const formatThreeLineRecommendations = (replyText) => {
  const candidates = [
    ...extractSectionHeadings(replyText),
    ...extractNumberedSteps(replyText),
    ...extractSentences(replyText)
  ];

  const unique = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const normalized = normalizeActionLine(candidate);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
    if (unique.length === 3) break;
  }

  const fallbackLines = [
    'Remove the most affected leaves and keep the area clean',
    'Water at the base and avoid wetting foliage',
    'Apply a crop-appropriate treatment and monitor progress'
  ];

  while (unique.length < 3) {
    unique.push(fallbackLines[unique.length]);
  }

  return unique
    .slice(0, 3)
    .map((line, index) => `${index + 1}: ${line}`)
    .join('\n');
};

const buildOllamaPrompt = (history, userMessage, imageContext = '') => {
  const systemPrompt =
    'You are VisionQC, an AI assistant for plant disease detection. ' +
    'Provide concise, practical guidance. If unsure, ask for a clear photo and suggest using the Upload screen for analysis. ' +
    'Avoid medical claims; this is general plant-care advice. ' +
    'When giving advice or recommendations, always format the final answer as exactly 3 numbered lines in this style: ' +
    '"1: ...", "2: ...", "3: ...". Do not use bullet points, markdown headings, or extra sections.';

  const historyText = (Array.isArray(history) ? history : [])
    .map((item) => {
      const role = item.role === 'assistant' ? 'Assistant' : 'User';
      const content = String(item.content || '').trim();
      return content ? `${role}: ${content}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const normalizedImageContext = String(imageContext || '').trim();

  return [
    `System: ${systemPrompt}`,
    historyText,
    normalizedImageContext ? `Image analysis context:\n${normalizedImageContext}` : '',
    `User: ${String(userMessage || '').trim()}`,
    'Assistant:'
  ]
    .filter(Boolean)
    .join('\n\n');
};

const generateWithOllama = async ({ model, prompt }) => {
  const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false
    })
  });

  if (!ollamaResponse.ok) {
    const errorBody = await ollamaResponse.text();
    const error = new Error(`Ollama error ${ollamaResponse.status}: ${errorBody}`);
    error.ollamaStatus = ollamaResponse.status;
    error.ollamaBody = errorBody;
    throw error;
  }

  const data = await ollamaResponse.json();
  return String(data?.response || '').trim() || 'Sorry, I could not generate a response.';
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

const parseChatHistoryInput = (historyInput) => {
  let parsed = historyInput;

  if (typeof historyInput === 'string') {
    try {
      parsed = JSON.parse(historyInput);
    } catch (_error) {
      parsed = [];
    }
  }

  return Array.isArray(parsed)
    ? parsed
        .filter((item) => item && typeof item.role === 'string' && typeof item.content === 'string')
        .slice(-8)
    : [];
};

const asPositiveIntegerOrNull = (value) => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return null;
};

const formatConfidencePercent = (confidence) => {
  const parsed = Number(confidence);
  if (!Number.isFinite(parsed)) {
    return 'N/A';
  }
  return `${Math.round(parsed * 100)}%`;
};

const buildImageAnalysisContext = (prediction, cropHint = '') => {
  if (!prediction || typeof prediction !== 'object') {
    return '';
  }

  const lines = [
    `Predicted label: ${String(prediction.label || 'unknown')}`,
    `Confidence: ${formatConfidencePercent(prediction.confidence)}`
  ];
  const normalizedSuggestion = String(prediction.suggested_sc || '').trim();
  if (normalizedSuggestion) {
    lines.push(`Suggested treatment: ${normalizedSuggestion}`);
  }
  if (cropHint) {
    lines.push(`User crop hint: ${cropHint}`);
  }

  return lines.join('\n');
};

const buildPredictionServiceUrls = () =>
  [normalizeBaseUrl(PYTHON_SERVICE_URL), DEFAULT_LOCAL_PYTHON_SERVICE_URL].filter(
    (url, index, self) => Boolean(url) && self.indexOf(url) === index
  );

const forwardImageToPredictionService = async (file, cropHint = '') => {
  const predictionServiceUrls = buildPredictionServiceUrls();
  const normalizedCropHint = String(cropHint || '').trim();
  let lastServiceError = null;

  for (const serviceBaseUrl of predictionServiceUrls) {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(file.path), {
      filename: file.originalname || path.basename(file.path),
      contentType: file.mimetype || 'application/octet-stream'
    });
    if (normalizedCropHint) {
      formData.append('crop_hint', normalizedCropHint);
    }

    try {
      const response = await fetch(`${serviceBaseUrl}/predict`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
        timeout: 15000
      });

      if (!response.ok) {
        const text = await response.text();
        lastServiceError = `HTTP ${response.status} from ${serviceBaseUrl}/predict`;
        console.error('FastAPI error:', {
          serviceBaseUrl,
          status: response.status,
          body: text
        });
        continue;
      }

      return await response.json();
    } catch (serviceError) {
      lastServiceError = serviceError?.message || 'Prediction service unreachable';
      console.error('FastAPI request failed:', {
        serviceBaseUrl,
        error: lastServiceError
      });
    }
  }

  const normalizedError = String(lastServiceError || '');
  const serviceHelp = normalizedError.includes('ECONNREFUSED')
    ? 'FastAPI service is not running. Start it with: .\\.venv\\Scripts\\python.exe -m uvicorn backend.fastapi_service:app --host 127.0.0.1 --port 8000 --reload'
    : null;
  const error = new Error(lastServiceError || 'Failed to reach prediction service');
  error.status = 500;
  error.error = 'Prediction service error';
  error.detail = lastServiceError || 'Failed to reach prediction service';
  error.hint = serviceHelp;
  throw error;
};

const persistPredictionForUser = async (userId, filePath, predictionData) => {
  const imagePath = path.relative(__dirname, filePath).replace(/\\/g, '/');

  const insertImageQuery = `
    INSERT INTO image (user_id, image_path)
    VALUES ($1, $2)
    RETURNING image_id
  `;
  const imageResult = await pool.query(insertImageQuery, [userId, imagePath]);
  const imageId = imageResult.rows[0].image_id;

  const insertPredictionQuery = `
    INSERT INTO prediction (image_id, label, confidence, heatmap_url, suggested_sc)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING prediction_id, image_id, label, confidence, heatmap_url, suggested_sc, created_at, updated_at
  `;
  const predictionResult = await pool.query(insertPredictionQuery, [
    imageId,
    predictionData.label,
    predictionData.confidence,
    predictionData.heatmap_url || null,
    predictionData.suggested_sc || buildSuggestionFallback(predictionData.label, predictionData.confidence)
  ]);

  return predictionResult.rows[0];
};

const persistImageForUser = async (userId, filePath) => {
  const imagePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
  const insertImageQuery = `
    INSERT INTO image (user_id, image_path)
    VALUES ($1, $2)
    RETURNING image_id, user_id, image_path, uploaded_at, created_at, updated_at
  `;
  const imageResult = await pool.query(insertImageQuery, [userId, imagePath]);
  return imageResult.rows[0];
};

const fetchPredictionDetailsById = async (predictionId, requesterId, isAdmin) => {
  const predictionQuery = `
    SELECT
      p.prediction_id,
      p.image_id,
      p.label,
      p.confidence,
      p.heatmap_url,
      p.suggested_sc,
      p.created_at,
      p.updated_at,
      i.user_id AS owner_user_id,
      i.image_path,
      i.uploaded_at
    FROM prediction p
    JOIN image i ON i.image_id = p.image_id
    WHERE p.prediction_id = $1
      AND ($2::boolean = TRUE OR i.user_id = $3)
    LIMIT 1
  `;
  const predictionResult = await pool.query(predictionQuery, [predictionId, isAdmin, requesterId]);
  return predictionResult.rows[0] || null;
};

const analyzeUploadedImageForUser = async ({ file, userId, cropHint = '' }) => {
  if (!file) {
    const error = new Error('Image file is required');
    error.status = 400;
    error.error = 'Image file is required';
    throw error;
  }

  const normalizedCropHint = String(cropHint || '').trim();

  console.log('Analyze file info', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    cropHint: normalizedCropHint || null
  });

  console.log('Forwarding to Python service', {
    url: `${PYTHON_SERVICE_URL}/predict`,
    cropHint: normalizedCropHint || null
  });

  const predictionPayload = await forwardImageToPredictionService(file, normalizedCropHint);
  const predictionRow = await persistPredictionForUser(userId, file.path, predictionPayload);
  const prediction = {
    ...predictionPayload,
    ...predictionRow
  };

  return {
    prediction,
    predictionPayload
  };
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
const uploadLegacyImage = upload.fields([
  { name: 'image_file', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]);

// -------------------- Database connection --------------------

// Create a PostgreSQL connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const ensureSessionSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session (
      session_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      is_valid BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_session_token_validity ON session(token, is_valid, expires_at)`);
};

const ensureRetrainingQueueSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS retraining_queue (
      queue_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      prediction_id INT NOT NULL,
      flagged_by_user_id INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      confidence_score DECIMAL(6,4) NOT NULL,
      reason VARCHAR(255) NULL,
      admin_id INT NULL,
      admin_notes TEXT NULL,
      reviewed_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_rq_prediction FOREIGN KEY (prediction_id) REFERENCES prediction(prediction_id) ON DELETE CASCADE,
      CONSTRAINT fk_rq_user FOREIGN KEY (flagged_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_rq_admin FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE SET NULL
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_retraining_queue_status ON retraining_queue(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_retraining_queue_prediction_id ON retraining_queue(prediction_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_retraining_queue_user_id ON retraining_queue(flagged_by_user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_retraining_queue_created_at ON retraining_queue(created_at DESC)`);
};

const ensureRoleSeed = async () => {
  const roleNames = ['user', 'operator', 'annotator', 'admin'];
  for (const roleName of roleNames) {
    await pool.query(
      `
      INSERT INTO role (name)
      SELECT $1::VARCHAR(30)
      WHERE NOT EXISTS (
        SELECT 1
        FROM role
        WHERE LOWER(name) = LOWER($1::VARCHAR(30))
      )
      `,
      [roleName]
    );
  }
};

const ensureAnnotatorCorrectionSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS annotator_correction (
      correction_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      queue_id INT NULL,
      prediction_id INT NOT NULL,
      annotator_id INT NOT NULL,
      corrected_label VARCHAR(120) NOT NULL,
      notes TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_ac_queue FOREIGN KEY (queue_id) REFERENCES retraining_queue(queue_id) ON DELETE SET NULL,
      CONSTRAINT fk_ac_prediction FOREIGN KEY (prediction_id) REFERENCES prediction(prediction_id) ON DELETE CASCADE,
      CONSTRAINT fk_ac_annotator FOREIGN KEY (annotator_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT uq_ac_prediction_annotator UNIQUE (prediction_id, annotator_id)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ac_queue_id ON annotator_correction(queue_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ac_prediction_id ON annotator_correction(prediction_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ac_annotator_id ON annotator_correction(annotator_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ac_updated_at ON annotator_correction(updated_at DESC)`);
};

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

const verifyStartupSchemas = async () => {
  try {
    await ensureSessionSchema();
    console.log('Session schema verified');

    await ensureRetrainingQueueSchema();
    console.log('Retraining queue schema verified');

    await ensureRoleSeed();
    console.log('Role seed verified');

    await ensureAnnotatorCorrectionSchema();
    console.log('Annotator correction schema verified');
  } catch (schemaError) {
    console.error('Failed to verify startup schemas:', schemaError);
  }
};

verifyStartupSchemas();

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

// Purpose: allow annotator and admin roles.
const requireAnnotatorOrAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'annotator' && role !== 'admin') {
    return res.status(403).json({ error: 'Annotator access required' });
  }
  return next();
};

const normalizeRoleName = (roleValue) => String(roleValue || '').trim().toLowerCase();
const ALLOWED_ROLES = new Set(['user', 'operator', 'annotator', 'admin']);
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

const normalizePasswordResetTokenInput = (tokenValue) => {
  const rawToken = String(tokenValue || '').trim();
  if (!rawToken) return '';
  if (rawToken.startsWith(PASSWORD_RESET_TOKEN_PREFIX)) {
    return rawToken.slice(PASSWORD_RESET_TOKEN_PREFIX.length).trim();
  }
  return rawToken;
};

const generatePasswordResetToken = () => crypto.randomBytes(32).toString('hex');

const buildStoredPasswordResetToken = (tokenValue) =>
  `${PASSWORD_RESET_TOKEN_PREFIX}${crypto
    .createHash(PASSWORD_RESET_HASH_ALGO)
    .update(String(tokenValue || ''))
    .digest('hex')}`;

const getPasswordResetTokenCandidates = (tokenValue) => {
  const rawToken = String(tokenValue || '').trim();
  const normalizedToken = normalizePasswordResetTokenInput(rawToken);
  if (!normalizedToken) return [];

  const candidates = [buildStoredPasswordResetToken(normalizedToken)];

  // Keep backward compatibility with already-issued plaintext tokens.
  if (rawToken) {
    candidates.push(rawToken);
  }
  if (normalizedToken !== rawToken) {
    candidates.push(normalizedToken);
  }

  return [...new Set(candidates)];
};

const findValidPasswordResetSession = async (tokenValue) => {
  const tokenCandidates = getPasswordResetTokenCandidates(tokenValue);
  if (tokenCandidates.length === 0) {
    return null;
  }

  const sessionResult = await pool.query(
    `
      SELECT session_id, user_id, expires_at
      FROM session
      WHERE token = ANY($1::varchar[])
        AND is_valid = TRUE
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tokenCandidates]
  );

  return sessionResult.rows[0] || null;
};

const issuePasswordResetToken = async (userId) => {
  const tokenValue = generatePasswordResetToken();
  const storedToken = buildStoredPasswordResetToken(tokenValue);
  const expiryInterval = `${PASSWORD_RESET_EXPIRY_MINUTES} minutes`;

  await pool.query(
    `
      UPDATE session
      SET is_valid = FALSE
      WHERE user_id = $1
        AND token LIKE $2
        AND is_valid = TRUE
    `,
    [userId, `${PASSWORD_RESET_TOKEN_PREFIX}%`]
  );

  const insertResult = await pool.query(
    `
      INSERT INTO session (user_id, token, expires_at, is_valid)
      VALUES ($1, $2, NOW() + $3::interval, TRUE)
      RETURNING expires_at
    `,
    [userId, storedToken, expiryInterval]
  );

  return {
    token: tokenValue,
    expires_at: insertResult.rows[0].expires_at
  };
};

const buildPasswordResetUrl = (tokenValue, frontendOrigin = '') => {
  const safeToken = String(tokenValue || '').trim();

  const frontendOriginValue = String(frontendOrigin || '').trim();
  let resetBaseUrl = RESET_PASSWORD_URL;
  if (frontendOriginValue) {
    try {
      const originUrl = new URL(frontendOriginValue);
      originUrl.pathname = '/reset-password';
      originUrl.search = '';
      originUrl.hash = '';
      resetBaseUrl = originUrl.toString();
    } catch (_error) {
      // Ignore invalid origin header and fallback to configured RESET_PASSWORD_URL.
    }
  }

  if (!safeToken) return resetBaseUrl;

  try {
    const url = new URL(resetBaseUrl);
    url.searchParams.set('token', safeToken);
    return url.toString();
  } catch (_error) {
    const separator = resetBaseUrl.includes('?') ? '&' : '?';
    return `${resetBaseUrl}${separator}token=${encodeURIComponent(safeToken)}`;
  }
};

let smtpTransporter = null;
let graphAccessTokenCache = {
  accessToken: '',
  expiresAt: 0
};

const buildPasswordResetEmailPayload = ({ resetUrl, expiresAt, fullName = '' }) => {
  const recipientName = String(fullName || '').trim();
  const displayName = recipientName || 'there';
  const expiryIso = new Date(expiresAt).toISOString();
  const subject = SMTP_SUBJECT;
  const textBody = [
    `Hello ${displayName},`,
    '',
    'We received a request to reset your VisionQC password.',
    `Reset link: ${resetUrl}`,
    `Expires at: ${expiryIso}`,
    '',
    'If you did not request this, please ignore this email.'
  ].join('\n');
  const htmlBody = `
    <p>Hello ${displayName},</p>
    <p>We received a request to reset your VisionQC password.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>If the button does not open, use this URL:</p>
    <p>${resetUrl}</p>
    <p>This link expires at ${expiryIso}.</p>
    <p>If you did not request this, please ignore this email.</p>
  `;

  return {
    subject,
    textBody,
    htmlBody
  };
};

const withPromiseTimeout = (promise, timeoutMs, timeoutLabel) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${timeoutLabel} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const getSmtpTransporter = () => {
  if (smtpTransporter) {
    return smtpTransporter;
  }

  if (SMTP_URL) {
    smtpTransporter = nodemailer.createTransport(SMTP_URL, {
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
      dnsTimeout: SMTP_DNS_TIMEOUT_MS
    });
    return smtpTransporter;
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    dnsTimeout: SMTP_DNS_TIMEOUT_MS,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  return smtpTransporter;
};

const sendPasswordResetEmailViaSmtp = async ({ email, resetUrl, expiresAt, fullName = '' }) => {
  if (!SMTP_FROM_EMAIL) {
    return {
      sent: false,
      reason: 'missing_from_email'
    };
  }

  const transporter = getSmtpTransporter();
  if (!transporter) {
    return {
      sent: false,
      reason: 'smtp_not_configured'
    };
  }

  const recipientEmail = String(email || '').trim().toLowerCase();
  const { subject, textBody, htmlBody } = buildPasswordResetEmailPayload({
    resetUrl,
    expiresAt,
    fullName
  });

  try {
    const result = await withPromiseTimeout(
      transporter.sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to: recipientEmail,
        subject,
        text: textBody,
        html: htmlBody
      }),
      SMTP_SEND_TIMEOUT_MS,
      'SMTP send'
    );
    if (result?.messageId) {
      return {
        sent: true
      };
    }

    return {
      sent: false,
      reason: 'smtp_rejected',
      provider_message: 'SMTP provider did not return a message id'
    };
  } catch (error) {
    const errorMessage = String(error?.message || 'Failed to send SMTP email');
    const isTimeout = /timed out/i.test(errorMessage);
    return {
      sent: false,
      reason: isTimeout ? 'smtp_send_timeout' : 'smtp_send_failed',
      provider_message: errorMessage
    };
  }
};

const isGraphEmailConfigured = () =>
  Boolean(GRAPH_TENANT_ID && GRAPH_CLIENT_ID && GRAPH_CLIENT_SECRET && GRAPH_SENDER_EMAIL);

const getMicrosoftGraphAccessToken = async () => {
  if (!isGraphEmailConfigured()) {
    return {
      accessToken: '',
      error: {
        reason: 'graph_not_configured'
      }
    };
  }

  if (
    graphAccessTokenCache.accessToken &&
    graphAccessTokenCache.expiresAt > Date.now() + 30 * 1000
  ) {
    return {
      accessToken: graphAccessTokenCache.accessToken
    };
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(
    GRAPH_TENANT_ID
  )}/oauth2/v2.0/token`;
  const tokenRequestBody = new URLSearchParams({
    client_id: GRAPH_CLIENT_ID,
    client_secret: GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  try {
    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenRequestBody.toString()
    });

    const rawTokenBody = await tokenResponse.text().catch(() => '');
    let tokenPayload = {};
    try {
      tokenPayload = rawTokenBody ? JSON.parse(rawTokenBody) : {};
    } catch (_error) {
      tokenPayload = {};
    }

    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      return {
        accessToken: '',
        error: {
          reason: 'graph_token_request_failed',
          provider_status: tokenResponse.status,
          provider_message:
            tokenPayload?.error_description ||
            tokenPayload?.error?.message ||
            tokenResponse.statusText ||
            rawTokenBody ||
            'Unable to acquire Microsoft Graph access token'
        }
      };
    }

    const expiresInSeconds = Number(tokenPayload.expires_in || 3600);
    graphAccessTokenCache = {
      accessToken: tokenPayload.access_token,
      expiresAt: Date.now() + Math.max(expiresInSeconds - 60, 60) * 1000
    };

    return {
      accessToken: graphAccessTokenCache.accessToken
    };
  } catch (error) {
    return {
      accessToken: '',
      error: {
        reason: 'graph_token_request_failed',
        provider_message: error?.message || 'Microsoft Graph token request failed'
      }
    };
  }
};

const sendPasswordResetEmailViaGraph = async ({ email, resetUrl, expiresAt, fullName = '' }) => {
  if (!isGraphEmailConfigured()) {
    return {
      sent: false,
      reason: 'graph_not_configured'
    };
  }

  const recipientEmail = String(email || '').trim().toLowerCase();
  const { subject, htmlBody } = buildPasswordResetEmailPayload({
    resetUrl,
    expiresAt,
    fullName
  });

  const tokenResult = await getMicrosoftGraphAccessToken();
  if (!tokenResult.accessToken) {
    return {
      sent: false,
      reason: tokenResult.error?.reason || 'graph_token_request_failed',
      provider_status: tokenResult.error?.provider_status,
      provider_message: tokenResult.error?.provider_message
    };
  }

  const graphEndpoint = `${GRAPH_API_BASE_URL}/users/${encodeURIComponent(GRAPH_SENDER_EMAIL)}/sendMail`;
  const graphPayload = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlBody
      },
      toRecipients: [
        {
          emailAddress: {
            address: recipientEmail
          }
        }
      ]
    },
    saveToSentItems: false
  };

  try {
    const graphResponse = await fetch(graphEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphPayload)
    });

    if (graphResponse.status === 202) {
      return {
        sent: true
      };
    }

    const rawGraphBody = await graphResponse.text().catch(() => '');
    let graphData = {};
    try {
      graphData = rawGraphBody ? JSON.parse(rawGraphBody) : {};
    } catch (_error) {
      graphData = {};
    }

    return {
      sent: false,
      reason: 'graph_send_failed',
      provider_status: graphResponse.status,
      provider_message:
        graphData?.error?.message ||
        graphResponse.statusText ||
        rawGraphBody ||
        'Microsoft Graph sendMail request failed'
    };
  } catch (error) {
    return {
      sent: false,
      reason: 'graph_send_failed',
      provider_message: error?.message || 'Microsoft Graph sendMail request failed'
    };
  }
};

const isResendConfigured = () => Boolean(RESEND_API_KEY && RESEND_FROM_EMAIL);

const sendPasswordResetEmailViaResend = async ({ email, resetUrl, expiresAt, fullName = '' }) => {
  if (!isResendConfigured()) {
    return {
      sent: false,
      reason: 'resend_not_configured'
    };
  }

  const recipientEmail = String(email || '').trim().toLowerCase();
  const { subject, textBody, htmlBody } = buildPasswordResetEmailPayload({
    resetUrl,
    expiresAt,
    fullName
  });
  const fromValue = `"${RESEND_FROM_NAME}" <${RESEND_FROM_EMAIL}>`;
  const resendEndpoint = `${RESEND_API_BASE_URL}/emails`;

  try {
    const resendResponse = await withPromiseTimeout(
      fetch(resendEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'VisionQC/1.0'
        },
        body: JSON.stringify({
          from: fromValue,
          to: [recipientEmail],
          subject,
          html: htmlBody,
          text: textBody
        })
      }),
      RESEND_SEND_TIMEOUT_MS,
      'Resend send'
    );

    const rawBody = await resendResponse.text().catch(() => '');
    let parsedBody = {};
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch (_error) {
      parsedBody = {};
    }

    if (!resendResponse.ok) {
      return {
        sent: false,
        reason: 'resend_send_failed',
        provider_status: resendResponse.status,
        provider_message:
          parsedBody?.message ||
          parsedBody?.error ||
          resendResponse.statusText ||
          rawBody ||
          'Resend send request failed'
      };
    }

    if (!parsedBody?.id) {
      return {
        sent: false,
        reason: 'resend_rejected',
        provider_status: resendResponse.status,
        provider_message: 'Resend did not return a message id'
      };
    }

    return {
      sent: true
    };
  } catch (error) {
    const errorMessage = String(error?.message || 'Resend send failed');
    const isTimeout = /timed out/i.test(errorMessage);
    return {
      sent: false,
      reason: isTimeout ? 'resend_send_timeout' : 'resend_send_failed',
      provider_message: errorMessage
    };
  }
};

const sendPasswordResetEmail = async ({ email, resetUrl, expiresAt, fullName = '' }) => {
  const payload = { email, resetUrl, expiresAt, fullName };
  const mode = PASSWORD_RESET_DELIVERY_MODE;

  if (mode === 'resend') {
    return sendPasswordResetEmailViaResend(payload);
  }

  if (mode === 'graph') {
    return sendPasswordResetEmailViaGraph(payload);
  }

  if (mode === 'smtp') {
    return sendPasswordResetEmailViaSmtp(payload);
  }

  // auto mode: try Resend first, then Graph, then fallback to SMTP
  const resendDelivery = await sendPasswordResetEmailViaResend(payload);
  if (resendDelivery.sent) {
    return {
      ...resendDelivery,
      provider: 'resend'
    };
  }

  const graphDelivery = await sendPasswordResetEmailViaGraph(payload);
  if (graphDelivery.sent) {
    return {
      ...graphDelivery,
      provider: 'graph'
    };
  }

  const smtpDelivery = await sendPasswordResetEmailViaSmtp(payload);
  if (smtpDelivery.sent) {
    return {
      ...smtpDelivery,
      provider: 'smtp'
    };
  }

  return {
    sent: false,
    reason: smtpDelivery.reason || graphDelivery.reason || resendDelivery.reason || 'delivery_failed',
    provider_message:
      smtpDelivery.provider_message ||
      graphDelivery.provider_message ||
      resendDelivery.provider_message,
    provider_status:
      smtpDelivery.provider_status ||
      graphDelivery.provider_status ||
      resendDelivery.provider_status,
    resend_reason: resendDelivery.reason,
    graph_reason: graphDelivery.reason,
    smtp_reason: smtpDelivery.reason
  };
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

// -------------------- Password reset endpoints --------------------

// POST /api/auth/forgot-password
// Purpose: issue a short-lived reset token and (normally) send it by email.
app.post('/api/auth/forgot-password', async (req, res) => {
  const normalizedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const genericResponse = {
    status: 'success',
    message: 'If the email is registered, a password reset link has been sent.'
  };

  try {
    const userResult = await pool.query(
      `
        SELECT user_id, full_name
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.json(genericResponse);
    }

    const userId = Number(userResult.rows[0].user_id);
    const fullName = String(userResult.rows[0].full_name || '').trim();
    const resetTokenRow = await issuePasswordResetToken(userId);
    const requestOrigin = String(req.get('origin') || '').trim();
    const requestReferer = String(req.get('referer') || '').trim();
    let frontendOrigin = requestOrigin;
    if (!frontendOrigin && requestReferer) {
      try {
        frontendOrigin = new URL(requestReferer).origin;
      } catch (_error) {
        frontendOrigin = '';
      }
    }

    const resetUrl = buildPasswordResetUrl(resetTokenRow.token, frontendOrigin);
    const delivery = await sendPasswordResetEmail({
      email: normalizedEmail,
      resetUrl,
      expiresAt: resetTokenRow.expires_at,
      fullName
    });

    if (!delivery.sent) {
      console.error('Password reset delivery failed:', {
        email: normalizedEmail,
        reason: delivery.reason,
        provider_status: delivery.provider_status,
        provider_message: delivery.provider_message
      });
    }

    if (EXPOSE_RESET_TOKEN_IN_RESPONSE) {
      return res.json({
        ...genericResponse,
        reset_token: resetTokenRow.token,
        reset_url: resetUrl,
        expires_at: resetTokenRow.expires_at,
        email_delivery: delivery.sent ? 'sent' : 'not_sent',
        email_provider: delivery.provider || null,
        email_reason: delivery.sent ? null : delivery.reason || null,
        email_error: delivery.sent ? null : delivery.provider_message || null
      });
    }

    return res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/reset-password/validate
// Purpose: verify whether a reset token exists and is still valid.
app.get('/api/auth/reset-password/validate', async (req, res) => {
  const tokenValue = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  if (!tokenValue) {
    return res.status(400).json({ error: 'token query parameter is required' });
  }

  try {
    const resetSession = await findValidPasswordResetSession(tokenValue);
    if (!resetSession) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    return res.json({
      status: 'success',
      message: 'Reset token is valid',
      expires_at: resetSession.expires_at
    });
  } catch (error) {
    console.error('Validate reset token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
// Purpose: validate reset token and set a new password.
app.post('/api/auth/reset-password', async (req, res) => {
  const tokenValue = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const passwordValue = typeof req.body?.password === 'string' ? req.body.password : '';
  const confirmationValue = typeof req.body?.password_confirmation === 'string' ? req.body.password_confirmation : '';

  if (!tokenValue || !passwordValue || !confirmationValue) {
    return res.status(400).json({ error: 'token, password, and password_confirmation are required' });
  }

  if (passwordValue !== confirmationValue) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  const passwordValidationError = validatePassword(passwordValue);
  if (passwordValidationError) {
    return res.status(400).json({ error: passwordValidationError });
  }

  try {
    const resetSession = await findValidPasswordResetSession(tokenValue);
    if (!resetSession) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const userId = Number(resetSession.user_id);
    const passwordHash = await bcrypt.hash(passwordValue, 10);
    const dbClient = await pool.connect();

    try {
      await dbClient.query('BEGIN');
      await dbClient.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
        [passwordHash, userId]
      );
      await dbClient.query(
        `
          UPDATE session
          SET is_valid = FALSE
          WHERE user_id = $1
            AND token LIKE $2
            AND is_valid = TRUE
        `,
        [userId, `${PASSWORD_RESET_TOKEN_PREFIX}%`]
      );
      await dbClient.query('COMMIT');
    } catch (transactionError) {
      await dbClient.query('ROLLBACK');
      throw transactionError;
    } finally {
      dbClient.release();
    }

    return res.json({
      status: 'success',
      message: 'Password reset successful. You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------- Legacy compatibility endpoints --------------------

// POST /api/images/upload
// Purpose: screenshot-compatible upload endpoint (stores image only).
app.post('/api/images/upload', authenticateToken, uploadLegacyImage, async (req, res) => {
  const file = req.files?.image_file?.[0] || req.files?.image?.[0] || null;
  if (!file) {
    return res.status(400).json({ error: 'image_file is required' });
  }

  try {
    const image = await persistImageForUser(req.user.user_id, file.path);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return res.status(201).json({
      image_id: image.image_id,
      image_url: `${baseUrl}/${String(image.image_path || '').replace(/\\/g, '/')}`,
      uploaded_at: image.uploaded_at
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/getpredictiondetails
// Purpose: screenshot-compatible prediction details lookup.
app.post('/api/getpredictiondetails', authenticateToken, async (req, res) => {
  const predictionId = Number(req.body?.prediction_id);
  if (!predictionId) {
    return res.status(400).json({ error: 'prediction_id is required' });
  }

  try {
    const requesterId = Number(req.user?.user_id);
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
    const row = await fetchPredictionDetailsById(predictionId, requesterId, isAdmin);
    if (!row) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    return res.json({
      prediction_id: row.prediction_id,
      image_id: row.image_id,
      label: row.label,
      confidence: row.confidence,
      heatmap_url: row.heatmap_url,
      suggested_solution: row.suggested_sc
    });
  } catch (error) {
    console.error('Get prediction details error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/predictions/:predictionId
// Purpose: frontend helper compatibility route.
app.get('/api/predictions/:predictionId', authenticateToken, async (req, res) => {
  const predictionId = Number(req.params.predictionId);
  if (!predictionId) {
    return res.status(400).json({ error: 'Invalid prediction ID' });
  }

  try {
    const requesterId = Number(req.user?.user_id);
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
    const row = await fetchPredictionDetailsById(predictionId, requesterId, isAdmin);
    if (!row) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return res.json({
      prediction_id: row.prediction_id,
      image_id: row.image_id,
      label: row.label,
      confidence: row.confidence,
      heatmap_url: row.heatmap_url,
      suggested_sc: row.suggested_sc,
      image_url: row.image_path ? `${baseUrl}/${String(row.image_path).replace(/\\/g, '/')}` : null,
      uploaded_at: row.uploaded_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  } catch (error) {
    console.error('Get prediction endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
    const cropHint = String(req.body?.crop_hint || req.body?.cropHint || '').trim();
    const { prediction } = await analyzeUploadedImageForUser({
      file: req.file,
      userId: req.user.user_id,
      cropHint
    });

    res.json(prediction);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const errorMessage = error?.error || 'Prediction service error';
    const detail = error?.detail || error?.message || null;
    const hint = error?.hint || null;

    console.error('Analyze error:', {
      message: error?.message || error,
      status,
      detail,
      hint
    });

    return res.status(status).json({
      error: errorMessage,
      ...(detail ? { detail } : {}),
      ...(hint ? { hint } : {})
    });
  }
});

// -------------------- Chat endpoint (Ollama) --------------------

// POST /api/chat
// Purpose:
// - accept message (+ optional history) from frontend
// - call Ollama /api/generate
// - return assistant reply
// Protected by authenticateToken.
app.post('/api/chat', authenticateToken, upload.single('image'), async (req, res) => {
  const {
    message,
    history: historyFromBody,
    chat_id: chatIdFromBody,
    image_id: imageIdFromBody,
    prediction_id: predictionIdFromBody,
    topic,
    crop_hint: cropHintFromBody,
    cropHint: cropHintFromCamelCase
  } = req.body || {};

  const requesterId = Number(req.user?.user_id);
  const requesterRole = String(req.user?.role || '').toLowerCase();
  const isAdmin = requesterRole === 'admin';

  if (!requesterId) {
    return res.status(401).json({ error: 'Invalid token payload' });
  }

  const safeHistory = parseChatHistoryInput(historyFromBody);
  const hasUploadedImage = Boolean(req.file);
  const requestedChatId = asPositiveIntegerOrNull(chatIdFromBody);
  const requestedImageId = asPositiveIntegerOrNull(imageIdFromBody);
  const requestedPredictionId = asPositiveIntegerOrNull(predictionIdFromBody);
  const trimmedMessage = extractOriginalQuestion(message);
  if (!trimmedMessage && !hasUploadedImage) {
    return res.status(400).json({ error: 'Message or image is required' });
  }

  const normalizedCropHint = String(cropHintFromBody || cropHintFromCamelCase || '').trim();
  const promptMessage =
    trimmedMessage || 'Please analyze the uploaded plant photo and suggest practical next steps.';
  const storedUserMessage = trimmedMessage || '[Uploaded image for analysis]';

  let uploadedImageId = null;
  let uploadedPredictionId = null;
  let predictionContext = null;
  let inferredImageIdFromPrediction = null;
  let imageAnalysis = null;
  let imageAnalysisError = null;

  if (hasUploadedImage) {
    try {
      const imageAnalysisResult = await analyzeUploadedImageForUser({
        file: req.file,
        userId: requesterId,
        cropHint: normalizedCropHint
      });

      imageAnalysis = imageAnalysisResult.prediction;
      predictionContext = imageAnalysis;
      uploadedImageId = asPositiveIntegerOrNull(imageAnalysis?.image_id);
      uploadedPredictionId = asPositiveIntegerOrNull(imageAnalysis?.prediction_id);
    } catch (error) {
      imageAnalysisError = {
        error: error?.error || 'Image analysis failed',
        detail: error?.detail || error?.message || null,
        hint: error?.hint || null
      };
      console.error('Chat image analysis error:', imageAnalysisError);
    }
  }

  if (!predictionContext && requestedPredictionId) {
    try {
      const predictionRow = await fetchPredictionDetailsById(
        requestedPredictionId,
        requesterId,
        isAdmin
      );

      if (predictionRow) {
        predictionContext = {
          prediction_id: predictionRow.prediction_id,
          image_id: predictionRow.image_id,
          label: predictionRow.label,
          confidence: predictionRow.confidence,
          suggested_sc: predictionRow.suggested_sc
        };
        inferredImageIdFromPrediction = asPositiveIntegerOrNull(predictionRow.image_id);
      }
    } catch (contextError) {
      console.error('Chat prediction context lookup error:', contextError);
    }
  }

  const imageContext = predictionContext
    ? buildImageAnalysisContext(predictionContext, normalizedCropHint)
    : '';

  let reply = '';
  let source = 'ollama';
  let providerErrorMessage = '';
  let activeOllamaModel = OLLAMA_MODEL;

  try {
    const prompt = buildOllamaPrompt(safeHistory, promptMessage, imageContext);
    try {
      reply = await generateWithOllama({
        model: activeOllamaModel,
        prompt
      });
    } catch (primaryError) {
      const errorMessage = String(primaryError?.message || '');
      const memoryError = /requires more system memory|insufficient memory/i.test(errorMessage);
      const fallbackIsCodingSpecialized = isCodingSpecializedModel(OLLAMA_FALLBACK_MODEL);
      const canUseFallback =
        memoryError &&
        OLLAMA_FALLBACK_MODEL &&
        OLLAMA_FALLBACK_MODEL.toLowerCase() !== activeOllamaModel.toLowerCase() &&
        !fallbackIsCodingSpecialized;

      if (!canUseFallback) {
        throw primaryError;
      }

      activeOllamaModel = OLLAMA_FALLBACK_MODEL;
      reply = await generateWithOllama({
        model: activeOllamaModel,
        prompt
      });
      source = 'ollama';
    }
  } catch (error) {
    providerErrorMessage = error?.message || 'Chat service error';
    console.error('Chat error:', {
      message: providerErrorMessage,
      ollamaUrl: OLLAMA_BASE_URL,
      ollamaModel: activeOllamaModel,
      configuredOllamaModel: OLLAMA_MODEL,
      fallbackOllamaModel: OLLAMA_FALLBACK_MODEL || null
    });
    reply = buildFallbackChatReply(promptMessage);
    source = 'fallback';
  }

  if (looksOffDomainChatReply(reply)) {
    console.warn('Chat guardrail replaced off-domain model reply', {
      model: activeOllamaModel
    });
    reply = buildPlantDomainRecoveryReply(promptMessage, predictionContext);
    source = 'guardrail';
  }

  if (predictionContext) {
    reply = formatThreeLineRecommendations(reply);
  }

  let chatId = null;

  try {
    const dbClient = await pool.connect();

    try {
      await dbClient.query('BEGIN');

      const contextPredictionId = asPositiveIntegerOrNull(predictionContext?.prediction_id);
      const effectiveImageId = requestedImageId || uploadedImageId || inferredImageIdFromPrediction;
      const effectivePredictionId = requestedPredictionId || uploadedPredictionId || contextPredictionId;

      if (requestedChatId) {
        const existingChatQuery = `
          SELECT chat_id, user_id
          FROM ai_chat
          WHERE chat_id = $1
        `;
        const existingChatResult = await dbClient.query(existingChatQuery, [requestedChatId]);

        if (existingChatResult.rows.length === 0) {
          throw new Error('CHAT_NOT_FOUND');
        }

        const ownerUserId = Number(existingChatResult.rows[0].user_id);
        if (!isAdmin && ownerUserId !== requesterId) {
          throw new Error('CHAT_FORBIDDEN');
        }

        chatId = requestedChatId;

        if (effectiveImageId || effectivePredictionId) {
          const updateChatQuery = `
            UPDATE ai_chat
            SET
              image_id = COALESCE(image_id, $2),
              prediction_id = COALESCE(prediction_id, $3)
            WHERE chat_id = $1
          `;
          await dbClient.query(updateChatQuery, [chatId, effectiveImageId, effectivePredictionId]);
        }
      } else {
        const normalizedTopic = String(topic || 'general').trim().slice(0, 80) || 'general';

        const createChatQuery = `
          INSERT INTO ai_chat (user_id, image_id, prediction_id, topic)
          VALUES ($1, $2, $3, $4)
          RETURNING chat_id
        `;
        const createChatResult = await dbClient.query(createChatQuery, [
          requesterId,
          effectiveImageId,
          effectivePredictionId,
          normalizedTopic
        ]);
        chatId = createChatResult.rows[0].chat_id;
      }

      const insertMessageQuery = `
        INSERT INTO ai_chatmessage (chat_id, sender, content)
        VALUES ($1, $2, $3)
      `;
      await dbClient.query(insertMessageQuery, [chatId, 'USER', storedUserMessage]);
      await dbClient.query(insertMessageQuery, [chatId, 'AI', reply]);

      await dbClient.query('COMMIT');
    } catch (dbError) {
      await dbClient.query('ROLLBACK');
      throw dbError;
    } finally {
      dbClient.release();
    }
  } catch (dbError) {
    if (dbError.message === 'CHAT_NOT_FOUND') {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (dbError.message === 'CHAT_FORBIDDEN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.error('Chat persistence error:', dbError);
    return res.status(500).json({
      error: 'Failed to store chat messages',
      detail: process.env.NODE_ENV === 'production' ? null : dbError.message
    });
  }

  return res.json({
    reply,
    source,
    chat_id: chatId,
    ...(imageAnalysis ? { image_analysis: imageAnalysis } : {}),
    ...(imageAnalysisError ? { image_analysis_error: imageAnalysisError } : {}),
    ...(providerErrorMessage && process.env.NODE_ENV !== 'production'
      ? { error: providerErrorMessage }
      : {})
  });
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

// -------------------- Retraining endpoints --------------------

// POST /api/predictions/:predictionId/flag-for-retraining
// Purpose:
// - Allow users to flag low-confidence predictions for admin retraining review.
app.post('/api/predictions/:predictionId/flag-for-retraining', authenticateToken, upload.none(), async (req, res) => {
  const predictionId = Number(req.params.predictionId);
  if (!predictionId) {
    return res.status(400).json({ error: 'Invalid prediction ID' });
  }

  const requesterId = Number(req.user?.user_id);
  const requesterRole = String(req.user?.role || '').toLowerCase();
  const isAdmin = requesterRole === 'admin';

  const targetUserId = Number(req.body?.user_id || requesterId);
  if (!targetUserId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  if (!isAdmin && requesterId !== targetUserId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const reasonRaw = String(req.body?.reason || '').trim();
  const reason = reasonRaw ? reasonRaw.slice(0, 255) : null;

  try {
    const predictionQuery = `
      SELECT
        p.prediction_id,
        p.confidence,
        i.user_id AS owner_user_id
      FROM prediction p
      JOIN image i ON i.image_id = p.image_id
      WHERE p.prediction_id = $1
      LIMIT 1
    `;
    const predictionResult = await pool.query(predictionQuery, [predictionId]);
    const predictionRow = predictionResult.rows[0];

    if (!predictionRow) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    const predictionOwnerId = Number(predictionRow.owner_user_id);
    const confidence = Number(predictionRow.confidence);

    if (!isAdmin && predictionOwnerId !== requesterId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!Number.isFinite(confidence)) {
      return res.status(400).json({ error: 'Prediction confidence is unavailable' });
    }

    if (confidence >= 0.7) {
      return res.status(400).json({
        error: 'Invalid retraining request',
        detail: 'Only predictions with confidence < 70% can be flagged for retraining'
      });
    }

    const existingQuery = `
      SELECT queue_id
      FROM retraining_queue
      WHERE prediction_id = $1 AND status = 'PENDING'
      LIMIT 1
    `;
    const existingResult = await pool.query(existingQuery, [predictionId]);
    const existingQueueId = existingResult.rows[0]?.queue_id;

    if (existingQueueId) {
      return res.json({
        success: true,
        queue_id: existingQueueId,
        message: 'Prediction already flagged for retraining'
      });
    }

    const insertQuery = `
      INSERT INTO retraining_queue
        (prediction_id, flagged_by_user_id, confidence_score, reason, status, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, 'PENDING', NOW(), NOW())
      RETURNING queue_id
    `;
    const insertResult = await pool.query(insertQuery, [predictionId, targetUserId, confidence, reason]);
    const queueId = insertResult.rows[0]?.queue_id;

    return res.status(201).json({
      success: true,
      queue_id: queueId,
      message: 'Prediction flagged for retraining'
    });
  } catch (error) {
    console.error('Flag for retraining error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------- Annotator endpoints --------------------

// GET /api/annotator/queue
// Purpose:
// - Annotator/admin paginated queue over retraining requests.
// - Shows annotator's current correction (if any) plus latest correction summary.
app.get('/api/annotator/queue', authenticateToken, requireAnnotatorOrAdmin, async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 100);
  const status = String(req.query.status || 'PENDING').trim().toUpperCase();
  const allowedStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
  const annotatorId = Number(req.user?.user_id);

  if (!allowedStatuses.has(status)) {
    return res.status(400).json({ error: 'Invalid status. Use PENDING, APPROVED, REJECTED, or CANCELLED.' });
  }

  if (!annotatorId) {
    return res.status(401).json({ error: 'Invalid token payload' });
  }

  const offset = (page - 1) * perPage;

  try {
    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM retraining_queue
      WHERE status = $1
      `,
      [status]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const queueResult = await pool.query(
      `
      SELECT
        rq.queue_id,
        rq.prediction_id,
        rq.flagged_by_user_id,
        rq.confidence_score,
        rq.reason,
        rq.status,
        rq.created_at,
        rq.updated_at,
        p.image_id,
        p.label,
        p.confidence,
        p.suggested_sc,
        u.full_name,
        u.email,
        i.image_path,
        i.uploaded_at,
        ac.correction_id,
        ac.corrected_label,
        ac.notes AS annotator_notes,
        ac.updated_at AS correction_updated_at,
        COALESCE(corr_stats.total_corrections, 0) AS total_corrections,
        latest_any.corrected_label AS latest_corrected_label,
        latest_any.updated_at AS latest_correction_at,
        latest_any.annotator_id AS latest_annotator_id
      FROM retraining_queue rq
      JOIN prediction p ON rq.prediction_id = p.prediction_id
      JOIN users u ON rq.flagged_by_user_id = u.user_id
      LEFT JOIN image i ON p.image_id = i.image_id
      LEFT JOIN annotator_correction ac
        ON ac.queue_id = rq.queue_id
       AND ac.annotator_id = $4
      LEFT JOIN LATERAL (
        SELECT
          ac2.corrected_label,
          ac2.updated_at,
          ac2.annotator_id
        FROM annotator_correction ac2
        WHERE ac2.queue_id = rq.queue_id
        ORDER BY ac2.updated_at DESC
        LIMIT 1
      ) latest_any ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INT AS total_corrections
        FROM annotator_correction ac3
        WHERE ac3.queue_id = rq.queue_id
      ) corr_stats ON TRUE
      WHERE rq.status = $1
      ORDER BY rq.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [status, perPage, offset, annotatorId]
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const items = queueResult.rows.map((row) => ({
      ...row,
      image_path: row.image_path ? `${baseUrl}/${String(row.image_path).replace(/\\/g, '/')}` : null
    }));

    return res.json({
      items,
      total,
      page,
      per_page: perPage,
      pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    console.error('Get annotator queue error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/annotator/queue/:queueId
// Purpose:
// - Return a single queue item with recent corrections.
app.get('/api/annotator/queue/:queueId', authenticateToken, requireAnnotatorOrAdmin, async (req, res) => {
  const queueId = Number(req.params.queueId);
  const annotatorId = Number(req.user?.user_id);

  if (!queueId) {
    return res.status(400).json({ error: 'Invalid queue ID' });
  }
  if (!annotatorId) {
    return res.status(401).json({ error: 'Invalid token payload' });
  }

  try {
    const queueResult = await pool.query(
      `
      SELECT
        rq.queue_id,
        rq.prediction_id,
        rq.flagged_by_user_id,
        rq.confidence_score,
        rq.reason,
        rq.status,
        rq.created_at,
        rq.updated_at,
        p.image_id,
        p.label,
        p.confidence,
        p.suggested_sc,
        u.full_name,
        u.email,
        i.image_path,
        i.uploaded_at,
        ac.correction_id,
        ac.corrected_label,
        ac.notes AS annotator_notes,
        ac.updated_at AS correction_updated_at
      FROM retraining_queue rq
      JOIN prediction p ON rq.prediction_id = p.prediction_id
      JOIN users u ON rq.flagged_by_user_id = u.user_id
      LEFT JOIN image i ON p.image_id = i.image_id
      LEFT JOIN annotator_correction ac
        ON ac.queue_id = rq.queue_id
       AND ac.annotator_id = $2
      WHERE rq.queue_id = $1
      LIMIT 1
      `,
      [queueId, annotatorId]
    );

    const item = queueResult.rows[0];
    if (!item) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    const recentCorrectionsResult = await pool.query(
      `
      SELECT
        ac.correction_id,
        ac.queue_id,
        ac.prediction_id,
        ac.annotator_id,
        au.full_name AS annotator_name,
        au.email AS annotator_email,
        ac.corrected_label,
        ac.notes,
        ac.status,
        ac.created_at,
        ac.updated_at
      FROM annotator_correction ac
      JOIN users au ON au.user_id = ac.annotator_id
      WHERE ac.queue_id = $1
      ORDER BY ac.updated_at DESC
      LIMIT 10
      `,
      [queueId]
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return res.json({
      item: {
        ...item,
        image_path: item.image_path ? `${baseUrl}/${String(item.image_path).replace(/\\/g, '/')}` : null
      },
      recent_corrections: recentCorrectionsResult.rows
    });
  } catch (error) {
    console.error('Get annotator queue item error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/annotator/corrections
// Purpose:
// - Annotator/admin submits or updates a correction on a queued prediction.
app.post('/api/annotator/corrections', authenticateToken, requireAnnotatorOrAdmin, async (req, res) => {
  const annotatorId = Number(req.user?.user_id);
  const bodyQueueId = Number(req.body?.queue_id || 0);
  const bodyPredictionId = Number(req.body?.prediction_id || 0);
  const correctedLabel = String(req.body?.corrected_label || '').trim();
  const notesRaw = String(req.body?.notes || req.body?.annotation_notes || '').trim();
  const notes = notesRaw ? notesRaw.slice(0, 4000) : null;

  if (!annotatorId) {
    return res.status(401).json({ error: 'Invalid token payload' });
  }
  if (!bodyQueueId && !bodyPredictionId) {
    return res.status(400).json({ error: 'queue_id or prediction_id is required' });
  }
  if (correctedLabel.length < 2 || correctedLabel.length > 120) {
    return res.status(400).json({ error: 'corrected_label must be between 2 and 120 characters' });
  }

  try {
    let queueRow = null;
    let queueId = bodyQueueId || null;
    let predictionId = bodyPredictionId || null;

    if (queueId) {
      const queueLookupResult = await pool.query(
        `
        SELECT queue_id, prediction_id, status
        FROM retraining_queue
        WHERE queue_id = $1
        LIMIT 1
        `,
        [queueId]
      );
      queueRow = queueLookupResult.rows[0] || null;
      if (!queueRow) {
        return res.status(404).json({ error: 'Queue item not found' });
      }
      if (predictionId && predictionId !== Number(queueRow.prediction_id)) {
        return res.status(400).json({ error: 'prediction_id does not match queue item' });
      }
      predictionId = Number(queueRow.prediction_id);
    } else {
      const pendingQueueLookupResult = await pool.query(
        `
        SELECT queue_id, prediction_id, status
        FROM retraining_queue
        WHERE prediction_id = $1
        ORDER BY CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END, created_at DESC
        LIMIT 1
        `,
        [predictionId]
      );
      queueRow = pendingQueueLookupResult.rows[0] || null;
      if (queueRow) {
        queueId = Number(queueRow.queue_id);
        predictionId = Number(queueRow.prediction_id);
      }
    }

    if (!queueId || !predictionId) {
      return res.status(404).json({ error: 'No retraining queue item found for this prediction' });
    }

    if (String(queueRow?.status || '').toUpperCase() !== 'PENDING') {
      return res.status(400).json({ error: 'Queue item is not pending and cannot be corrected' });
    }

    const predictionExistsResult = await pool.query(
      `
      SELECT prediction_id
      FROM prediction
      WHERE prediction_id = $1
      LIMIT 1
      `,
      [predictionId]
    );
    if (predictionExistsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    const upsertResult = await pool.query(
      `
      INSERT INTO annotator_correction
        (queue_id, prediction_id, annotator_id, corrected_label, notes, status, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, 'SUBMITTED', NOW(), NOW())
      ON CONFLICT (prediction_id, annotator_id)
      DO UPDATE
      SET
        queue_id = EXCLUDED.queue_id,
        corrected_label = EXCLUDED.corrected_label,
        notes = EXCLUDED.notes,
        status = 'SUBMITTED',
        updated_at = NOW()
      RETURNING
        correction_id,
        queue_id,
        prediction_id,
        annotator_id,
        corrected_label,
        notes,
        status,
        created_at,
        updated_at
      `,
      [queueId, predictionId, annotatorId, correctedLabel, notes]
    );

    await pool.query(
      `
      UPDATE retraining_queue
      SET updated_at = NOW()
      WHERE queue_id = $1
      `,
      [queueId]
    );

    return res.status(201).json({
      success: true,
      message: 'Correction submitted successfully',
      correction: upsertResult.rows[0]
    });
  } catch (error) {
    console.error('Submit annotator correction error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/retraining-queue
// Purpose:
// - Admin paginated view over retraining queue by status.
app.get('/api/admin/retraining-queue', authenticateToken, requireAdmin, async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 100);
  const status = String(req.query.status || 'PENDING').trim().toUpperCase();
  const allowedStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);

  if (!allowedStatuses.has(status)) {
    return res.status(400).json({ error: 'Invalid status. Use PENDING, APPROVED, REJECTED, or CANCELLED.' });
  }

  const offset = (page - 1) * perPage;

  try {
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM retraining_queue
      WHERE status = $1
    `;
    const countResult = await pool.query(countQuery, [status]);
    const total = Number(countResult.rows[0]?.total || 0);

    const queueQuery = `
      SELECT
        rq.queue_id,
        rq.prediction_id,
        rq.flagged_by_user_id,
        rq.confidence_score,
        rq.reason,
        rq.status,
        rq.admin_id,
        rq.admin_notes,
        rq.reviewed_at,
        rq.created_at,
        rq.updated_at,
        p.image_id,
        p.label,
        p.confidence,
        p.suggested_sc,
        u.full_name,
        u.email,
        i.image_path,
        i.uploaded_at
      FROM retraining_queue rq
      JOIN prediction p ON rq.prediction_id = p.prediction_id
      JOIN users u ON rq.flagged_by_user_id = u.user_id
      LEFT JOIN image i ON p.image_id = i.image_id
      WHERE rq.status = $1
      ORDER BY rq.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const queueResult = await pool.query(queueQuery, [status, perPage, offset]);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const items = queueResult.rows.map((row) => ({
      ...row,
      image_path: row.image_path ? `${baseUrl}/${String(row.image_path).replace(/\\/g, '/')}` : null
    }));

    return res.json({
      items,
      total,
      page,
      per_page: perPage,
      pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    console.error('Get retraining queue error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/retraining-queue/:queueId
// Purpose:
// - Admin approves/rejects/cancels retraining requests.
app.patch('/api/admin/retraining-queue/:queueId', authenticateToken, requireAdmin, upload.none(), async (req, res) => {
  const queueId = Number(req.params.queueId);
  if (!queueId) {
    return res.status(400).json({ error: 'Invalid queue ID' });
  }

  const status = String(req.body?.status || '').trim().toUpperCase();
  const allowedStatuses = new Set(['APPROVED', 'REJECTED', 'CANCELLED']);
  if (!allowedStatuses.has(status)) {
    return res.status(400).json({ error: 'Invalid status. Use APPROVED, REJECTED, or CANCELLED.' });
  }

  const adminId = Number(req.body?.admin_id || req.user?.user_id || 0) || null;
  const adminNotesRaw = String(req.body?.admin_notes || '').trim();
  const adminNotes = adminNotesRaw ? adminNotesRaw : null;

  try {
    const updateQuery = `
      UPDATE retraining_queue
      SET
        status = $1,
        admin_id = $2,
        admin_notes = $3,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE queue_id = $4
      RETURNING queue_id, status, admin_id, admin_notes, reviewed_at, updated_at
    `;
    const updateResult = await pool.query(updateQuery, [status, adminId, adminNotes, queueId]);
    const updated = updateResult.rows[0];

    if (!updated) {
      return res.status(404).json({ error: 'Retraining request not found' });
    }

    return res.json({
      success: true,
      message: `Retraining request ${status.toLowerCase()}`,
      item: updated
    });
  } catch (error) {
    console.error('Update retraining queue item error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/low-confidence-predictions
// Purpose:
// - Admin helper endpoint listing low-confidence predictions.
app.get('/api/admin/low-confidence-predictions', authenticateToken, requireAdmin, async (req, res) => {
  const threshold = Math.min(Math.max(Number(req.query.threshold), 0), 1) || 0.7;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

  try {
    const lowConfidenceQuery = `
      SELECT
        p.prediction_id,
        p.image_id,
        p.label,
        p.confidence,
        p.suggested_sc,
        p.created_at,
        i.user_id,
        i.image_path,
        i.uploaded_at,
        u.full_name,
        u.email
      FROM prediction p
      JOIN image i ON i.image_id = p.image_id
      JOIN users u ON u.user_id = i.user_id
      WHERE p.confidence < $1
      ORDER BY p.confidence ASC, p.created_at DESC
      LIMIT $2
    `;
    const lowConfidenceResult = await pool.query(lowConfidenceQuery, [threshold, limit]);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const predictions = lowConfidenceResult.rows.map((row) => ({
      ...row,
      image_url: row.image_path ? `${baseUrl}/${String(row.image_path).replace(/\\/g, '/')}` : null
    }));

    return res.json({
      threshold,
      count: predictions.length,
      predictions
    });
  } catch (error) {
    console.error('Get low-confidence predictions error:', error);
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

// DELETE /api/admin/images/:imageId
// Purpose: admin-only delete image sample (and cascade related prediction records).
app.delete('/api/admin/images/:imageId', authenticateToken, requireAdmin, async (req, res) => {
  const imageId = Number(req.params.imageId);
  if (!imageId) {
    return res.status(400).json({ error: 'Invalid image ID' });
  }

  try {
    const deleteQuery = `
      DELETE FROM image
      WHERE image_id = $1
      RETURNING image_id, image_path
    `;
    const deleteResult = await pool.query(deleteQuery, [imageId]);
    const deleted = deleteResult.rows[0];

    if (!deleted) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const imagePath = String(deleted.image_path || '').trim();
    if (imagePath) {
      try {
        const uploadsRoot = path.resolve(uploadsDir);
        const resolvedImagePath = path.resolve(__dirname, imagePath);
        const withinUploadsRoot =
          resolvedImagePath === uploadsRoot ||
          resolvedImagePath.startsWith(`${uploadsRoot}${path.sep}`);

        if (withinUploadsRoot && fs.existsSync(resolvedImagePath)) {
          fs.unlinkSync(resolvedImagePath);
        }
      } catch (fileError) {
        console.warn('Image file cleanup warning:', fileError?.message || fileError);
      }
    }

    return res.json({
      success: true,
      image_id: deleted.image_id
    });
  } catch (error) {
    console.error('Admin delete image error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------- Admin: dataset manager metrics --------------------

// GET /api/admin/dataset-metrics
// Purpose: admin intelligence layer for dataset health and annotation progress.
app.get('/api/admin/dataset-metrics', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const totalsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*)::INT FROM image) AS images_total,
        (SELECT COUNT(*)::INT FROM prediction) AS predictions_total,
        (
          SELECT COUNT(*)::INT
          FROM prediction
          WHERE label IS NOT NULL AND TRIM(label) <> ''
        ) AS labeled_total
    `);
    const totalsRow = totalsResult.rows[0] || {};

    const queueSummaryResult = await pool.query(`
      SELECT
        COUNT(*)::INT AS queue_total,
        COUNT(*) FILTER (WHERE status = 'PENDING')::INT AS pending_total,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::INT AS approved_total,
        COUNT(*) FILTER (WHERE status = 'REJECTED')::INT AS rejected_total
      FROM retraining_queue
    `);
    const queueSummary = queueSummaryResult.rows[0] || {};

    const correctionSummaryResult = await pool.query(`
      SELECT
        COUNT(DISTINCT prediction_id)::INT AS corrected_predictions,
        COUNT(*)::INT AS total_corrections
      FROM annotator_correction
    `);
    const correctionSummary = correctionSummaryResult.rows[0] || {};

    const classDistributionResult = await pool.query(`
      SELECT
        label,
        COUNT(*)::INT AS sample_count
      FROM prediction
      WHERE
        label IS NOT NULL
        AND TRIM(label) <> ''
        AND LOWER(TRIM(label)) NOT IN (
          'invalid_image',
          'retake_photo',
          'uncertain_prediction',
          'unknown_crop',
          'unsupported_crop',
          'invalid_crop_hint'
        )
      GROUP BY label
      ORDER BY sample_count DESC, label ASC
      LIMIT 12
    `);

    const classDistribution = classDistributionResult.rows.map((row) => ({
      label: row.label,
      count: Number(row.sample_count || 0)
    }));

    const classSampleTotal = classDistribution.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const classDistributionWithShare = classDistribution.map((item) => ({
      ...item,
      share: classSampleTotal > 0 ? Number(((item.count / classSampleTotal) * 100).toFixed(1)) : 0
    }));

    const maxClassCount = classDistribution.length > 0 ? Number(classDistribution[0].count || 0) : 0;
    const minClassCount = classDistribution.length > 0
      ? Number(classDistribution[classDistribution.length - 1].count || 0)
      : 0;
    const imbalanceRatio = maxClassCount > 0 ? Number((minClassCount / maxClassCount).toFixed(3)) : 1;

    const lowClassThreshold = Math.max(5, Math.round(classSampleTotal * 0.05));
    const minorityClasses = classDistributionWithShare
      .filter((item) => Number(item.count || 0) <= lowClassThreshold)
      .map((item) => item.label);

    let imbalanceStatus = 'healthy';
    let imbalanceMessage = 'Class balance looks healthy.';

    if (classDistributionWithShare.length < 2) {
      imbalanceStatus = 'insufficient_data';
      imbalanceMessage = 'Need at least two labeled classes to evaluate imbalance.';
    } else if (imbalanceRatio < 0.2) {
      imbalanceStatus = 'critical';
      imbalanceMessage = 'Severe imbalance detected. Minority classes need targeted sampling.';
    } else if (imbalanceRatio < 0.4) {
      imbalanceStatus = 'warning';
      imbalanceMessage = 'Moderate class imbalance detected. Add more data for smaller classes.';
    }

    const queueTotal = Number(queueSummary.queue_total || 0);
    const correctedPredictions = Number(correctionSummary.corrected_predictions || 0);
    const completionRate = queueTotal > 0
      ? Number(((correctedPredictions / queueTotal) * 100).toFixed(1))
      : 100;

    return res.json({
      dataset_size: {
        images: Number(totalsRow.images_total || 0),
        predictions: Number(totalsRow.predictions_total || 0),
        labeled_predictions: Number(totalsRow.labeled_total || 0)
      },
      class_distribution: classDistributionWithShare,
      annotation_progress: {
        queue_total: queueTotal,
        pending: Number(queueSummary.pending_total || 0),
        approved: Number(queueSummary.approved_total || 0),
        rejected: Number(queueSummary.rejected_total || 0),
        corrected_predictions: correctedPredictions,
        total_corrections: Number(correctionSummary.total_corrections || 0),
        completion_rate: completionRate
      },
      class_imbalance: {
        status: imbalanceStatus,
        message: imbalanceMessage,
        ratio: imbalanceRatio,
        max_class_count: maxClassCount,
        min_class_count: minClassCount,
        low_class_threshold: lowClassThreshold,
        minority_classes: minorityClasses
      }
    });
  } catch (error) {
    console.error('Admin dataset metrics error:', error);
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
    return res.status(400).json({ error: 'Invalid role. Use user, operator, annotator, or admin.' });
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
        return res.status(400).json({ error: 'Invalid role. Use user, operator, annotator, or admin.' });
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
