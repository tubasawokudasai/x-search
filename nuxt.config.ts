// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  plugins: [
    { src: '~/plugins/google-cse.client.js' }
  ],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  // 移除了客户端的 script 配置
  runtimeConfig: {
    // 在服务器端使用的环境变量
    googleApiKey: '',
    searchEngineId: '',
    braveApiKey: '',
    public: {
      // 客户端需要的环境变量

    }
  }
});
