import { API_BASE_URL } from '../constants/config';

const parseResponse = async (response) => {
  const raw = await response.text().catch(() => '');
  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    data = {};
  }

  if (!response.ok) {
    const fallbackDetail = String(raw || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);

    throw {
      status: response.status,
      error: data.error || response.statusText || 'Request failed',
      detail: data.detail || fallbackDetail || null,
      hint: data.hint || null
    };
  }

  return data;
};

const authHeaders = (token) => {
  const normalized = String(token || '').trim();
  if (!normalized) return {};
  return { Authorization: `Bearer ${normalized}` };
};

const jsonHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...authHeaders(token)
});

export const loginApi = async ({ email, password }) => {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password })
  });
  return parseResponse(response);
};

export const registerApi = async ({ fullName, email, password, passwordConfirm }) => {
  const response = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      full_name: fullName,
      email,
      password,
      password_confirm: passwordConfirm
    })
  });
  return parseResponse(response);
};

export const forgotPasswordApi = async (email) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email })
  });
  return parseResponse(response);
};

export const validateResetTokenApi = async (token) => {
  const query = new URLSearchParams({ token: String(token || '').trim() });
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password/validate?${query.toString()}`);
  return parseResponse(response);
};

export const resetPasswordApi = async ({ token, password, passwordConfirmation }) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      token,
      password,
      password_confirmation: passwordConfirmation
    })
  });
  return parseResponse(response);
};

export const analyzeImageApi = async ({ token, imageAsset, cropHint = '' }) => {
  const formData = new FormData();
  const uri = String(imageAsset?.uri || '').trim();
  if (!uri) {
    throw { error: 'Image URI is missing' };
  }

  const filename = imageAsset?.fileName || imageAsset?.name || `capture-${Date.now()}.jpg`;
  const mimeType = imageAsset?.mimeType || 'image/jpeg';
  formData.append('image', {
    uri,
    name: filename,
    type: mimeType
  });

  const hintValue = String(cropHint || '').trim();
  if (hintValue) {
    formData.append('crop_hint', hintValue);
  }

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData
  });
  return parseResponse(response);
};

export const getHistoryApi = async ({ token, userId, page = 1, perPage = 20 }) => {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage)
  });

  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/history?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(token)
  });
  return parseResponse(response);
};

export const getPredictionDetailsApi = async ({ token, predictionId }) => {
  const response = await fetch(`${API_BASE_URL}/api/predictions/${predictionId}`, {
    method: 'GET',
    headers: authHeaders(token)
  });
  return parseResponse(response);
};

export const toggleBookmarkApi = async ({ token, predictionId, userId, action }) => {
  const response = await fetch(`${API_BASE_URL}/api/predictions/${predictionId}/bookmark`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      user_id: userId,
      action
    })
  });
  return parseResponse(response);
};

export const sendChatMessageApi = async ({
  token,
  userId,
  message,
  history = [],
  chatId = null,
  predictionId = null
}) => {
  const payload = {
    user_id: userId,
    message,
    history
  };

  if (chatId) payload.chat_id = String(chatId);
  if (predictionId) payload.prediction_id = String(predictionId);

  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(payload)
  });
  return parseResponse(response);
};

export const flagForRetrainingApi = async ({ token, predictionId, userId, reason }) => {
  const response = await fetch(`${API_BASE_URL}/api/predictions/${predictionId}/flag-for-retraining`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      user_id: userId,
      ...(reason ? { reason } : {})
    })
  });
  return parseResponse(response);
};

export const getAdminUsersApi = async ({ token, page = 1, perPage = 20 }) => {
  const query = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  const response = await fetch(`${API_BASE_URL}/api/admin/users?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(token)
  });
  return parseResponse(response);
};

export const createAdminUserApi = async ({ token, payload }) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(payload || {})
  });
  return parseResponse(response);
};

export const updateAdminUserApi = async ({ token, userId, payload }) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify(payload || {})
  });
  return parseResponse(response);
};

export const deleteAdminUserApi = async ({ token, userId }) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(token)
  });
  return parseResponse(response);
};

export const getAdminImagesApi = async ({ token, page = 1, perPage = 20 }) => {
  const query = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  const response = await fetch(`${API_BASE_URL}/api/admin/images?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(token)
  });
  return parseResponse(response);
};

export const getAdminReportsApi = async ({ token, page = 1, perPage = 20 }) => {
  const query = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  const response = await fetch(`${API_BASE_URL}/api/admin/reports?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(token)
  });
  return parseResponse(response);
};

export const generateAdminReportApi = async ({ token, reportType = 'images', format = 'csv' }) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/reports/generate`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      report_type: reportType,
      format
    })
  });
  return parseResponse(response);
};

export const getRetrainingQueueApi = async ({ token, page = 1, perPage = 20, status = 'PENDING' }) => {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    status: String(status).toUpperCase()
  });
  const response = await fetch(`${API_BASE_URL}/api/admin/retraining-queue?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(token)
  });
  return parseResponse(response);
};

export const updateRetrainingQueueApi = async ({
  token,
  queueId,
  status,
  adminId = null,
  adminNotes = ''
}) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/retraining-queue/${queueId}`, {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      status,
      ...(adminId ? { admin_id: adminId } : {}),
      ...(adminNotes ? { admin_notes: adminNotes } : {})
    })
  });
  return parseResponse(response);
};

export const getAnnotatorQueueApi = async ({ token, page = 1, perPage = 20, status = 'PENDING' }) => {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    status: String(status).toUpperCase()
  });
  const response = await fetch(`${API_BASE_URL}/api/annotator/queue?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(token)
  });
  return parseResponse(response);
};

export const getAnnotatorQueueItemApi = async ({ token, queueId }) => {
  const response = await fetch(`${API_BASE_URL}/api/annotator/queue/${queueId}`, {
    method: 'GET',
    headers: authHeaders(token)
  });
  return parseResponse(response);
};

export const getLowConfidencePredictionsApi = async ({ token, threshold = 0.7, limit = 100 }) => {
  const query = new URLSearchParams({
    threshold: String(threshold),
    limit: String(limit)
  });
  const response = await fetch(`${API_BASE_URL}/api/admin/low-confidence-predictions?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(token)
  });
  return parseResponse(response);
};

export const submitAnnotatorCorrectionApi = async ({
  token,
  queueId = null,
  predictionId,
  correctedLabel,
  annotationNotes
}) => {
  const response = await fetch(`${API_BASE_URL}/api/annotator/corrections`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      ...(queueId ? { queue_id: queueId } : {}),
      prediction_id: predictionId,
      corrected_label: correctedLabel,
      notes: annotationNotes
    })
  });
  return parseResponse(response);
};
