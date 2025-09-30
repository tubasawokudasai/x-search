// server/api/search.post.ts (或对应搜索路由文件)
import {defineEventHandler, getQuery, readBody} from 'h3';
import {useRuntimeConfig} from '#imports';
import NodeCache from 'node-cache';

// 导入 AI 触发器和 Gemini 调用工具
import {callGeminiChat} from "~~/server/utils/gemini-api.js";
import aiOverviewTrigger from "~~/server/utils/ai-overview-trigger.js";

// 原有缓存和常量配置
const searchCache = new NodeCache({stdTTL: 7200});
const RRF_K = 60; // Reciprocal Rank Fusion 常量

/**
 * 从逗号分隔的原始密钥字符串中安全地选择一个随机的 API 密钥。
 * @param {string | undefined} rawKeys - 原始的、逗号分隔的 API 密钥字符串。
 * @returns {string | null} - 返回一个有效的 API 密钥，如果没有则返回 null。
 */
function selectRandomApiKey(rawKeys) {
    if (!rawKeys || typeof rawKeys !== 'string' || rawKeys.trim() === '') {
        return null;
    }
    const apiKeys = rawKeys.split(',').map(key => key.trim()).filter(key => key !== '');
    if (apiKeys.length === 0) {
        return null;
    }
    return apiKeys[Math.floor(Math.random() * apiKeys.length)];
}


/**
 * 执行 Google Custom Search Engine 搜索
 * 【注意】此函数已移除所有 AI 相关的参数和逻辑
 * @param {string} q - 搜索关键词
 * @param {number} page - 页码 (Google CSE 每页 10 条)
 * @param {string} sort - 排序方式 (e.g., 'relevance', 'date')
 * @param {string} type - 搜索类型 (e.g., 'web', 'image')
 * @param {number|undefined} startIndex - Google 搜索的起始索引，优先级高于 page 参数
 * @param {object} runtimeConfig - 运行时配置（含 API 密钥等）
 * @returns {Promise<{
 * results: SearchResult[],
 * time: number,
 * error: string|null
 * }>} - 含初步结果的响应
 */
async function searchGoogle(q, page, sort, type, startIndex, runtimeConfig) {
    const startTime = Date.now();

    try {
        const googleApiKey = selectRandomApiKey(runtimeConfig.googleApiKey);
        const searchEngineId = runtimeConfig.searchEngineId;

        if (!googleApiKey || !searchEngineId) {
            console.warn('Google API 密钥或搜索引擎 ID 未配置。Google Search 将被跳过。');
            return {
                results: [], time: Date.now() - startTime, error: 'Google API Key or Search Engine ID not configured'
            };
        }

        let url = `https://customsearch.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(q.toString())}`;
        url += `&gl=hk&hl=zh-HK&lr=lang_zh-HK`;
        url += startIndex ? `&start=${startIndex}` : `&start=${(page - 1) * 10 + 1}`;
        if (type === 'image') url += `&searchType=image`; else if (sort === 'date') url += `&sort=date`;

        const fetchOptions = {signal: AbortSignal.timeout(5000)};

        const googleResponse = await makeTimedExternalApiCall(url, fetchOptions, 'Google Search', (data) => {
            if (data && data.items) {
                return data.items.map((item, index) => ({
                    title: item.title,
                    snippet: item.snippet || item.title || '',
                    link: item.link,
                    originalRank: index + 1,
                    source: 'google',
                    originalItem: item,
                    contextLink: type === 'image' ? (item.image?.contextLink ?? null) : null,
                    thumbnailLink: type === 'image' ? (item.image?.thumbnailLink ?? null) : null,
                }));
            }
            return [];
        });

        return googleResponse;

    } catch (error) {
        console.error('Google Search 初始化或构建请求失败:', error.message);
        return {
            results: [], time: Date.now() - startTime, error: error.message,
        };
    }
}

/**
 * 执行 Brave Search API 搜索
 * @param {string} q - 搜索关键词
 * @param {string} type - 搜索类型 (e.g., 'web', 'image')
 * @param {object} runtimeConfig - 运行时配置
 * @returns {Promise<SearchAPIResponse>} - 标准化搜索结果
 */
