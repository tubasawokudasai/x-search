#!/bin/bash

# 脚本中的变量
REGISTRY="registry.cn-hangzhou.aliyuncs.com"
NAMESPACE="openstackwang"
IMAGE_NAME="x-search-app"
IMAGE_VERSION="latest"
CONTAINER_NAME="x-search"

# 完整的镜像路径
IMAGE_PATH="$REGISTRY/$NAMESPACE/$IMAGE_NAME:$IMAGE_VERSION"

# --- 登录镜像仓库 ---
# 确保在运行脚本前你已经配置好 docker login

# --- 构建和推送多架构镜像 ---
echo "--- Building and pushing multi-platform image ---"
docker buildx build --platform linux/amd64,linux/arm64 -t "$IMAGE_PATH" --push .

# 检查构建是否成功
if [ $? -ne 0 ]; then
    echo "Error: Docker build failed. Exiting."
    exit 1
fi

# --- 远程部署 ---
echo "--- Deploying to remote server ---"
#
## 这里需要手动 SSH 到服务器，或者使用 SSH 命令执行远程命令
## 以下是示例，你需要根据你的实际情况修改
## 假设你已经配置了 SSH 免密登录
#SSH_USER="root"
#SSH_HOST="10-7-121-150"
#
## SSH到远程服务器并执行部署命令
#ssh $SSH_USER@$SSH_HOST << EOF
#    # 停止并删除旧容器
#    docker stop $CONTAINER_NAME || true
#    docker rm $CONTAINER_NAME || true
#
#    # 拉取最新的镜像
#    docker pull $IMAGE_PATH
#
#    # 启动新容器
#    docker run -d -p 3000:3000 --name $CONTAINER_NAME "$IMAGE_PATH"
#
#    echo "Deployment complete."
#EOF
#
#echo "Script finished."
