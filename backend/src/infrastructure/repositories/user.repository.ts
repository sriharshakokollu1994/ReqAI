import { Pool } from 'pg';

export interface UserRecord {
  id:                 string;
  email:              string;
  passwordHash:       string | null;
  firstName:          string;
  lastName:           string;
  role:               string;
  isActive:           boolean;
  isEmailVerified:    boolean;
  avatarUrl:          string | null;
  jobTitle:           string | null;
  department:         string | null;
  failedLoginCount:   number;
  lockedUntil:        Date | null;
  lastLoginAt:        Date | null;
  resetTokenHash:     string | null;
  resetTokenExpires:  Date | null;
  createdAt:          Date;
  updatedAt:          Date;
}

export class UserRepository {
  constructor(private readonly db: Pool) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRecord>(
      `SELECT id, email, password_hash AS "passwordHash",
              first_name AS "firstName", last_name AS "lastName",
              role, is_active AS "isActive", is_email_verified AS "isEmailVerified",
              avatar_url AS "avatarUrl", job_title AS "jobTitle", department,
              failed_login_count AS "failedLoginCount",
              locked_until AS "lockedUntil", last_login_at AS "lastLoginAt",
              reset_token_hash AS "resetTokenHash",
              reset_token_expires AS "resetTokenExpires",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRecord>(
      `SELECT id, email, password_hash AS "passwordHash",
              first_name AS "firstName", last_name AS "lastName",
              role, is_active AS "isActive", is_email_verified AS "isEmailVerified",
              avatar_url AS "avatarUrl", job_title AS "jobTitle", department,
              failed_login_count AS "failedLoginCount",
              locked_until AS "lockedUntil", last_login_at AS "lastLoginAt",
              reset_token_hash AS "resetTokenHash",
              reset_token_expires AS "resetTokenExpires",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  async create(data: {
    email: string; passwordHash: string; firstName: string; lastName: string;
    role: string; jobTitle?: string; department?: string;
  }): Promise<UserRecord> {
    const { rows } = await this.db.query<UserRecord>(
      `INSERT INTO users
         (email, password_hash, first_name, last_name, role, job_title, department)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, email, password_hash AS "passwordHash",
                 first_name AS "firstName", last_name AS "lastName",
                 role, is_active AS "isActive", is_email_verified AS "isEmailVerified",
                 avatar_url AS "avatarUrl", job_title AS "jobTitle", department,
                 failed_login_count AS "failedLoginCount",
                 locked_until AS "lockedUntil", last_login_at AS "lastLoginAt",
                 reset_token_hash AS "resetTokenHash",
                 reset_token_expires AS "resetTokenExpires",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [data.email, data.passwordHash, data.firstName, data.lastName,
       data.role, data.jobTitle ?? null, data.department ?? null],
    );
    return rows[0];
  }

  async updateLoginAttempts(
    userId: string,
    count: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3`,
      [count, lockedUntil, userId],
    );
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
      [userId],
    );
  }

  async storeRefreshToken(data: {
    userId: string; tokenHash: string; ip?: string; userAgent?: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO refresh_tokens
         (user_id, token_hash, ip_address, device_info, expires_at)
       VALUES ($1, $2, $3::inet, $4, NOW() + INTERVAL '7 days')`,
      [data.userId, data.tokenHash, data.ip ?? null, data.userAgent ?? null],
    );
  }

  async revokeRefreshToken(tokenHash: string, reason: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens
       SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = $1
       WHERE token_hash = $2`,
      [reason, tokenHash],
    );
  }

  async setResetToken(userId: string, tokenHash: string, expires: Date): Promise<void> {
    await this.db.query(
      `UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3`,
      [tokenHash, expires, userId],
    );
  }

