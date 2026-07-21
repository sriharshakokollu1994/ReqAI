-- ============================================================
-- Migration 002 — Users Table
-- ReqAI – AI Requirement Analyzer
-- ============================================================

CREATE TABLE users (
    -- Identity
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255)    NOT NULL,
    password_hash       VARCHAR(255),                           -- NULL for SSO-only users
    first_name          VARCHAR(100)    NOT NULL,
    last_name           VARCHAR(100)    NOT NULL,

    -- Role & Status
    role                user_role       NOT NULL DEFAULT 'BUSINESS_ANALYST',
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    is_email_verified   BOOLEAN         NOT NULL DEFAULT FALSE,

    -- SSO
    sso_provider        VARCHAR(50),                            -- 'google' | 'microsoft'
    sso_subject         VARCHAR(255),                          -- external identity ID

    -- Profile
    avatar_url          VARCHAR(500),
    job_title           VARCHAR(150),
    department          VARCHAR(150),
    timezone            VARCHAR(80)     NOT NULL DEFAULT 'UTC',

    -- Security
    failed_login_count  SMALLINT        NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,

    -- Password Reset
    reset_token_hash    VARCHAR(255),
    reset_token_expires TIMESTAMPTZ,

    -- Email Verification
    verify_token_hash   VARCHAR(255),
    verify_token_expires TIMESTAMPTZ,

    -- Metadata
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,                            -- soft delete

    -- Constraints
    CONSTRAINT users_email_unique       UNIQUE (email),
    CONSTRAINT users_email_format       CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_first_name_length  CHECK (char_length(first_name) >= 1),
    CONSTRAINT users_last_name_length   CHECK (char_length(last_name) >= 1),
    CONSTRAINT users_sso_subject_unique UNIQUE (sso_provider, sso_subject),
    CONSTRAINT users_auth_required      CHECK (
        password_hash IS NOT NULL OR sso_provider IS NOT NULL
    )
);

-- ------------------------------------
-- Indexes
-- ------------------------------------
CREATE INDEX idx_users_email           ON users (email)         WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role            ON users (role)          WHERE deleted_at IS NULL;
CREATE INDEX idx_users_is_active       ON users (is_active)     WHERE deleted_at IS NULL;
CREATE INDEX idx_users_sso             ON users (sso_provider, sso_subject) WHERE sso_provider IS NOT NULL;
CREATE INDEX idx_users_created_at      ON users (created_at DESC);
CREATE INDEX idx_users_reset_token     ON users (reset_token_hash) WHERE reset_token_hash IS NOT NULL;

-- ------------------------------------
-- Trigger: auto-update updated_at
-- ------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ------------------------------------
-- Comments
-- ------------------------------------
COMMENT ON TABLE  users                     IS 'Platform users — all roles. Supports local auth and SSO.';
COMMENT ON COLUMN users.id                  IS 'UUID primary key — no sequential ID exposure';
COMMENT ON COLUMN users.password_hash       IS 'bcrypt hash (12 rounds). NULL for SSO-only users';
COMMENT ON COLUMN users.sso_subject         IS 'External identity provider subject ID (sub claim)';
COMMENT ON COLUMN users.failed_login_count  IS 'Resets to 0 on successful login. Lock at >= 5';
COMMENT ON COLUMN users.locked_until        IS 'Account locked until this timestamp. NULL = not locked';
COMMENT ON COLUMN users.deleted_at          IS 'Soft delete. Never hard-delete user records';
