<template>
  <router-link :to="to" class="action-button">
    {{ label }}
  </router-link>
</template>

<script setup>
defineProps(['label', 'to'])
</script>

<style scoped>
.action-button {
  padding: 10px 20px;
  background: #0077ff;
  color: white;
  border-radius: 8px;
  text-align: center;
  text-decoration: none;
  font-weight: bold;
}
</style>
