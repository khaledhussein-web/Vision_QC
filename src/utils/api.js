// VisionQC API Service Layer
// Real API endpoints (no mock responses)

// API base URL (override with VITE_API_BASE_URL if needed)
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

// Auth state
let authToken = null;
let currentUserId = null;

const TOKEN_STORAGE_KEY = 'token';

const getStoredToken = () => {
  if (authToken) return authToken;
  try {
    authToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (error) {
    // Ignore storage access issues (e.g., SSR or privacy mode)
  }
  return authToken;
};

const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseResponse = async (response) => {
  const raw = await response.text().catch(() => '');
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    data = {};
  }

  const cleanedRaw = String(raw || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!response.ok) {
    const fallbackDetail = cleanedRaw ? cleanedRaw.slice(0, 220) : null;
    throw {
      status: response.status,
      error: data.error || response.statusText || 'Request failed',
      detail: data.detail || fallbackDetail,
      hint: data.hint || null
    };
  }

  return data;
};

// API Functions

/**
 * Login Authentication
 * POST /api/login
 */
export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const data = await parseResponse(response);
  authToken = data.token;
  currentUserId = data.user_id;
  if (data.token) {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    } catch (error) {
      // Ignore storage access issues
    }
  }

  return data;
}

/**
 * User Registration
 * POST /api/register
 */
export async function register(
  full_name,
  email,
  password,
  password_confirm,
  role = 'user'
) {
  const response = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      full_name,
      email,
      password,
      password_confirm,
      role
    })
  });

  const data = await parseResponse(response);
  authToken = data.token || authToken;
  currentUserId = data.user_id || currentUserId;
  if (data.token) {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    } catch (error) {
      // Ignore storage access issues
    }
  }

  return data;
}

/**
 * Forgot Password
 * POST /api/auth/forgot-password
 */
export async function forgotPassword(email) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });
  } catch (_error) {
    const baseUrlHint = API_BASE_URL || 'http://localhost:5000';
    throw {
      status: 0,
      error: 'Backend unreachable',
      detail: `Could not connect to ${baseUrlHint}/api/auth/forgot-password`,
      hint: 'Ensure backend is running and reachable from this device.'
    };
  }

  return parseResponse(response);
}

/**
 * Validate Reset Token
 * GET /api/auth/reset-password/validate?token=...
 */
export async function validateResetToken(token) {
  const query = new URLSearchParams({
    token: String(token || '').trim()
  });

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/reset-password/validate?${query.toString()}`, {
      method: 'GET'
    });
  } catch (_error) {
    const baseUrlHint = API_BASE_URL || 'http://localhost:5000';
    throw {
      status: 0,
      error: 'Backend unreachable',
      detail: `Could not connect to ${baseUrlHint}/api/auth/reset-password/validate`,
      hint: 'Ensure backend is running and reachable from this device.'
    };
  }

  return parseResponse(response);
}

/**
 * Reset Password
 * POST /api/auth/reset-password
 */
export async function resetPassword(
  token,
  password,
  password_confirmation
) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, password, password_confirmation })
    });
  } catch (_error) {
    const baseUrlHint = API_BASE_URL || 'http://localhost:5000';
    throw {
      status: 0,
      error: 'Backend unreachable',
      detail: `Could not connect to ${baseUrlHint}/api/auth/reset-password`,
      hint: 'Ensure backend is running and reachable from this device.'
    };
  }

  return parseResponse(response);
}

/**
 * Analyze Image
 * POST /api/analyze
 */
export async function analyzeImage(
  imageFile,
  options = {}
) {
  const formData = new FormData();
  formData.append('image', imageFile);
  const cropHint = String(options?.cropHint || '').trim();
  if (cropHint) {
    formData.append('crop_hint', cropHint);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders()
      },
      body: formData
    });
  } catch (error) {
    const baseUrlHint = API_BASE_URL || 'http://localhost:5000';
    throw {
      status: 0,
      error: 'Backend unreachable',
      detail: `Could not connect to ${baseUrlHint}/api/analyze`,
      hint: 'Start all services with `npm run dev:all` and keep the terminal running.'
    };
  }

  return parseResponse(response);
}

/**
 * Get Prediction Details
 * GET /api/predictions/{prediction_id}
 */
export async function getPredictionDetails(predictionId) {
  const response = await fetch(`${API_BASE_URL}/api/predictions/${predictionId}`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders()
    }
  });

  return parseResponse(response);
}

/**
 * Get User History / Predictions List
 * GET /api/users/{user_id}/history
 */
export async function getHistory(
  userId,
  page = 1,
  perPage = 20
) {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage)
  });

  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/history?${query.toString()}`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders()
    }
  });

  return parseResponse(response);
}

/**
 * Toggle Bookmark
 * POST /api/predictions/{prediction_id}/bookmark
 */
export async function toggleBookmark(
  predictionId,
  userId,
  action
) {
  const response = await fetch(`${API_BASE_URL}/api/predictions/${predictionId}/bookmark`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ user_id: userId, action })
  });

  return parseResponse(response);
}

/**
 * Get Chat History
 * GET /api/chat/{chat_id}
 */
export async function getChatHistory(chatId) {
  const response = await fetch(`${API_BASE_URL}/api/chat/${chatId}`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders()
    }
  });

  return parseResponse(response);
}

/**
 * Chat with AI Agent
 * POST /api/chat
 */
