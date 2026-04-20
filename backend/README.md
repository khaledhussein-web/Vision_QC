# VisionQC Backend

This is the backend server for the VisionQC application, connecting to a PostgreSQL database.

## Setup

1. Ensure PostgreSQL is installed and running locally.

2. Create a database named `visionqc_db`.

3. Update `backend/.env` with your database connection string:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/visionqc_db
   JWT_SECRET=your_secret_key
   ```

   Optional password reset delivery via Resend, SMTP, or Microsoft Graph OAuth2:
   ```
   PASSWORD_RESET_DELIVERY_MODE=auto

   RESEND_API_KEY=re_xxxxxxxxx
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   RESEND_FROM_NAME=VisionQC
   RESEND_SEND_TIMEOUT_MS=15000
   # Optional override:
   # RESEND_API_BASE_URL=https://api.resend.com

   SMTP_HOST=smtp.yourprovider.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_CONNECTION_TIMEOUT_MS=15000
   SMTP_GREETING_TIMEOUT_MS=15000
   SMTP_SOCKET_TIMEOUT_MS=20000
   SMTP_DNS_TIMEOUT_MS=2000
   SMTP_SEND_TIMEOUT_MS=15000
   SMTP_USER=your_smtp_username
   SMTP_PASS=your_smtp_password
   SMTP_FROM_NAME=VisionQC
   SMTP_FROM_EMAIL=noreply@yourdomain.com
   SMTP_SUBJECT=VisionQC Password Reset
   RESET_PASSWORD_URL=http://localhost:5173/reset-password
   PASSWORD_RESET_EXPIRY_MINUTES=30
   EXPOSE_RESET_TOKEN_IN_RESPONSE=true

   GRAPH_TENANT_ID=your-entra-tenant-id
   GRAPH_CLIENT_ID=your-app-client-id
   GRAPH_CLIENT_SECRET=your-app-client-secret
   GRAPH_SENDER_EMAIL=noreply@yourdomain.com
   # Optional override:
   # GRAPH_API_BASE_URL=https://graph.microsoft.com/v1.0
   ```
   Notes:
   - `PASSWORD_RESET_DELIVERY_MODE` supports: `auto` (Resend then Graph then SMTP), `resend`, `graph`, or `smtp`.
   - Resend mode requires a verified sender domain/address in your Resend account.
   - If outbound SMTP ports are blocked by firewall/network policy, SMTP delivery will fail (timeouts). In that case use Graph mode or allow outbound SMTP.
   - `RESET_PASSWORD_URL` is the frontend page users open from email.
   - `EXPOSE_RESET_TOKEN_IN_RESPONSE` should be `false` in production.
   - If delivery is not configured, forgot-password still returns a safe generic message and (in dev) exposes reset URL.
   - For Graph app-only sending, grant application permission `Mail.Send` and admin-consent it in Microsoft Entra.
   - Personal Outlook/Hotmail consumer mailboxes often cannot use app-only Graph sending; Microsoft 365 work/school mailboxes are recommended.

   Optional prediction-quality tuning (FastAPI service):
   ```
   MODEL_ID=linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification
   QUALITY_GATE_THRESHOLD=0.65
   LOW_CONFIDENCE_THRESHOLD=0.65
   LOW_MARGIN_THRESHOLD=0.10
   STRICT_CROP_GATE=false
   ENABLE_HARD_CROP_GATE=false
   CROP_PRIOR_MIN_CONF=0.35
   CROP_PRIOR_STRENGTH=0.55
   CROP_PRIOR_FLOOR=0.08
   ENABLE_OPEN_WORLD_CROP_CHECK=true
   OPEN_WORLD_MODEL_ID=openai/clip-vit-base-patch32
   OPEN_WORLD_LOCAL_FILES_ONLY=true
   OPEN_WORLD_USE_AS_HINT_CONF=0.40
   OPEN_WORLD_MIN_UNSUPPORTED_CONF=0.45
   OPEN_WORLD_TOP_K=5
   ```

   Optional request field:
   - `crop_hint` (multipart form text) lets you force prediction within a known crop.
   - If `crop_hint` is not supported by the current model labels, API returns `unsupported_crop` instead of a wrong disease class.
   - With `ENABLE_OPEN_WORLD_CROP_CHECK=true`, the service also auto-detects likely unsupported crops and returns `unsupported_crop` instead of forcing a wrong class.

4. Install dependencies:
   ```
   npm install
   ```

5. Set up Python 3.11 tooling for the FastAPI service:
   ```
   py -3.11 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
   ```

6. Initialize the database (create tables and insert initial data):
   ```
   npm run init-db
   ```

7. Start the server:
   ```
   npm start
   ```

8. Start the FastAPI service:
   ```
   .\.venv\Scripts\python.exe -m uvicorn backend.fastapi_service:app --host 127.0.0.1 --port 8000 --reload
   ```

The server will run on `http://localhost:5000`.


