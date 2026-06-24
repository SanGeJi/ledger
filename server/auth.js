const crypto = require('crypto')
const db = require('./db')

const SESSION_DAYS = 30

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

function toSqliteDate(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function register(username, password) {
  if (!username || String(username).trim().length < 2) throw new Error('用户名至少 2 个字符')
  if (!password || password.length < 6) throw new Error('密码至少 6 个字符')
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username)
  if (exists) throw new Error('用户名已存在')
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = hashPassword(password, salt)
  const res = db.prepare('INSERT INTO users (username,password_hash,salt) VALUES (?,?,?)').run(username, hash, salt)
  const user = { id: res.lastInsertRowid, username }
  return { token: createSession(user.id), user }
}

function login(username, password) {
  const row = db.prepare('SELECT * FROM users WHERE username=?').get(username)
  if (!row) throw new Error('用户名或密码错误')
  if (hashPassword(password, row.salt) !== row.password_hash) throw new Error('用户名或密码错误')
  return { token: createSession(row.id), user: { id: row.id, username: row.username } }
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = toSqliteDate(new Date(Date.now() + SESSION_DAYS * 86400000))
  db.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').run(token, userId, expires)
  return token
}

function getUserByToken(token) {
  if (!token) return null
  return db.prepare(`
    SELECT u.id, u.username FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token=? AND s.expires_at > datetime('now')
  `).get(token) || null
}

function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(token)
}

module.exports = { register, login, createSession, getUserByToken, deleteSession }