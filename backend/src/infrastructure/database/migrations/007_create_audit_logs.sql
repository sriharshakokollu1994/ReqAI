-- ============================================================
-- Migration 007 — Audit Log
-- ReqAI – AI Requirement Analyzer
-- Immutable, append-only record of all user actions.
-- NEVER UPDATE or DELETE rows in this table.
-- ============================================================

CREATE TABLE audit_logs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            REFERENCES users(id) ON DELETE SET NULL, -- NULL for system/anonymous
    impersonated_by UUID            REFERENCES users(id) ON DELETE SET NULL, -- for admin impersonation

    -- What happened
    action          audit_action    NOT NULL,
    entity_type     VARCHAR(100)    NOT NULL,                   -- 'requirement' | 'project' | 'analysis' ...
    entity_id       UUID,                                       -- NULL for non-entity actions (login)
    entity_label    VARCHAR(500),                               -- human-readable entity name snapshot

    -- Change data capture
    before_state    JSONB,                                      -- NULL for CREATE / READ / LOGIN
    after_state     JSONB,                                      -- NULL for DELETE / LOGOUT
    changed_fields  TEXT[],                                     -- list of field names that changed

    -- Request context
    ip_address      INET,
    user_agent      TEXT,
    request_id      VARCHAR(100),                               -- correlation ID from request header
    session_id      VARCHAR(100),

    -- Outcome
    succeeded       BOOLEAN         NOT NULL DEFAULT TRUE,
    error_message   TEXT,

    -- Timestamp (immutable — no updated_at)
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT al_entity_on_mutation CHECK (
        action IN ('LOGIN','LOGOUT') OR entity_id IS NOT NULL
    )
);

-- ------------------------------------
-- Indexes
-- ------------------------------------
CREATE INDEX idx_al_user_id         ON audit_logs (user_id)         WHERE user_id IS NOT NULL;
CREATE INDEX idx_al_action          ON audit_logs (action);
CREATE INDEX idx_al_entity_type     ON audit_logs (entity_type);
CREATE INDEX idx_al_entity_id       ON audit_logs (entity_id)       WHERE entity_id IS NOT NULL;
CREATE INDEX idx_al_created_at      ON audit_logs (created_at DESC);
CREATE INDEX idx_al_succeeded       ON audit_logs (succeeded)       WHERE succeeded = FALSE;
CREATE INDEX idx_al_ip_address      ON audit_logs (ip_address)      WHERE ip_address IS NOT NULL;
CREATE INDEX idx_al_request_id      ON audit_logs (request_id)      WHERE request_id IS NOT NULL;
CREATE INDEX idx_al_session_id      ON audit_logs (session_id)      WHERE session_id IS NOT NULL;

-- Composite: security forensics queries
CREATE INDEX idx_al_user_action_date ON audit_logs (user_id, action, created_at DESC);
CREATE INDEX idx_al_entity_history   ON audit_logs (entity_type, entity_id, created_at DESC);

-- ------------------------------------
-- Prevent updates and deletes (immutability enforcement)
-- ------------------------------------
CREATE OR REPLACE FUNCTION trigger_audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only — UPDATE and DELETE are forbidden. Row id: %', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_audit_log_immutable();

CREATE TRIGGER trg_audit_log_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_audit_log_immutable();

-- ------------------------------------
-- Views: security & reporting
-- ------------------------------------

-- Recent security-relevant events (failed auth, unusual access)
CREATE VIEW v_security_events AS
SELECT
    al.created_at,
    al.action,
    al.entity_type,
    al.entity_label,
    al.ip_address,
    al.succeeded,
    al.error_message,
    u.email         AS user_email,
    u.role          AS user_role
FROM audit_logs al
LEFT JOIN users u ON u.id = al.user_id
WHERE al.action IN ('LOGIN','LOGOUT','REVOKE','DELETE')
   OR al.succeeded = FALSE
ORDER BY al.created_at DESC;

-- Per-entity change history
CREATE VIEW v_entity_change_history AS
SELECT
    al.created_at,
    al.action,
    al.entity_type,
    al.entity_id,
    al.entity_label,
    al.before_state,
    al.after_state,
    al.changed_fields,
    u.first_name || ' ' || u.last_name  AS changed_by,
    u.role                              AS changed_by_role
FROM audit_logs al
LEFT JOIN users u ON u.id = al.user_id
WHERE al.action IN ('CREATE','UPDATE','DELETE')
ORDER BY al.created_at DESC;

-- ------------------------------------
-- Comments
-- ------------------------------------
COMMENT ON TABLE  audit_logs                    IS 'Immutable, append-only audit trail. UPDATE and DELETE blocked by triggers. Required for compliance.';
COMMENT ON COLUMN audit_logs.impersonated_by    IS 'Set when an admin performs an action while impersonating another user.';
COMMENT ON COLUMN audit_logs.before_state       IS 'Full entity JSON snapshot before the mutation. NULL for CREATE.';
COMMENT ON COLUMN audit_logs.after_state        IS 'Full entity JSON snapshot after the mutation. NULL for DELETE.';
COMMENT ON COLUMN audit_logs.changed_fields     IS 'Array of field names that were modified. Populated for UPDATE actions.';
COMMENT ON COLUMN audit_logs.request_id         IS 'HTTP correlation ID — ties audit entry to application log lines.';
