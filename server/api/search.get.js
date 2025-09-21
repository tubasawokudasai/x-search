import {defineEventHandler, getQuery} from 'h3';
import {useRuntimeConfig} from '#imports';
import NodeCache from 'node-cache';
import got from 'got';

// 初始化缓存实例，设置缓存过期时间为2小时（7200秒）
const searchCache = new NodeCache({stdTTL: 7200});

export default defineEventHandler(async (event) => {
    try {
        const {q, page = 1, sort = 'relevance', type = 'web', startIndex} = getQuery(event);
        if (!q) {
            return {success: false, error: '搜索关键词不能为空'};
        }

        // 1. 检查缓存
        const queryParams = {q, page, sort, type, startIndex};
        const cacheKey = JSON.stringify(queryParams);
        const cachedResult = searchCache.get(cacheKey);
        if (cachedResult) {
            console.log('Serving from cache:', cacheKey);
            return {success: true, data: cachedResult};
        }

        const runtimeConfig = useRuntimeConfig();
        const apiKey = runtimeConfig.googleApiKey.split(',');
        if (!apiKey || !apiKey.length) {
            return {success: false, error: '服务器未配置Google API密钥'};
        }
        const randomIndex = Math.floor(Math.random() * apiKey.length);
        const googleApiKey = apiKey[randomIndex];
        const searchEngineId = runtimeConfig.searchEngineId;

        if (!googleApiKey || !searchEngineId) {
            return {success: false, error: '服务器未配置Google API密钥或搜索引擎ID'};
        }

        // 2. 构造Google CSE请求URL
        let url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(q.toString())}`;
        url += `&lr=lang_zh-CN&hl=zh-CN`;
        url += startIndex ? `&start=${startIndex}` : `&start=${(page - 1) * 10 + 1}`;

        if (type === 'image') {
            url += `&searchType=image`;
        } else if (sort === 'date') {
            url += `&sort=date`;
        }

        // 3. 服务端发起请求并处理错误
        const response = await got(url, {
            timeout: {
                request: 5000 // 5秒超时
            }
        }).json();

        // 4. 将结果存入缓存并返回
        searchCache.set(cacheKey, response);
        return {success: true, data: response};

    } catch (error) {
        console.error('服务端搜索代理错误:', error);

        let statusMessage = error.statusMessage || error.message || '服务端处理搜索请求失败';
        if (error.response?.statusCode === 429) {
            statusMessage = 'Google API调用频率过高，请稍后再试';
        }

        return {
            success: false,
            error: statusMessage
        };
    }
});
