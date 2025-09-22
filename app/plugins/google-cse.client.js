import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin((nuxtApp) => {
    // 定义搜索函数，支持多种参数
    async function fetchSearchResults(
        query,
        startIndex='1',
        searchType
    ) {
        try {
            const url = new URL('/api/search', window.location.origin);
            url.searchParams.append('q', query);
            url.searchParams.append('startIndex', startIndex.toString());
            url.searchParams.append('type', searchType);

            const response = await fetch(url.toString());

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.message || `搜索失败: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('搜索错误:', error);
            throw error;
        }
    }

    // 定义搜索建议函数
    async function fetchSuggestions(query) {
        try {
            const url = new URL('/api/suggest', window.location.origin);
            url.searchParams.append('q', query);

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error('获取搜索建议失败');
            }
            return await response.json();
        } catch (error) {
            console.error('搜索建议错误:', error);
            return [];
        }
    }

    // 注册服务
    nuxtApp.provide('googleSearch', {
        fetchResults: fetchSearchResults,
        fetchSuggestions: fetchSuggestions
    });

    console.log('Google search plugin registered:', !!nuxtApp.$googleSearch);
});
