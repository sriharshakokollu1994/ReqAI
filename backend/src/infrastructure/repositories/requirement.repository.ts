import { Pool } from 'pg';
import { RequirementQuery } from '../../application/dtos/requirement.dto';

export class RequirementRepository {
  constructor(private readonly db: Pool) {}

  async list(query: RequirementQuery & { projectId: string; tags?: string[] }): Promise<{
    data: any[];
    total: number;
  }> {
    const conditions: string[] = ['r.project_id = $1', 'r.deleted_at IS NULL'];
    const params: unknown[]    = [query.projectId];
    let   idx = 2;

    if (query.status)   { conditions.push(`r.status = $${idx++}`);   params.push(query.status); }
    if (query.type)     { conditions.push(`r.type = $${idx++}`);     params.push(query.type); }
    if (query.priority) { conditions.push(`r.priority = $${idx++}`); params.push(query.priority); }
    if (query.search) {
      conditions.push(`(r.title ILIKE $${idx} OR to_tsvector('english', r.body) @@ plainto_tsquery('english', $${idx}))`);
      params.push(`%${query.search}%`);
      idx++;
    }
    if (query.tags?.length) {
      conditions.push(`r.tags @> $${idx++}`);
      params.push(query.tags);
    }

    const orderMap: Record<string, string> = {
      createdAt: 'r.created_at', updatedAt: 'r.updated_at',
      title: 'r.title', priority: 'r.priority', status: 'r.status',
    };
    const orderCol = orderMap[query.sortBy ?? 'createdAt'] ?? 'r.created_at';
    const orderDir = query.sortDir === 'asc' ? 'ASC' : 'DESC';

    const where  = conditions.join(' AND ');
    const offset = (query.page - 1) * query.limit;

    const [{ rows }, { rows: countRows }] = await Promise.all([
      this.db.query(
        `SELECT r.id, r.project_id AS "projectId", r.title, r.body, r.type, r.priority,
                r.status, r.source, r.source_file_url AS "sourceFileUrl", r.tags,
                r.version, r.word_count AS "wordCount", r.parent_id AS "parentId",
                r.created_by AS "createdBy", r.updated_by AS "updatedBy",
                r.analyzed_at AS "analyzedAt", r.approved_at AS "approvedAt",
                r.created_at AS "createdAt", r.updated_at AS "updatedAt"
         FROM requirements r
         WHERE ${where}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, query.limit, offset],
      ),
      this.db.query(`SELECT COUNT(*)::int AS total FROM requirements r WHERE ${where}`, params),
    ]);

    return { data: rows, total: countRows[0].total };
  }

  async findById(id: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT r.id, r.project_id AS "projectId", r.title, r.body, r.type, r.priority,
              r.status, r.source, r.source_file_url AS "sourceFileUrl", r.tags,
              r.version, r.word_count AS "wordCount", r.parent_id AS "parentId",
              r.created_by AS "createdBy", r.updated_by AS "updatedBy",
              r.analyzed_at AS "analyzedAt", r.approved_at AS "approvedAt",
              r.created_at AS "createdAt", r.updated_at AS "updatedAt"
       FROM requirements r WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  async create(data: {
    projectId: string; createdBy: string; title: string; body: string;
    type?: string; priority?: string; source?: string; tags?: string[]; parentId?: string;
  }): Promise<any> {
    const { rows } = await this.db.query(
      `INSERT INTO requirements
         (project_id, created_by, title, body, type, priority, source, tags, parent_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, project_id AS "projectId", title, body, type, priority, status,
                 source, source_file_url AS "sourceFileUrl", tags, version,
                 word_count AS "wordCount", parent_id AS "parentId",
                 created_by AS "createdBy", updated_by AS "updatedBy",
                 analyzed_at AS "analyzedAt", approved_at AS "approvedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        data.projectId, data.createdBy, data.title, data.body,
        data.type ?? 'FUNCTIONAL', data.priority ?? 'MEDIUM',
        data.source ?? null, data.tags ?? [], data.parentId ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: string, data: {
    title?: string; body?: string; type?: string; priority?: string;
    status?: string; tags?: string[]; updatedBy?: string;
  }): Promise<any> {
    const sets: string[]  = ['updated_by = $2'];
    const params: unknown[] = [id, data.updatedBy ?? null];
    let idx = 3;

    if (data.title    !== undefined) { sets.push(`title = $${idx++}`);    params.push(data.title); }
    if (data.body     !== undefined) { sets.push(`body = $${idx++}`);     params.push(data.body); }
    if (data.type     !== undefined) { sets.push(`type = $${idx++}`);     params.push(data.type); }
    if (data.priority !== undefined) { sets.push(`priority = $${idx++}`); params.push(data.priority); }
    if (data.status   !== undefined) { sets.push(`status = $${idx++}`);   params.push(data.status); }
    if (data.tags     !== undefined) { sets.push(`tags = $${idx++}`);     params.push(data.tags); }

    const { rows } = await this.db.query(
      `UPDATE requirements SET ${sets.join(', ')}
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, project_id AS "projectId", title, body, type, priority, status,
                 source, source_file_url AS "sourceFileUrl", tags, version,
                 word_count AS "wordCount", parent_id AS "parentId",
                 created_by AS "createdBy", updated_by AS "updatedBy",
                 analyzed_at AS "analyzedAt", approved_at AS "approvedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      params,
    );
    return rows[0];
  }

  async softDelete(id: string): Promise<void> {
    await this.db.query(
      `UPDATE requirements SET deleted_at = NOW(), status = 'ARCHIVED' WHERE id = $1`,
      [id],
    );
  }

  async getVersionHistory(requirementId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT id, requirement_id AS "requirementId", version, title, body,
              changed_by AS "changedBy", change_summary AS "changeSummary",
              created_at AS "createdAt"
       FROM requirement_versions
       WHERE requirement_id = $1
       ORDER BY version DESC`,
      [requirementId],
    );
    return rows;
  }

  async createLink(
    sourceId: string, targetId: string, linkType: string, createdBy: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO requirement_links (source_id, target_id, link_type, created_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (source_id, target_id, link_type) DO NOTHING`,
      [sourceId, targetId, linkType, createdBy],
    );
  }

  async isProjectMember(projectId: string, userId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
      [projectId, userId],
    );
    return rows.length > 0;
  }
}