  async findByResetToken(tokenHash: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRecord>(
      `SELECT id, email, reset_token_hash AS "resetTokenHash",
              reset_token_expires AS "resetTokenExpires",
              password_hash AS "passwordHash",
              first_name AS "firstName", last_name AS "lastName",
              role, is_active AS "isActive", is_email_verified AS "isEmailVerified",
              avatar_url AS "avatarUrl", job_title AS "jobTitle", department,
              failed_login_count AS "failedLoginCount",
              locked_until AS "lockedUntil", last_login_at AS "lastLoginAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE reset_token_hash = $1 AND deleted_at IS NULL`,
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.db.query(
      `UPDATE users
       SET password_hash = $1, reset_token_hash = NULL,
           reset_token_expires = NULL, password_changed_at = NOW()
       WHERE id = $2`,
      [passwordHash, userId],
    );
 }

 // ── Admin: findAll with pagination + filters ─────────────────────────────

  async findAll(opts: {
    page:      number;
    limit:     number;
    role?:     string;
    isActive?: boolean;
    search?:   string;
  }): Promise<{ users: UserRecord[]; total: number }> {
    const conditions: string[]  = ['deleted_at IS NULL'];
    const params:     unknown[] = [];
    let   p = 1;

    if (opts.role !== undefined) {
      conditions.push(`role = $${p++}::user_role`);
      params.push(opts.role);
    }
    if (opts.isActive !== undefined) {
      conditions.push(`is_active = $${p++}`);
      params.push(opts.isActive);
    }
    if (opts.search) {
      conditions.push(
        `(first_name ILIKE $${p} OR last_name ILIKE $${p} OR email ILIKE $${p})`,
      );
      params.push(`%${opts.search}%`);
      p++;
    }

    const where  = conditions.join(' AND ');
    const offset = (opts.page - 1) * opts.limit;

    const [dataResult, countResult] = await Promise.all([
      this.db.query<UserRecord>(
        `SELECT id, email,
                first_name AS "firstName", last_name AS "lastName",
                role, is_active AS "isActive", is_email_verified AS "isEmailVerified",
                avatar_url AS "avatarUrl", job_title AS "jobTitle", department,
                failed_login_count AS "failedLoginCount",
                locked_until AS "lockedUntil", last_login_at AS "lastLoginAt",
                reset_token_hash AS "resetTokenHash",
                reset_token_expires AS "resetTokenExpires",
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM users
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, opts.limit, offset],
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users WHERE ${where}`,
        params,
      ),
    ]);

    return {
      users: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  }

  // ── Admin: update role ────────────────────────────────────────────────────

  async updateRole(userId: string, role: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRecord>(
      `UPDATE users
       SET role = $1::user_role
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, email,
                 first_name AS "firstName", last_name AS "lastName",
                 role, is_active AS "isActive", is_email_verified AS "isEmailVerified",
                 avatar_url AS "avatarUrl", job_title AS "jobTitle", department,
                 failed_login_count AS "failedLoginCount",
                 locked_until AS "lockedUntil", last_login_at AS "lastLoginAt",
                 reset_token_hash AS "resetTokenHash",
                 reset_token_expires AS "resetTokenExpires",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [role, userId],
    );
    return rows[0] ?? null;
  }

  // ── Admin: activate / deactivate user ────────────────────────────────────

  async updateStatus(userId: string, isActive: boolean): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRecord>(
      `UPDATE users
       SET is_active = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, email,
                 first_name AS "firstName", last_name AS "lastName",
                 role, is_active AS "isActive", is_email_verified AS "isEmailVerified",
                 avatar_url AS "avatarUrl", job_title AS "jobTitle", department,
                 failed_login_count AS "failedLoginCount",
                 locked_until AS "lockedUntil", last_login_at AS "lastLoginAt",
                 reset_token_hash AS "resetTokenHash",
                 reset_token_expires AS "resetTokenExpires",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [isActive, userId],
    );
    return rows[0] ?? null;
  }

  // ── Admin: soft delete ────────────────────────────────────────────────────

  async softDelete(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
  }

  // ── Profile: partial update ───────────────────────────────────────────────

  async updateProfile(
    userId: string,
    data: {
      firstName?:  string;
      lastName?:   string;
      jobTitle?:   string;
      department?: string;
      avatarUrl?:  string;
    },
  ): Promise<UserRecord | null> {
    const sets:   string[]  = [];
    const params: unknown[] = [];
    let   p = 1;

    if (data.firstName  !== undefined) { sets.push(`first_name = $${p++}`); params.push(data.firstName); }
    if (data.lastName   !== undefined) { sets.push(`last_name  = $${p++}`); params.push(data.lastName); }
    if (data.jobTitle   !== undefined) { sets.push(`job_title  = $${p++}`); params.push(data.jobTitle); }
    if (data.department !== undefined) { sets.push(`department = $${p++}`); params.push(data.department); }
    if (data.avatarUrl  !== undefined) { sets.push(`avatar_url = $${p++}`); params.push(data.avatarUrl || null); }

    // Nothing to update — just return current record
    if (sets.length === 0) return this.findById(userId);

    params.push(userId);
    const { rows } = await this.db.query<UserRecord>(
      `UPDATE users
       SET ${sets.join(', ')}
       WHERE id = $${p} AND deleted_at IS NULL
       RETURNING id, email,
                 first_name AS "firstName", last_name AS "lastName",
                 role, is_active AS "isActive", is_email_verified AS "isEmailVerified",
                 avatar_url AS "avatarUrl", job_title AS "jobTitle", department,
                 failed_login_count AS "failedLoginCount",
                 locked_until AS "lockedUntil", last_login_at AS "lastLoginAt",
                 reset_token_hash AS "resetTokenHash",
                 reset_token_expires AS "resetTokenExpires",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      params,
    );
    return rows[0] ?? null;
  }
}