export async function sendChatMessage(
  userId,
  message,
  history = [],
  options = {}
) {
  const imageFile = options?.imageFile || null;
  const hasImage = typeof File !== 'undefined' && imageFile instanceof File;
  const cropHint = String(options?.cropHint || '').trim();
  let response;

  if (hasImage) {
    const formData = new FormData();
    const trimmedMessage = String(message || '').trim();
    const safeHistory = Array.isArray(history) ? history : [];

    if (userId !== undefined && userId !== null) {
      formData.append('user_id', String(userId));
    }
    if (trimmedMessage) {
      formData.append('message', trimmedMessage);
    }
    formData.append('history', JSON.stringify(safeHistory));
    formData.append('image', imageFile);

    if (options?.chatId) {
      formData.append('chat_id', String(options.chatId));
    }
    if (options?.imageId) {
      formData.append('image_id', String(options.imageId));
    }
    if (options?.predictionId) {
      formData.append('prediction_id', String(options.predictionId));
    }
    if (options?.topic) {
      formData.append('topic', String(options.topic));
    }
    if (cropHint) {
      formData.append('crop_hint', cropHint);
    }

    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders()
      },
      body: formData
    });
  } else {
    const payload = {
      user_id: userId,
      message,
      history
    };

    if (options?.chatId) {
      payload.chat_id = String(options.chatId);
    }
    if (options?.imageId) {
      payload.image_id = String(options.imageId);
    }
    if (options?.predictionId) {
      payload.prediction_id = String(options.predictionId);
    }
    if (options?.topic) {
      payload.topic = String(options.topic);
    }
    if (cropHint) {
      payload.crop_hint = cropHint;
    }

    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
  }

  return parseResponse(response);
}

/**
 * Fake Payment / Subscription
 * POST /api/payments/fake
 */
export async function processPayment(
  userId,
  plan,
  paymentMethod
) {
  const response = await fetch(`${API_BASE_URL}/api/payments/fake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ user_id: userId, plan, payment_method: paymentMethod })
  });

  return parseResponse(response);
}

/**
 * Admin: List Users
 * GET /api/admin/users
 */
export async function getAdminUsers(page = 1, perPage = 20) {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage)
  });

  const response = await fetch(`${API_BASE_URL}/api/admin/users?${query.toString()}`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders()
    }
  });

  return parseResponse(response);
}

/**
 * Admin: Create User
 * POST /api/admin/users
 */
export async function createAdminUser(payload) {
  const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload || {})
  });

  return parseResponse(response);
}

/**
 * Admin: Update User
 * PATCH /api/admin/users/{user_id}
 */
export async function updateAdminUser(userId, payload) {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload || {})
  });

  return parseResponse(response);
}

/**
 * Admin: Delete User
 * DELETE /api/admin/users/{user_id}
 */
export async function deleteAdminUser(userId) {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders()
    }
  });

  return parseResponse(response);
}

/**
 * Admin: List Images
 * GET /api/admin/images
 */
export async function getAdminImages(page = 1, perPage = 20) {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage)
  });

  const response = await fetch(`${API_BASE_URL}/api/admin/images?${query.toString()}`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders()
    }
  });

  return parseResponse(response);
}

/**
 * Admin: List Reports
 * GET /api/admin/reports
 */
export async function getAdminReports(page = 1, perPage = 20) {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage)
  });

  const response = await fetch(`${API_BASE_URL}/api/admin/reports?${query.toString()}`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders()
    }
  });

  return parseResponse(response);
}

/**
 * Admin: Generate Report
 * POST /api/admin/reports/generate
 */
export async function generateAdminReport(reportType = 'images', format = 'csv') {
  const response = await fetch(`${API_BASE_URL}/api/admin/reports/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      report_type: reportType,
      format
    })
  });

  return parseResponse(response);
}

/**
 * Flag Prediction for Retraining
 * POST /api/predictions/{prediction_id}/flag-for-retraining
 */
export async function flagPredictionForRetraining(
  predictionId,
  userId,
  reason = null
) {
  const response = await fetch(
    `${API_BASE_URL}/api/predictions/${predictionId}/flag-for-retraining`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        user_id: userId,
        ...(reason ? { reason: String(reason) } : {})
      })
    }
  );

  return parseResponse(response);
}

/**
 * Get Retraining Queue (Admin)
 * GET /api/admin/retraining-queue
 */
export async function getRetrainingQueue(
  page = 1,
  perPage = 20,
  status = 'PENDING'
) {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    status: String(status)
  });

  const response = await fetch(
    `${API_BASE_URL}/api/admin/retraining-queue?${query.toString()}`,
    {
      method: 'GET',
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return parseResponse(response);
}

/**
 * Update Retraining Queue Item (Admin)
 * PATCH /api/admin/retraining-queue/{queue_id}
 */
export async function updateRetrainingQueueItem(
  queueId,
  status,
  adminId = null,
  adminNotes = null
) {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/retraining-queue/${queueId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        status: String(status),
        ...(adminId ? { admin_id: Number(adminId) } : {}),
        ...(adminNotes ? { admin_notes: String(adminNotes) } : {})
      })
    }
  );

  return parseResponse(response);
}

/**
 * Get Low Confidence Predictions (Admin)
 * GET /api/admin/low-confidence-predictions
 */
export async function getLowConfidencePredictions(
  threshold = 0.7,
  limit = 100
) {
  const query = new URLSearchParams({
    threshold: String(threshold),
    limit: String(limit)
  });

  const response = await fetch(
    `${API_BASE_URL}/api/admin/low-confidence-predictions?${query.toString()}`,
    {
      method: 'GET',
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return parseResponse(response);
}

// Helper function to set auth token (useful for testing)
export function setAuthToken(token) {
  authToken = token;
}

// Helper function to get current user ID
export function getCurrentUserId() {
  return currentUserId;
}

// Helper function to check if user is admin
export function isAdminUser() {
  return false;
}

// Helper to set current user (optional)
export function setCurrentUserId(userId) {
  currentUserId = userId;
}




