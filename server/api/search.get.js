import { defineEventHandler, getQuery } from 'h3';
import { useRuntimeConfig } from '#imports';
import NodeCache from 'node-cache';

// 初始化缓存实例，设置缓存过期时间为2小时（7200秒）
const searchCache = new NodeCache({ stdTTL: 7200 });

// RRF常数，通常取60。这个值可以根据实际效果进行调整。
const RRF_K = 60;

/**
 * @typedef {object} SearchResult - 标准化搜索结果结构，用于内部聚合
 * @property {string} title - 结果标题
 * @property {string} snippet - 结果摘要
 * @property {string} link - 结果链接
 * @property {number} originalRank - 在原始搜索结果集中的排名 (1-based)
 * @property {string} source - 结果来源 (e.g., 'google', 'brave')
 * @property {number} [rrfScore] - RRF分数，聚合后添加
 */

/**
 * @typedef {object} SearchAPIResponse - 外部搜索API的标准化返回结构，包含结果和时间
 * @property {SearchResult[]} results - 标准化搜索结果数组
 * @property {number | null} time - API调用所花费的时间（毫秒），如果失败则为null
 */

/**
 * 封装通用的外部 API 调用逻辑，包括计时、错误处理和数据提取。
 * @template T - 标准化搜索结果的类型 (SearchResult)。
 * @param {string} url - 要请求的 URL。
 * @param {RequestInit} options - Fetch 请求的选项（如 headers, signal）。
 * @param {string} apiName - API 的名称，用于日志和错误信息。
 * @param {(rawData: any) => T[]} dataExtractor - 从原始 API 响应中提取并标准化结果的函数。
 * @returns {Promise<SearchAPIResponse>} - 包含标准化结果数组和请求耗时。
 */
async function makeTimedExternalApiCall(url, options, apiName, dataExtractor) {
    const startTime = Date.now();
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`${apiName} API responded with status ${response.status}: ${errorText}`);
        }

        const rawData = await response.json();
        const results = dataExtractor(rawData);
        const duration = Date.now() - startTime;
        return { results, time: duration };
    } catch (error) {
        console.error(`${apiName} API调用失败:`, error.message);
        // 即使失败，也返回从开始到失败所花费的时间
        return { results: [], time: Date.now() - startTime };
    }
}


/**
 * 执行Google Custom Search Engine搜索
 * @param {string} q - 搜索关键词
 * @param {number} page - 页码 (Google CSE每页10条)
 * @param {string} sort - 排序方式 (e.g., 'relevance', 'date')
 * @param {string} type - 搜索类型 (e.g., 'web', 'image')
 * @param {number} startIndex - Google搜索的起始索引，优先级高于page参数
 * @param {object} runtimeConfig - 运行时配置，包含Google API密钥和搜索引擎ID
 * @returns {Promise<SearchAPIResponse>} - 标准化搜索结果数组和时间
 */
async function searchGoogle(q, page, sort, type, startIndex, runtimeConfig) {
    const startTime = Date.now(); // 记录开始时间，用于处理密钥缺失等早期退出情况
    try {
        const apiKeys = runtimeConfig.googleApiKey?.split(',');
        if (!apiKeys || !apiKeys.length) {
            console.warn('Google API密钥未配置。Google Search将被跳过。');
            return { results: [], time: Date.now() - startTime };
        }
        const randomIndex = Math.floor(Math.random() * apiKeys.length);
        const googleApiKey = apiKeys[randomIndex];
        const searchEngineId = runtimeConfig.searchEngineId;

        if (!googleApiKey || !searchEngineId) {
            console.warn('Google API密钥或搜索引擎ID未配置。Google Search将被跳过。');
            return { results: [], time: Date.now() - startTime };
        }

        // 构造Google CSE请求URL
        let url = `https://customsearch.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(q.toString())}`;
        url += `&gl=hk&hl=zh-HK&lr=lang_zh-HK`; // 设置区域和语言偏好
        url += startIndex ? `&start=${startIndex}` : `&start=${(page - 1) * 10 + 1}`;

        if (type === 'image') {
            url += `&searchType=image`;
        } else if (sort === 'date') {
            url += `&sort=date`;
        }

        const fetchOptions = {
            signal: AbortSignal.timeout(5000) // 5秒超时
        };

        // 使用通用辅助函数执行请求
        return await makeTimedExternalApiCall(url, fetchOptions, 'Google Search', (data) => {
            if (data && data.items) {
                return data.items.map((item, index) => ({
                    title: item.title,
                    snippet: item.snippet,
                    link: item.link,
                    originalRank: index + 1,
                    source: 'google',
                    originalItem: item
                }));
            }
            return [];
        });

    } catch (error) {
        // 这个 catch 块主要处理 `makeTimedExternalApiCall` 调用前的错误 (如 URL 构造失败)
        console.error('Google Search 初始化或构建请求失败:', error.message);
        return { results: [], time: Date.now() - startTime };
    }
}

