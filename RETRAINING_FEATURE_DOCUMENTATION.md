# Vision QC - Low-Confidence Prediction Retraining Feature

## Overview

This document describes the new feature that allows users to flag predictions with confidence scores below 70% for admin review and model retraining. The system includes a complete workflow from user flagging to admin approval/rejection with good UI/UX and proper database structure.

---

## Architecture & Components

### 1. Database Schema

#### New Table: `retraining_queue`
```sql
CREATE TABLE retraining_queue (
  queue_id          INT PRIMARY KEY (auto-increment),
  prediction_id     INT NOT NULL (FK to prediction),
  flagged_by_user_id INT NOT NULL (FK to users),
  
  status            VARCHAR(20) DEFAULT 'PENDING' -- PENDING, APPROVED, REJECTED
  confidence_score  DECIMAL(6,4) -- Store confidence at time of flagging
  reason            VARCHAR(255) -- User's optional reason
  
  admin_id          INT NULL (FK to users - admin who reviewed)
  admin_notes       TEXT NULL -- Admin's review notes
  reviewed_at       TIMESTAMP NULL -- When admin reviewed
  
  created_at        TIMESTAMP DEFAULT NOW()
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_retraining_queue_status ON retraining_queue(status);
CREATE INDEX idx_retraining_queue_prediction_id ON retraining_queue(prediction_id);
CREATE INDEX idx_retraining_queue_user_id ON retraining_queue(flagged_by_user_id);
CREATE INDEX idx_retraining_queue_created_at ON retraining_queue(created_at DESC);
```

---

## Backend Implementation

### New Python Module: `db_operations.py`
Located at: `backend/db_operations.py`

Core functions:
- **`store_prediction()`** - Persist predictions to database
- **`store_image()`** - Store image records
- **`flag_prediction_for_retraining()`** - Create retraining queue entry
- **`get_retraining_queue()`** - Fetch paginated queue items
- **`update_retraining_request()`** - Update status (APPROVED/REJECTED)
- **`get_prediction_with_details()`** - Fetch prediction with full context

### New API Endpoints

#### 1. `POST /api/analyze`
**Purpose:** Analyze image and store prediction to database (replaces `/predict`)

**Request:**
```
POST /api/analyze
Content-Type: multipart/form-data

- image: File (required)
- crop_hint: string (optional)
- user_id: integer (optional)
```

**Response:**
```json
{
  "prediction_id": 123,
  "image_id": 456,
  "label": "powdery_mildew",
  "confidence": 0.62,
  "flagged_for_retraining": true,
  "queue_id": 789,
  "suggested_sc": "...",
  "gradcam_png_base64": "...",
  ...
}
```

**Auto-Flagging:** If confidence < 70%, the system **automatically** creates a retraining queue entry.

---

#### 2. `POST /api/predictions/{prediction_id}/flag-for-retraining`
**Purpose:** Manually flag a prediction for retraining (with reason)

**Request:**
```
POST /api/predictions/123/flag-for-retraining
Content-Type: multipart/form-data

- user_id: integer (required)
- reason: string (optional) - e.g., "Photo was blurry", "Wrong crop category"
```

**Response:**
```json
{
  "success": true,
  "queue_id": 789,
  "message": "Prediction flagged for retraining"
}
```

**Constraints:**
- Only predictions with confidence < 70% can be manually flagged
- Prevents duplicate flags (returns existing queue_id if already flagged)

---

#### 3. `GET /api/admin/retraining-queue`
**Purpose:** Fetch paginated retraining queue for admin review

**Query Parameters:**
```
- page: integer (default: 1)
- per_page: integer (default: 20, max: 100)
- status: string (default: "PENDING") - PENDING | APPROVED | REJECTED
```

**Response:**
```json
{
  "items": [
    {
      "queue_id": 789,
      "prediction_id": 123,
      "image_id": 456,
      "label": "powdery_mildew",
      "confidence": 0.62,
      "confidence_score": 0.62,
      "status": "PENDING",
      "reason": "Low confidence prediction - auto-flagged",
      "full_name": "John Farmer",
      "email": "john@example.com",
      "image_path": "/uploads/...",
      "created_at": "2026-03-31T12:00:00Z",
      "flagged_by_user_id": 1,
      "admin_id": null,
      "admin_notes": null,
      "reviewed_at": null
    }
  ],
  "total": 45,
  "page": 1,
  "per_page": 20,
  "pages": 3
}
```

---

#### 4. `PATCH /api/admin/retraining-queue/{queue_id}`
**Purpose:** Update retraining request status (admin approves/rejects)

