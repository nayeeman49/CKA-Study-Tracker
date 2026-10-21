// Owner tool: reset a user's password (signs them out everywhere).
// Local: node scripts/reset-password.js <username> <new-password>
// Fly:   fly ssh console -a nayeeman49-cka-tracker -C "node scripts/reset-password.js <username> <new-password>"
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const [username, pw] = process.argv.slice(2);
if (!username || !pw || pw.length < 8) { console.error('Usage: node scripts/reset-password.js <username> <new-password (8+ chars)>'); process.exit(1); }
const db = new DatabaseSync(path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'cka.db'));
const u = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (!u) { console.error('No such user'); process.exit(1); }
const salt = crypto.randomBytes(16).toString('hex');
db.prepare('UPDATE users SET salt=?, pass_hash=? WHERE id=?').run(salt, crypto.scryptSync(pw, salt, 64).toString('hex'), u.id);
db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
console.log('Password reset for', username, '- they can log in now and generate a new recovery code in Settings.');
