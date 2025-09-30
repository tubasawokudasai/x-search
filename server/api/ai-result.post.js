import { defineEventHandler, readBody } from 'h3';

export default defineEventHandler(async (event) => {
    const { taskId } = await readBody(event);

    if (!taskId) {
        // 设置 HTTP 状态码为 400 Bad Request
        event.node.res.statusCode = 400;
        return {
            success: false,
            error: 'taskId is required',
        };
    }

    // 访问在主搜索请求中存储结果的全局对象
    const runtime = globalThis;
    const pendingReplies = runtime.__pendingAIReplies || new Map();

    if (!pendingReplies.has(taskId)) {
        // 如果任务ID不存在，可能任务还在处理中或ID无效
        return {
            success: true,
            data: {
                status: 'pending',
                message: 'AI overview is still being generated.',
            }
        };
    }

    const aiResult = pendingReplies.get(taskId);

    if (aiResult.status === 'completed' || aiResult.status === 'failed') {
        pendingReplies.delete(taskId);
    }

    return {
        success: true,
        data: aiResult,
    };
});
