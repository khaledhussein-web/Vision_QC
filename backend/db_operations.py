"""
Database operations for VisionQC including predictions persistence and retraining queue management.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from datetime import datetime
from typing import Optional, Dict, Any, List

# Database connection pooling
_db_connection = None

def get_connection():
    """Get or create database connection."""
    global _db_connection
    
    if _db_connection is not None and not _db_connection.closed:
        return _db_connection
    
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'postgres'),
            database=os.getenv('DB_NAME', 'visionqc'),
            port=os.getenv('DB_PORT', 5432),
            connect_timeout=5
        )
        _db_connection = conn
        return conn
    except psycopg2.Error as e:
        print(f"Database connection error: {e}")
        return None


def store_prediction(
    user_id: int,
    image_id: int,
    label: str,
    confidence: float,
    heatmap_url: Optional[str] = None,
    suggested_sc: Optional[str] = None,
    crop: Optional[str] = None,
    inference_mode: str = "standard",
    raw_data: Optional[Dict] = None,
) -> Optional[int]:
    """
    Store a prediction to the database.
    Returns prediction_id on success, None on failure.
    """
    conn = get_connection()
    if not conn:
        print("Cannot store prediction: no database connection")
        return None
    
    try:
        with conn.cursor() as cur:
            # Store in prediction table
            query = """
            INSERT INTO prediction (image_id, label, confidence, heatmap_url, suggested_sc)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING prediction_id;
            """
            
            cur.execute(query, (
                image_id,
                label,
                float(confidence),
                heatmap_url,
                suggested_sc
            ))
            
            prediction_id = cur.fetchone()[0]
            conn.commit()
            return prediction_id
            
    except psycopg2.Error as e:
        print(f"Error storing prediction: {e}")
        conn.rollback()
        return None


def store_image(user_id: int, image_path: str) -> Optional[int]:
    """
    Store an image record to the database.
    Returns image_id on success, None on failure.
    """
    conn = get_connection()
    if not conn:
        return None
    
    try:
        with conn.cursor() as cur:
            query = """
            INSERT INTO image (user_id, image_path, uploaded_at)
            VALUES (%s, %s, NOW())
            RETURNING image_id;
            """
            
            cur.execute(query, (user_id, image_path))
            image_id = cur.fetchone()[0]
            conn.commit()
            return image_id
            
    except psycopg2.Error as e:
        print(f"Error storing image: {e}")
        conn.rollback()
        return None


def flag_prediction_for_retraining(
    prediction_id: int,
    user_id: int,
    confidence_score: float,
    reason: Optional[str] = None,
) -> Optional[int]:
    """
    Flag a prediction for retraining (create retraining queue entry).
    Returns queue_id on success, None on failure.
    """
    conn = get_connection()
    if not conn:
        return None
    
    try:
        with conn.cursor() as cur:
            # Check if already flagged
            check_query = """
            SELECT queue_id FROM retraining_queue 
            WHERE prediction_id = %s AND status = 'PENDING';
            """
            cur.execute(check_query, (prediction_id,))
            existing = cur.fetchone()
            
            if existing:
                return existing[0]  # Already flagged
            
            # Create new retraining queue entry
            query = """
            INSERT INTO retraining_queue 
            (prediction_id, flagged_by_user_id, confidence_score, reason, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'PENDING', NOW(), NOW())
            RETURNING queue_id;
            """
            
            cur.execute(query, (prediction_id, user_id, float(confidence_score), reason))
            queue_id = cur.fetchone()[0]
            conn.commit()
            return queue_id
            
    except psycopg2.Error as e:
        print(f"Error flagging prediction for retraining: {e}")
        conn.rollback()
        return None


def get_retraining_queue(
    page: int = 1,
    per_page: int = 20,
    status: str = "PENDING",
) -> Dict[str, Any]:
    """
    Get retraining queue entries with pagination.
    """
    conn = get_connection()
    if not conn:
        return {"items": [], "total": 0, "page": page}
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get total count
            count_query = "SELECT COUNT(*) FROM retraining_queue WHERE status = %s;"
            cur.execute(count_query, (status,))
            total = cur.fetchone()["count"]
            
            # Get paginated results
            offset = (page - 1) * per_page
            query = """
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
                img.image_path
            FROM retraining_queue rq
            JOIN prediction p ON rq.prediction_id = p.prediction_id
            JOIN users u ON rq.flagged_by_user_id = u.user_id
            LEFT JOIN image img ON p.image_id = img.image_id
            WHERE rq.status = %s
            ORDER BY rq.created_at DESC
            LIMIT %s OFFSET %s;
            """
            
            cur.execute(query, (status, per_page, offset))
            items = cur.fetchall()
            
            return {
                "items": [dict(row) for row in items],
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page
            }
            
    except psycopg2.Error as e:
        print(f"Error fetching retraining queue: {e}")
        return {"items": [], "total": 0, "page": page}


def update_retraining_request(
    queue_id: int,
    status: str,
    admin_id: Optional[int] = None,
    admin_notes: Optional[str] = None,
) -> bool:
    """
    Update a retraining request status (APPROVED, REJECTED, CANCELLED).
    """
    conn = get_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor() as cur:
            query = """
            UPDATE retraining_queue
            SET status = %s, admin_id = %s, admin_notes = %s, reviewed_at = NOW(), updated_at = NOW()
            WHERE queue_id = %s;
            """
            
            cur.execute(query, (status, admin_id, admin_notes, queue_id))
            conn.commit()
            return cur.rowcount > 0
            
    except psycopg2.Error as e:
        print(f"Error updating retraining request: {e}")
        conn.rollback()
        return False


def get_prediction_with_details(prediction_id: int) -> Optional[Dict[str, Any]]:
    """
    Get full prediction details including image and user.
    """
    conn = get_connection()
    if not conn:
        return None
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
            SELECT 
                p.prediction_id,
                p.image_id,
                p.label,
                p.confidence,
                p.heatmap_url,
                p.suggested_sc,
                p.created_at,
                p.updated_at,
                i.user_id,
                i.image_path,
                i.uploaded_at,
                u.full_name,
                u.email
            FROM prediction p
            JOIN image i ON p.image_id = i.image_id
            JOIN users u ON i.user_id = u.user_id
            WHERE p.prediction_id = %s;
            """
            
            cur.execute(query, (prediction_id,))
            result = cur.fetchone()
            return dict(result) if result else None
            
    except psycopg2.Error as e:
        print(f"Error fetching prediction details: {e}")
        return None


