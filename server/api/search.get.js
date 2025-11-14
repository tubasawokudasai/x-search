// server/api/search.post.ts

import {defineEventHandler, getQuery} from 'h3';
import {useRuntimeConfig} from '#imports';
import NodeCache from 'node-cache';
import {callGeminiChat} from "~~/server/utils/gemini-api.js";
import aiOverviewTrigger from "~~/server/utils/ai-overview-trigger.js";

// ========== START: 常量、枚举和辅助工具定义 ==========

// --- 常量配置 ---
const CACHE_TTL_SECONDS = 7200; // 缓存有效期，2小时
const REQUEST_TIMEOUT_MS = 5000; // 外部API请求超时时间，5秒
const GOOGLE_ITEMS_PER_PAGE = 10; // Google CSE 每页返回的条目数
const RRF_K = 60; // Reciprocal Rank Fusion 常量

// --- 搜索源和类型常量，替代枚举 ---
const SEARCH_SOURCE = {
    GOOGLE: 'google',
    BRAVE: 'brave',
    GENERIC_AI: 'generic-ai',
};

const SEARCH_TYPE = {
    WEB: 'web',
    IMAGE: 'image',
};

const SEARCH_SORT = {
    RELEVANCE: 'relevance',
    DATE: 'date',
};

// ========== END: 常量、枚举和辅助工具定义 ==========


// 原有缓存配置
const searchCache = new NodeCache({stdTTL: CACHE_TTL_SECONDS});

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
 * 封装通用的外部 API 调用逻辑
 * @param {string} url - 请求 URL
 * @param {RequestInit} options - Fetch 选项
 * @param {string} apiName - API 名称（用于日志，使用常量）
 * @param {(rawData: any) => Array<object>} dataExtractor - 结果提取函数
 * @param {boolean} [returnRawData=false] - 是否返回原始数据对象 (NEW)
 * @returns {Promise<object>} - 标准化响应
 */
async function makeTimedExternalApiCall(url, options, apiName, dataExtractor, returnRawData = false) {
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

        const responseObj = {results, time: duration, error: null};
        if (returnRawData) {
            responseObj.originalRawData = rawData; // 新增返回原始数据
        }
        return responseObj;

    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.warn(`[${apiName}] API请求超时:`, error.message);
            return {results: [], time: Date.now() - startTime, error: '请求超时'};
        }
        console.error(`[${apiName}] API调用失败:`, error.message);
        return {results: [], time: Date.now() - startTime, error: error.message};
    }
}


/**
 * 执行 Google Custom Search Engine 搜索
 * @param {string} q - 搜索关键词
 * @param {number} page - 页码 (Google CSE 每页 10 条)
 * @param {string} sort - 排序方式 (e.g., 'relevance', 'date')
 * @param {string} type - 搜索类型 (e.g., 'web', 'image')
 * @param {number|undefined} startIndex - Google 搜索的起始索引，优先级高于 page 参数
 * @param {object} runtimeConfig - 运行时配置（含 API 密钥等）
 * @returns {Promise<object>} - 含初步结果和原始数据的响应 (已修正)
 */
