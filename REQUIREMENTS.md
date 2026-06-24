# Ledger — 全栈记账应用 需求文档

## 1. 项目概述

一个从零开发的全栈个人记账应用,支持收入/支出记录、分类管理、数据看板(图表)。

核心约束:**零第三方依赖**——不使用任何 npm 包,不克隆任何别人的项目。整个项目只用 Node.js 内置模块(`http` / `crypto` / `node:sqlite`)和浏览器原生 API 实现。每一行业务代码自己编写。

目标是展示 vibe coding 能把一个完整全栈应用(后端 + 数据库 + 认证 + 前端 + 图表)做到什么程度。

## 2. 设计原则

- **零依赖**:不安装任何 npm 包,不 clone 任何仓库。仅靠 Node.js 内置能力 + 原生 Web。
- **全部自写**:HTTP 路由、数据库访问、认证、前端、图表,全部手写,不套框架。
- **鲁棒优先**:输入校验、参数化 SQL(防注入)、错误处理到位(因为用户无法自行 debug)。
- **单进程可运行**:一个 Node 进程同时提供 API 和静态前端,同源,无跨域问题。

## 3. 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 后端 | Node.js 内置 `http` 模块 | 手写路由,不用 Express |
| 数据库 | Node.js 内置 `node:sqlite` | SQLite,无需外部驱动 |
| 认证 | Node `crypto` | scrypt 哈希密码 + HMAC-SHA256 签名 token |
| 前端 | 原生 HTML/CSS/JS | 不用框架,手写 SPA |
| 图表 | 原生 SVG | 手写折线图 / 环形图,不用图表库 |

无 `node_modules`,无 `package.json` 依赖。

## 4. 功能需求

### 4.1 用户认证
- 注册:用户名 + 密码;密码用 scrypt 加盐哈希后存储,明文不落库。
- 登录:校验通过后签发 token(payload 含 userId + 过期时间,HMAC 签名)。
- 登出:前端清除 token。
- 鉴权:除注册/登录外,所有接口校验 `Authorization: Bearer <token>`。

### 4.2 交易管理
- 新增:类型(收入/支出)、金额、分类、备注、日期。
- 编辑、删除。
- 列表:按日期范围、类型、分类筛选;按日期倒序。

### 4.3 分类管理
- 预置默认分类(餐饮、交通、购物、工资等),带颜色。
- 新增自定义分类(名称、类型、颜色)。
- 删除自定义分类(已被交易引用时阻止或提示)。

### 4.4 数据看板
- 总收入、总支出、结余三个数字卡片。
- 折线图:近 30 天 收入/支出趋势(手写 SVG)。
- 环形图:支出按分类占比(手写 SVG)。
- 最近 10 笔交易。

### 4.5 通用
- 响应式布局,移动端可用。
- 表单校验 + 友好错误提示。
- 金额以"分"为整数存储,避免浮点误差。

## 5. 数据模型

```
users
  id            INTEGER PRIMARY KEY
  username      TEXT UNIQUE NOT NULL
  password_hash TEXT NOT NULL
  salt          TEXT NOT NULL
  created_at    TEXT NOT NULL

categories
  id         INTEGER PRIMARY KEY
  user_id    INTEGER NOT NULL  (默认分类 user_id=0)
  name       TEXT NOT NULL
  type       TEXT NOT NULL  ('income' | 'expense')
  color      TEXT NOT NULL  (如 #ff6a3d)
  is_default INTEGER NOT NULL (0/1)
  created_at TEXT NOT NULL

transactions
  id          INTEGER PRIMARY KEY
  user_id     INTEGER NOT NULL
  type        TEXT NOT NULL ('income' | 'expense')
  amount      INTEGER NOT NULL  (单位:分)
  category_id INTEGER
  note        TEXT
  date        TEXT NOT NULL  (YYYY-MM-DD)
  created_at  TEXT NOT NULL
```

## 6. API 设计

所有 `/api/*` 返回 JSON。需鉴权的接口缺/错 token 返回 401。

```
POST   /api/auth/register      {username,password}            -> {token,user}
POST   /api/auth/login         {username,password}            -> {token,user}
POST   /api/auth/logout                                        -> {ok}
GET    /api/auth/me                                            -> {user}

GET    /api/transactions?from=&to=&type=&category=&page=      -> {rows,total}
POST   /api/transactions       {type,amount,category_id,note,date}
PUT    /api/transactions/:id    {...}
DELETE /api/transactions/:id

GET    /api/categories                                         -> {income:[],expense:[]}
POST   /api/categories         {name,type,color}
DELETE /api/categories/:id

GET    /api/dashboard                                          -> {totalIncome,totalExpense,balance,trend:[{date,income,expense}],byCategory:[{name,color,amount}]}
```

## 7. 前端页面(SPA,hash 路由)

- `#/login` 登录 / 注册
- `#/` 看板(数字卡片 + 折线图 + 环形图 + 最近交易)
- `#/transactions` 交易列表(新增/编辑/删除/筛选)
- `#/categories` 分类管理
- 顶部导航栏(未登录只显示登录页)

## 8. 项目结构

```
ledger/
  server/
    app.js          入口:启动 http 服务,挂载路由,托管静态前端
    router.js       极简路由分发
    db.js           sqlite 初始化 + 建表 + 预置数据
    auth.js         注册/登录/token 签发与校验
    api/
      transactions.js
      categories.js
      dashboard.js
      auth.js
    public/
      index.html
      app.js         前端 SPA 逻辑(路由、请求、渲染)
      style.css
      charts.js      手写 SVG 折线图 / 环形图
  data/ledger.db     SQLite 数据文件(运行时生成)
  REQUIREMENTS.md
  README.md
  start.bat          一键启动
  .gitignore
```

## 9. 非功能需求

- 安全:SQL 全部参数化;密码 scrypt 哈希;token HMAC 签名 + 过期校验。
- 健壮:所有输入做类型/范围校验,异常返回明确错误码与消息。
- 可运行:`start.bat` 启动后,浏览器开 `http://localhost:3000` 即用。
- 可维护:后端按模块拆分,前端单文件但结构清晰。

## 10. 不在范围内(v1)

- 多用户共享账本
- 多币种 / 汇率
- 定期账单 / 自动记账
- 预算上限提醒
- 数据导出 Excel(留 v2)
- 移动端原生 App

## 11. 验收标准

1. 注册 → 登录 → 进入看板,流程通。
2. 能新增/编辑/删除交易,列表与筛选生效。
3. 看板折线图、环形图数据正确、渲染正常。
4. 自定义分类可增删。
5. 移动端布局不崩。
6. `node_modules` 不存在 / 为空(证明零依赖)。
7. 未登录访问受保护接口返回 401。