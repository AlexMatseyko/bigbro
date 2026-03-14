/**
 * Run migration SQL file.
 * Usage from server/: node scripts/run-migration.js [migration-file]
 * Default: migrations/001_profile_and_online_time.sql
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

const file = process.argv[2] || path.join(__dirname, '..', 'migrations', '001_profile_and_online_time.sql');
const sql = fs.readFileSync(file, 'utf8');
const statements = sql
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith('--'));

async function run() {
  for (const stmt of statements) {
    await db.query(stmt + ';');
  }
  console.log('Migration completed:', path.basename(file));
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