async function searchGoogle(q, page, sort, type, startIndex, runtimeConfig) {
    const startTime = Date.now();

    try {
        const googleApiKey = selectRandomApiKey(runtimeConfig.googleApiKey);
        const searchEngineId = runtimeConfig.searchEngineId;

        if (!googleApiKey || !searchEngineId) {
            console.warn('[Google Search] API 密钥或搜索引擎 ID 未配置。Google Search 将被跳过。');
            return {
                results: [], time: Date.now() - startTime, error: 'Google API Key or Search Engine ID not configured'
            };
        }

        const url = new URL(`https://customsearch.googleapis.com/customsearch/v1`);
        url.searchParams.append('key', googleApiKey);
        url.searchParams.append('cx', searchEngineId);
        url.searchParams.append('q', q);

        url.searchParams.append('gl', 'hk');
        url.searchParams.append('hl', 'zh-HK');
        url.searchParams.append('lr', 'lang_zh-HK');
        url.searchParams.append('start', (startIndex ? startIndex : (page - 1) * GOOGLE_ITEMS_PER_PAGE + 1).toString());

        if (type === SEARCH_TYPE.IMAGE) {
            url.searchParams.append('searchType', 'image');
        } else if (sort === SEARCH_SORT.DATE) {
            url.searchParams.append('sort', 'date');
        }

        const fetchOptions = {signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)};

        // 修正: 传递 true 以返回原始数据
        return await makeTimedExternalApiCall(url.toString(), fetchOptions, SEARCH_SOURCE.GOOGLE, (data) => {
            if (data && data.items) {
                return data.items.map((item, index) => ({
                    title: item.title,
                    snippet: item.snippet || item.title || '',
                    link: item.link,
                    originalRank: index + 1,
                    source: SEARCH_SOURCE.GOOGLE,
                    originalItem: item,
                    contextLink: type === SEARCH_TYPE.IMAGE ? (item.image?.contextLink ?? null) : null,
                    thumbnailLink: type === SEARCH_TYPE.IMAGE ? (item.image?.thumbnailLink ?? null) : null,
                }));
            }
            return [];
        }, true); // <- 修正点

    } catch (error) {
        console.error('[Google Search] 初始化或构建请求失败:', error.message);
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
 * @returns {Promise<object>} - 标准化搜索结果
 */
async function searchBrave(q, type, runtimeConfig) {
    const startTime = Date.now();
    try {
        const braveApiKey = selectRandomApiKey(runtimeConfig.braveApiKey);

        if (!braveApiKey) {
            console.warn('[Brave Search] Brave API 密钥未配置。Brave Search 将被跳过。');
            return {results: [], time: Date.now() - startTime, error: 'Brave API Key not configured'};
        }

        const baseUrl = type === SEARCH_TYPE.IMAGE ? `https://api.search.brave.com/res/v1/images/search` : `https://api.search.brave.com/res/v1/web/search`;

        const url = new URL(baseUrl);
        url.searchParams.append('q', q);

        const fetchOptions = {
            headers: {
                'X-Subscription-Token': braveApiKey,
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        };

        return await makeTimedExternalApiCall(url.toString(), fetchOptions, SEARCH_SOURCE.BRAVE, (data) => {
            if (type === SEARCH_TYPE.IMAGE && data && data.results) {
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
                        source: SEARCH_SOURCE.BRAVE,
                        originalItem: item
                    };
                });
            } else if (data && data.web && data.web.results) {
                return data.web.results.map((item, index) => ({
                    title: item.title,
                    snippet: item.description,
                    link: item.url,
                    originalRank: index + 1,
                    source: SEARCH_SOURCE.BRAVE,
                    originalItem: item,
                    contextLink: null,
                    thumbnailLink: null,
                }));
            }
            return [];
        });
    } catch (error) {
        console.error('[Brave Search] 初始化或构建请求失败:', error.message);
        return {results: [], time: Date.now() - startTime, error: error.message};
    }
}


