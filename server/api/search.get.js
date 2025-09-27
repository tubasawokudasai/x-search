import {defineEventHandler, getQuery} from 'h3';
import {useRuntimeConfig} from '#imports';
import NodeCache from 'node-cache';

const searchCache = new NodeCache({stdTTL: 7200});
const RRF_K = 60;

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
    const startTime = Date.now();
    try {
        const apiKeys = runtimeConfig.googleApiKey?.split(',');
        if (!apiKeys || !apiKeys.length) {
            console.warn('Google API密钥未配置。Google Search将被跳过。');
            return {results: [], time: Date.now() - startTime, error: 'Google API Key not configured'};
        }
        const randomIndex = Math.floor(Math.random() * apiKeys.length);
        const googleApiKey = apiKeys[randomIndex];
        const searchEngineId = runtimeConfig.searchEngineId;

        if (!googleApiKey || !searchEngineId) {
            console.warn('Google API密钥或搜索引擎ID未配置。Google Search将被跳过。');
            return {
                results: [],
                time: Date.now() - startTime,
                error: 'Google API Key or Search Engine ID not configured'
            };
        }

        let url = `https://customsearch.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(q.toString())}`;
        url += `&gl=hk&hl=zh-HK&lr=lang_zh-HK`;
        url += startIndex ? `&start=${startIndex}` : `&start=${(page - 1) * 10 + 1}`;

        if (type === 'image') {
            url += `&searchType=image`;
        } else if (sort === 'date') { // sort='date'只对普通网页搜索生效
            url += `&sort=date`;
        }

        const fetchOptions = {
            signal: AbortSignal.timeout(5000)
        };

        return await makeTimedExternalApiCall(url, fetchOptions, 'Google Search', (data) => {
            if (data && data.items) {
                return data.items.map((item, index) => {
                    const baseResult = {
                        title: item.title,
                        snippet: item.snippet || item.title || '', // Fallback for snippet
                        link: item.link, // Google CSE 图片搜索时，item.link 通常就是图片本身的URL
                        originalRank: index + 1,
                        source: 'google',
                        originalItem: item,
                        contextLink: null, // 默认设置为null
                        thumbnailLink: null, // 默认设置为null
                    };

                    // 根据提供的 Google CSE 图片接口，图片信息在 item.image 对象下
                    // 确保 item.image 存在，然后从其中提取 contextLink 和 thumbnailLink
                    if (type === 'image' && item.image) {
                        baseResult.contextLink = item.image.contextLink ?? null;
                        baseResult.thumbnailLink = item.image.thumbnailLink ?? null;
                    }
                    // 对于非图片搜索，或者 item.image 不存在的情况，contextLink/thumbnailLink 保持为 null
                    return baseResult;
                });
            }
            return [];
        });

    } catch (error) {
        console.error('Google Search 初始化或构建请求失败:', error.message);
        return {results: [], time: Date.now() - startTime, error: error.message};
    }
}

/**
 * 执行Brave Search API搜索
 * @param {string} q - 搜索关键词
 * @param {string} type - 搜索类型 (e.g., 'web', 'image')
 * @param {object} runtimeConfig - 运行时配置，包含Brave API密钥
 * @returns {Promise<SearchAPIResponse>} - 标准化搜索结果数组和时间
 */
