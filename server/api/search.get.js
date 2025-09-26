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
 * 执行Google Custom Search Engine搜索
 * @param {string} q - 搜索关键词
 * @param {number} page - 页码 (Google CSE每页10条)
 * @param {string} sort - 排序方式 (e.g., 'relevance', 'date')
 * @param {string} type - 搜索类型 (e.g., 'web', 'image')
 * @param {number} startIndex - Google搜索的起始索引，优先级高于page参数
 * @param {object} runtimeConfig - 运行时配置，包含Google API密钥和搜索引擎ID
 * @returns {Promise<SearchResult[]>} - 标准化搜索结果数组
 */
async function searchGoogle(q, page, sort, type, startIndex, runtimeConfig) {
    try {
        const apiKeys = runtimeConfig.googleApiKey?.split(',');
        if (!apiKeys || !apiKeys.length) {
            console.warn('Google API密钥未配置。Google Search将被跳过。');
            return [];
        }
        const randomIndex = Math.floor(Math.random() * apiKeys.length);
        const googleApiKey = apiKeys[randomIndex];
        const searchEngineId = runtimeConfig.searchEngineId;

        if (!googleApiKey || !searchEngineId) {
            console.warn('Google API密钥或搜索引擎ID未配置。Google Search将被跳过。');
            return [];
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

        // 使用原生fetch进行请求，并设置超时
        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000) // 5秒超时，Node.js 16.5+ 支持 AbortSignal.timeout
        });

        // 检查响应状态，如果不是2xx，则抛出错误
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google API responded with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (data && data.items) {
            return data.items.map((item, index) => ({
                title: item.title,
                snippet: item.snippet,
                link: item.link,
                // 为了模拟 Google CSE 结果，可以添加更多字段，这里仅包含关键字段
                // item.displayLink, item.formattedUrl 等可以根据需求添加
                // originalRank 用于 RRF 计算，是当前API响应中的相对排名 (1-based)
                originalRank: index + 1,
                source: 'google', // 明确添加来源
                // 保留 Google CSE 原始的一些字段，方便后续聚合时返回更完整的数据
                // 注意：这里是直接把整个item存下来，方便在最终返回时进行结构映射。
                // 也可以只挑出部分字段，根据具体需求决定。
                originalItem: item
            }));
        }
        return [];

    } catch (error) {
        console.error('Google Search API调用失败:', error.message);
        return [];
    }
}

/**
 * 执行Brave Search API搜索
 * @param {string} q - 搜索关键词
 * @param {object} runtimeConfig - 运行时配置，包含Brave API密钥
 * @returns {Promise<SearchResult[]>} - 标准化搜索结果数组
 */
