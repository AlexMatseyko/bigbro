/**
 * One-off: delete user by email (e.g. for re-registration testing).
 * Run from server/: node scripts/delete-user-by-email.js
 */
const db = require('../db');

const email = process.argv[2] || 'alexligear1@gmail.com';

db.query('DELETE FROM users WHERE email = $1', [email])
  .then((result) => {
    console.log('Deleted', result.rowCount, 'user(s) with email:', email);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
