// VisionQC API Service Layer
// All API endpoints with mock responses matching the exact structure specified

// Simulated delay for realistic API behavior
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock JWT token
let authToken = null;
let currentUserId = 1;

// Mock data storage
const mockUsers = new Map();
const mockPredictions = new Map();
const mockImages = new Map();
const mockChatHistory = new Map();
let nextImageId = 1;
let nextPredictionId = 1;
let nextMessageId = 1;

// Initialize some mock data
mockUsers.set(1, {
  user_id: 1,
  email: 'user@visionqc.com',
  password: 'password123',
  role: 'user'
});

mockUsers.set(999, {
  user_id: 999,
  email: 'admin@visionqc.com',
  password: 'admin123',
  role: 'admin'
});

// API Functions

/**
 * Login Authentication
 * POST /api/login
 */
export async function login(username, password) {
  await delay(800);
  
  // Check credentials
  let foundUser = null;
  mockUsers.forEach((user) => {
    if (user.email === username && user.password === password) {
      foundUser = user;
    }
  });

  if (!foundUser) {
    throw {
      status: 401,
      error: 'Invalid credentials'
    };
  }

  // Generate token
  authToken = `mock_token_${foundUser.user_id}_${Date.now()}`;
  currentUserId = foundUser.user_id;

  return {
    token: authToken,
    user_id: foundUser.user_id
  };
}

/**
 * User Registration
 * POST /api/register
 */
export async function register(
  email,
  password,
  password_confirm
) {
  await delay(1000);

  if (password !== password_confirm) {
    throw {
      status: 400,
      error: 'Passwords do not match'
    };
  }

  // Check if email already exists
  let emailExists = false;
  mockUsers.forEach((user) => {
    if (user.email === email) {
      emailExists = true;
    }
  });

  if (emailExists) {
    throw {
      status: 409,
      error: 'Email already registered'
    };
  }

  const newUserId = mockUsers.size + 1;
  mockUsers.set(newUserId, {
    user_id: newUserId,
    email,
    password,
    role: 'user'
  });

  currentUserId = newUserId;
  authToken = `mock_token_${newUserId}_${Date.now()}`;

  return {
    status: 'success',
    user_id: newUserId
  };
}

/**
 * Forgot Password
 * POST /api/auth/forgot-password
 */
export async function forgotPassword(email) {
  await delay(1500);

  // Check if email exists
  let emailExists = false;
  mockUsers.forEach((user) => {
    if (user.email === email) {
      emailExists = true;
    }
  });

  if (!emailExists) {
    throw {
      status: 404,
      error: 'Email not found'
    };
  }

  return {
    status: 'success',
    message: 'Password reset link has been sent to your email'
  };
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
  await delay(1000);

  if (password !== password_confirmation) {
    throw {
      status: 400,
      error: 'Passwords do not match'
    };
  }

  if (!token || token.length < 10) {
    throw {
      status: 400,
      error: 'Invalid reset token'
    };
  }

  return {
    status: 'success',
    message: 'Password has been reset successfully'
  };
}

/**
 * Upload Image
 * POST /api/images/upload
 */
