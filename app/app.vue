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

