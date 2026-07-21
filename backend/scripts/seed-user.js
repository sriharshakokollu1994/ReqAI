require('dotenv').config();

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const email = process.env.SEED_USER_EMAIL || 'dummy.user@reqai.dev';
  const password = process.env.SEED_USER_PASSWORD || 'Password123!';
  const firstName = process.env.SEED_USER_FIRST_NAME || 'Dummy';
  const lastName = process.env.SEED_USER_LAST_NAME || 'User';
  const role = process.env.SEED_USER_ROLE || 'BUSINESS_ANALYST';
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

  const passwordHash = await bcrypt.hash(password, rounds);

  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email],
  );

  if (existing.rowCount > 0) {
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           first_name = $2,
           last_name = $3,
           role = $4,
           is_active = TRUE,
           is_email_verified = TRUE,
           failed_login_count = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $5`,
      [passwordHash, firstName, lastName, role, existing.rows[0].id],
    );

    console.log('Seed user updated');
    console.log(`email: ${email}`);
    console.log(`password: ${password}`);
    console.log(`id: ${existing.rows[0].id}`);
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (
         email,
         password_hash,
         first_name,
         last_name,
         role,
         is_active,
         is_email_verified
       )
       VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
       RETURNING id`,
      [email, passwordHash, firstName, lastName, role],
    );

    console.log('Seed user inserted');
    console.log(`email: ${email}`);
    console.log(`password: ${password}`);
    console.log(`id: ${inserted.rows[0].id}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error('Failed to seed dummy user');
  console.error(error);
  process.exit(1);
});
