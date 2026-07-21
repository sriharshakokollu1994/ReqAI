import { Pool, PoolClient } from 'pg';
import { AnalysisHistoryQuery } from '../../application/dtos/analysis.dto';

// ── Column selectors (reused across multiple queries) ─────────────────────────

const ANALYSIS_COLS = `
  a.id, a.requirement_id AS "requirementId", a.triggered_by AS "triggeredBy",
  a.status, a.job_id AS "jobId", a.ai_provider AS "aiProvider",
  a.ai_model AS "aiModel", a.prompt_version AS "promptVersion",
  a.tokens_prompt AS "tokensPrompt", a.tokens_completion AS "tokensCompletion",
  a.tokens_total AS "tokensTotal", a.cost_usd AS "costUsd",
  a.duration_ms AS "durationMs", a.error_code AS "errorCode",
  a.error_message AS "errorMessage", a.retry_count AS "retryCount",
  a.queued_at AS "queuedAt", a.started_at AS "startedAt",
  a.completed_at AS "completedAt"
`.trim();

const ARTIFACT_AGG = `
  json_agg(
    json_build_object(
      'id',              ar.id,
      'analysisId',      ar.analysis_id,
      'artifactType',    ar.artifact_type,
      'content',         ar.content,
      'isEdited',        ar.is_edited,
      'editedBy',        ar.edited_by,
      'editedAt',        ar.edited_at,
      'confidenceScore', ar.confidence_score,
      'userRating',      ar.user_rating,
      'createdAt',       ar.created_at,
      'updatedAt',       ar.updated_at
    ) ORDER BY ar.artifact_type
  ) FILTER (WHERE ar.id IS NOT NULL) AS artifacts
`.trim();

export class AnalysisRepository {
  constructor(private readonly db: Pool) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(data: {
    requirementId: string;
    triggeredBy:   string;
    aiProvider:    string;
    aiModel:       string;
    promptVersion: string;
  }): Promise<any> {
    const { rows } = await this.db.query(
      `INSERT INTO analyses
         (requirement_id, triggered_by, ai_provider, ai_model, prompt_version, status)
       VALUES ($1, $2, $3, $4, $5, 'QUEUED')
       RETURNING
         id, requirement_id AS "requirementId", triggered_by AS "triggeredBy",
         status, job_id AS "jobId", ai_provider AS "aiProvider",
         ai_model AS "aiModel", prompt_version AS "promptVersion",
         tokens_prompt AS "tokensPrompt", tokens_completion AS "tokensCompletion",
         tokens_total AS "tokensTotal", cost_usd AS "costUsd",
         duration_ms AS "durationMs", error_code AS "errorCode",
         error_message AS "errorMessage", retry_count AS "retryCount",
         queued_at AS "queuedAt", started_at AS "startedAt",
         completed_at AS "completedAt"`,
      [data.requirementId, data.triggeredBy, data.aiProvider, data.aiModel, data.promptVersion],
    );
    return rows[0];
  }

  // ── Job ID ────────────────────────────────────────────────────────────────

  async updateJobId(analysisId: string, jobId: string): Promise<void> {
    await this.db.query(
      `UPDATE analyses SET job_id = $1 WHERE id = $2`,
      [jobId, analysisId],
    );
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  /**
   * Returns the most recent analysis (any status) for a requirement.
   * Used by the status-polling endpoint.
   */
  async findLatestByRequirement(requirementId: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT ${ANALYSIS_COLS}
       FROM analyses a
       WHERE a.requirement_id = $1
       ORDER BY a.queued_at DESC
       LIMIT 1`,
      [requirementId],
    );
    return rows[0] ?? null;
  }

  /**
   * Returns the latest COMPLETED analysis with full artifact payload.
   * Used by the getLatest endpoint.
   */
  async findLatestCompleted(requirementId: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT ${ANALYSIS_COLS}, ${ARTIFACT_AGG}
       FROM analyses a
       LEFT JOIN artifacts ar ON ar.analysis_id = a.id
       WHERE a.requirement_id = $1 AND a.status = 'COMPLETED'
       GROUP BY a.id
       ORDER BY a.completed_at DESC
       LIMIT 1`,
      [requirementId],
    );
    return rows[0] ?? null;
  }

