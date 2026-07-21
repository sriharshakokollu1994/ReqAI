-- ============================================================
-- Migration 004 — Requirements & Requirement Versions
-- ReqAI – AI Requirement Analyzer
-- ============================================================

-- ------------------------------------
-- Table: requirements
-- ------------------------------------
CREATE TABLE requirements (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID                NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by      UUID                NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
    updated_by      UUID                REFERENCES users(id)             ON DELETE SET NULL,

    -- Core fields
    title           VARCHAR(500)        NOT NULL,
    body            TEXT                NOT NULL,
    type            requirement_type    NOT NULL DEFAULT 'FUNCTIONAL',
    priority        priority_level      NOT NULL DEFAULT 'MEDIUM',
    status          requirement_status  NOT NULL DEFAULT 'DRAFT',

    -- Metadata
    source          VARCHAR(200),                                -- e.g. 'Jira-PROJ-42', 'email', 'upload'
    source_file_url VARCHAR(500),                               -- S3 URL of uploaded document
    tags            TEXT[]              NOT NULL DEFAULT '{}',
    version         INTEGER             NOT NULL DEFAULT 1,      -- incremented on each body change
    word_count      INTEGER             GENERATED ALWAYS AS (
                        array_length(regexp_split_to_array(trim(body), '\s+'), 1)
                    ) STORED,

    -- Relationships
    parent_id       UUID                REFERENCES requirements(id) ON DELETE SET NULL,  -- for sub-requirements

    -- Timestamps
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    analyzed_at     TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT req_title_length     CHECK (char_length(title) BETWEEN 3 AND 500),
    CONSTRAINT req_body_length      CHECK (char_length(body)  >= 10),
    CONSTRAINT req_version_positive CHECK (version >= 1),
    CONSTRAINT req_no_self_parent   CHECK (id <> parent_id),
    CONSTRAINT req_approved_ts      CHECK (
        (status = 'APPROVED' AND approved_at IS NOT NULL) OR
        (status <> 'APPROVED')
    ),
    CONSTRAINT req_analyzed_ts      CHECK (
        (status IN ('ANALYZED','REVIEWED','APPROVED') AND analyzed_at IS NOT NULL) OR
        (status NOT IN ('ANALYZED','REVIEWED','APPROVED'))
    )
);

-- Indexes
CREATE INDEX idx_req_project_id       ON requirements (project_id)      WHERE deleted_at IS NULL;
CREATE INDEX idx_req_created_by       ON requirements (created_by)      WHERE deleted_at IS NULL;
CREATE INDEX idx_req_status           ON requirements (status)          WHERE deleted_at IS NULL;
CREATE INDEX idx_req_priority         ON requirements (priority)        WHERE deleted_at IS NULL;
CREATE INDEX idx_req_type             ON requirements (type)            WHERE deleted_at IS NULL;
CREATE INDEX idx_req_parent_id        ON requirements (parent_id)       WHERE parent_id IS NOT NULL;
CREATE INDEX idx_req_created_at       ON requirements (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_req_tags             ON requirements USING GIN (tags);
CREATE INDEX idx_req_title_trgm       ON requirements USING GIN (title gin_trgm_ops);
CREATE INDEX idx_req_body_fts         ON requirements USING GIN (to_tsvector('english', body));
CREATE INDEX idx_req_project_status   ON requirements (project_id, status) WHERE deleted_at IS NULL;

-- Trigger
CREATE TRIGGER trg_requirements_updated_at
    BEFORE UPDATE ON requirements
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- Auto-increment version when body changes
CREATE OR REPLACE FUNCTION trigger_increment_version()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.body IS DISTINCT FROM NEW.body THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_requirements_version
    BEFORE UPDATE ON requirements
    FOR EACH ROW
    EXECUTE FUNCTION trigger_increment_version();

-- Comments
COMMENT ON TABLE  requirements                  IS 'Core entity. Each requirement belongs to a project and is versioned.';
COMMENT ON COLUMN requirements.body             IS 'Raw requirement text. Min 10 chars. Triggers version increment on change.';
COMMENT ON COLUMN requirements.word_count       IS 'Auto-computed from body. Used for AI token estimation.';
COMMENT ON COLUMN requirements.source_file_url  IS 'S3/storage URL of original uploaded document (PDF, TXT, MD).';
COMMENT ON COLUMN requirements.version         IS 'Incremented automatically when body is updated.';
COMMENT ON COLUMN requirements.parent_id       IS 'Self-referencing FK for sub-requirements and requirement hierarchies.';


-- ------------------------------------
-- Table: requirement_versions
-- Immutable snapshot on each body change
-- ------------------------------------
CREATE TABLE requirement_versions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id  UUID        NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    version         INTEGER     NOT NULL,
    title           VARCHAR(500) NOT NULL,
    body            TEXT        NOT NULL,
    changed_by      UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    change_summary  VARCHAR(500),                               -- human-readable note
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT rv_version_positive          CHECK (version >= 1),
    CONSTRAINT rv_unique_version_per_req    UNIQUE (requirement_id, version)
);

-- Indexes
CREATE INDEX idx_rv_requirement_id  ON requirement_versions (requirement_id);
CREATE INDEX idx_rv_version         ON requirement_versions (requirement_id, version DESC);
CREATE INDEX idx_rv_changed_by      ON requirement_versions (changed_by);
CREATE INDEX idx_rv_created_at      ON requirement_versions (created_at DESC);

-- Trigger: snapshot body on insert/update to requirements
CREATE OR REPLACE FUNCTION trigger_snapshot_requirement()
RETURNS TRIGGER AS $$
BEGIN
    -- Only snapshot when body actually changes
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.body IS DISTINCT FROM NEW.body) THEN
        INSERT INTO requirement_versions (requirement_id, version, title, body, changed_by)
        VALUES (NEW.id, NEW.version, NEW.title, NEW.body, COALESCE(NEW.updated_by, NEW.created_by));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_requirements_snapshot
    AFTER INSERT OR UPDATE ON requirements
    FOR EACH ROW
    EXECUTE FUNCTION trigger_snapshot_requirement();

-- Comments
COMMENT ON TABLE  requirement_versions              IS 'Immutable version snapshots. Created automatically by trigger on body change.';
COMMENT ON COLUMN requirement_versions.change_summary IS 'Optional human-readable description of what changed in this version.';


-- ------------------------------------
-- Table: requirement_links
-- Explicit relationships between requirements
-- ------------------------------------
CREATE TABLE requirement_links (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID        NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    target_id       UUID        NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    link_type       VARCHAR(50) NOT NULL,                       -- 'RELATED' | 'DEPENDS_ON' | 'CONFLICTS_WITH' | 'DUPLICATES'
    created_by      UUID        NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT rl_no_self_link      CHECK (source_id <> target_id),
    CONSTRAINT rl_unique_link       UNIQUE (source_id, target_id, link_type),
    CONSTRAINT rl_valid_link_type   CHECK (link_type IN ('RELATED','DEPENDS_ON','CONFLICTS_WITH','DUPLICATES','IMPLEMENTS'))
);

-- Indexes
CREATE INDEX idx_rl_source_id   ON requirement_links (source_id);
CREATE INDEX idx_rl_target_id   ON requirement_links (target_id);
CREATE INDEX idx_rl_link_type   ON requirement_links (link_type);

COMMENT ON TABLE requirement_links IS 'Typed edges between requirements. Enables dependency and conflict mapping.';
