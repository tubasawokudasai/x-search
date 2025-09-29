<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <div
        class="border-b border-gray-200 dark:border-gray-800 px-6 py-4 sticky top-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm z-10">
      <div class="flex flex-col sm:flex-row items-center max-w-7xl mx-auto">
        <div class="mb-4 sm:mb-0 sm:mr-8 text-center sm:text-left">
          <h1 class="text-xl sm:text-2xl font-light text-gray-800 dark:text-white tracking-wide cursor-pointer"
              @click="goHome">
            xSearch
          </h1>
        </div>
        <div class="relative w-full sm:flex-1 max-w-2xl">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none"
                   viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input
                v-model="searchQuery"
                type="text"
                class="w-full h-12 pl-12 pr-4 text-base border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:shadow-md"
                @keyup.enter="performSearch(1, true)"
                @input="handleInput"
                @blur="showSuggestions = false"
                placeholder="Search with xSearch"
            />
            <div v-if="showSuggestions && suggestions.length > 0"
                 class="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
              <ul>
                <li v-for="(suggestion, index) in suggestions" :key="index"
                    @mousedown.prevent="selectSuggestion(suggestion)"
                    class="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg"
                       class="h-4 w-4 text-gray-400 dark:text-gray-500 mr-3 flex-shrink-0" fill="none"
                       viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <span class="truncate">{{ suggestion }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-4xl mx-auto px-6 py-8">
      <div v-if="isLoading" class="text-center py-10">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p>Loading...</p>
      </div>

      <div v-else-if="error"
           class="text-center text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-300 p-4 rounded-lg">
        <p>Failed to get search results: {{ error }}</p>
        <button @click="performSearch(currentPage, false)"
                class="mt-2 text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
          Retry
        </button>
      </div>

      <div v-else-if="searchQuery && rawResults">
        <!-- 修改后的部分开始 -->
        <div class="flex justify-between items-center mb-4">
          <div v-if="rawResults.data.searchInformation" class="relative group">
            <div class="text-sm text-gray-600 dark:text-gray-400 cursor-help">
              About {{ rawResults.data.searchInformation.formattedTotalResults }}
              (<span class="hover:underline">{{ rawResults.totalResponseTime / 1000 }} seconds</span>)
            </div>
            <!-- Tooltip 浮窗 -->
            <div v-if="rawResults.apiTimings"
                 class="absolute left-0 mt-2 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-30">
              <p v-for="(time, apiName) in rawResults.apiTimings" :key="apiName">
                {{ (apiName as string).charAt(0).toUpperCase() + (apiName as string).slice(1) }}: {{ time / 1000 }}s
              </p>
            </div>
          </div>
        </div>
        <!-- 修改后的部分结束 -->

        <div v-if="spellingSuggestion"
             class="text-sm text-gray-700 dark:text-gray-300 mb-4 p-3 bg-blue-50 dark:bg-gray-950 rounded-lg">
          <p>Did you mean: <a
              @click.prevent="searchWithSuggestion(spellingSuggestion)"
              class="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-semibold"
          >{{ spellingSuggestion }}</a></p>
        </div>

        <div class="border-b border-gray-200 dark:border-gray-800 mb-6">
          <div class="flex justify-between items-center">
            <nav class="-mb-px flex space-x-6" aria-label="Tabs">
              <button @click="changeSearchType('web')"
                      :class="[searchType === 'web' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600', 'whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors']">
                Web
              </button>
              <button @click="changeSearchType('image')"
                      :class="[searchType === 'image' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600', 'whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors']">
                Images
              </button>
            </nav>
            <div v-if="searchType === 'web' && searchResults.length > 0" class="relative">
              <select
                  :value="sortOrder"
                  @change="changeSort(($event.target as HTMLSelectElement).value)"
                  class="appearance-none bg-white dark:bg-gray-800 border-none text-gray-600 dark:text-gray-400 py-1 pl-3 pr-8 rounded-md leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                  {{ option.text }}
                </option>
              </select>
              <div
                  class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div v-if="searchType === 'web' && sortedResults.length > 0" class="space-y-8">
          <div v-for="(result, index) in sortedResults" :key="index" class="group relative pb-6">
            <a :href="result.link" target="_blank" rel="noopener noreferrer">
              <h3 class="text-xl text-blue-600 dark:text-blue-400 group-hover:underline truncate"
                  v-html="highlightText(result.title, searchQuery)"></h3>
            </a>
            <div class="flex items-center text-sm text-green-700 dark:text-green-500 mt-1 truncate">
              <img
                  :src="`/api/proxy-image?url=${encodeURIComponent(`https://www.google.com/s2/favicons?sz=16&domain_url=${result.link}`)}`"
                  class="w-4 h-4 mr-2 flex-shrink-0" alt="Favicon"/>
              <a :href="result.link" target="_blank" rel="noopener noreferrer" class="hover:underline">
                {{ formatUrl(result.displayLink) }}
              </a>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2 line-clamp-2"
               v-html="highlightText(result.snippet, searchQuery)"></p>

            <div v-if="result.source"
                 class="absolute bottom-1 right-0 text-xs text-gray-500 dark:text-gray-400 font-normal">
              {{ result.source }}
            </div>
          </div>
        </div>

        <div v-else-if="searchType === 'image' && searchResults.length > 0"
             class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <div v-for="(result, index) in searchResults" :key="index"
               class="group relative aspect-square overflow-hidden rounded-lg">
            <a :href="result.image.contextLink" target="_blank" rel="noopener noreferrer">
              <img :src="result.link" :alt="result.title"
                   class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"/>
              <div
                  class="absolute inset-0 bg-gray-900 bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div
                  class="absolute bottom-0 left-0 p-2 w-full text-white text-xs bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p class="truncate" v-html="highlightText(result.title, searchQuery)"></p>
                <p class="truncate font-semibold">{{ result.displayLink }}</p>
              </div>
            </a>
          </div>
        </div>

        <div v-else class="text-center text-gray-500 dark:text-gray-400 pt-10">
          <p>No results found for "<strong>{{ searchQuery }}</strong>".</p>
          <ul class="mt-2 text-sm list-disc list-inside">
            <li>Check for spelling errors.</li>
            <li>Try different keywords.</li>
            <li>Use more general terms.</li>
          </ul>
        </div>

        <div v-if="totalPages > 1 && searchResults.length > 0" class="flex justify-center mt-12 hidden sm:flex">
          <nav class="flex items-center space-x-2">
            <button @click="goToPage(currentPage - 1)" :disabled="currentPage === 1"
                    class="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>
            <button v-for="page in paginationPages" :key="page" @click="goToPage(page)"
                    :class="page === currentPage ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
                    class="w-10 h-10 rounded-md transition-colors">
              {{ page }}
            </button>
            <button @click="goToPage(currentPage + 1)" :disabled="currentPage === totalPages"
                    class="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Next
            </button>
          </nav>
        </div>

        <div v-if="totalPages > currentPage && searchResults.length > 0" class="flex sm:hidden justify-center mt-8">
          <button @click="loadMore"
                  :disabled="isLoadingMore"
                  class="flex items-center px-4 py-2 border rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  :class="{
                    'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white': !isLoadingMore,
                    'border-gray-400 text-gray-400': isLoadingMore
                  }">
            <span v-if="!isLoadingMore">More Results</span>
            <span v-else>Loading...</span>
            <div v-if="isLoadingMore"
                 class="ml-2 inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
            <svg v-else class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                 xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import {ref, onMounted, computed, watch} from 'vue';
import {useRoute, useRouter, useNuxtApp} from '#app';

// --- TYPE DEFINITIONS ---
interface Root {
  success: boolean,
  totalResponseTime: number,
  data: Data,
  apiTimings?: {
    [key: string]: number; // 动态键名，存储不同API的耗时
  };
  error?: string;
}

interface Data {
  searchInformation: SearchInformation,
  items: Item[],
  spelling?: {
    correctedQuery: string;
  }
}

interface SearchInformation {
  searchTime: number,
  formattedSearchTime: string,
  totalResults: string,
  formattedTotalResults: string
}

interface Item {
  title: string,
  link: string,
  displayLink: string,
  snippet: string,
  image: {
    contextLink: string;
    thumbnailLink: string;
  };
  source?: string;
}

// --- END TYPE DEFINITIONS ---

const route = useRoute();
const router = useRouter();
const {$googleSearch} = useNuxtApp();

// --- STATE MANAGEMENT ---
const searchQuery = ref(route.query.q as string || '');
const searchType = ref<'web' | 'image'>(route.query.type as 'web' | 'image' || 'web');
const currentPage = ref(parseInt(route.query.page as string) || 1);
const isLoading = ref(false);
const error = ref<string | null>(null);

const rawResults = ref<Root | null>(null);
const searchResults = ref<Item[]>([]);
const spellingSuggestion = computed(() => rawResults.value?.data?.spelling?.correctedQuery || null);

const suggestions = ref<string[]>([]);
const showSuggestions = ref(false);

const sortOrder = ref<'relevance' | 'date'>('relevance');
const sortOptions = [
  {text: 'Relevance', value: 'relevance'},
  {text: 'Date', value: 'date'},
];

const isLoadingMore = ref(false);

// --- SEARCH & DATA FETCHING ---
const performSearch = async (page: number = 1, isNewSearch: boolean = false) => {
  if (!searchQuery.value) return;

  if (isNewSearch) {
    isLoading.value = true;
    error.value = null;
  }

  currentPage.value = page;

  showSuggestions.value = false;

  if (isNewSearch) {
    router.push({query: {q: searchQuery.value, type: searchType.value, page: currentPage.value.toString()}});
  }

  const startIndex = (page - 1) * 10 + 1;

  try {
    // 假设 $googleSearch.fetchResults 已经可以正确返回包含 apiTimings 的 Root 接口数据
    const results: Root = await $googleSearch.fetchResults(searchQuery.value, startIndex, searchType.value);
    if (results.success) {
      if (isNewSearch) {
        searchResults.value = results.data.items;
      } else {
        searchResults.value = [...searchResults.value, ...results.data.items];
      }
      rawResults.value = results; // 这里会正确存储 apiTimings
      if (isNewSearch) {
        sortOrder.value = 'relevance';
      }
    } else {
      error.value = results.error as string; // 修正类型断言
    }
    document.title = `${searchQuery.value} - xSearch`;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
    rawResults.value = null;
    searchResults.value = [];
  } finally {
    isLoading.value = false;
    isLoadingMore.value = false;
    if (isNewSearch) {
      window.scrollTo(0, 0);
    }
  }
};

const handleInput = async () => {
  if (searchQuery.value.trim().length > 0) {
    try {
      // 假设 fetchSuggestions 返回 { success: boolean, data: string[] }
      const data: { success: boolean, data: string[] } = await $googleSearch.fetchSuggestions(searchQuery.value);
      if (data.success) {
        suggestions.value = data.data;
        showSuggestions.value = true;
      } else {
        suggestions.value = [];
        showSuggestions.value = false;
      }
    } catch (error) {
      console.error('获取建议失败:', error);
      suggestions.value = [];
      showSuggestions.value = false;
    }
  } else {
    suggestions.value = [];
    showSuggestions.value = false;
  }
};

const selectSuggestion = (suggestion: string) => {
  searchQuery.value = suggestion;
  performSearch(1, true);
};

const searchWithSuggestion = (suggestion: string) => {
  searchQuery.value = suggestion;
  performSearch(1, true);
}

const changeSearchType = (type: 'web' | 'image') => {
  if (searchType.value !== type) {
    searchType.value = type;
    performSearch(1, true);
  }
};

const loadMore = () => {
  if (currentPage.value < totalPages.value && !isLoadingMore.value) {
    isLoadingMore.value = true;
    performSearch(currentPage.value + 1, false);
  }
};

// --- SORTING LOGIC ---
const changeSort = (newSortOrder: string) => {
  if (newSortOrder === 'relevance' || newSortOrder === 'date') {
    sortOrder.value = newSortOrder;
  }
};

const sortedResults = computed(() => {
  if (sortOrder.value === 'date') {
    return [...searchResults.value].sort((a, b) => {
      // 这里的排序逻辑是基于 title 长度，如果需要按实际日期排序，需要确保 Item 接口有 date 字段，并且 API 返回了可解析的日期。
      // 目前保持与您代码一致，但请注意这可能不是真正的日期排序。
      const dateA = a.title.length;
      const dateB = b.title.length;
      return dateB - dateA;
    });
  }
  return searchResults.value;
});

// --- PAGINATION ---
const totalPages = computed(() => {
  if (!rawResults.value?.data?.searchInformation?.totalResults) return 0;
  const total = parseInt(rawResults.value.data.searchInformation.totalResults.replace(/,/g, ''), 10);
  return Math.min(Math.ceil(total / 10), 10);
});

const paginationPages = computed(() => {
  const pages = [];
  for (let i = 1; i <= totalPages.value; i++) {
    pages.push(i);
  }
  return pages;
});

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    performSearch(page, true);
  }
};

// --- HELPERS ---
const goHome = () => router.push('/');

const formatUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

const highlightText = (text: string, query: string) => {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.split(' ').join('|')})`, 'gi');
  return text.replace(regex, '<strong class="font-semibold bg-yellow-100 dark:bg-yellow-700/50 rounded-sm px-0.5">$1</strong>');
};

// --- LIFECYCLE & WATCHERS ---
onMounted(() => {
  if (searchQuery.value) {
    performSearch(currentPage.value, false);
  } else {
    router.push('/');
  }
});

watch(() => route.query, (newQuery) => {
  const newSearchQuery = newQuery.q as string || '';
  const newPage = parseInt(newQuery.page as string) || 1;
  const newType = (newQuery.type as 'web' | 'image') || 'web';

  if (newSearchQuery !== searchQuery.value || newPage !== currentPage.value || newType !== searchType.value) {
    searchQuery.value = newSearchQuery;
    currentPage.value = newPage;
    searchType.value = newType;
    performSearch(newPage, true);
  }
});
</script>

<style>
/* For line-clamp fallback if not supported or for more complex cases */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
</style>
