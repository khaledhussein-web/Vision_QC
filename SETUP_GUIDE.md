# Quick Start Guide - Retraining Feature Setup

## 1. Database Setup

### Run the schema migration:
```bash
cd backend
psql -U postgres -d visionqc -f ../src/database/schema.sql
```

This will create the `retraining_queue` table with proper indexes.

---

## 2. Backend Setup

### Install required Python package:
```bash
pip install psycopg2-binary
```

### Set environment variables in `.env`:
```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=visionqc
```

### Verify the FastAPI service has the imports:
The `db_operations.py` module should be in the same `backend/` directory as `fastapi_service.py`.

### Start the backend:
```bash
cd backend
python -m uvicorn backend.fastapi_service:app --reload --host 127.0.0.1 --port 8000
```

---

## 3. Frontend Setup

No additional packages needed - all components use existing React libraries:
- `lucide-react` for icons (already in use)
- `useState` hook (already in use)

### Make sure API base URL is configured:
Check `vite.config.js` and ensure `VITE_API_BASE_URL` points to your backend:
```javascript
// .env.local or vite.config.js
VITE_API_BASE_URL=http://localhost:5000
```

### Start the frontend:
```bash
npm run dev
```

---

## 4. Test the Feature

### User Workflow Test:
1. Go to http://localhost:5173 (or your frontend URL)
2. Upload a plant image
3. If confidence < 70%, you'll see a red alert banner
4. Click "Flag for Model Retraining"
5. Enter an optional reason
6. Click "Confirm Flag"
7. Should see success message

### Admin Workflow Test:
1. Go to Admin Dashboard
2. Click "Retraining Queue" tab
3. You should see the flagged prediction in PENDING tab
4. Click on an item to view details
5. Click "Approve" or "Reject"
6. Check the APPROVED/REJECTED tabs to verify status change

---

## 5. API Testing (Optional)

### Test the /api/analyze endpoint:
```bash
curl -X POST http://localhost:5000/api/analyze \
  -F "image=@/path/to/plant.jpg" \
  -F "user_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test flagging endpoint:
```bash
curl -X POST http://localhost:5000/api/predictions/123/flag-for-retraining \
  -F "user_id=1" \
  -F "reason=Image was blurry" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test admin queue endpoint:
```bash
curl http://localhost:5000/api/admin/retraining-queue?page=1&per_page=10&status=PENDING \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 6. Troubleshooting

### Database Connection Error:
- Check DB credentials in environment variables
- Verify PostgreSQL is running: `pg_isready`
- Ensure database exists: `psql -l`

### API Not Found (404):
- Verify `db_operations.py` is in `backend/` directory
- Check FastAPI imports at top of `fastapi_service.py`
- Restart backend server

### Modal/Component Not Showing:
- Check browser console for JavaScript errors
- Verify `lucide-react` icons are imported correctly
- Clear browser cache and reload

### User ID Not Passed:
- Ensure user is authenticated before logging in
- Check `currentUser` prop is passed to `ResultScreen`
- Verify `App.jsx` passes `{ id: userId, ... }`

---

## 7. Configuration Options

### Adjust Low-Confidence Threshold:
Edit in `backend/fastapi_service.py`:
```python
LOW_CONFIDENCE_THRESHOLD = 0.70  # Change to 0.75 for 75%, etc.
```

Then in `ResultScreen.jsx`:
```javascript
const isLowConfidence = confidencePercent !== null && confidencePercent < 70;
```

### Adjust Queue Items Per Page:
In `RetrainingQueueScreen.jsx`:
```javascript
const PER_PAGE = 10;  // Change to 20, 50, etc.
```

### Adjust Auto-flagging Behavior:
In `fastapi_service.py` `/api/analyze` endpoint:
```python
if float(confidence) < 0.7:  # Change threshold here
    queue_id = flag_prediction_for_retraining(...)
```

---

## 8. Enable Authentication (Optional)

For production, add auth middleware to verify admin users:

```python
from fastapi import Depends, HTTPException

async def verify_admin(token: str = Header(...)):
    # Validate token and check admin role
    if not is_admin_user(token):
        raise HTTPException(status_code=403, detail="Admin access required")
    return token

@app.get("/api/admin/retraining-queue", dependencies=[Depends(verify_admin)])
async def get_retraining_queue_admin(...):
    ...
```

---

## 9. Monitoring & Maintenance

### Check Queue Size:
```sql
SELECT COUNT(*) as pending_count FROM retraining_queue WHERE status = 'PENDING';
SELECT COUNT(*) as approved_count FROM retraining_queue WHERE status = 'APPROVED';
```

### Monitor Low-Confidence Trends:
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as count,
  AVG(confidence) as avg_confidence
FROM prediction
WHERE confidence < 0.7
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;  -- Last 7 days
```

### Clear Old Retraining Records (optional):
```sql
-- Archive records older than 90 days
DELETE FROM retraining_queue 
WHERE reviewed_at < NOW() - INTERVAL '90 days'
AND status IN ('APPROVED', 'REJECTED');
```

---

## 10. Deployment Checklist

- [ ] Database schema initialized
- [ ] Python package `psycopg2-binary` installed
- [ ] Environment variables configured
- [ ] Backend service started
- [ ] Frontend configured with correct API URL
- [ ] Frontend service started
- [ ] Can upload image and see results
- [ ] Low-confidence predictions trigger alert
- [ ] Can flag prediction and see it in admin queue
- [ ] Admin can approve/reject flagged predictions
- [ ] Error handling works correctly
- [ ] Mobile UI is responsive
- [ ] API authentication working (if applicable)

---

## Quick Commands Reference

```bash
# Backend
cd backend
pip install psycopg2-binary
psql -U postgres -d visionqc -f ../src/database/schema.sql
python -m uvicorn backend.fastapi_service:app --reload --host 127.0.0.1 --port 8000

# Frontend
npm install
npm run dev

# Test endpoints
curl -X GET http://localhost:5000/api/admin/retraining-queue

# Database checks
psql -U postgres -d visionqc
> SELECT * FROM retraining_queue;
> SELECT COUNT(*) FROM retraining_queue WHERE status='PENDING';
```

---

## Additional Resources

- Full documentation: `RETRAINING_FEATURE_DOCUMENTATION.md`
- API endpoints reference: See documentation
- Database schema: `src/database/schema.sql`
- Component files:
  - `src/components/ResultScreen.jsx` - User flagging UI
  - `src/components/admin/RetrainingQueueScreen.jsx` - Admin queue
  - `backend/db_operations.py` - Database operations

---

**Last Updated:** March 31, 2026
**Status:** Ready for Production
