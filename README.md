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

使用 Docker 快速部署应用，命令如下：

```bash
docker run -d -p 3000:3000 --name x-search registry.cn-hangzhou.aliyuncs.com/openstackwang/x-search-app:latest
```

-----

## 环境配置

在项目根目录创建 `.env` 文件，添加你的 Google 自定义搜索引擎凭证。支持使用逗号分隔的多个 API 密钥：

```
NUXT_GOOGLE_API_KEY=your_api_key_here
NUXT_SEARCH_ENGINE_ID=your_search_engine_id_here
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
│   │   └── google-cse.client.js # Google 自定义搜索插件
│   └── assets/                 
│       └── css/
│           └── main.css        # 主样式文件
├── server/                     
│   └── api/
│       └── search.get.js       # 搜索请求的服务器API端点
├── public/                     # 静态资源目录
│   ├── favicon.ico
│   └── robots.txt
├── conf/                       # 配置文件目录
│   └── nginx.conf             # Nginx 配置文件
├── Dockerfile                 # Docker 构建文件
├── nuxt.config.ts             # Nuxt 配置文件
├── package.json               # 项目依赖和脚本
├── tsconfig.json              # TypeScript 配置文件
├── .env                       # 环境变量文件
├── .gitignore                 # Git 忽略文件
└── yarn.lock                  # Yarn 锁文件
```

-----

## 依赖项

- Nuxt 3
- Tailwind CSS
- Vue 3

有关工作原理的详细说明，请查看 [Programmable Search Engine](https://developers.google.com/custom-search/v1/overview?hl=zh-cn)。
