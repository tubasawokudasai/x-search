# xSearch - 聚合网页搜索

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftubasawokudasai%2Fx-search&env=NUXT_GOOGLE_API_KEY,NUXT_SEARCH_ENGINE_ID,NUXT_BRAVE_API_KEY&envDescription=Enter%20your%20Google%20API%20Key,Search%20Engine%20ID%20and%20Brave%20API%20Key.&project-name=x-search-app&repository-name=x-search-app)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Ftubasawokudasai%2Fx-search&env=NUXT_GOOGLE_API_KEY,NUXT_SEARCH_ENGINE_ID,NUXT_BRAVE_API_KEY)

基于 **Nuxt.js** 的网页搜索应用，集成了 **Google 自定义搜索引擎 API** 和 **Brave 搜索 API**，提供网页和图片搜索功能。具有响应式设计和深色模式等特性。

## 功能特性

-   **多搜索引擎支持**：灵活切换和使用 Google 自定义搜索及 Brave 搜索服务。
-   网页搜索结果高亮显示
-   图片搜索网格布局
-   分页支持
-   深色模式支持
-   拼写建议
-   响应式设计
-   搜索类型切换（网页/图片）

-----

## 安装与设置

确保已安装项目依赖：

```bash
yarn install
```

-----

## 开发服务器

启动开发服务器，访问地址 `http://localhost:3000`：

```bash
yarn dev
```

-----

## 生产构建

为生产环境构建应用：

```bash
yarn build
```

本地预览生产构建：

```bash

yarn preview
```

-----

## 部署

### 一键部署

你可以使用以下按钮将此项目一键部署到 Vercel 或 Cloudflare Pages：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftubasawokudasai%2Fx-search&env=NUXT_GOOGLE_API_KEY,NUXT_SEARCH_ENGINE_ID,NUXT_BRAVE_API_KEY&envDescription=Enter%20your%20Google%20API%20Key,Search%20Engine%20ID%20and%20Brave%20API%20Key.&project-name=x-search-app&repository-name=x-search-app)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Ftubasawokudasai%2Fx-search&env=NUXT_GOOGLE_API_KEY,NUXT_SEARCH_ENGINE_ID,NUXT_BRAVE_API_KEY)

点击按钮后，平台会引导你完成仓库克隆和环境变量设置。

### 使用 Docker 部署

如果你希望自托管，可以使用 Docker 快速部署应用：

```bash
docker run -d -p 3000:3000 --name x-search \
  -e NUXT_GOOGLE_API_KEY="your_google_api_key_here" \
  -e NUXT_SEARCH_ENGINE_ID="your_search_engine_id_here" \
  -e NUXT_BRAVE_API_KEY="your_brave_api_key_here" \
  registry.cn-hangzhou.aliyuncs.com/openstackwang/x-search-app:latest
```

-----

## 环境配置

在项目根目录创建 `.env` 文件，添加你的 Google 自定义搜索引擎和 Brave API 凭证。这些变量会在部署到 Vercel 或 Cloudflare 时被要求输入。

```
# .env file for local development
NUXT_GOOGLE_API_KEY=your_google_api_key_here
NUXT_SEARCH_ENGINE_ID=your_search_engine_id_here
NUXT_BRAVE_API_KEY=your_brave_api_key_here
```

-----

## 项目结构

```
.
├── app/                          # 应用程序目录
│   ├── app.vue                  # 应用程序根组件
│   ├── pages/                   # 页面组件
│   │   ├── index/
│   │   │   └── index.vue       # 首页搜索输入页面
│   │   └── search/
│   │       └── index.vue       # 搜索结果页面
│   ├── plugins/
│   │   ├── google-cse.client.js # Google 自定义搜索插件
│   │   └── brave-api.client.js  # Brave 搜索 API 插件 (假设存在或计划添加)
│   └── assets/
│       └── css/
│           └── main.css        # 主样式文件
├── server/
│   └── api/
│       └── search.get.js       # 搜索请求的服务器API端点 (需处理多源搜索逻辑)
├── public/                     # 静态资源目录
│   ├── favicon.ico
│   └── robots.txt
├── conf/                       # 配置文件目录 (自托管使用)
│   └── nginx.conf             # Nginx 配置文件
├── Dockerfile                 # Docker 构建文件 (自托管使用)
├── nuxt.config.ts             # Nuxt 配置文件
├── package.json               # 项目依赖和脚本
├── tsconfig.json              # TypeScript 配置文件
├── .gitignore                 # Git 忽略文件
└── yarn.lock                  # Yarn 锁文件
```

## 依赖项

- Nuxt 3
- Tailwind CSS
- Vue 3

参考文档 
- [Programmable Search Engine](https://developers.google.com/custom-search/v1/overview?hl=zh-cn) 
- [Brave Search API Documentation](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started)