async function searchBrave(q, type, runtimeConfig) {
    const startTime = Date.now();
    try {
        const braveApiKey = selectRandomApiKey(runtimeConfig.braveApiKey);

        if (!braveApiKey) {
            console.warn('Brave API 密钥未配置。Brave Search 将被跳过。');
            return {results: [], time: Date.now() - startTime, error: 'Brave API Key not configured'};
        }

        const baseUrl = type === 'image' ? `https://api.search.brave.com/res/v1/images/search` : `https://api.search.brave.com/res/v1/web/search`;

        const url = new URL(baseUrl);
        url.searchParams.append('q', q);

        const fetchOptions = {
            headers: {
                'X-Subscription-Token': braveApiKey, 'Accept': 'application/json',
            }, signal: AbortSignal.timeout(5000)
        };

        return await makeTimedExternalApiCall(url.toString(), fetchOptions, 'Brave Search', (data) => {
            if (type === 'image' && data && data.results) {
                return data.results.map((item, index) => {
                    const titleFallback = item.title || 'Image Result';
                    const snippetFallback = item.title || 'No description available.';
                    return {
                        title: titleFallback,
                        snippet: snippetFallback,
                        link: item.properties?.url ?? null,
                        thumbnailLink: item.thumbnail?.src ?? null,
                        contextLink: item.url,
                        originalRank: index + 1,
                        source: 'brave',
                        originalItem: item
                    };
                });
            } else if (data && data.web && data.web.results) {
                return data.web.results.map((item, index) => ({
                    title: item.title,
                    snippet: item.description,
                    link: item.url,
                    originalRank: index + 1,
                    source: 'brave',
                    originalItem: item,
                    contextLink: null,
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

/**
 * 封装通用的外部 API 调用逻辑
 * @param {string} url - 请求 URL
 * @param {RequestInit} options - Fetch 选项
 * @param {string} apiName - API 名称（用于日志）
 * @param {(rawData: any) => SearchResult[]} dataExtractor - 结果提取函数
 * @returns {Promise<SearchAPIResponse>} - 标准化响应
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
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        console.error(`${apiName} API调用失败:`, error.message);
        return {results: [], time: Date.now() - startTime, error: error.message};
    }
}


// 主事件处理器
export default defineEventHandler(async (event) => {
    const handlerStartTime = Date.now();

    try {
        // 步骤 1：解析查询参数 (保持不变)
        const rawQuery = getQuery(event);
        const q = typeof rawQuery.q === 'string' ? rawQuery.q.trim() : undefined;
        const page = parseInt(rawQuery.page) || 1;
        const sort = typeof rawQuery.sort === 'string' ? rawQuery.sort : 'relevance';
        const type = typeof rawQuery.type === 'string' ? rawQuery.type : 'web';
        const startIndex = rawQuery.startIndex ? parseInt(rawQuery.startIndex) : undefined;

        if (!q) {
            return {
                success: false,
                error: '搜索关键词不能为空',
                totalResponseTime: Date.now() - handlerStartTime,
                apiTimings: null
            };
        }

        const runtimeConfig = useRuntimeConfig();

        // 步骤 2：检查缓存 (保持不变)
        const cacheKey = JSON.stringify({q, page, sort, type, startIndex});
        const cachedResult = searchCache.get(cacheKey);

        if (cachedResult) {
            console.log(`[Cache] 命中并返回缓存结果 for key: ${cacheKey}`);
            return {
                success: true, data: cachedResult, totalResponseTime: Date.now() - handlerStartTime, apiTimings: null // 来自缓存，无实时 API 计时
            };
        }

        console.log(`[Search] 开始聚合查询: "${q}", 类型: "${type}"`);

        // 步骤 3：AI 触发判断
        let shouldTriggerAI = false;
        const geminiApiKey = runtimeConfig.geminiApiKey || '';
        let aiTaskId = null;

        if (geminiApiKey.trim() !== '') {
            const aiTriggerResult = aiOverviewTrigger.shouldTriggerAIOverview(q);
            shouldTriggerAI = aiTriggerResult.trigger;
            console.log(`[AI Trigger] Query [${q}] -> Should trigger AI? ${shouldTriggerAI}`);

            if (shouldTriggerAI) {
                // 提前生成 AI 任务 ID
                aiTaskId = `generic-ai-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            }
        } else {
            console.warn('[AI Trigger] Gemini API 密钥未配置，跳过 AI 概览触发判断和任务启动');
        }

        // 步骤 4：并行调用搜索引擎
        const searchPromises = [];

        // Google 搜索任务
        if (runtimeConfig.googleApiKey && runtimeConfig.searchEngineId) {
            searchPromises.push(searchGoogle(q, page, sort, type, startIndex, runtimeConfig));
        } else {
            console.warn("[Config] 未找到 Google API 密钥或搜索引擎 ID，跳过 Google 搜索。");
        }

        // Brave 搜索任务
        if (runtimeConfig.braveApiKey) {
            searchPromises.push(searchBrave(q, type, runtimeConfig));
        } else {
            console.warn("[Config] 未找到 Brave API 密钥，跳过 Brave 搜索。");
        }

        if (searchPromises.length === 0) {
            // 如果没有配置任何搜索引擎，但触发了 AI，应该继续 AI 任务
            if (!shouldTriggerAI) {
                throw new Error("所有搜索引擎均未配置，且 AI 未触发，无法执行搜索。");
            }
        } else {
            await Promise.all(searchPromises);
        }

        // 重新获取搜索结果（因为它们可能在 searchPromises 中）
        const searchResults = await Promise.all(searchPromises);

        // 步骤 5：处理并聚合结果
        const googleSearchData = searchResults.find(res => res.results.length > 0 && res.results[0]?.source === 'google') || {
            results: [],
            time: 0,
            error: null
        };
        const braveSearchData = searchResults.find(res => res.results.length > 0 && res.results[0]?.source === 'brave') || {
            results: [],
            time: 0,
            error: null
        };

        if (googleSearchData.error) console.warn(`Google 搜索错误: ${googleSearchData.error}`);
        if (braveSearchData.error) console.warn(`Brave 搜索错误: ${braveSearchData.error}`);

        // === 步骤 5.5：AI 任务注册逻辑===
        if (shouldTriggerAI && aiTaskId) {

            const runtime = globalThis;
            runtime.__pendingAIReplies = runtime.__pendingAIReplies || new Map();

            const aiPrompt = `基于搜索关键词「${q}」，生成结构化 AI 概览：请紧扣关键词核心信息，用简洁语言分点（如要点 1、要点 2）呈现，不展开无关内容，快速聚焦核心，避免发散。语言需与关键词语言一致。`;

            // 异步执行 Gemini 调用（不阻塞当前函数返回）
            (async () => {
                try {
                    console.log(`独立 AI 任务 [${aiTaskId}] 开始执行...`);

                    const geminiResult = await callGeminiChat(aiPrompt, geminiApiKey);
                    const aiContent = geminiResult?.choices?.[0]?.message?.content || 'AI 未生成有效回复';

                    runtime.__pendingAIReplies.set(aiTaskId, {
                        taskId: aiTaskId, query: q, source: 'generic-ai', // 标记为通用 AI
                        status: 'completed', data: {
                            aiOverview: aiContent, // 不再包含 googlePreliminary 或任何搜索结果上下文
                        }, generatedAt: Date.now()
                    });
                    console.log(`独立 AI 任务 [${aiTaskId}] 完成`);
                } catch (aiError) {
                    console.error(`独立 AI 任务 [${aiTaskId}] 失败：`, aiError.message);
                    runtime.__pendingAIReplies.set(aiTaskId, {
                        taskId: aiTaskId,
                        query: q,
                        source: 'generic-ai',
                        status: 'failed',
                        error: aiError.message,
                        generatedAt: Date.now()
                    });
                }
            })().then();
        }
        // === 结束 AI 任务注册逻辑 ===

        // 步骤 6：结果去重和RRF排序
        const allResults = [...googleSearchData.results, ...braveSearchData.results];
        const uniqueResultsMap = new Map();

        allResults.forEach(result => {
            if (result.link && !uniqueResultsMap.has(result.link)) {
                uniqueResultsMap.set(result.link, {...result, rrfScore: 0});
            }
        });

        allResults.forEach(result => {
            if (result.link && uniqueResultsMap.has(result.link)) {
                const score = 1 / (RRF_K + result.originalRank);
                uniqueResultsMap.get(result.link).rrfScore += score;
            }
        });

        const uniqueResults = Array.from(uniqueResultsMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);

        // 步骤 7：构建聚合响应
        const validApiTimes = [googleSearchData.time, braveSearchData.time].filter(t => t > 0);
        const averageSearchTime = validApiTimes.length > 0 ? validApiTimes.reduce((a, b) => a + b, 0) / validApiTimes.length : 0;

        const aggregatedResponse = {
            searchInformation: {
                searchTime: averageSearchTime,
                formattedSearchTime: `${(averageSearchTime / 1000).toFixed(2)} seconds`,
                totalResults: uniqueResults.length.toString(),
                formattedTotalResults: `${uniqueResults.length} results`
            }, items: uniqueResults.map(item => {
                const baseItem = {
                    title: item.title,
                    link: item.link,
                    displayLink: item.link?.replace(/^(https?:\/\/(www\.)?)/, '').split('/')[0] || '',
                    snippet: item.snippet,
                    source: item.source,
                };
                if (type === 'image') {
                    baseItem.image = {
                        contextLink: item.contextLink ?? '', thumbnailLink: item.thumbnailLink ?? '',
                    };
                }
                return baseItem;
            }), aiTask: {
                // 只有成功触发且任务ID存在时才标记为 true
                hasAI: shouldTriggerAI && !!aiTaskId, taskId: aiTaskId, source: 'generic' // 标记为通用 AI
            }
        };

        // 步骤 8：存入缓存
        searchCache.set(cacheKey, aggregatedResponse);

        return {
            success: true, data: aggregatedResponse, totalResponseTime: Date.now() - handlerStartTime, apiTimings: {
                google: googleSearchData.time || null, brave: braveSearchData.time || null,
            },
        };

    } catch (error) {
        console.error('搜索代理错误:', error);
        let statusMessage = error.message || '服务端处理搜索请求失败';
        if (error instanceof DOMException && error.name === 'AbortError') {
            statusMessage = '请求超时，请稍后再试';
        } else if (error.message?.includes('status 429')) {
            statusMessage = 'API调用频率过高，请稍后再试';
        }

        return {
            success: false, error: statusMessage, totalResponseTime: Date.now() - handlerStartTime, apiTimings: null, // Error occurred, timings may be incomplete
        };
    }
});
