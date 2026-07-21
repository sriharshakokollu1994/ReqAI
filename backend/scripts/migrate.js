require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const migrationsDir = path.join(__dirname, '..', 'src', 'infrastructure', 'database', 'migrations');

  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Running ${file}...`);
      await client.query(sql);
    }
    console.log('Migrations completed successfully');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration failed');
  console.error(error);
  process.exit(1);
});
