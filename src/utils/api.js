// VisionQC API Service Layer
// Real API endpoints (no mock responses)

// API base URL (override with VITE_API_BASE_URL if needed)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

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
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw {
      status: response.status,
      error: data.error || 'Request failed'
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
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  });

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
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token, password, password_confirmation })
  });

  return parseResponse(response);
}

/**
 * Analyze Image
 * POST /api/analyze
 */
export async function analyzeImage(
  imageFile
) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders()
    },
    body: formData
  });

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
  message
) {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ user_id: userId, message })
  });

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
