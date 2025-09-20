<template>
  <div class="min-h-screen" :class="{'dark-mode': isDarkMode && isMounted}">
    <div class="flex flex-col items-center justify-center min-h-screen px-4">
      <div class="mb-8">
        <h1 class="text-8xl font-light text-gray-800 tracking-wide dark:text-white">xSearch</h1>
      </div>
      <div class="relative w-full max-w-xl">
        <input
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            @input="handleInput" @blur="showSuggestions = false" type="text"
            placeholder="搜索..."
            class="w-full p-4 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
        <button
            @click="handleSearch"
            class="absolute right-2 top-2 bottom-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          搜索
        </button>
        <ul
            v-if="showSuggestions && suggestions.length > 0"
            class="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 dark:bg-gray-800 dark:border-gray-600"
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

      <!-- 错误提示 -->
      <div v-if="searchError" class="mt-4 text-red-500">
        {{ searchError }}
      </div>

    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUpdated } from 'vue';
import { useNuxtApp, navigateTo } from 'nuxt/app';

const isDarkMode = ref(false);
const isMounted = ref(false);
const searchQuery = ref('');
const searchError = ref('');
const nuxtApp = useNuxtApp();
const showSuggestions = ref(false);
const suggestions = ref([]);

// 检查服务是否可用
const googleSearchAvailable = ref(!!nuxtApp.$googleSearch);

// 处理搜索提交
const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchError.value = '请输入搜索关键词';
    return;
  }

  searchError.value = '';

  try {
    // 再次检查服务
    if (!nuxtApp.$googleSearch) {
      throw new Error('搜索服务未加载，请尝试刷新页面');
    }

    // 调用搜索方法
    const results = await nuxtApp.$googleSearch.fetchResults(searchQuery.value);

    // 导航到结果页
    navigateTo({
      path: '/search',
      query: { q: searchQuery.value }
    });
  } catch (error) {
    console.error('搜索出错:', error);
    searchError.value = error.message || '搜索过程中发生错误';
  }
};

const handleInput = async () => {
  // 只有当搜索词不为空时才请求建议
  if (searchQuery.value.trim().length > 0) {
    try {
      const data = await nuxtApp.$googleSearch.fetchSuggestions(searchQuery.value);
      // 假设返回的数据格式为 { success: true, data: [...] }
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

// 组件更新时再次检查服务
onUpdated(() => {
  googleSearchAvailable.value = !!nuxtApp.$googleSearch;
});

onMounted(() => {
  isMounted.value = true;
  // 检查深色模式
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    isDarkMode.value = true;
  }

  // 延迟检查，确保插件有时间加载
  setTimeout(() => {
    googleSearchAvailable.value = !!nuxtApp.$googleSearch;
  }, 100);
});
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