async function searchBrave(q, runtimeConfig) {
    try {
        const braveApiKeys = runtimeConfig.braveApiKey?.split(','); // 支持多个密钥
        if (!braveApiKeys || !braveApiKeys.length) {
            console.warn('Brave API密钥未配置。Brave Search将被跳过。');
            return [];
        }
        const randomIndex = Math.floor(Math.random() * braveApiKeys.length);
        const braveApiKey = braveApiKeys[randomIndex];

        // 构造URL，使用URLSearchParams来处理查询参数
        const baseUrl = `https://api.search.brave.com/res/v1/web/search`;
        const url = new URL(baseUrl);
        url.searchParams.append('q', q); // 添加查询参数 'q'

        // 使用原生fetch进行请求，并设置超时和头部
        const response = await fetch(url.toString(), {
            headers: {
                'X-Subscription-Token': braveApiKey, // 从配置中获取的密钥
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(5000) // 5秒超时
        });

        // 检查响应状态，如果不是2xx，则抛出错误
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Brave API responded with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();

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

    } catch (error) {
        console.error('Brave Search API调用失败:', error.message);
        return [];
    }
}

export default defineEventHandler(async (event) => {
    try {
        const { q, page = 1, sort = 'relevance', type = 'web', startIndex } = getQuery(event);
        if (!q) {
            return { success: false, error: '搜索关键词不能为空' };
        }

        const runtimeConfig = useRuntimeConfig();

        // 构建缓存键，确保包含所有影响聚合结果的参数
        const cacheKeyParams = { q, page, sort, type, startIndex, aggregateFormat: true };
        const cacheKey = JSON.stringify(cacheKeyParams);
        const cachedResult = searchCache.get(cacheKey);
        if (cachedResult) {
            console.log('Serving aggregated results from cache:', cacheKey);
            return { success: true, data: cachedResult };
        }

        console.log(`Aggregating results for query: "${q}"`);

        // 2. 并发请求 Google 和 Brave Search
        const [googleResults, braveResults] = await Promise.all([
            searchGoogle(q, page, sort, type, startIndex, runtimeConfig),
            searchBrave(q, runtimeConfig),
        ]);

        // 3. 合并所有结果
        const allResults = [...googleResults, ...braveResults];

        // 4a. 去重，并为RRF评分做准备
        const uniqueResultsMap = new Map();
        allResults.forEach(result => {
            if (!uniqueResultsMap.has(result.link)) {
                // 如果链接不存在，则添加，并初始化RRF分数
                uniqueResultsMap.set(result.link, {
                    title: result.title,
                    snippet: result.snippet,
                    link: result.link,
                    source: result.source, // 保留第一个发现的来源信息
                    rrfScore: 0, // 初始化rrfScore
                    // 将原始 item 也存储下来，方便最终返回时构造更完整的响应
                    // 注意：这里可能会混合不同来源的原始字段，需要谨慎处理
                    originalItem: result.originalItem
                });
            }
        });

        // 4b. 计算RRF分数
        allResults.forEach(result => {
            if (uniqueResultsMap.has(result.link)) {
                const score = 1 / (RRF_K + result.originalRank);
                const entry = uniqueResultsMap.get(result.link);
                entry.rrfScore += score; // 累加分数
            }
        });

        // 4c. 根据RRF分数降序排序
        const uniqueResults = Array.from(uniqueResultsMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);

        // 5. 构造最终返回格式
        // 模拟 Google CSE API 的顶层结构
        const aggregatedResponse = {
            kind: "customsearch#search",
            // 更多Google CSE的顶层字段，如url, queries, context等，由于是聚合结果，
            // 很难准确反映所有来源，这里只包含items和searchInformation
            searchInformation: {
                totalResults: uniqueResults.length.toString(),
                formattedTotalResults: `${uniqueResults.length} results`
            },
            items: uniqueResults.map(item => ({
                // 这些字段尽量与Google CSE的item结构保持一致
                // title, snippet, link 是我们标准化 SearchResult 时就有的
                title: item.title,
                htmlTitle: item.title, // 简单复制
                link: item.link,
                displayLink: item.link.replace(/^(https?:\/\/(www\.)?)/, '').split('/')[0], // 模拟
                snippet: item.snippet,
                htmlSnippet: item.snippet, // 简单复制
                formattedUrl: item.link,
                htmlFormattedUrl: item.link,
                // 新增来源和RRF分数
                source: item.source,
                rrfScore: item.rrfScore,
                // 如果需要，可以将原始item中的更多字段也映射过来
                // 例如：item.originalItem.pagemap (来自Google)
                //      item.originalItem.thumbnail (来自Brave)
                // ⚠️ 注意：混合字段时需要处理好不同来源字段的差异性
                // 暂时只暴露标准化和新增的字段，确保结果一致性
            }))
        };

        // 6. 将结果存入缓存并返回
        searchCache.set(cacheKey, aggregatedResponse);
        return { success: true, data: aggregatedResponse };

    } catch (error) {
        console.error('服务端搜索代理错误:', error);

        let statusMessage = error.message || '服务端处理搜索请求失败';
        // 原生fetch的超时错误会是 'AbortError'
        if (error.name === 'AbortError') {
            statusMessage = '请求超时，请稍后再试';
        } else if (error.message.includes('status 429')) {
            statusMessage = 'Google或Brave API调用频率过高，请稍后再试';
        }

        return {
            success: false,
            error: statusMessage
        };
    }
});
