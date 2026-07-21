-- ============================================================
-- Migration 008 — Notifications, Refresh Tokens & Sessions
-- ReqAI – AI Requirement Analyzer
-- ============================================================

-- ------------------------------------
-- Table: notifications
-- ------------------------------------
CREATE TABLE notifications (
    id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notification_type   NOT NULL,
    title       VARCHAR(200)        NOT NULL,
    message     TEXT                NOT NULL,
    payload     JSONB               NOT NULL DEFAULT '{}',       -- context data (analysisId, requirementId…)
    is_read     BOOLEAN             NOT NULL DEFAULT FALSE,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT notif_read_ts CHECK (
        (is_read = TRUE  AND read_at IS NOT NULL) OR
        (is_read = FALSE AND read_at IS NULL)
    )
);

CREATE INDEX idx_notif_user_id      ON notifications (user_id);
CREATE INDEX idx_notif_unread       ON notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notif_type         ON notifications (type);
CREATE INDEX idx_notif_created_at   ON notifications (created_at DESC);

COMMENT ON TABLE notifications IS 'In-app notification inbox per user. Supports unread badge counts.';


-- ------------------------------------
-- Table: refresh_tokens
-- Server-side refresh token store (Redis mirror for DB fallback)
-- ------------------------------------
CREATE TABLE refresh_tokens (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(64) NOT NULL,                       -- SHA-256 of the raw refresh token
    device_info     VARCHAR(300),                               -- user-agent summary
    ip_address      INET,
    is_revoked      BOOLEAN     NOT NULL DEFAULT FALSE,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  VARCHAR(100),                               -- 'logout' | 'rotation' | 'admin_revoke'
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT rt_token_hash_unique     UNIQUE (token_hash),
    CONSTRAINT rt_revoke_consistency    CHECK (
        (is_revoked = TRUE  AND revoked_at IS NOT NULL) OR
        (is_revoked = FALSE AND revoked_at IS NULL)
    ),
    CONSTRAINT rt_expires_future        CHECK (expires_at > created_at)
);

CREATE INDEX idx_rt_user_id         ON refresh_tokens (user_id);
CREATE INDEX idx_rt_token_hash      ON refresh_tokens (token_hash);
CREATE INDEX idx_rt_expires_at      ON refresh_tokens (expires_at) WHERE is_revoked = FALSE;
CREATE INDEX idx_rt_active          ON refresh_tokens (user_id, is_revoked, expires_at)
    WHERE is_revoked = FALSE;

COMMENT ON TABLE  refresh_tokens                IS 'Persistent refresh token store. Enables cross-device session management and instant revocation.';
COMMENT ON COLUMN refresh_tokens.token_hash     IS 'SHA-256 hash of the raw UUID token. Raw token is never stored.';
COMMENT ON COLUMN refresh_tokens.revoked_reason IS 'Why the token was revoked: logout, rotation (new issued), or admin action.';


-- ------------------------------------
-- Function: purge expired refresh tokens (run nightly via pg_cron or app scheduler)
-- ------------------------------------
CREATE OR REPLACE FUNCTION purge_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW() - INTERVAL '1 day';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION purge_expired_refresh_tokens IS 'Deletes refresh tokens expired more than 24 hours ago. Schedule nightly.';