def get_user_history(user_id: int, page: int = 1, per_page: int = 20) -> Dict[str, Any]:
    """
    Get user's prediction history.
    """
    conn = get_connection()
    if not conn:
        return {"items": [], "total": 0}
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get total count
            count_query = "SELECT COUNT(*) FROM prediction p JOIN image i ON p.image_id = i.image_id WHERE i.user_id = %s;"
            cur.execute(count_query, (user_id,))
            total = cur.fetchone()["count"]
            
            # Get paginated results
            offset = (page - 1) * per_page
            query = """
            SELECT 
                p.prediction_id,
                p.image_id,
                p.label,
                p.confidence,
                p.created_at,
                i.image_path,
                i.uploaded_at
            FROM prediction p
            JOIN image i ON p.image_id = i.image_id
            WHERE i.user_id = %s
            ORDER BY p.created_at DESC
            LIMIT %s OFFSET %s;
            """
            
            cur.execute(query, (user_id, per_page, offset))
            items = cur.fetchall()
            
            return {
                "items": [dict(row) for row in items],
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page
            }
            
    except psycopg2.Error as e:
        print(f"Error fetching user history: {e}")
        return {"items": [], "total": 0}


def get_low_confidence_predictions(threshold: float = 0.7, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Get predictions below confidence threshold (for admin review).
    """
    conn = get_connection()
    if not conn:
        return []
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
            SELECT 
                p.prediction_id,
                p.image_id,
                p.label,
                p.confidence,
                p.created_at,
                i.user_id,
                i.image_path
            FROM prediction p
            JOIN image i ON p.image_id = i.image_id
            WHERE p.confidence < %s
            AND NOT EXISTS (
                SELECT 1 FROM retraining_queue rq 
                WHERE rq.prediction_id = p.prediction_id AND rq.status = 'PENDING'
            )
            ORDER BY p.confidence ASC, p.created_at DESC
            LIMIT %s;
            """
            
            cur.execute(query, (threshold, limit))
            results = cur.fetchall()
            return [dict(row) for row in results]
            
    except psycopg2.Error as e:
        print(f"Error fetching low confidence predictions: {e}")
        return []
