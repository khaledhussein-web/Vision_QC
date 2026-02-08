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

## Initial Users

- Admin: admin@visionqc.com / admin123
- User: user@visionqc.com / password123
