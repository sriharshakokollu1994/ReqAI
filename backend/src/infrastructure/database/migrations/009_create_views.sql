-- ============================================================
-- Migration 009 — Analytics Views & Dashboard Queries
-- ReqAI – AI Requirement Analyzer
-- ============================================================

-- ------------------------------------
-- View: v_project_dashboard
-- Per-project health metrics for the dashboard
-- ------------------------------------
CREATE VIEW v_project_dashboard AS
SELECT
    p.id                                                                AS project_id,
    p.name                                                              AS project_name,
    p.status                                                            AS project_status,
    p.owner_id,

    -- Requirement counts
    COUNT(r.id)                                                         AS total_requirements,
    COUNT(r.id) FILTER (WHERE r.status = 'ANALYZED')                   AS analyzed_count,
    COUNT(r.id) FILTER (WHERE r.status = 'APPROVED')                   AS approved_count,
    COUNT(r.id) FILTER (WHERE r.status = 'DRAFT')                      AS draft_count,

    -- Complexity breakdown (from latest completed analysis)
    COUNT(a.id) FILTER (
        WHERE (art.content->>'level') = 'LOW'
    )                                                                   AS complexity_low,
    COUNT(a.id) FILTER (
        WHERE (art.content->>'level') = 'MEDIUM'
    )                                                                   AS complexity_medium,
    COUNT(a.id) FILTER (
        WHERE (art.content->>'level') = 'HIGH'
    )                                                                   AS complexity_high,
    COUNT(a.id) FILTER (
        WHERE (art.content->>'level') = 'VERY_HIGH'
    )                                                                   AS complexity_very_high,

    -- Coverage
    ROUND(
        100.0 * COUNT(r.id) FILTER (WHERE r.status IN ('ANALYZED','REVIEWED','APPROVED'))
        / NULLIF(COUNT(r.id), 0), 1
    )                                                                   AS analysis_coverage_pct,

    -- Activity
    MAX(r.updated_at)                                                   AS last_requirement_update,
    MAX(a.completed_at)                                                 AS last_analysis_at,

    p.created_at

FROM projects p
LEFT JOIN requirements  r   ON r.project_id   = p.id AND r.deleted_at IS NULL
LEFT JOIN LATERAL (
    SELECT id, completed_at
    FROM analyses
    WHERE requirement_id = r.id AND status = 'COMPLETED'
    ORDER BY completed_at DESC
    LIMIT 1
)                           a   ON TRUE
LEFT JOIN artifacts         art ON art.analysis_id = a.id AND art.artifact_type = 'COMPLEXITY_SCORE'
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.status, p.owner_id, p.created_at;


-- ------------------------------------
-- View: v_requirement_analysis_summary
-- Latest analysis result per requirement
-- ------------------------------------
CREATE VIEW v_requirement_analysis_summary AS
SELECT
    r.id                    AS requirement_id,
    r.title,
    r.project_id,
    r.status                AS requirement_status,
    r.priority,
    r.type,
    r.version,
    r.word_count,
    a.id                    AS latest_analysis_id,
    a.status                AS analysis_status,
    a.ai_provider,
    a.ai_model,
    a.tokens_total,
    a.cost_usd,
    a.duration_ms,
    a.completed_at          AS last_analyzed_at,

    -- Complexity from artifact
    art_cx.content->>'level'    AS complexity_level,
    art_cx.content->>'score'    AS complexity_score,

    -- Counts from artifact content
    jsonb_array_length(NULLIF(art_us.content->'stories', 'null'::jsonb))     AS user_story_count,
    jsonb_array_length(NULLIF(art_ts.content->'scenarios', 'null'::jsonb))   AS test_scenario_count,
    jsonb_array_length(NULLIF(art_ri.content->'risks', 'null'::jsonb))       AS risk_count,
    jsonb_array_length(NULLIF(art_nf.content->'nfrs', 'null'::jsonb))        AS nfr_count,
    jsonb_array_length(NULLIF(art_mi.content->'items', 'null'::jsonb))       AS missing_info_count

FROM requirements r
LEFT JOIN LATERAL (
    SELECT * FROM analyses
    WHERE requirement_id = r.id AND status = 'COMPLETED'
    ORDER BY completed_at DESC
    LIMIT 1
) a ON TRUE
LEFT JOIN artifacts art_cx ON art_cx.analysis_id = a.id AND art_cx.artifact_type = 'COMPLEXITY_SCORE'
LEFT JOIN artifacts art_us ON art_us.analysis_id = a.id AND art_us.artifact_type = 'USER_STORIES'
LEFT JOIN artifacts art_ts ON art_ts.analysis_id = a.id AND art_ts.artifact_type = 'TEST_SCENARIOS'
LEFT JOIN artifacts art_ri ON art_ri.analysis_id = a.id AND art_ri.artifact_type = 'RISKS'
LEFT JOIN artifacts art_nf ON art_nf.analysis_id = a.id AND art_nf.artifact_type = 'NON_FUNCTIONAL_REQS'
LEFT JOIN artifacts art_mi ON art_mi.analysis_id = a.id AND art_mi.artifact_type = 'MISSING_INFO'
WHERE r.deleted_at IS NULL;


-- ------------------------------------
-- View: v_user_activity_summary
-- Per-user productivity metrics
-- ------------------------------------
CREATE VIEW v_user_activity_summary AS
SELECT
    u.id                            AS user_id,
    u.first_name || ' ' || u.last_name AS full_name,
    u.email,
    u.role,
    COUNT(DISTINCT r.id)            AS requirements_created,
    COUNT(DISTINCT a.id)            AS analyses_triggered,
    COUNT(DISTINCT sa.id)           AS analyses_saved,
    MAX(al.created_at)              AS last_activity_at,
    u.last_login_at
FROM users u
LEFT JOIN requirements  r   ON r.created_by    = u.id AND r.deleted_at IS NULL
LEFT JOIN analyses      a   ON a.triggered_by  = u.id
LEFT JOIN saved_analyses sa ON sa.user_id      = u.id
LEFT JOIN audit_logs     al ON al.user_id      = u.id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.first_name, u.last_name, u.email, u.role, u.last_login_at;