export async function uploadImage(
  imageFile,
  metadata
) {
  await delay(1500);

  if (!authToken) {
    throw {
      status: 401,
      error: 'Authorization required'
    };
  }

  const imageId = nextImageId++;
  const imageUrl = typeof imageFile === 'string' 
    ? imageFile 
    : URL.createObjectURL(imageFile);

  const imageData = {
    image_id: imageId,
    image_url: imageUrl,
    uploaded_at: new Date().toISOString(),
    user_id: currentUserId,
    metadata
  };

  mockImages.set(imageId, imageData);

  // Automatically create a prediction for this image
  const diseases = [
    'Early Blight',
    'Late Blight',
    'Powdery Mildew',
    'Bacterial Spot',
    'Leaf Mold',
    'Septoria Leaf Spot',
    'Spider Mites',
    'Target Spot',
    'Yellow Leaf Curl Virus',
    'Mosaic Virus',
    'Healthy'
  ];

  const solutions = {
    'Early Blight': 'Apply fungicide containing chlorothalonil or copper. Remove affected leaves and improve air circulation. Water at soil level to avoid wetting foliage.',
    'Late Blight': 'Remove and destroy infected plants immediately. Apply copper-based fungicides preventatively. Ensure good air circulation and avoid overhead watering.',
    'Powdery Mildew': 'Apply sulfur or potassium bicarbonate fungicides. Improve air circulation around plants. Remove affected leaves and avoid overhead watering.',
    'Bacterial Spot': 'Use copper-based bactericides. Remove infected plant parts. Avoid working with plants when wet. Practice crop rotation.',
    'Leaf Mold': 'Improve ventilation and reduce humidity. Apply fungicides containing chlorothalonil. Remove infected leaves promptly.',
    'Septoria Leaf Spot': 'Apply organic fungicides like copper or sulfur. Remove infected leaves. Mulch around plants to prevent soil splash. Ensure proper spacing.',
    'Spider Mites': 'Spray with insecticidal soap or neem oil. Increase humidity around plants. Remove heavily infested leaves. Introduce beneficial predatory mites.',
    'Target Spot': 'Apply fungicide containing chlorothalonil. Remove infected leaves. Improve air circulation. Avoid overhead irrigation.',
    'Yellow Leaf Curl Virus': 'Control whitefly populations with insecticidal soap. Remove infected plants. Use virus-resistant varieties. Install reflective mulches.',
    'Mosaic Virus': 'Remove and destroy infected plants. Control aphid populations. Disinfect tools between plants. Plant virus-resistant varieties.',
    'Healthy': 'Your plant appears healthy! Continue current care routine: proper watering, adequate sunlight, and regular monitoring for any signs of disease.'
  };

  const randomDisease = diseases[Math.floor(Math.random() * diseases.length)];
  const confidence = 85 + Math.random() * 14; // 85-99%

  const predictionId = nextPredictionId++;
  const predictionData = {
    prediction_id: predictionId,
    image_id: imageId,
    label: randomDisease,
    confidence: parseFloat(confidence.toFixed(1)),
    heatmap_url: imageUrl,
    suggested_solution: solutions[randomDisease] || 'Consult with a plant pathologist for proper diagnosis and treatment.',
    created_at: new Date().toISOString(),
    bookmarked: false,
    user_id: currentUserId,
    image_url: imageUrl
  };

  mockPredictions.set(predictionId, predictionData);

  return {
    image_id: imageId,
    image_url: imageUrl,
    uploaded_at: new Date().toISOString(),
    prediction: {
      prediction_id: predictionData.prediction_id,
      image_id: predictionData.image_id,
      label: predictionData.label,
      confidence: predictionData.confidence,
      heatmap_url: predictionData.heatmap_url,
      suggested_solution: predictionData.suggested_solution
    }
  };
}

/**
 * Get Prediction Details
 * GET /api/predictions/{prediction_id}
 */
export async function getPredictionDetails(predictionId) {
  await delay(500);

  const prediction = mockPredictions.get(predictionId);

  if (!prediction) {
    throw {
      status: 404,
      error: 'Prediction not found'
    };
  }

  return {
    prediction_id: prediction.prediction_id,
    image_id: prediction.image_id,
    label: prediction.label,
    confidence: prediction.confidence,
    heatmap_url: prediction.heatmap_url,
    suggested_solution: prediction.suggested_solution
  };
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
  await delay(700);

  if (!authToken) {
    throw {
      status: 401,
      error: 'Authorization required'
    };
  }

  // Get all predictions for this user
  const userPredictions = [];
  mockPredictions.forEach((prediction) => {
    if (prediction.user_id === userId) {
      const image = mockImages.get(prediction.image_id);
      userPredictions.push({
        prediction_id: prediction.prediction_id,
        image_url: image?.image_url || prediction.heatmap_url,
        label: prediction.label,
        confidence: prediction.confidence,
        suggested_solution: prediction.suggested_solution,
        heatmap_url: prediction.heatmap_url,
        created_at: prediction.created_at,
        bookmarked: prediction.bookmarked || false
      });
    }
  });

  // Sort by date (newest first)
  userPredictions.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Paginate
  const start = (page - 1) * perPage;
  const paginatedItems = userPredictions.slice(start, start + perPage);

  return {
    page,
    per_page: perPage,
    total: userPredictions.length,
    items: paginatedItems
  };
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
  await delay(400);

  if (!authToken) {
    throw {
      status: 401,
      error: 'Authorization required'
    };
  }

  const prediction = mockPredictions.get(predictionId);

  if (!prediction) {
    throw {
      status: 404,
      error: 'Prediction not found'
    };
  }

  prediction.bookmarked = action === 'add';
  mockPredictions.set(predictionId, prediction);

  return {
    status: 'success',
    bookmarked: prediction.bookmarked
  };
}

