<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">

import {useSeoMeta} from "#imports";

useSeoMeta( {
  title: "xSearch",
  description: "xSearch is a search engine for the internet",
})
</script>

<style scoped>
:root {
  --bg-color: white;
  --text-color: black;
  --border-color: gray;
  --input-bg-color: white;
  --input-text-color: black;
  --placeholder-color: gray;
}
[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: white;
  --border-color: #333;
  --input-bg-color: #333;
  --input-text-color: white;
  --placeholder-color: #999;
}
</style>

