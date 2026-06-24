const { createApp } = Vue
const API = '/api'

function getToken() { return localStorage.getItem('ledger_token') }
function setToken(t) { t ? localStorage.setItem('ledger_token', t) : localStorage.removeItem('ledger_token') }

createApp({
  data() {
    return {
      user: null,
      route: '/login',
      isLogin: true,
      authForm: { username: '', password: '' },
      authError: '',
      txns: [],
      txForm: { type: 'expense', amount: null, category_id: '', note: '', date: new Date().toISOString().slice(0, 10) },
      editingId: null,
      filters: { type: '', category: '', from: '', to: '' },
      categories: { income: [], expense: [] },
      catForm: { name: '', type: 'expense', color: '#ff6a3d' },
      dash: { totalIncome: 0, totalExpense: 0, balance: 0, trend: [], byCategory: [] },
      trendChart: null,
      catChart: null,
      error: ''
    }
  },
  computed: {
    allCategories() { return [...this.categories.income, ...this.categories.expense] }
  },
  async mounted() {
    window.addEventListener('hashchange', this.onHash)
    this.onHash()
    const tok = getToken()
    if (tok) {
      try {
        const r = await this.api('/auth/me')
        this.user = r.user
        await this.loadAll()
        if (this.route === '/login') this.go('/')
      } catch (e) { setToken(null); this.go('/login') }
    }
  },
  methods: {
    go(path) { location.hash = path },
    onHash() {
      this.route = location.hash.replace('#', '') || '/login'
      if (this.route === '') this.route = '/login'
      if (this.user && this.route === '/login') this.route = '/'
      if (this.user && (this.route === '/' || this.route === '/transactions' || this.route === '/categories')) {
        if (this.route === '/' && !this.dash.trend.length) this.loadDashboard()
      }
    },
    async api(path, opts = {}) {
      const tok = getToken()
      const res = await fetch(API + path, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(opts.headers || {}) }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '请求失败')
      return data
    },
    async submitAuth() {
      this.authError = ''
      try {
        const ep = this.isLogin ? '/auth/login' : '/auth/register'
        const r = await this.api(ep, { method: 'POST', body: JSON.stringify(this.authForm) })
        setToken(r.token); this.user = r.user
        await this.loadAll(); this.go('/')
      } catch (e) { this.authError = e.message }
    },
    async logout() {
      try { await this.api('/auth/logout', { method: 'POST' }) } catch (e) {}
      setToken(null); this.user = null; this.go('/login')
    },
    async loadAll() { await Promise.all([this.loadDashboard(), this.loadTransactions(), this.loadCategories()]) },
    async loadDashboard() {
      this.dash = await this.api('/dashboard')
      this.$nextTick(() => this.renderCharts())
    },
    renderCharts() {
      if (this.trendChart) this.trendChart.destroy()
      if (this.catChart) this.catChart.destroy()
      if (this.$refs.trendChart) {
        this.trendChart = new Chart(this.$refs.trendChart, {
          type: 'line',
          data: {
            labels: this.dash.trend.map(t => t.date.slice(5)),
            datasets: [
              { label: '收入', data: this.dash.trend.map(t => t.income / 100), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.1)', tension: .3, fill: true },
              { label: '支出', data: this.dash.trend.map(t => t.expense / 100), borderColor: '#ff6a3d', backgroundColor: 'rgba(255,106,61,.1)', tension: .3, fill: true }
            ]
          },
          options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
        })
      }
      if (this.$refs.catChart && this.dash.byCategory.length) {
        this.catChart = new Chart(this.$refs.catChart, {
          type: 'doughnut',
          data: { labels: this.dash.byCategory.map(c => c.name), datasets: [{ data: this.dash.byCategory.map(c => c.amount / 100), backgroundColor: this.dash.byCategory.map(c => c.color) }] },
          options: { responsive: true, plugins: { legend: { position: 'right' } } }
        })
      }
    },
    async loadTransactions() {
      const q = new URLSearchParams()
      if (this.filters.type) q.set('type', this.filters.type)
      if (this.filters.category) q.set('category', this.filters.category)
      if (this.filters.from) q.set('from', this.filters.from)
      if (this.filters.to) q.set('to', this.filters.to)
      const r = await this.api('/transactions?' + q.toString())
      this.txns = r.rows
    },
    resetFilters() { this.filters = { type: '', category: '', from: '', to: '' }; this.loadTransactions() },
    resetTxForm() {
      this.editingId = null
      this.txForm = { type: 'expense', amount: '', category_id: '', note: '', date: new Date().toISOString().slice(0, 10) }
    },
    editTx(t) {
      this.editingId = t.id
      this.txForm = { type: t.type, amount: (t.amount / 100).toFixed(2), category_id: t.category_id || '', note: t.note || '', date: t.date }
    },
    async saveTx() {
      try {
        const body = JSON.stringify(this.txForm)
        if (this.editingId) await this.api('/transactions/' + this.editingId, { method: 'PUT', body })
        else await this.api('/transactions', { method: 'POST', body })
        this.txForm.amount = null
        await Promise.all([this.loadTransactions(), this.loadDashboard()])
      } catch (e) { alert(e.message) }
    },
    async delTx(id) { if (!confirm('删除这笔交易?')) return; await this.api('/transactions/' + id, { method: 'DELETE' }); await Promise.all([this.loadTransactions(), this.loadDashboard()]) },
    async loadCategories() { this.categories = await this.api('/categories') },
    async saveCat() {
      try { await this.api('/categories', { method: 'POST', body: JSON.stringify(this.catForm) }); this.catForm.name = ''; await this.loadCategories() }
      catch (e) { alert(e.message) }
    },
    async delCat(id) { if (!confirm('删除该分类?')) return; try { await this.api('/categories/' + id, { method: 'DELETE' }); await this.loadCategories() } catch (e) { alert(e.message) } },
    money(cents) { return (cents / 100).toFixed(2) }
  }
}).mount('#app')