/**
 * 执行Brave Search API搜索
 * @param {string} q - 搜索关键词
 * @param {object} runtimeConfig - 运行时配置，包含Brave API密钥
 * @returns {Promise<SearchAPIResponse>} - 标准化搜索结果数组和时间
 */
async function searchBrave(q, runtimeConfig) {
    const startTime = Date.now(); // 记录开始时间，用于处理密钥缺失等早期退出情况
    try {
        const braveApiKeys = runtimeConfig.braveApiKey?.split(','); // 支持多个密钥
        if (!braveApiKeys || !braveApiKeys.length) {
            console.warn('Brave API密钥未配置。Brave Search将被跳过。');
            return { results: [], time: Date.now() - startTime };
        }
        const randomIndex = Math.floor(Math.random() * braveApiKeys.length);
        const braveApiKey = braveApiKeys[randomIndex];

        // 构造URL，使用URLSearchParams来处理查询参数
        const baseUrl = `https://api.search.brave.com/res/v1/web/search`;
        const url = new URL(baseUrl);
        url.searchParams.append('q', q); // 添加查询参数 'q'

        const fetchOptions = {
            headers: {
                'X-Subscription-Token': braveApiKey, // 从配置中获取的密钥
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(5000) // 5秒超时
        };

        // 使用通用辅助函数执行请求
        return await makeTimedExternalApiCall(url.toString(), fetchOptions, 'Brave Search', (data) => {
            if (data && data.web && data.web.results) {
                return data.web.results.map((item, index) => ({
                    title: item.title,
                    snippet: item.description, // Brave的摘要字段是description
                    link: item.url,         // Brave的链接字段是url
                    originalRank: index + 1, // Brave返回的结果排名从1开始
                    source: 'brave',          // 明确添加来源
                    originalItem: item // 保留 Brave 原始的一些字段
                }));
            }
            return [];
        });

    } catch (error) {
        // 这个 catch 块主要处理 `makeTimedExternalApiCall` 调用前的错误
        console.error('Brave Search 初始化或构建请求失败:', error.message);
        return { results: [], time: Date.now() - startTime };
    }
}

export default defineEventHandler(async (event) => {
    const handlerStartTime = Date.now(); // 记录整个事件处理的开始时间
    let googleApiTime = null; // 初始化 API 调用时间
    let braveApiTime = null;

    try {
        const { q, page = 1, sort = 'relevance', type = 'web', startIndex } = getQuery(event);
        if (!q) {
            const handlerEndTime = Date.now();
            return {
                success: false,
                error: '搜索关键词不能为空',
                totalResponseTime: handlerEndTime - handlerStartTime,
                apiTimings: { google: googleApiTime, brave: braveApiTime } // 此时为null
            };
        }

        const runtimeConfig = useRuntimeConfig();

        // 构建缓存键，确保包含所有影响聚合结果的参数
        const cacheKeyParams = { q, page, sort, type, startIndex, aggregateFormat: true };
        const cacheKey = JSON.stringify(cacheKeyParams);
        const cachedResult = searchCache.get(cacheKey);
        if (cachedResult) {
            console.log('Serving aggregated results from cache:', cacheKey);
            const handlerEndTime = Date.now();
            return {
                success: true,
                data: cachedResult,
                totalResponseTime: handlerEndTime - handlerStartTime,
                apiTimings: null // 从缓存获取，没有外部 API 调用时间
            };
        }

        console.log(`Aggregating results for query: "${q}"`);

        // 2. 并发请求 Google 和 Brave Search
        const [googleSearchData, braveSearchData] = await Promise.all([
            searchGoogle(q, page, sort, type, startIndex, runtimeConfig),
            searchBrave(q, runtimeConfig),
        ]);

        const googleResults = googleSearchData.results;
        googleApiTime = googleSearchData.time; // 获取 Google API 调用时间

        const braveResults = braveSearchData.results;
        braveApiTime = braveSearchData.time; // 获取 Brave API 调用时间

        // 3. 合并所有结果
        const allResults = [...googleResults, ...braveResults];

        // 4a. 去重，并为RRF评分做准备
        const uniqueResultsMap = new Map();
        allResults.forEach(result => {
            if (!uniqueResultsMap.has(result.link)) {
                uniqueResultsMap.set(result.link, {
                    title: result.title,
                    snippet: result.snippet,
                    link: result.link,
                    source: result.source,
                    rrfScore: 0,
                    originalItem: result.originalItem
                });
            }
        });

        // 4b. 计算RRF分数
        allResults.forEach(result => {
            if (uniqueResultsMap.has(result.link)) {
                const score = 1 / (RRF_K + result.originalRank);
                const entry = uniqueResultsMap.get(result.link);
                entry.rrfScore += score;
            }
        });

        // 4c. 根据RRF分数降序排序
        const uniqueResults = Array.from(uniqueResultsMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);

        // 5. 构造最终返回格式
        const aggregatedResponse = {
            kind: "customsearch#search",
            searchInformation: {
                totalResults: uniqueResults.length.toString(),
                formattedTotalResults: `${uniqueResults.length} results`
            },
            items: uniqueResults.map(item => ({
                title: item.title,
                htmlTitle: item.title,
                link: item.link,
                displayLink: item.link.replace(/^(https?:\/\/(www\.)?)/, '').split('/')[0],
                snippet: item.snippet,
                htmlSnippet: item.snippet,
                formattedUrl: item.link,
                htmlFormattedUrl: item.link,
                source: item.source,
                rrfScore: item.rrfScore,
            }))
        };

        // 6. 将结果存入缓存并返回
        searchCache.set(cacheKey, aggregatedResponse);

        const handlerEndTime = Date.now(); // 记录结束时间
        const totalResponseTime = handlerEndTime - handlerStartTime; // 计算总耗时

        return {
            success: true,
            data: aggregatedResponse,
            totalResponseTime: totalResponseTime, // 添加总响应时间
            apiTimings: { // 添加每个接口的请求时间
                google: googleApiTime,
                brave: braveApiTime,
            },
        };

    } catch (error) {
        console.error('服务端搜索代理错误:', error);

        let statusMessage = error.message || '服务端处理搜索请求失败';
        if (error.name === 'AbortError') {
            statusMessage = '请求超时，请稍后再试';
        } else if (error.message.includes('status 429')) {
            statusMessage = 'Google或Brave API调用频率过高，请稍后再试';
        }

        const handlerEndTime = Date.now(); // 记录结束时间
        const totalResponseTime = handlerEndTime - handlerStartTime; // 计算总耗时

        return {
            success: false,
            error: statusMessage,
            totalResponseTime: totalResponseTime, // 错误响应也包含总响应时间
            apiTimings: { // 错误响应也包含已知的 API 调用时间
                google: googleApiTime,
                brave: braveApiTime,
            },
        };
    }
});
