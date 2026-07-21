-- ============================================================
-- Migration 005 — Analyses & Artifacts
-- ReqAI – AI Requirement Analyzer
-- ============================================================

-- ------------------------------------
-- Table: analyses
-- One per AI analysis run per requirement
-- ------------------------------------
CREATE TABLE analyses (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id      UUID                NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    triggered_by        UUID                NOT NULL REFERENCES users(id)        ON DELETE RESTRICT,

    -- Job state
    status              analysis_status     NOT NULL DEFAULT 'QUEUED',
    job_id              VARCHAR(255),                           -- Bull queue job ID

    -- AI Provider metadata
    ai_provider         ai_provider         NOT NULL,
    ai_model            VARCHAR(100)        NOT NULL,           -- e.g. 'gpt-4o', 'claude-3-5-sonnet'
    ai_model_version    VARCHAR(50),
    prompt_version      VARCHAR(50)         NOT NULL DEFAULT 'v1', -- for prompt A/B tracking

    -- Performance metrics
    tokens_prompt       INTEGER,                               -- input tokens consumed
    tokens_completion   INTEGER,                               -- output tokens consumed
    tokens_total        INTEGER GENERATED ALWAYS AS (
                            COALESCE(tokens_prompt, 0) + COALESCE(tokens_completion, 0)
                        ) STORED,
    cost_usd            NUMERIC(10, 6),                        -- estimated cost in USD
    duration_ms         INTEGER,                               -- wall-clock time for AI call

    -- Error handling
    error_code          VARCHAR(100),
    error_message       TEXT,
    retry_count         SMALLINT            NOT NULL DEFAULT 0,

    -- Timestamps
    queued_at           TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT analysis_tokens_positive     CHECK (tokens_prompt IS NULL    OR tokens_prompt >= 0),
    CONSTRAINT analysis_completion_positive CHECK (tokens_completion IS NULL OR tokens_completion >= 0),
    CONSTRAINT analysis_duration_positive   CHECK (duration_ms IS NULL      OR duration_ms >= 0),
    CONSTRAINT analysis_cost_positive       CHECK (cost_usd IS NULL         OR cost_usd >= 0),
    CONSTRAINT analysis_retry_non_negative  CHECK (retry_count >= 0),
    CONSTRAINT analysis_completed_ts        CHECK (
        (status = 'COMPLETED' AND completed_at IS NOT NULL) OR
        (status <> 'COMPLETED')
    ),
    CONSTRAINT analysis_started_ts          CHECK (
        (status IN ('PROCESSING','COMPLETED','FAILED') AND started_at IS NOT NULL) OR
        (status NOT IN ('PROCESSING','COMPLETED','FAILED'))
    )
);