  /**
   * Returns a specific analysis by ID with full artifact payload.
   */
  async findByIdWithArtifacts(analysisId: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT ${ANALYSIS_COLS}, ${ARTIFACT_AGG}
       FROM analyses a
       LEFT JOIN artifacts ar ON ar.analysis_id = a.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [analysisId],
    );
    return rows[0] ?? null;
  }

  /**
   * Returns all analysis runs for a requirement (summary only, no artifacts).
   */
  async findAllByRequirement(requirementId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT
         id, requirement_id AS "requirementId", triggered_by AS "triggeredBy",
         status, job_id AS "jobId", ai_provider AS "aiProvider",
         ai_model AS "aiModel", prompt_version AS "promptVersion",
         tokens_total AS "tokensTotal", cost_usd AS "costUsd",
         duration_ms AS "durationMs", error_code AS "errorCode",
         retry_count AS "retryCount",
         queued_at AS "queuedAt", started_at AS "startedAt",
         completed_at AS "completedAt"
       FROM analyses
       WHERE requirement_id = $1
       ORDER BY queued_at DESC`,
      [requirementId],
    );
    return rows;
  }

  // ── History (paginated) ───────────────────────────────────────────────────

  /**
   * Paginated analysis history for a user, joined to requirement + project.
   *
   * Complexity level is read from the SUMMARY artifact (v2 schema: content->>'complexity').
   * Risk count is read from the RISKS artifact (v2 schema: content->'risks').
   * Story points total is read from the STORY_POINTS artifact (v2 schema: content->>'totalPoints').
   */
  async listHistory(
    userId: string,
    query:  AnalysisHistoryQuery,
  ): Promise<{ data: any[]; total: number }> {
    const conditions: string[] = [
      `pm.user_id = $1`,
      `a.status IS NOT NULL`,
    ];
    const params: unknown[] = [userId];
    let idx = 2;

    if (query.projectId) { conditions.push(`p.id = $${idx++}`);           params.push(query.projectId); }
    if (query.status)    { conditions.push(`a.status = $${idx++}`);        params.push(query.status); }
    if (query.provider)  { conditions.push(`a.ai_provider = $${idx++}`);   params.push(query.provider); }
    if (query.from)      { conditions.push(`a.completed_at >= $${idx++}`); params.push(query.from); }
    if (query.to)        { conditions.push(`a.completed_at <= $${idx++}`); params.push(query.to); }

    const ORDER_MAP: Record<string, string> = {
      completedAt: 'a.completed_at',
      createdAt:   'a.queued_at',
      tokensTotal: 'a.tokens_total',
      costUsd:     'a.cost_usd',
    };
    const orderCol = ORDER_MAP[query.sortBy ?? 'completedAt'] ?? 'a.completed_at';
    const orderDir = query.sortDir === 'asc' ? 'ASC' : 'DESC';
    const where    = conditions.join(' AND ');
    const offset   = (query.page - 1) * query.limit;

    // v2: complexity → SUMMARY.content->>'complexity'
    //     riskCount  → RISKS.content->'risks' array length
    //     storyTotal → STORY_POINTS.content->>'totalPoints'
    const dataSql = `
      SELECT
        a.id                                        AS "analysisId",
        a.requirement_id                            AS "requirementId",
        r.title                                     AS "requirementTitle",
        p.id                                        AS "projectId",
        p.name                                      AS "projectName",
        a.status,
        a.ai_provider                               AS "aiProvider",
        a.ai_model                                  AS "aiModel",
        a.prompt_version                            AS "promptVersion",
        smry.content->>'complexity'                 AS "complexityLevel",
        jsonb_array_length(
          COALESCE(ri.content->'risks', '[]'::jsonb)
        )                                           AS "riskCount",
        (sp.content->>'totalPoints')::int           AS "storyPoints",
        a.tokens_total                              AS "tokensTotal",
        a.cost_usd                                  AS "costUsd",
        a.triggered_by                              AS "triggeredBy",
        a.completed_at                              AS "completedAt"
      FROM   analyses         a
      JOIN   requirements     r  ON r.id         = a.requirement_id
      JOIN   projects         p  ON p.id         = r.project_id
      JOIN   project_members  pm ON pm.project_id = p.id
      LEFT JOIN artifacts smry ON smry.analysis_id = a.id AND smry.artifact_type = 'SUMMARY'
      LEFT JOIN artifacts ri   ON ri.analysis_id   = a.id AND ri.artifact_type   = 'RISKS'
      LEFT JOIN artifacts sp   ON sp.analysis_id   = a.id AND sp.artifact_type   = 'STORY_POINTS'
      WHERE ${where}
      ORDER BY ${orderCol} ${orderDir} NULLS LAST
      LIMIT  $${idx++}
      OFFSET $${idx++}`;

    const countSql = `
      SELECT COUNT(DISTINCT a.id)::int AS total
      FROM   analyses         a
      JOIN   requirements     r  ON r.id         = a.requirement_id
      JOIN   projects         p  ON p.id         = r.project_id
      JOIN   project_members  pm ON pm.project_id = p.id
      WHERE  ${where}`;

    const [{ rows }, { rows: countRows }] = await Promise.all([
      this.db.query(dataSql, [...params, query.limit, offset]),
      this.db.query(countSql, params),
    ]);

    return { data: rows, total: countRows[0]?.total ?? 0 };
  }

  // ── Saved analyses (paginated) ────────────────────────────────────────────

  async listSaved(
    userId: string,
    query:  AnalysisHistoryQuery,
  ): Promise<{ data: any[]; total: number }> {
    const offset = (query.page - 1) * query.limit;

    const [{ rows }, { rows: countRows }] = await Promise.all([
      this.db.query(
        `SELECT
           a.id                                      AS "analysisId",
           a.requirement_id                          AS "requirementId",
           r.title                                   AS "requirementTitle",
           p.id                                      AS "projectId",
           p.name                                    AS "projectName",
           a.status,
           a.ai_provider                             AS "aiProvider",
           a.ai_model                                AS "aiModel",
           smry.content->>'complexity'               AS "complexityLevel",
           a.tokens_total                            AS "tokensTotal",
           a.cost_usd                                AS "costUsd",
           a.triggered_by                            AS "triggeredBy",
           a.completed_at                            AS "completedAt",
           sa.note,
           sa.saved_at                               AS "savedAt"
         FROM saved_analyses sa
         JOIN analyses       a  ON a.id          = sa.analysis_id
         JOIN requirements   r  ON r.id          = a.requirement_id
         JOIN projects       p  ON p.id          = r.project_id
         LEFT JOIN artifacts smry ON smry.analysis_id = a.id AND smry.artifact_type = 'SUMMARY'
         WHERE sa.user_id = $1
         ORDER BY sa.saved_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, query.limit, offset],
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS total FROM saved_analyses WHERE user_id = $1`,
        [userId],
      ),
    ]);

    return { data: rows, total: countRows[0]?.total ?? 0 };
  }

  // ── Save / Unsave ─────────────────────────────────────────────────────────

  async saveForUser(analysisId: string, userId: string, note?: string): Promise<void> {
    await this.db.query(
      `INSERT INTO saved_analyses (user_id, analysis_id, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, analysis_id) DO UPDATE SET note = EXCLUDED.note`,
      [userId, analysisId, note ?? null],
    );
  }

  async unsaveForUser(analysisId: string, userId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM saved_analyses WHERE analysis_id = $1 AND user_id = $2`,
      [analysisId, userId],
    );
  }

  // ── Artifacts ─────────────────────────────────────────────────────────────

  async findArtifactById(artifactId: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT
         id, analysis_id AS "analysisId", artifact_type AS "artifactType",
         content, is_edited AS "isEdited", edited_by AS "editedBy",
         edited_at AS "editedAt", confidence_score AS "confidenceScore",
         user_rating AS "userRating", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM artifacts
       WHERE id = $1`,
      [artifactId],
    );
    return rows[0] ?? null;
  }

  async updateArtifact(
    artifactId: string,
    data: { content: Record<string, unknown>; editedBy: string; editedAt: Date },
  ): Promise<any> {
    const { rows } = await this.db.query(
      `UPDATE artifacts
       SET content    = $1,
           is_edited  = TRUE,
           edited_by  = $2,
           edited_at  = $3
       WHERE id = $4
       RETURNING
         id, analysis_id AS "analysisId", artifact_type AS "artifactType",
         content, is_edited AS "isEdited", edited_by AS "editedBy",
         edited_at AS "editedAt", confidence_score AS "confidenceScore",
         user_rating AS "userRating", created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [data.content, data.editedBy, data.editedAt, artifactId],
    );
    return rows[0];
  }

  async rateArtifact(artifactId: string, rating: number): Promise<void> {
    await this.db.query(
      `UPDATE artifacts SET user_rating = $1 WHERE id = $2`,
      [rating, artifactId],
    );
  }
}
