-- ============================================================
-- VisionQC - Full PostgreSQL Schema (Single users table + RBAC)
-- Includes: roles/permissions, sessions, images, predictions,
-- bookmarks, subscriptions, reports, label corrections,
-- AI chat + messages (linked to image/prediction)
-- ============================================================

-- (Optional) clean start (careful in production)
-- DROP TABLE IF EXISTS ai_chatmessage, ai_chat, bookmark, label_correction, report,
--   prediction, image, session, subscription, role_permission, permission, role, users
--   CASCADE;

-- =========================
-- 1) RBAC: role / permission
-- =========================

CREATE TABLE role (
  role_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE permission (
  permission_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE role_permission (
  role_id       INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role
    FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm
    FOREIGN KEY (permission_id) REFERENCES permission(permission_id) ON DELETE CASCADE
);

-- =========================
-- 2) users (ONE table only)
-- =========================

CREATE TABLE users (
  user_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,

  role_id        INT NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE / SUSPENDED

  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login     TIMESTAMP NULL,

  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES role(role_id)
);

-- =========================
-- 3) session (JWT sessions)
-- =========================

CREATE TABLE session (
  session_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INT NOT NULL,

  token        VARCHAR(255) NOT NULL UNIQUE,
  expires_at   TIMESTAMP NOT NULL,
  is_valid     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_session_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =========================
-- 4) image / prediction
-- =========================

CREATE TABLE image (
  image_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INT NOT NULL,

  image_path   VARCHAR(255) NOT NULL,
  uploaded_at  TIMESTAMP NOT NULL DEFAULT NOW(),

  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_image_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE prediction (
  prediction_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  image_id        INT NOT NULL,

  label           VARCHAR(120) NOT NULL,
  confidence      DECIMAL(6,4) NOT NULL,  -- 0.0000 -> 1.0000

  heatmap_url     VARCHAR(255) NULL,
  suggested_sc    TEXT NULL,              -- keeps same naming as your diagram

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_prediction_image
    FOREIGN KEY (image_id) REFERENCES image(image_id) ON DELETE CASCADE,

  -- If you want 1 image -> 1 prediction (like your diagram)
  CONSTRAINT uq_prediction_image UNIQUE (image_id)
);

-- =========================
-- 5) subscription
-- =========================

CREATE TABLE subscription (
  subscription_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         INT NOT NULL,

  plan            VARCHAR(60) NOT NULL,
  starts_at       TIMESTAMP NOT NULL,
  ends_at         TIMESTAMP NULL,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_subscription_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =========================
-- 6) report
-- =========================

CREATE TABLE report (
  report_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operator_id    INT NOT NULL,            -- operator is a user with role OPERATOR

  report_type    VARCHAR(60) NOT NULL,
  format         VARCHAR(20) NOT NULL,
  download_link  VARCHAR(255) NULL,

  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_report_operator
    FOREIGN KEY (operator_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =========================
-- 7) label_correction
-- =========================

CREATE TABLE label_correction (
  correction_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  image_id       INT NOT NULL,
  operator_id    INT NOT NULL,

  old_label      VARCHAR(120) NOT NULL,
  new_label      VARCHAR(120) NOT NULL,

  corrected_at   TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_lc_image
    FOREIGN KEY (image_id) REFERENCES image(image_id) ON DELETE CASCADE,
  CONSTRAINT fk_lc_operator
    FOREIGN KEY (operator_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =========================
-- 8) bookmark
-- =========================

CREATE TABLE bookmark (
  bookmark_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       INT NOT NULL,
  prediction_id INT NOT NULL,

  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_bookmark_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_bookmark_prediction
    FOREIGN KEY (prediction_id) REFERENCES prediction(prediction_id) ON DELETE CASCADE,

  CONSTRAINT uq_bookmark UNIQUE (user_id, prediction_id)
);

-- =========================
-- 9) AI chat (solution / treatment assistant)
-- =========================

CREATE TABLE ai_chat (
  chat_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       INT NOT NULL,

  -- link chat to a case (optional but recommended)
  image_id      INT NULL,
  prediction_id INT NULL,

  topic         VARCHAR(80) NULL,  -- "treatment", "prevention", "solution", etc.
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_chat_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,

  CONSTRAINT fk_chat_image
    FOREIGN KEY (image_id) REFERENCES image(image_id) ON DELETE SET NULL,

  CONSTRAINT fk_chat_prediction
    FOREIGN KEY (prediction_id) REFERENCES prediction(prediction_id) ON DELETE SET NULL
);

CREATE TABLE ai_chatmessage (
  message_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id      INT NOT NULL,

  sender       VARCHAR(30) NOT NULL, -- 'USER' or 'AI'
  content      TEXT NOT NULL,

  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_msg_chat
    FOREIGN KEY (chat_id) REFERENCES ai_chat(chat_id) ON DELETE CASCADE
);



CREATE INDEX idx_session_user_id ON session(user_id);
CREATE INDEX idx_image_user_id ON image(user_id);
CREATE INDEX idx_prediction_image_id ON prediction(image_id);
CREATE INDEX idx_report_operator_id ON report(operator_id);
CREATE INDEX idx_lc_image_id ON label_correction(image_id);
CREATE INDEX idx_bookmark_user_id ON bookmark(user_id);
CREATE INDEX idx_ai_chat_user_id ON ai_chat(user_id);

CREATE INDEX idx_ai_chatmessage_chat_id_created_at
  ON ai_chatmessage (chat_id, created_at);

-- =========================
-- 10) retraining_queue (Low-score flagging for retraining)
-- =========================

CREATE TABLE retraining_queue (
  queue_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prediction_id     INT NOT NULL,
  flagged_by_user_id INT NOT NULL,

  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / APPROVED / REJECTED
  
  confidence_score  DECIMAL(6,4) NOT NULL, -- Store the confidence at time of flagging
  reason            VARCHAR(255) NULL,     -- User's reason for flagging (optional)
  
  admin_id          INT NULL,              -- Admin who reviewed it
  admin_notes       TEXT NULL,
  reviewed_at       TIMESTAMP NULL,

  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_rq_prediction
    FOREIGN KEY (prediction_id) REFERENCES prediction(prediction_id) ON DELETE CASCADE,
  CONSTRAINT fk_rq_user
    FOREIGN KEY (flagged_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_rq_admin
    FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_retraining_queue_status ON retraining_queue(status);
CREATE INDEX idx_retraining_queue_prediction_id ON retraining_queue(prediction_id);
CREATE INDEX idx_retraining_queue_user_id ON retraining_queue(flagged_by_user_id);
CREATE INDEX idx_retraining_queue_created_at ON retraining_queue(created_at DESC);

INSERT INTO role (name) VALUES ('USER')  ON CONFLICT (name) DO NOTHING;
INSERT INTO role (name) VALUES ('ADMIN') ON CONFLICT (name) DO NOTHING;

