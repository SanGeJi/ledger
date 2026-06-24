const express = require('express')
const path = require('path')
const db = require('./db')
const auth = require('./auth')

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// 鉴权中间件
function authRequired(req, res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  const user = auth.getUserByToken(token)
  if (!user) return res.status(401).json({ error: '未登录或登录已过期' })
  req.user = user
  req.token = token
  next()
}

// ---------- 认证 ----------
app.post('/api/auth/register', (req, res) => {
  try { res.json(auth.register(req.body.username, req.body.password)) }
  catch (e) { res.status(400).json({ error: e.message }) }
})
app.post('/api/auth/login', (req, res) => {
  try { res.json(auth.login(req.body.username, req.body.password)) }
  catch (e) { res.status(400).json({ error: e.message }) }
})
app.post('/api/auth/logout', authRequired, (req, res) => {
  auth.deleteSession(req.token)
  res.json({ ok: true })
})
app.get('/api/auth/me', authRequired, (req, res) => res.json({ user: req.user }))

// ---------- 交易 ----------
app.get('/api/transactions', authRequired, (req, res) => {
  const { from, to, type, category } = req.query
  let sql = 'SELECT t.*, c.name AS category_name, c.color AS category_color FROM transactions t LEFT JOIN categories c ON t.category_id=c.id WHERE t.user_id=?'
  const args = [req.user.id]
  if (from) { sql += ' AND t.date >= ?'; args.push(from) }
  if (to) { sql += ' AND t.date <= ?'; args.push(to) }
  if (type) { sql += ' AND t.type = ?'; args.push(type) }
  if (category) { sql += ' AND t.category_id = ?'; args.push(category) }
  sql += ' ORDER BY t.date DESC, t.id DESC LIMIT 200'
  res.json({ rows: db.prepare(sql).all(...args) })
})

app.post('/api/transactions', authRequired, (req, res) => {
  const { type, amount, category_id, note, date } = req.body
  if (!type || !['income', 'expense'].includes(type)) return res.status(400).json({ error: '类型无效' })
  const amt = Math.round(Number(amount) * 100)
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: '金额无效' })
  if (!date) return res.status(400).json({ error: '日期必填' })
  const r = db.prepare('INSERT INTO transactions (user_id,type,amount,category_id,note,date) VALUES (?,?,?,?,?,?)')
    .run(req.user.id, type, amt, category_id || null, note || '', date)
  res.json({ id: r.lastInsertRowid })
})

app.put('/api/transactions/:id', authRequired, (req, res) => {
  const { type, amount, category_id, note, date } = req.body
  const amt = Math.round(Number(amount) * 100)
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: '金额无效' })
  const r = db.prepare('UPDATE transactions SET type=?,amount=?,category_id=?,note=?,date=? WHERE id=? AND user_id=?')
    .run(type, amt, category_id || null, note || '', date, req.params.id, req.user.id)
  if (r.changes === 0) return res.status(404).json({ error: '未找到或无权操作' })
  res.json({ ok: true })
})

app.delete('/api/transactions/:id', authRequired, (req, res) => {
  const r = db.prepare('DELETE FROM transactions WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
  if (r.changes === 0) return res.status(404).json({ error: '未找到或无权操作' })
  res.json({ ok: true })
})

// ---------- 分类 ----------
app.get('/api/categories', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM categories WHERE user_id=0 OR user_id=? ORDER BY is_default DESC, id ASC').all(req.user.id)
  const income = rows.filter(r => r.type === 'income')
  const expense = rows.filter(r => r.type === 'expense')
  res.json({ income, expense })
})

app.post('/api/categories', authRequired, (req, res) => {
  const { name, type, color } = req.body
  if (!name || !type || !['income', 'expense'].includes(type)) return res.status(400).json({ error: '参数无效' })
  const r = db.prepare('INSERT INTO categories (user_id,name,type,color,is_default) VALUES (?,?,?,? ,0)')
    .run(req.user.id, name, type, color || '#888888')
  res.json({ id: r.lastInsertRowid })
})

app.delete('/api/categories/:id', authRequired, (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id)
  if (!cat) return res.status(404).json({ error: '分类不存在' })
  if (cat.is_default === 1) return res.status(400).json({ error: '默认分类不可删除' })
  if (cat.user_id !== req.user.id) return res.status(403).json({ error: '无权操作' })
  const ref = db.prepare('SELECT COUNT(*) AS c FROM transactions WHERE category_id=?').get(req.params.id)
  if (ref.c > 0) return res.status(400).json({ error: '该分类已被交易引用,无法删除' })
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// ---------- 看板 ----------
app.get('/api/dashboard', authRequired, (req, res) => {
  const uid = req.user.id
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount END),0) AS income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS expense
    FROM transactions WHERE user_id=?`).get(uid)
  const trend = db.prepare(`
    SELECT date,
      COALESCE(SUM(CASE WHEN type='income' THEN amount END),0) AS income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS expense
    FROM transactions WHERE user_id=? AND date >= date('now','-30 day')
    GROUP BY date ORDER BY date`).all(uid)
  const byCategory = db.prepare(`
    SELECT c.name, c.color, SUM(t.amount) AS amount
    FROM transactions t JOIN categories c ON t.category_id=c.id
    WHERE t.user_id=? AND t.type='expense'
    GROUP BY t.category_id ORDER BY amount DESC`).all(uid)
  res.json({
    totalIncome: totals.income,
    totalExpense: totals.expense,
    balance: totals.income - totals.expense,
    trend,
    byCategory
  })
})

// SPA 兜底
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' })
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

const PORT = 3000
app.listen(PORT, () => console.log('Ledger running at http://localhost:' + PORT))