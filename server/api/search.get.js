import { defineEventHandler, getQuery, createError } from 'h3'; // Nuxt服务端工具库
import { useRuntimeConfig } from '#imports'; // 读取Nuxt配置

export default defineEventHandler(async (event) => {
    try {
        // 1. 获取前端传递的参数（搜索词、页码、排序方式等）
        const { q, page = 1, sort = 'relevance', type = 'web', startIndex } = getQuery(event);
        if (!q) {
            throw createError({ statusCode: 400, statusMessage: '搜索关键词不能为空' });
        }

        // 2. 从Nuxt配置中读取Google密钥（隐藏在服务端，不暴露给前端）
        const runtimeConfig = useRuntimeConfig();
        const apiKey = runtimeConfig.googleApiKey.split(',');
        if (!apiKey || !apiKey.length){
            throw createError({ statusCode: 500, statusMessage: '服务器未配置Google API密钥' });
        }
        const randomIndex = Math.floor(Math.random() * apiKey.length);
        const googleApiKey = apiKey[randomIndex];
        const searchEngineId = runtimeConfig.searchEngineId;

        if (!googleApiKey || !searchEngineId) {
            throw createError({ statusCode: 500, statusMessage: '服务器未配置Google API密钥或搜索引擎ID' });
        }

        // 3. 构造Google CSE请求URL（与原前端逻辑一致）
        let url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(q)}&lr=lang_zh-CN&hl=zh-CN`;
        url += `&lr=lang_zh-CN&hl=zh-CN`; // 中文结果
        url += startIndex ? `&start=${startIndex}` : `&start=${(page - 1) * 10 + 1}`; // 页码计算

        // 追加图片搜索/排序参数
        if (type === 'image') {
            url += `&searchType=image`;
        } else if (sort === 'date') {
            url += `&sort=date`;
        }

        // 4. 服务端发起请求（避免前端跨域和密钥暴露）
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw createError({
                statusCode: response.status,
                statusMessage: errorData?.error?.message || `Google API请求失败: ${response.statusText}`
            });
        }

        // 5. 将Google返回的结果回传给前端
        const searchData = await response.json();
        return { success: true, data: searchData };

    } catch (error) {
        console.error('服务端搜索代理错误:', error);
        // 统一错误格式，方便前端处理
        return {
            success: false,
            error: error.statusMessage || error.message || '服务端处理搜索请求失败'
        };
    }
});
