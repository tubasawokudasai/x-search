# 1. 构建阶段 (Build Stage)
# 使用 Node.js 镜像作为基础
FROM node:20.19.5-slim AS build

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 yarn.lock 文件，以便利用 Docker 缓存
COPY package.json yarn.lock ./

# 安装依赖
RUN yarn install --frozen-lockfile

# 复制所有项目文件
COPY . .

# 执行 Nuxt 构建命令
RUN yarn build

# 2. 生产阶段 (Production Stage)
# 再次使用 Node.js 镜像，但这次只包含运行所需的文件
FROM node:20.19.5-slim AS production

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 yarn.lock
COPY package.json yarn.lock ./

# 从构建阶段复制 node_modules 和 .output 目录
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output

# 暴露 Nuxt 默认的 3000 端口
EXPOSE 3000

# 启动 Nuxt 服务
CMD ["node", ".output/server/index.mjs"]
