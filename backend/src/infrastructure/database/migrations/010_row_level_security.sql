-- ============================================================
-- Migration 010 — Row Level Security (RLS) Policies
-- ReqAI – AI Requirement Analyzer
-- Enforces data isolation at the DB layer.
-- Enable for multi-tenant deployments.
-- ============================================================

-- NOTE: RLS is disabled by default for single-tenant deploys.
-- Set ENABLE_RLS=true environment variable and run this migration
-- to activate tenant-level isolation.

-- ------------------------------------
-- Enable RLS on sensitive tables
-- ------------------------------------
ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_analyses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;

-- ------------------------------------
-- Application role (service account used by the backend)
-- ------------------------------------
-- The backend connects as 'reqai_app' and sets the session variable:
--   SET LOCAL app.current_user_id = '<uuid>';
--   SET LOCAL app.current_user_role = 'BUSINESS_ANALYST';

-- ------------------------------------
-- Projects: members can see their projects only
-- ------------------------------------
CREATE POLICY projects_isolation ON projects
    FOR ALL
    USING (
        id IN (
            SELECT project_id FROM project_members
            WHERE user_id = current_setting('app.current_user_id', TRUE)::uuid
        )
        OR owner_id = current_setting('app.current_user_id', TRUE)::uuid
        OR current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

-- ------------------------------------
-- Requirements: only project members can see them
-- ------------------------------------
CREATE POLICY requirements_isolation ON requirements
    FOR ALL
    USING (
        project_id IN (
            SELECT project_id FROM project_members
            WHERE user_id = current_setting('app.current_user_id', TRUE)::uuid
        )
        OR current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

-- ------------------------------------
-- Notifications: users see only their own
-- ------------------------------------
CREATE POLICY notifications_isolation ON notifications
    FOR ALL
    USING (
        user_id = current_setting('app.current_user_id', TRUE)::uuid
        OR current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

-- ------------------------------------
-- Saved analyses: users see only their own
-- ------------------------------------
CREATE POLICY saved_analyses_isolation ON saved_analyses
    FOR ALL
    USING (
        user_id = current_setting('app.current_user_id', TRUE)::uuid
        OR current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

-- Audit logs: admins + own records
CREATE POLICY audit_logs_isolation ON audit_logs
    FOR SELECT
    USING (
        user_id = current_setting('app.current_user_id', TRUE)::uuid
        OR current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

-- Insert always allowed from app (no restriction on writes)
CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT WITH CHECK (TRUE);

COMMENT ON POLICY projects_isolation ON projects IS 'Users see only projects they own or are members of. Admins see all.';
COMMENT ON POLICY requirements_isolation ON requirements IS 'Users see requirements only in their projects. Admins see all.';