-- Indexes
CREATE INDEX idx_analyses_requirement_id  ON analyses (requirement_id);
CREATE INDEX idx_analyses_triggered_by    ON analyses (triggered_by);
CREATE INDEX idx_analyses_status          ON analyses (status);
CREATE INDEX idx_analyses_ai_provider     ON analyses (ai_provider);
CREATE INDEX idx_analyses_completed_at    ON analyses (completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_analyses_created_at      ON analyses (created_at DESC);
CREATE INDEX idx_analyses_job_id          ON analyses (job_id) WHERE job_id IS NOT NULL;

-- Partial index: only latest completed analysis per requirement (for fast reads)
CREATE INDEX idx_analyses_latest          ON analyses (requirement_id, completed_at DESC)
    WHERE status = 'COMPLETED';

-- Trigger
CREATE TRIGGER trg_analyses_updated_at
    BEFORE UPDATE ON analyses
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- Auto-update requirement.analyzed_at and status when analysis completes
CREATE OR REPLACE FUNCTION trigger_analysis_complete_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED' THEN
        UPDATE requirements
        SET
            status      = CASE WHEN status = 'IN_ANALYSIS' THEN 'ANALYZED'::requirement_status ELSE status END,
            analyzed_at = NOW(),
            updated_at  = NOW()
        WHERE id = NEW.requirement_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_analyses_sync_requirement
    AFTER UPDATE ON analyses
    FOR EACH ROW
    EXECUTE FUNCTION trigger_analysis_complete_sync();

-- Comments
COMMENT ON TABLE  analyses                  IS 'One record per AI analysis execution. Tracks AI provider, model, tokens, and cost.';
COMMENT ON COLUMN analyses.prompt_version   IS 'Version label of the prompt template used. Enables regression analysis.';
COMMENT ON COLUMN analyses.cost_usd         IS 'Estimated cost based on provider token pricing at time of analysis.';
COMMENT ON COLUMN analyses.job_id           IS 'Bull/BullMQ queue job ID for tracking async job state.';


-- ------------------------------------
-- Table: artifacts
-- One record per artifact type per analysis run
-- ------------------------------------
CREATE TABLE artifacts (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id     UUID            NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    artifact_type   artifact_type   NOT NULL,

    -- Content
    content         JSONB           NOT NULL,                  -- structured AI output per type
    raw_ai_output   TEXT,                                      -- original unparsed AI response (debug/audit)

    -- Edit tracking
    is_edited       BOOLEAN         NOT NULL DEFAULT FALSE,
    edited_by       UUID            REFERENCES users(id) ON DELETE SET NULL,
    edited_at       TIMESTAMPTZ,

    -- Quality signals
    confidence_score NUMERIC(4,3),                             -- 0.000–1.000 (future AI confidence)
    user_rating      SMALLINT,                                 -- 1–5 user feedback

    -- Timestamps
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT artifact_unique_per_analysis UNIQUE (analysis_id, artifact_type),
    CONSTRAINT artifact_content_not_empty   CHECK (content <> '{}'::jsonb),
    CONSTRAINT artifact_edit_consistency    CHECK (
        (is_edited = TRUE  AND edited_by IS NOT NULL AND edited_at IS NOT NULL) OR
        (is_edited = FALSE AND edited_at IS NULL)
    ),
    CONSTRAINT artifact_confidence_range    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
    CONSTRAINT artifact_rating_range        CHECK (user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5))
);

-- Indexes
CREATE INDEX idx_artifacts_analysis_id    ON artifacts (analysis_id);
CREATE INDEX idx_artifacts_type           ON artifacts (artifact_type);
CREATE INDEX idx_artifacts_edited         ON artifacts (is_edited) WHERE is_edited = TRUE;
CREATE INDEX idx_artifacts_edited_by      ON artifacts (edited_by)  WHERE edited_by IS NOT NULL;
CREATE INDEX idx_artifacts_content        ON artifacts USING GIN (content);  -- query inside JSONB

-- Trigger
CREATE TRIGGER trg_artifacts_updated_at
    BEFORE UPDATE ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- Comments
COMMENT ON TABLE  artifacts                     IS 'Structured AI-generated outputs. One row per artifact type per analysis.';
COMMENT ON COLUMN artifacts.content             IS 'JSONB payload. Schema varies by artifact_type — see application-layer schema definitions.';
COMMENT ON COLUMN artifacts.raw_ai_output       IS 'Full unparsed text from AI provider — retained for debugging and re-parsing.';
COMMENT ON COLUMN artifacts.confidence_score    IS 'Reserved for future AI self-reported confidence (0.0–1.0).';
COMMENT ON COLUMN artifacts.user_rating         IS '1–5 star rating given by user to assess AI output quality.';


-- ------------------------------------
-- Table: saved_analyses
-- User-bookmarked analyses for quick access
-- ------------------------------------
CREATE TABLE saved_analyses (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    analysis_id UUID        NOT NULL REFERENCES analyses(id)  ON DELETE CASCADE,
    note        VARCHAR(500),                                  -- user's personal annotation
    saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT sa_unique_save UNIQUE (user_id, analysis_id)
);

CREATE INDEX idx_saved_analyses_user_id     ON saved_analyses (user_id);
CREATE INDEX idx_saved_analyses_analysis_id ON saved_analyses (analysis_id);
CREATE INDEX idx_saved_analyses_saved_at    ON saved_analyses (saved_at DESC);

COMMENT ON TABLE saved_analyses IS 'User bookmarks on completed analyses for personal reference.';
