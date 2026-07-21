-- ============================================================
-- Migration 003 — Projects & Project Members
-- ReqAI – AI Requirement Analyzer
-- ============================================================

-- ------------------------------------
-- Table: projects
-- ------------------------------------
CREATE TABLE projects (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200)    NOT NULL,
    description     TEXT,
    status          project_status  NOT NULL DEFAULT 'ACTIVE',
    owner_id        UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_archived     BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Metadata
    tags            TEXT[]          NOT NULL DEFAULT '{}',
    settings        JSONB           NOT NULL DEFAULT '{}',     -- future extensibility

    -- Timestamps
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    archived_at     TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT projects_name_length   CHECK (char_length(name) BETWEEN 2 AND 200),
    CONSTRAINT projects_archived_ts   CHECK (
        (is_archived = FALSE AND archived_at IS NULL) OR
        (is_archived = TRUE  AND archived_at IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_projects_owner_id   ON projects (owner_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_status     ON projects (status)       WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_is_archived ON projects (is_archived) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_created_at ON projects (created_at DESC);
CREATE INDEX idx_projects_tags       ON projects USING GIN (tags);
CREATE INDEX idx_projects_name_trgm  ON projects USING GIN (name gin_trgm_ops);

-- Trigger
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- Comments
COMMENT ON TABLE  projects              IS 'Top-level containers for grouping requirements';
COMMENT ON COLUMN projects.settings     IS 'Reserved JSONB for future project-level configuration';
COMMENT ON COLUMN projects.tags         IS 'Array of free-form tags for project categorisation';


-- ------------------------------------
-- Table: project_members
-- ------------------------------------
CREATE TABLE project_members (
    id          UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID                    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID                    NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    role        project_member_role     NOT NULL DEFAULT 'MEMBER',
    invited_by  UUID                    REFERENCES users(id) ON DELETE SET NULL,
    joined_at   TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT pm_unique_membership UNIQUE (project_id, user_id)
);

-- Indexes
CREATE INDEX idx_project_members_project_id ON project_members (project_id);
CREATE INDEX idx_project_members_user_id    ON project_members (user_id);
CREATE INDEX idx_project_members_role       ON project_members (role);

-- Comments
COMMENT ON TABLE  project_members              IS 'Many-to-many between projects and users with per-project roles';
COMMENT ON COLUMN project_members.invited_by   IS 'Which user sent the invitation. NULL if self-joined or migrated';