async function searchBrave(q, type, runtimeConfig) {
    const startTime = Date.now();
    try {
        const braveApiKeys = runtimeConfig.braveApiKey?.split(',');
        if (!braveApiKeys || !braveApiKeys.length) {
            console.warn('Brave API密钥未配置。Brave Search将被跳过。');
            return {results: [], time: Date.now() - startTime, error: 'Brave API Key not configured'};
        }
        const randomIndex = Math.floor(Math.random() * braveApiKeys.length);
        const braveApiKey = braveApiKeys[randomIndex];

        const baseUrl = type === 'image'
            ? `https://api.search.brave.com/res/v1/images/search`
            : `https://api.search.brave.com/res/v1/web/search`;

        const url = new URL(baseUrl);
        url.searchParams.append('q', q);

        const fetchOptions = {
            headers: {
                'X-Subscription-Token': braveApiKey,
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(5000)
        };

        return await makeTimedExternalApiCall(url.toString(), fetchOptions, 'Brave Search', (data) => {
            if (type === 'image' && data && data.results) { // Brave 图片搜索的处理
                return data.results.map((item, index) => {
                    const titleFallback = item.title || 'Image Result';
                    const snippetFallback = item.title || 'No description available.'; // 图片搜索没有原生 snippet
                    return {
                        title: titleFallback,
                        snippet: snippetFallback,
                        link: item.properties?.url ?? null, // 正确：图片本身的URL来自 item.properties.url
                        thumbnailLink: item.thumbnail?.src ?? null, // 缩略图URL，使用可选链和 ??
                        contextLink: item.url, // 正确：图片所在的源页面URL来自 item.url
                        originalRank: index + 1,
                        source: 'brave',
                        originalItem: item
                    };
                });
            } else if (data && data.web && data.web.results) { // Brave 网页搜索的处理
                return data.web.results.map((item, index) => ({
                    title: item.title,
                    snippet: item.description,
                    link: item.url,
                    originalRank: index + 1,
                    source: 'brave',
                    originalItem: item,
                    contextLink: null, // 非图片搜索确保这些字段为null
                    thumbnailLink: null,
                }));
            }
            return [];
        });
    } catch (error) {
        console.error('Brave Search 初始化或构建请求失败:', error.message);
        return {results: [], time: Date.now() - startTime, error: error.message};
    }
}

export default defineEventHandler(async (event) => {
    const handlerStartTime = Date.now();
    let googleApiTime = null;
    let braveApiTime = null;

    try {
        const {q, page = 1, sort = 'relevance', type = 'web', startIndex} = getQuery(event);
        if (!q) {
            const handlerEndTime = Date.now();
            return {
                success: false,
                error: '搜索关键词不能为空',
                totalResponseTime: handlerEndTime - handlerStartTime,
                apiTimings: {google: googleApiTime, brave: braveApiTime}
            };
        }

        const runtimeConfig = useRuntimeConfig();

        const cacheKeyParams = {q, page, sort, type, startIndex};
        const cacheKey = JSON.stringify(cacheKeyParams);
        const cachedResult = searchCache.get(cacheKey);

        if (cachedResult) {
            console.log('Serving aggregated results from cache:', cacheKey);
            const handlerEndTime = Date.now();
            return {
                success: true,
                data: cachedResult,
                totalResponseTime: handlerEndTime - handlerStartTime,
                apiTimings: null
            };
        }

        console.log(`Aggregating results for query: "${q}", type: "${type}"`);

        const [googleSearchData, braveSearchData] = await Promise.all([
            searchGoogle(q, page, sort, type, startIndex, runtimeConfig),
            searchBrave(q, type, runtimeConfig),
        ]);

        const googleResults = googleSearchData.results;
        googleApiTime = googleSearchData.time;
        if (googleSearchData.error) {
            console.warn(`Google Search API 返回错误: ${googleSearchData.error}`);
        }

        const braveResults = braveSearchData.results;
        braveApiTime = braveSearchData.time;
        if (braveSearchData.error) {
            console.warn(`Brave Search API 返回错误: ${braveSearchData.error}`);
        }

        const allResults = [...googleResults, ...braveResults];

        const uniqueResultsMap = new Map();
        allResults.forEach(result => {
            if (!uniqueResultsMap.has(result.link)) {
                uniqueResultsMap.set(result.link, {
                    title: result.title,
                    snippet: result.snippet,
                    link: result.link,
                    source: result.source,
                    rrfScore: 0,
                    contextLink: result.contextLink,
                    thumbnailLink: result.thumbnailLink,
                    originalItem: result.originalItem
                });
            }
        });

        allResults.forEach(result => {
            if (uniqueResultsMap.has(result.link)) {
                const score = 1 / (RRF_K + result.originalRank);
                const entry = uniqueResultsMap.get(result.link);
                if (entry) {
                    entry.rrfScore += score;
                }
            }
        });

        const uniqueResults = Array.from(uniqueResultsMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);

        const aggregatedResponse = {
            searchInformation: {
                searchTime: ((googleApiTime || 0) + (braveApiTime || 0)) / ((googleApiTime && braveApiTime) ? 2 : (googleApiTime || braveApiTime) ? 1 : 1) || 0,
                formattedSearchTime: `${(((googleApiTime || 0) + (braveApiTime || 0)) / 2000 || 0).toFixed(2)} seconds`,
                totalResults: uniqueResults.length.toString(),
                formattedTotalResults: `${uniqueResults.length} results`
            },
            items: uniqueResults.map(item => {
                const baseItem = {
                    title: item.title,
                    link: item.link,
                    displayLink: item.link?.replace(/^(https?:\/\/(www\.)?)/, '').split('/')[0] || '',
                    snippet: item.snippet,
                    source: item.source,
                };

                if (type === 'image' && (item.contextLink || item.thumbnailLink)) {
                    baseItem.image = {
                        contextLink: item.contextLink ?? '',
                        thumbnailLink: item.thumbnailLink ?? '',
                    };
                }
                return baseItem;
            })
        };

        searchCache.set(cacheKey, aggregatedResponse);

        const handlerEndTime = Date.now();
        const totalResponseTime = handlerEndTime - handlerStartTime;

        return {
            success: true,
            data: aggregatedResponse,
            totalResponseTime: totalResponseTime,
            apiTimings: {
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
            statusMessage = 'API调用频率过高，请稍后再试';
        }

        const handlerEndTime = Date.now();
        const totalResponseTime = handlerEndTime - handlerStartTime;

        return {
            success: false,
            error: statusMessage,
            totalResponseTime: totalResponseTime,
            apiTimings: {
                google: googleApiTime,
                brave: braveApiTime,
            },
        };
    }
});

/**
 * 封装通用的外部 API 调用逻辑，包括计时、错误处理和数据提取。
 * @param {string} url - 要请求的 URL。
 * @param {RequestInit} options - Fetch 请求的选项（如 headers, signal）。
 * @param {string} apiName - API 的名称，用于日志和错误信息。
 * @param {(rawData: any) => SearchResult[]} dataExtractor - 从原始 API 响应中提取并标准化结果的函数。
 * @returns {Promise<SearchAPIResponse>} - 包含标准化结果数组、请求耗时和可能的错误信息。
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
        return {results, time: duration, error: null};
    } catch (error) {
        console.error(`${apiName} API调用失败:`, error.message);
        return {results: [], time: Date.now() - startTime, error: error.message};
    }
}
