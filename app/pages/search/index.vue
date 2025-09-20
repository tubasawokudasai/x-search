<template>
  <div class="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" :class="{'dark': isDarkMode}">
    <!-- Header with Search Bar -->
    <div
        class="border-b border-gray-200 dark:border-gray-700 px-6 py-4 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
      <div class="flex items-center max-w-7xl mx-auto">
        <div class="mr-8">
          <h1 class="text-2xl font-light text-gray-800 dark:text-white tracking-wide cursor-pointer" @click="goHome">
            xSearch
          </h1>
        </div>
        <div class="relative flex-1 max-w-2xl">
          <div class="relative">
            <input
                v-model="searchQuery"
                type="text"
                class="w-full h-12 pl-12 pr-4 text-base border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:shadow-md"
                @keyup.enter="performSearch(1)"
                placeholder="Search with xSearch"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="max-w-4xl mx-auto px-6 py-8">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-10">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p>Loading...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error"
           class="text-center text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-300 p-4 rounded-lg">
        <p>Failed to get search results: {{ error }}</p>
        <button @click="performSearch(currentPage)"
                class="mt-2 text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
          Retry
        </button>
      </div>

      <!-- Results Area -->
      <div v-else-if="searchQuery && rawResults">
        <!-- Search Info & Sorting -->
        <div class="flex justify-between items-center mb-4">
          <div v-if="rawResults.data.searchInformation" class="text-sm text-gray-600 dark:text-gray-400">
            About {{ rawResults.data.searchInformation.formattedTotalResults }} results
            ({{ rawResults.data.searchInformation.formattedSearchTime }} seconds)
          </div>
          <!-- Sorting feature can be added here if needed -->
        </div>

        <!-- Spelling Suggestion -->
        <div v-if="spellingSuggestion"
             class="text-sm text-gray-700 dark:text-gray-300 mb-4 p-3 bg-blue-50 dark:bg-gray-800 rounded-lg">
          <p>Did you mean: <a
              @click.prevent="searchWithSuggestion(spellingSuggestion)"
              class="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-semibold"
          >{{ spellingSuggestion }}</a></p>
        </div>

        <!-- Search Type Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
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
        </div>

        <!-- Web Results -->
        <div v-if="searchType === 'web' && searchResults.length > 0" class="space-y-8">
          <div v-for="(result, index) in searchResults" :key="index" class="group">
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
          </div>
        </div>

        <!-- Image Results -->
        <div v-else-if="searchType === 'image' && searchResults.length > 0"
             class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <div v-for="(result, index) in searchResults" :key="index"
               class="group relative aspect-square overflow-hidden rounded-lg">
            <a :href="result.image.contextLink" target="_blank" rel="noopener noreferrer">
              <img :src="result.link" :alt="result.title"
                   class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"/>
              <div
                  class="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div
                  class="absolute bottom-0 left-0 p-2 w-full text-white text-xs bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p class="truncate" v-html="highlightText(result.title, searchQuery)"></p>
                <p class="truncate font-semibold">{{ result.displayLink }}</p>
              </div>
            </a>
          </div>
        </div>

        <!-- No Results Found -->
        <div v-else class="text-center text-gray-500 dark:text-gray-400 pt-10">
          <p>No results found for "<strong>{{ searchQuery }}</strong>".</p>
          <ul class="mt-2 text-sm list-disc list-inside">
            <li>Check for spelling errors.</li>
            <li>Try different keywords.</li>
            <li>Use more general terms.</li>
          </ul>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1 && searchResults.length > 0" class="flex justify-center mt-12">
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

      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {ref, onMounted, computed, watch} from 'vue';
import {useRoute, useRouter, useNuxtApp} from '#app';

// --- TYPE DEFINITIONS (from original script) ---
interface Root {
  success: boolean
  data: Data
}

interface Data {
  searchInformation: SearchInformation
  items: Item[]
  spelling?: {
    correctedQuery: string;
  }
}

interface SearchInformation {
  searchTime: number
  formattedSearchTime: string
  totalResults: string
  formattedTotalResults: string
}

interface Item {
  title: string
  link: string
  displayLink: string
  snippet: string
  image: {
    contextLink: string;
    thumbnailLink: string;
  };
}

// --- END TYPE DEFINITIONS ---

const route = useRoute();
const router = useRouter();
const {$googleSearch} = useNuxtApp();

// --- STATE MANAGEMENT ---
const isDarkMode = ref(false);
const searchQuery = ref(route.query.q as string || '');
const searchType = ref<'web' | 'image'>(route.query.type as 'web' | 'image' || 'web');
const currentPage = ref(parseInt(route.query.page as string) || 1);
const isLoading = ref(false);
const error = ref<string | null>(null);

const rawResults = ref<Root | null>(null);
const searchResults = computed(() => rawResults.value?.data?.items || []);
const spellingSuggestion = computed(() => rawResults.value?.data?.spelling?.correctedQuery || null);

// --- SEARCH & DATA FETCHING ---
const performSearch = async (page: number = 1) => {
  if (!searchQuery.value) return;

  isLoading.value = true;
  error.value = null;
  currentPage.value = page;

  // Update URL query parameters
  router.push({query: {q: searchQuery.value, type: searchType.value, page: currentPage.value.toString()}});

  const startIndex = (page - 1) * 10 + 1;

  try {
    rawResults.value = await $googleSearch.fetchResults(searchQuery.value, startIndex, searchType.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
    rawResults.value = null; // Clear old results on error
  } finally {
    isLoading.value = false;
    window.scrollTo(0, 0); // Scroll to top after loading
  }
};

const searchWithSuggestion = (suggestion: string) => {
  searchQuery.value = suggestion;
  performSearch(1);
}

const changeSearchType = (type: 'web' | 'image') => {
  if (searchType.value !== type) {
    searchType.value = type;
    performSearch(1);
  }
};

// --- PAGINATION ---
const totalPages = computed(() => {
  if (!rawResults.value?.data?.searchInformation?.totalResults) return 0;
  // Google Custom Search API is limited to 100 results (10 pages)
  const total = parseInt(rawResults.value.data.searchInformation.totalResults.replace(/,/g, ''), 10);
  return Math.min(Math.ceil(total / 10), 10);
});

const paginationPages = computed(() => {
  // A more advanced pagination logic could be implemented here to show "..."
  // For simplicity, showing all pages up to 10.
  const pages = [];
  for (let i = 1; i <= totalPages.value; i++) {
    pages.push(i);
  }
  return pages;
});

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    performSearch(page);
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
  // Initial search if query exists in URL
  if (searchQuery.value) {
    performSearch(currentPage.value);
  } else {
    router.push('/');
  }

  // Dark mode detection
  if (typeof window !== 'undefined' && window.matchMedia) {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    isDarkMode.value = darkModeMediaQuery.matches;
    darkModeMediaQuery.addEventListener('change', (e) => {
      isDarkMode.value = e.matches;
    });
  }
});

// Watch for browser back/forward button navigation
watch(() => route.query, (newQuery) => {
  const newSearchQuery = newQuery.q as string || '';
  const newPage = parseInt(newQuery.page as string) || 1;
  const newType = (newQuery.type as 'web' | 'image') || 'web';

  if (newSearchQuery !== searchQuery.value || newPage !== currentPage.value || newType !== searchType.value) {
    searchQuery.value = newSearchQuery;
    currentPage.value = newPage;
    searchType.value = newType;
    performSearch(newPage);
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
