import { defineEventHandler, getQuery, createError } from 'h3';
// 引入 iconv-lite
import iconv from 'iconv-lite';

export default defineEventHandler(async (event) => {
    try {
        const { q } = getQuery(event);

        if (!q) {
            throw createError({ statusCode: 400, statusMessage: '搜索关键词不能为空' });
        }

        const url = `https://www.google.com/complete/search?q=${encodeURIComponent(q)}&client=chrome&hl=zh-CN`;

        const response = await fetch(url);

        if (!response.ok) {
            throw createError({
                statusCode: response.status,
                statusMessage: `获取搜索建议失败: ${response.statusText}`
            });
        }

        // --- 这里是关键的改动 ---

        // 1. 不再使用 response.text()，而是获取原始的二进制数据 ArrayBuffer
        const buffer = await response.arrayBuffer();

        // 2. 使用 iconv-lite 将 GBK 编码的 Buffer 解码为 UTF-8 字符串
        //    Buffer.from(buffer) 是将 ArrayBuffer 转换为 Node.js 的 Buffer 对象
        const text = iconv.decode(Buffer.from(buffer), 'gbk');


        // 解析为 JSON
        const data = JSON.parse(text);

        // 提取搜索建议
        const suggestions = data[1]

        return {
            success: true,
            data: suggestions
        };

    } catch (error) {
        // 捕获到的错误可能已经是 h3 的 H3Error，它有 statusCode 和 statusMessage
        const h3Error = error.statusCode ? error : null;

        console.error('服务端搜索建议代理错误:', h3Error || error);

        // 优先返回 h3 错误信息，否则返回通用错误信息
        return {
            success: false,
            error: h3Error?.statusMessage || error.message || '服务端处理搜索请求失败'
        };
    }
});
