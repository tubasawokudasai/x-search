<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <div class="flex flex-col items-center justify-center h-[80vh] px-4">
      <div class="mb-8">
        <h1 class="text-6xl sm:text-7xl md:text-8xl font-light text-gray-800 tracking-wide dark:text-white">xSearch</h1>
      </div>
      <div class="relative w-full max-w-xl">
        <span class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </span>
        <input
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            @input="handleInput" @blur="showSuggestions = false" type="text"
            placeholder="搜索..."
            class="w-full p-4 pl-12 border rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >

        <ul
            v-if="showSuggestions && suggestions.length > 0"
            class="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 dark:bg-gray-950 dark:border-gray-600"
        >
          <li
              v-for="(suggestion, index) in suggestions"
              :key="index"
              @mousedown.prevent="selectSuggestion(suggestion)"
              class="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {{ suggestion }}
          </li>
        </ul>
      </div>

      <div v-if="searchError" class="mt-4 text-red-500">
        {{ searchError }}
      </div>
    </div>

  </div>
</template>

<script setup>
import {ref, onMounted} from 'vue';
import {useNuxtApp, navigateTo} from 'nuxt/app';

const searchQuery = ref('');
const searchError = ref('');
const nuxtApp = useNuxtApp();
const showSuggestions = ref(false);
const suggestions = ref([]);

// 处理搜索提交
const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchError.value = '请输入搜索关键词';
    return;
  }

  searchError.value = '';

  // 导航到结果页
  navigateTo({
    path: '/search',
    query: {q: searchQuery.value}
  });

};

const handleInput = async () => {
  // 只有当搜索词不为空时才请求建议
  if (searchQuery.value.trim().length > 0) {
    try {
      const data = await nuxtApp.$googleSearch.fetchSuggestions(searchQuery.value);
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

// 新增：点击建议项时填充输入框并搜索
const selectSuggestion = (suggestion) => {
  searchQuery.value = suggestion;
  showSuggestions.value = false;
  handleSearch();
};

</script>

<style scoped>
.dark-mode {
  background-color: #1a1a1a;
  color: white;
}

.dark-mode input {
  background-color: #333;
  color: white;
  border-color: #555;
}
</style>
