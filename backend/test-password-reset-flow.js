const path = require('path');
const { spawn } = require('child_process');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const TEST_HOST = '127.0.0.1';
const TEST_PORT = Number(process.env.TEST_BACKEND_PORT || 5059);
const BASE_URL = `http://${TEST_HOST}:${TEST_PORT}`;
const SERVER_START_TIMEOUT_MS = 20000;
const REQUEST_TIMEOUT_MS = 10000;

const fetchFn = (...args) => {
  if (typeof fetch === 'function') {
    return fetch(...args);
  }
  return import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, timeoutMs, label) => {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const requestJson = async (method, endpoint, body, expectedStatuses = [200]) => {
  const headers = { 'Content-Type': 'application/json' };
  const response = await withTimeout(
    fetchFn(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    }),
    REQUEST_TIMEOUT_MS,
    `${method} ${endpoint}`
  );

  const raw = await response.text().catch(() => '');
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    data = {};
  }

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${method} ${endpoint} expected status ${expectedStatuses.join('/')} but got ${response.status}. Body: ${raw || '<empty>'}`
    );
  }

  return { status: response.status, data };
};

const waitForServer = async () => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
    try {
      const response = await fetchFn(`${BASE_URL}/api/auth/reset-password/validate`);
      if ([400, 404].includes(response.status)) {
        return;
      }
    } catch (_error) {
      // Keep retrying until timeout.
    }
    await sleep(300);
  }

  throw new Error(`Backend did not become ready at ${BASE_URL} within ${SERVER_START_TIMEOUT_MS}ms`);
};

const startServer = () => {
  const serverEnv = {
    ...process.env,
    HOST: TEST_HOST,
    PORT: String(TEST_PORT),
    EXPOSE_RESET_TOKEN_IN_RESPONSE: 'true',
    SMTP_URL: '',
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM_EMAIL: ''
  };

  const child = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[backend] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[backend:err] ${chunk}`);
  });

  return child;
};

const cleanupUser = async (email) => {
  if (!email || !process.env.DATABASE_URL) return;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await pool.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  } finally {
    await pool.end();
  }
};

const run = async () => {
  const unique = Date.now();
  const email = `pwreset-test-${unique}@visionqc.test`;
  const originalPassword = 'Original123';
  const nextPassword = 'Updated123';
  let server = null;

  try {
    console.log('Starting backend server for password reset integration test...');
    server = startServer();
    await waitForServer();
    console.log('Backend is ready.');

    console.log('1) Registering test user...');
    await requestJson(
      'POST',
      '/api/register',
      {
        full_name: 'Password Reset Test User',
        email,
        password: originalPassword,
        password_confirm: originalPassword
      },
      [201]
    );

    console.log('2) Requesting forgot password...');
    const forgotResponse = await requestJson(
      'POST',
      '/api/auth/forgot-password',
      { email },
      [200]
    );
    const resetToken = String(forgotResponse.data?.reset_token || '').trim();
    if (!resetToken) {
      throw new Error('Forgot password response did not include reset_token. Ensure EXPOSE_RESET_TOKEN_IN_RESPONSE=true.');
    }

    console.log('3) Validating reset token...');
    await requestJson(
      'GET',
      `/api/auth/reset-password/validate?token=${encodeURIComponent(resetToken)}`,
      null,
      [200]
    );

    console.log('4) Resetting password...');
    await requestJson(
      'POST',
      '/api/auth/reset-password',
      {
        token: resetToken,
        password: nextPassword,
        password_confirmation: nextPassword
      },
      [200]
    );

    console.log('5) Confirm old password fails...');
    await requestJson(
      'POST',
      '/api/login',
      {
        email,
        password: originalPassword
      },
      [401]
    );

    console.log('6) Confirm new password succeeds...');
    const loginResponse = await requestJson(
      'POST',
      '/api/login',
      {
        email,
        password: nextPassword
      },
      [200]
    );
    if (!loginResponse.data?.token) {
      throw new Error('Login with new password succeeded but token missing in response.');
    }

    console.log('7) Confirm used reset token is invalidated...');
    await requestJson(
      'GET',
      `/api/auth/reset-password/validate?token=${encodeURIComponent(resetToken)}`,
      null,
      [400]
    );

    console.log('Password reset integration test PASSED.');
    process.exitCode = 0;
  } catch (error) {
    console.error('Password reset integration test FAILED.');
    console.error(error?.message || error);
    process.exitCode = 1;
  } finally {
    if (server && !server.killed) {
      server.kill('SIGTERM');
      await sleep(500);
      if (!server.killed) {
        server.kill('SIGKILL');
      }
    }
    await cleanupUser(email).catch((cleanupError) => {
      console.error('Cleanup warning:', cleanupError?.message || cleanupError);
    });
  }
};

run();