// 主事件处理器
export default defineEventHandler(async (event) => {
    const handlerStartTime = Date.now();

    try {
        // 步骤 1：解析和校验查询参数
        const rawQuery = getQuery(event);
        const q = typeof rawQuery.q === 'string' ? rawQuery.q.trim() : undefined;
        let page = parseInt(rawQuery.page);
        let startIndex = rawQuery.startIndex ? parseInt(rawQuery.startIndex) : undefined;
        const sort = typeof rawQuery.sort === 'string' && Object.values(SEARCH_SORT).includes(rawQuery.sort)
            ? rawQuery.sort
            : SEARCH_SORT.RELEVANCE;
        const type = typeof rawQuery.type === 'string' && Object.values(SEARCH_TYPE).includes(rawQuery.type)
            ? rawQuery.type
            : SEARCH_TYPE.WEB;

        if (!q) {
            return {
                success: false,
                error: '搜索关键词不能为空',
                totalResponseTime: Date.now() - handlerStartTime,
                apiTimings: null
            };
        }

        if (isNaN(page) || page < 1) {
            page = 1; // 默认页码或强制为有效值
            console.warn(`[Handler] Invalid page number '${rawQuery.page}'. Defaulting to 1.`);
        }
        if (startIndex !== undefined && (isNaN(startIndex) || startIndex < 1)) {
            startIndex = undefined; // 忽略无效的 startIndex
            console.warn(`[Handler] Invalid startIndex '${rawQuery.startIndex}'. Ignoring.`);
        }

        const runtimeConfig = useRuntimeConfig();

        // 步骤 2：检查缓存
        const cacheKey = JSON.stringify({q, page, sort, type, startIndex});
        const cachedResult = searchCache.get(cacheKey);

        if (cachedResult) {
            console.log(`[Cache] 命中并返回缓存结果 for key: ${cacheKey}`);
            return {
                success: true,
                data: cachedResult,
                totalResponseTime: Date.now() - handlerStartTime,
                apiTimings: {[SEARCH_SOURCE.GOOGLE]: null, [SEARCH_SOURCE.BRAVE]: null} // 来自缓存，无实时 API 计时
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
                aiTaskId = `${SEARCH_SOURCE.GENERIC_AI}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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

        if (searchPromises.length === 0 && !shouldTriggerAI && aiTaskId === null) {
            // 如果没有配置任何搜索引擎，且未触发 AI 任务，则抛出错误
            throw new Error("所有搜索引擎均未配置，且 AI 未触发，无法执行搜索。");
        }

        // 等待所有搜索引擎 API 调用完成 (如果有的话)
        const searchApiResults = searchPromises.length > 0 ? await Promise.all(searchPromises) : [];

        // 步骤 5：处理并聚合结果
        const googleApiResult = searchApiResults.find(res => res.results[0]?.source === SEARCH_SOURCE.GOOGLE) || {
            results: [],
            time: 0,
            error: null
        };
        const braveApiResult = searchApiResults.find(res => res.results[0]?.source === SEARCH_SOURCE.BRAVE) || {
            results: [],
            time: 0,
            error: null
        };

        if (googleApiResult.error) console.warn(`[Google Search] 发现错误: ${googleApiResult.error}`);
        if (braveApiResult.error) console.warn(`[Brave Search] 发现错误: ${braveApiResult.error}`);

        console.log(`[Google Search] Time: ${googleApiResult.time}ms, Results: ${googleApiResult.results.length}`);
        console.log(`[Brave Search] Time: ${braveApiResult.time}ms, Results: ${braveApiResult.results.length}`);


        // === 步骤 5.5：AI 任务注册逻辑 (不变) ===
        if (shouldTriggerAI && aiTaskId) {
            // 确保 globalThis.__pendingAIReplies 存在
            globalThis.__pendingAIReplies = globalThis.__pendingAIReplies || new Map();

            const aiPrompt = `基于搜索关键词「${q}」，生成结构化 AI 概览：请紧扣关键词核心信息，用简洁语言分点（如要点 1、要点 2）呈现，不展开无关内容，快速聚焦核心，避免发散。语言需与关键词语言一致。`;

            // 提前在 Map 中标记为 pending 状态
            globalThis.__pendingAIReplies.set(aiTaskId, {
                taskId: aiTaskId,
                query: q,
                source: SEARCH_SOURCE.GENERIC_AI,
                status: 'pending',
                generatedAt: Date.now()
            });

            // 异步执行 Gemini 调用（不阻塞当前函数返回）
            (async () => {
                try {
                    console.log(`[AI Task ${aiTaskId}] 开始执行...`);
                    const validGeminiApiKey = selectRandomApiKey(geminiApiKey); // 确保使用有效的API密钥

                    if (!validGeminiApiKey) {
                        throw new Error("Gemini API 密钥不可用或配置无效。");
                    }
                    const geminiResult = await callGeminiChat(aiPrompt, validGeminiApiKey);
                    const aiContent = geminiResult?.choices?.[0]?.message?.content || 'AI 未生成有效回复';

                    globalThis.__pendingAIReplies.set(aiTaskId, {
                        taskId: aiTaskId,
                        query: q,
                        source: SEARCH_SOURCE.GENERIC_AI,
                        status: 'completed',
                        data: {
                            aiOverview: aiContent,
                        },
                        generatedAt: Date.now()
                    });
                    console.log(`[AI Task ${aiTaskId}] 完成`);
                } catch (aiError) {
                    console.error(`[AI Task ${aiTaskId}] 失败：`, aiError.message);
                    globalThis.__pendingAIReplies.set(aiTaskId, {
                        taskId: aiTaskId,
                        query: q,
                        source: SEARCH_SOURCE.GENERIC_AI,
                        status: 'failed',
                        error: aiError.message,
                        generatedAt: Date.now()
                    });
                }
            })().then();
        }
        // === 结束 AI 任务注册逻辑 ===

        // 步骤 6：结果去重和RRF排序
        const allResults = [...googleApiResult.results, ...braveApiResult.results];
        const uniqueResultsMap = new Map();

        allResults.forEach(result => {
            if (!result.link) {
                return; // 跳过没有链接的结果
            }

            // --- 修正: 规范化 URL 逻辑 ---
            let normalizedLink;
            try {
                // 1. 尝试解码 URL
                const urlObj = new URL(result.link);
                // 2. 清除查询参数和哈希
                urlObj.search = '';
                urlObj.hash = '';
                normalizedLink = decodeURIComponent(urlObj.href);

                // 3. 移除 www. 前缀
                normalizedLink = normalizedLink.replace(/^https?:\/\/(www\.)/, (match, p1) => match.replace(p1, ''));

                // 4. 确保尾部斜杠一致 (通常移除尾部斜杠)
                normalizedLink = normalizedLink.replace(/\/$/, '');

            } catch (e) {
                console.warn(`[De-duplication] Failed to normalize URL '${result.link}':`, e.message);
                normalizedLink = result.link;
            }
            // --- 规范化处理结束 ---

            const currentScoreContribution = 1 / (RRF_K + result.originalRank);

            if (uniqueResultsMap.has(normalizedLink)) {
                const existingResult = uniqueResultsMap.get(normalizedLink);
                existingResult.rrfScore = (existingResult.rrfScore || 0) + currentScoreContribution;
                // 可以选择在此处更新其他字段，如优先保留更长的 snippet 等
                if (result.snippet && existingResult.snippet.length < result.snippet.length) {
                    existingResult.snippet = result.snippet;
                }
                // 对于图片搜索，更新图片信息
                if (type === SEARCH_TYPE.IMAGE && result.thumbnailLink && !existingResult.thumbnailLink) {
                    existingResult.thumbnailLink = result.thumbnailLink;
                    existingResult.contextLink = result.contextLink;
                }
            } else {
                // 存储规范化后的链接，但保留原始链接在结果对象中
                uniqueResultsMap.set(normalizedLink, {...result, rrfScore: currentScoreContribution});
            }
        });

        const uniqueResults = Array.from(uniqueResultsMap.values()).sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0));

        // 步骤 7：构建聚合响应 (已修正)
        const validApiTimes = [googleApiResult.time, braveApiResult.time].filter(t => t > 0);
        const averageSearchTime = validApiTimes.length > 0 ? validApiTimes.reduce((a, b) => a + b, 0) / validApiTimes.length : 0;

        // 修正: 尝试从 Google 原始数据中提取总结果数
        const googleRawData = googleApiResult?.originalRawData;
        const trueTotalResults = googleRawData?.searchInformation?.totalResults || uniqueResults.length.toString();
        const formattedTrueTotalResults = googleRawData?.searchInformation?.formattedTotalResults || `${uniqueResults.length} results`;

        const aggregatedResponse = {
            searchInformation: {
                searchTime: averageSearchTime,
                formattedSearchTime: `${(averageSearchTime / 1000).toFixed(2)} seconds`,
                // 使用 Google 提供的原始总结果数
                totalResults: trueTotalResults,
                formattedTotalResults: formattedTrueTotalResults
            },
            items: uniqueResults.map(item => {
                const clientItem = {
                    title: item.title,
                    link: item.link, // 返回原始链接
                    displayLink: item.link?.replace(/^(https?:\/\/(www\.)?)/, '').split('/')[0] || '',
                    snippet: item.snippet,
                    source: item.source,
                };
                if (type === SEARCH_TYPE.IMAGE && item.contextLink && item.thumbnailLink) {
                    clientItem.image = {
                        contextLink: item.contextLink,
                        thumbnailLink: item.thumbnailLink,
                    };
                }
                return clientItem;
            }),
            aiTask: {
                hasAI: shouldTriggerAI && !!aiTaskId,
                taskId: aiTaskId,
                source: SEARCH_SOURCE.GENERIC_AI
            }
        };

        // 步骤 8：存入缓存
        searchCache.set(cacheKey, aggregatedResponse);

        return {
            success: true,
            data: aggregatedResponse,
            totalResponseTime: Date.now() - handlerStartTime,
            apiTimings: {
                [SEARCH_SOURCE.GOOGLE]: googleApiResult.time || null,
                [SEARCH_SOURCE.BRAVE]: braveApiResult.time || null,
            },
        };

    } catch (error) {
        console.error('[Handler] 搜索代理错误:', error);
        let statusMessage = error.message || '服务端处理搜索请求失败';
        if (error instanceof DOMException && error.name === 'AbortError') {
            statusMessage = '请求超时，请稍后再试';
        } else if (error.message?.includes('status 429')) {
            statusMessage = 'API调用频率过高，请稍后再试';
        }

        return {
            success: false,
            error: statusMessage,
            totalResponseTime: Date.now() - handlerStartTime,
            apiTimings: null,
        };
    }
});
