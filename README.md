# Ledger 全栈记账应用

独立开发的全栈个人记账应用。后端手写 REST API,SQLite 持久化,认证、交易、分类、看板图表全部自实现。

## 功能

- 注册 / 登录:密码 scrypt 加盐哈希存储,服务端会话 token 鉴权
- 交易管理:收入/支出的增删改查,按类型、分类、日期范围筛选
- 分类管理:10 个预置分类 + 自定义分类(带颜色)
- 数据看板:总收入 / 总支出 / 结余 + 近 30 天趋势折线图 + 支出分类环形图
- 响应式布局,移动端可用

## 技术栈

- 后端:Node.js + Express + 内置 `node:sqlite`(SQLite,无需外部数据库服务)
- 认证:`crypto.scrypt` 密码哈希 + 随机会话 token
- 前端:Vue 3 + Chart.js(本地 vendor,运行时不联网加载)+ 原生 CSS
- 数据:SQLite,金额按"分"整数存储,避免浮点误差

## 运行

```bash
npm install
npm start
```

浏览器打开 http://localhost:3000,注册账号即可使用。

## 项目结构

```
ledger/
  server/
    app.js        Express 入口,所有 API 路由 + 静态托管
    db.js         SQLite 初始化、建表、预置数据
    auth.js       注册、登录、会话 token
    public/
      index.html  Vue 模板(SPA)
      app.js      前端逻辑(路由、请求、渲染、图表)
      style.css
      vendor/     Vue 与 Chart.js 本地文件
  data/           SQLite 数据库(运行时生成,不入库)
  REQUIREMENTS.md 需求文档
  start.bat       一键启动
```

## 说明

本项目为独立开发,所有业务代码(后端路由、数据库、认证、前端、图表)均自行实现,未使用任何现成的脚手架或模板项目。