-- ============================================================
-- Migration 006 — Prompt History
-- ReqAI – AI Requirement Analyzer
-- Tracks every prompt sent to AI providers — for debugging,
-- cost tracking, prompt engineering, and compliance.
-- ============================================================

CREATE TABLE prompt_history (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id         UUID            NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    requirement_id      UUID            NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    triggered_by        UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- Prompt identity
    prompt_template     VARCHAR(100)    NOT NULL,               -- e.g. 'ANALYSIS_V1', 'ANALYSIS_V2'
    prompt_version      VARCHAR(50)     NOT NULL DEFAULT 'v1',
    sequence_order      SMALLINT        NOT NULL DEFAULT 1,      -- for multi-turn / chained prompts

    -- AI Provider
    ai_provider         ai_provider     NOT NULL,
    ai_model            VARCHAR(100)    NOT NULL,
    ai_model_version    VARCHAR(50),

    -- Prompt content
    system_prompt       TEXT            NOT NULL,               -- system/instruction message
    user_prompt         TEXT            NOT NULL,               -- user/content message
    full_prompt_hash    VARCHAR(64)     NOT NULL,               -- SHA-256 of system+user prompt (dedup/cache key)

    -- Response
    raw_response        TEXT,                                   -- full raw response from AI
    parsed_successfully BOOLEAN         NOT NULL DEFAULT FALSE,
    parse_error         TEXT,

    -- Token accounting
    tokens_prompt       INTEGER,
    tokens_completion   INTEGER,
    tokens_total        INTEGER GENERATED ALWAYS AS (
                            COALESCE(tokens_prompt, 0) + COALESCE(tokens_completion, 0)
                        ) STORED,
    cost_usd            NUMERIC(10, 6),

    -- Performance
    request_duration_ms INTEGER,                               -- time from request to first token
    total_duration_ms   INTEGER,                               -- total time including streaming

    -- HTTP metadata
    api_request_id      VARCHAR(200),                          -- provider's request/trace ID
    http_status_code    SMALLINT,
    provider_error_code VARCHAR(100),
    provider_error_msg  TEXT,

    -- Timestamps
    sent_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    received_at         TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT ph_tokens_positive       CHECK (tokens_prompt IS NULL OR tokens_prompt >= 0),
    CONSTRAINT ph_completion_positive   CHECK (tokens_completion IS NULL OR tokens_completion >= 0),
    CONSTRAINT ph_cost_positive         CHECK (cost_usd IS NULL OR cost_usd >= 0),
    CONSTRAINT ph_duration_positive     CHECK (request_duration_ms IS NULL OR request_duration_ms >= 0),
    CONSTRAINT ph_sequence_positive     CHECK (sequence_order >= 1),
    CONSTRAINT ph_hash_length           CHECK (char_length(full_prompt_hash) = 64)
);

-- ------------------------------------
-- Indexes
-- ------------------------------------
CREATE INDEX idx_ph_analysis_id         ON prompt_history (analysis_id);
CREATE INDEX idx_ph_requirement_id      ON prompt_history (requirement_id);
CREATE INDEX idx_ph_triggered_by        ON prompt_history (triggered_by);
CREATE INDEX idx_ph_ai_provider         ON prompt_history (ai_provider);
CREATE INDEX idx_ph_ai_model            ON prompt_history (ai_model);
CREATE INDEX idx_ph_prompt_version      ON prompt_history (prompt_version);
CREATE INDEX idx_ph_prompt_hash         ON prompt_history (full_prompt_hash);   -- cache key lookups
CREATE INDEX idx_ph_sent_at             ON prompt_history (sent_at DESC);
CREATE INDEX idx_ph_parsed              ON prompt_history (parsed_successfully);
CREATE INDEX idx_ph_http_status         ON prompt_history (http_status_code)    WHERE http_status_code IS NOT NULL;
CREATE INDEX idx_ph_cost                ON prompt_history (cost_usd DESC)       WHERE cost_usd IS NOT NULL;

-- Composite: fast lookups for analysis + sequence
CREATE INDEX idx_ph_analysis_sequence   ON prompt_history (analysis_id, sequence_order);

-- ------------------------------------
-- View: prompt_cost_summary
-- ------------------------------------
CREATE VIEW v_prompt_cost_summary AS
SELECT
    ph.ai_provider,
    ph.ai_model,
    ph.prompt_version,
    COUNT(*)                                            AS total_requests,
    SUM(ph.tokens_total)                                AS total_tokens,
    SUM(ph.cost_usd)                                    AS total_cost_usd,
    AVG(ph.total_duration_ms)                           AS avg_duration_ms,
    COUNT(*) FILTER (WHERE ph.parsed_successfully)      AS successful_parses,
    COUNT(*) FILTER (WHERE NOT ph.parsed_successfully)  AS failed_parses,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE ph.parsed_successfully) / NULLIF(COUNT(*), 0), 2
    )                                                   AS parse_success_rate_pct,
    MIN(ph.sent_at)                                     AS first_request,
    MAX(ph.sent_at)                                     AS last_request
FROM prompt_history ph
GROUP BY ph.ai_provider, ph.ai_model, ph.prompt_version;

-- ------------------------------------
-- View: daily_ai_usage
-- ------------------------------------
CREATE VIEW v_daily_ai_usage AS
SELECT
    DATE_TRUNC('day', sent_at)  AS usage_date,
    ai_provider,
    ai_model,
    COUNT(*)                    AS request_count,
    SUM(tokens_total)           AS total_tokens,
    SUM(cost_usd)               AS total_cost_usd
FROM prompt_history
GROUP BY DATE_TRUNC('day', sent_at), ai_provider, ai_model
ORDER BY usage_date DESC;

-- ------------------------------------
-- Comments
-- ------------------------------------
COMMENT ON TABLE  prompt_history                        IS 'Immutable log of every AI prompt sent. Supports cost tracking, debugging, and prompt versioning.';
COMMENT ON COLUMN prompt_history.full_prompt_hash       IS 'SHA-256 of concatenated system+user prompt. Used for deduplication and response caching.';
COMMENT ON COLUMN prompt_history.prompt_template        IS 'Named template identifier — maps to versioned prompt definition in application code.';
COMMENT ON COLUMN prompt_history.sequence_order         IS 'For multi-turn prompts: 1=initial, 2=follow-up, etc.';
COMMENT ON COLUMN prompt_history.api_request_id         IS 'Provider-assigned request ID for cross-referencing provider dashboards/logs.';
COMMENT ON COLUMN prompt_history.raw_response           IS 'Full, unmodified response body from the AI provider. Retained for re-parsing and debugging.';
