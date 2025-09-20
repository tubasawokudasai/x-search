# xSearch - Google 自定义搜索引擎客户端

基于 Nuxt.js 的网页搜索客户端，集成 Google 自定义搜索引擎 API，提供网页和图片搜索功能。

## 功能特性

- 网页搜索结果高亮显示
- 图片搜索网格布局
- 分页支持（最多100个结果）
- 深色模式支持
- 拼写建议
- 响应式设计
- 搜索类型切换（网页/图片）

## 安装设置

确保安装了项目依赖：

```bash
yarn install
```

## 开发服务器

启动开发服务器，访问地址 `http://localhost:3000`：

```bash
yarn dev
```

## 生产构建

为生产环境构建应用：

```bash
yarn build
```

本地预览生产构建：

```bash
yarn preview
```

## 环境配置

在项目根目录创建 `.env` 文件，添加你的 Google 自定义搜索引擎凭证：

```
GOOGLE_CSE_API_KEY=your_api_key_here
GOOGLE_CSE_ID=your_search_engine_id_here
```

## 项目结构

- `/app/pages/index/index.vue` - 首页搜索输入页面
- `/app/pages/search/index.vue` - 搜索结果页面
- `/app/plugins/google-cse.client.js` - Google 自定义搜索插件
- `/server/api/search.get.ts` - 搜索请求的服务器API端点

## 依赖项

- Nuxt 3
- Tailwind CSS
- Vue 3

有关工作原理的详细说明，请查看 [Nuxt 文档](https://nuxt.com/docs/getting-started/introduction)。
