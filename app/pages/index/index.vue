<template>
  <div class="min-h-screen" :class="{'dark-mode': isDarkMode}">
    <div class="flex flex-col items-center justify-center min-h-screen px-4">
      <div class="mb-8">
        <h1 class="text-8xl font-light text-gray-800 tracking-wide dark:text-white">xSearch</h1>
      </div>
      <div class="relative w-full max-w-xl">
        <input
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            type="text"
            placeholder="搜索..."
            class="w-full p-4 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
        <button
            @click="handleSearch"
            class="absolute right-2 top-2 bottom-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          搜索
        </button>
      </div>

      <!-- 错误提示 -->
      <div v-if="searchError" class="mt-4 text-red-500">
        {{ searchError }}
      </div>

      <!-- 调试信息 -->
      <div v-if="showDebug" class="mt-4 text-sm text-gray-500">
        <p>插件状态: {{ googleSearchAvailable ? '已加载' : '未加载' }}</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUpdated } from 'vue';
import { useNuxtApp, navigateTo } from 'nuxt/app';

const isDarkMode = ref(false);
const searchQuery = ref('');
const searchError = ref('');
const showDebug = ref(true); // 显示调试信息
const nuxtApp = useNuxtApp();

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

// 组件更新时再次检查服务
onUpdated(() => {
  googleSearchAvailable.value = !!nuxtApp.$googleSearch;
});

onMounted(() => {
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