/**
 * Get Chat History
 * GET /api/chat/{chat_id}
 */
export async function getChatHistory(chatId) {
  await delay(600);

  if (!authToken) {
    throw {
      status: 401,
      error: 'Authorization required'
    };
  }

  const messages = mockChatHistory.get(chatId) || [];

  return {
    chat_id: chatId,
    user_id: currentUserId,
    messages
  };
}

/**
 * Chat with AI Agent
 * POST /api/chat
 */
export async function sendChatMessage(
  userId,
  message
) {
  await delay(1200);

  if (!authToken) {
    throw {
      status: 401,
      error: 'Authorization required'
    };
  }

  const chatId = userId; // Simple mapping: one chat per user
  const messageId = nextMessageId++;
  const timestamp = new Date().toISOString();

  // Save user message
  if (!mockChatHistory.has(chatId)) {
    mockChatHistory.set(chatId, []);
  }

  const chatMessages = mockChatHistory.get(chatId);
  chatMessages.push({
    message_id: messageId,
    sender: 'user',
    content: message,
    created_at: timestamp
  });

  // Generate AI response
  const aiResponses = [
    "Based on the image you've shared, I can see signs of leaf discoloration. This could indicate a nutrient deficiency or early stages of disease. Could you provide more details about the plant's watering schedule?",
    "The symptoms you're describing are consistent with powdery mildew. I recommend improving air circulation around the plant and applying a fungicide treatment. Would you like specific product recommendations?",
    "That's a great question! For prevention, ensure proper spacing between plants, water at the base rather than overhead, and remove any infected leaves promptly. Regular monitoring is key to early detection.",
    "The confidence score indicates a high probability of accurate diagnosis. The suggested treatment plan should help your plant recover within 2-3 weeks if applied correctly. Make sure to follow the application instructions carefully.",
    "I can help you understand the heatmap overlay. The red areas indicate where the AI detected the most significant disease symptoms. This helps you target your treatment more effectively."
  ];

  const aiResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
  const aiMessageId = nextMessageId++;
  const aiTimestamp = new Date(Date.now() + 1000).toISOString();

  chatMessages.push({
    message_id: aiMessageId,
    sender: 'ai',
    content: aiResponse,
    created_at: aiTimestamp
  });

  mockChatHistory.set(chatId, chatMessages);

  // Return user's message as per API spec
  return {
    chat_id: chatId,
    message_id: messageId,
    sender: 'user',
    content: message,
    created_at: timestamp
  };
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
  await delay(2000);

  if (!authToken) {
    throw {
      status: 401,
      error: 'Authorization required'
    };
  }

  const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const startsAt = new Date().toISOString();
  
  // Calculate end date based on plan
  const endDate = new Date();
  if (plan === 'monthly') {
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (plan === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }
  const endsAt = endDate.toISOString();

  return {
    status: 'success',
    transaction_id: transactionId,
    plan,
    starts_at: startsAt,
    ends_at: endsAt
  };
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
  const user = mockUsers.get(currentUserId);
  return user?.role === 'admin';
}