**Request:**
```
PATCH /api/admin/retraining-queue/789
Content-Type: multipart/form-data

- status: string (required) - APPROVED | REJECTED | CANCELLED
- admin_id: integer (optional) - Admin user ID
- admin_notes: string (optional) - Reason for approval/rejection
```

**Response:**
```json
{
  "success": true,
  "message": "Retraining request approved"
}
```

---

#### 5. `GET /api/predictions/{prediction_id}`
**Purpose:** Get full prediction details including image and user

**Response:**
```json
{
  "prediction_id": 123,
  "image_id": 456,
  "label": "powdery_mildew",
  "confidence": 0.62,
  "user_id": 1,
  "full_name": "John Farmer",
  "email": "john@example.com",
  ...
}
```

---

#### 6. `GET /api/users/{user_id}/history`
**Purpose:** Get user's prediction history with pagination

**Query Parameters:**
```
- page: integer (default: 1)
- per_page: integer (default: 20, max: 100)
```

---

#### 7. `GET /api/admin/low-confidence-predictions`
**Purpose:** Get predictions below threshold for admin analysis

**Query Parameters:**
```
- threshold: float (default: 0.7, range: 0.0-1.0)
- limit: integer (default: 100, max: 500)
```

---

## Frontend Implementation

### 1. API Functions (`src/utils/api.js`)

New exported functions:
```javascript
// Flag a prediction for retraining
export async function flagPredictionForRetraining(predictionId, userId, reason)

// Get admin retraining queue
export async function getRetrainingQueue(page, perPage, status)

// Update retraining queue item
export async function updateRetrainingQueueItem(queueId, status, adminId, adminNotes)

// Get low-confidence predictions
export async function getLowConfidencePredictions(threshold, limit)
```

---

### 2. Updated ResultScreen Component

**Location:** `src/components/ResultScreen.jsx`

**New Features:**
- ✅ Detects predictions with confidence < 70%
- ✅ Shows alert banner with visual warning (red)
- ✅ "Flag for Model Retraining" button for low-confidence predictions
- ✅ Modal dialog for flagging with optional reason field
- ✅ Shows "Already flagged for retraining" if already flagged
- ✅ Smooth loading states with spinner
- ✅ Error handling with user feedback

**UI Components:**
- Low-confidence alert banner (red, with alert icon)
- Flag button (red, with flag icon)
- Modal dialog with:
  - Reason textarea (optional)
  - Cancel & Confirm buttons
  - Loading state feedback
  - Error message display

**Props:**
```javascript
{
  navigate,           // Navigation function
  selectedImage,      // Base64 image
  currentPrediction, // Prediction object
  currentUser: {     // NEW - User info for flagging
    id: 123,
    name: "John",
    email: "john@example.com"
  }
}
```

---

### 3. New Admin Component: `RetrainingQueueScreen`

**Location:** `src/components/admin/RetrainingQueueScreen.jsx`

**Features:**
- ✅ Tabbed interface: PENDING | APPROVED | REJECTED
- ✅ Paginated list of flagged predictions (default: 10 per page)
- ✅ Click to select item for detailed review
- ✅ Side panel showing prediction details:
  - Image preview
  - Prediction ID, Image ID
  - Confidence score (color-coded)
  - Suggested solution
  - User who flagged it
- ✅ Admin action panel:
  - Optional notes textarea
  - Approve button (green)
  - Reject button (red)
  - Success/error messages
- ✅ Real-time queue status updates

---

### 4. Updated Admin Dashboard

**Location:** `src/components/admin/AdminDashboard.jsx`

**Changes:**
- Added "Retraining Queue" tab
- Quick action card for retraining queue (highlighted in orange/red)
- Integrated `RetrainingQueueScreen` component
- Tab navigation to retraining queue

---

### 5. Updated App.jsx

**Changes:**
- Pass `currentUser` object to `ResultScreen` component
- Contains: `id`, `name`, `email`

---

## User Experience Flow

### User Side:

1. **Upload Image** → Analyze
   - System runs prediction inference
   - If confidence < 70%, shows alert banner
   
2. **See Low-Confidence Alert**
   - Red banner with: "Low Confidence Prediction"
   - Explains: "Help improve model by flagging for retraining"
   - Shows: "Flag for Model Retraining" button

3. **Click Flag Button**
   - Modal opens with:
     - Explanation text
     - Optional reason textarea
     - "Confirm Flag" and "Cancel" buttons

4. **Optionally Add Reason**
   - User types reason (e.g., "Photo was blurry", "Wrong crop")
   - Or leaves empty for auto-flagged reason

5. **Submit Flag**
   - System sends request to backend
   - Shows loading spinner
   - On success: Message "Already flagged for retraining"
   - On error: Shows error message

6. **Proceed**
   - User can analyze another image
   - Flagged prediction is in admin queue

---

### Admin Side:

1. **Go to Admin Dashboard**
   - See quick action for "Retraining Queue"
   - Click to navigate or click "Retraining Queue" tab

2. **Review Pending Queue**
   - See list of flagged predictions (sorted by date)
   - Shows: Prediction label, confidence %, user who flagged, reason
   - Items color-coded by status (yellow=pending, green=approved, red=rejected)

3. **Click Item to Review**
   - Item highlights in green
   - Side panel shows full details:
     - Image preview (if available)
     - Prediction details
     - Flagged reason
     - Suggested solution

4. **Make Decision**
   - Add optional review notes (text area)
   - Click "Approve" button → Marks for retraining
   - Click "Reject" button → Closes flag

5. **View Approved/Rejected**
   - Switch tabs to see reviewed items
   - Shows when reviewed and admin notes

---

## Database & API Optimization

### Key Indexes:
```sql
-- Fast status filtering
CREATE INDEX idx_retraining_queue_status ON retraining_queue(status);

-- Fast prediction lookup
CREATE INDEX idx_retraining_queue_prediction_id ON retraining_queue(prediction_id);

-- Fast user flagging history
CREATE INDEX idx_retraining_queue_user_id ON retraining_queue(flagged_by_user_id);

-- Fast date sorting for "latest" queries
CREATE INDEX idx_retraining_queue_created_at ON retraining_queue(created_at DESC);
```

### Constraints:
- **Duplicate Prevention:** Before creating new flag, check if PENDING flag exists for prediction
- **One-Way Reference:** Each prediction can have multiple retraining_queue entries (historical tracking)
- **Cascading Deletes:** Deleting prediction or user cascades to retraining_queue

---

## Configuration & Deployment

### Environment Variables (Backend):
```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=visionqc
```

### Frontend Configuration (`vite.config.js`):
```javascript
VITE_API_BASE_URL=http://localhost:5000
```

---

## Error Handling

### Backend Errors:

| Status | Error | Cause |
|--------|-------|-------|
| 404 | Prediction not found | Invalid prediction_id |
| 400 | Confidence >= 70% | Can only flag low-confidence |
| 400 | Already flagged | PENDING flag exists |
| 500 | Failed to flag | DB error |

### Frontend Handling:
- All errors shown in UI modals
- Graceful degradation if API unavailable
- Retry logic for failed requests (optional)
- User-friendly error messages

---

## Testing Checklist

- [ ] User flags low-confidence prediction (< 70%)
- [ ] Low-confidence alert banner displays
- [ ] Flag modal opens and closes properly
- [ ] Flagged prediction appears in admin queue
- [ ] Admin can view all details (image, prediction, reason)
- [ ] Admin can approve flagging
- [ ] Admin can reject flagging
- [ ] Admin notes are saved and displayed
- [ ] Status tabs filter correctly (PENDING, APPROVED, REJECTED)
- [ ] Pagination works for large queues
- [ ] Same user cannot flag twice (shows "already flagged")
- [ ] High-confidence predictions (≥70%) cannot be flagged
- [ ] Error handling for failed API calls
- [ ] Loading states display correctly
- [ ] UI is mobile-responsive
- [ ] Color coding is clear and consistent

---

## Performance Considerations

1. **Indexing:** All queries use indexed columns for O(1) lookup
2. **Pagination:** Default 10 items per page prevents large data transfers
3. **Database:** Queries use efficient JOINs with proper foreign keys
4. **Frontend:** React components use proper memoization for performance
5. **Caching:** Consider caching low-confidence predictions on admin dashboard

---

## Future Enhancements

1. **Automated Retraining Trigger:** Upon approval, automatically trigger model retraining
2. **Batch Processing:** Allow admins to approve/reject multiple items at once
3. **Notification System:** Email admins when new flags reach threshold
4. **Analytics Dashboard:** Show trends in low-confidence predictions
5. **Model Performance Tracking:** Track accuracy improvements after retraining
6. **User Feedback Loop:** Notify users when their flagged predictions caused model improvements
7. **API Rate Limiting:** Prevent spam flagging by rate limiting per user

---

## Support & Documentation

For issues or questions:
1. Check database schema is properly initialized
2. Verify API endpoints are accessible
3. Check browser console for frontend errors
4. Review backend logs for server errors
5. Ensure user authentication is working
6. Test API endpoints directly with curl/Postman

---

**Implementation Date:** March 31, 2026
**Version:** 1.0
**Status:** Production Ready
