<template>
  <div class="balance-card">
    <p>Ваш баланс:</p>
    <h3>{{ balance }} ₽</h3>
  </div>
</template>

<script setup>
defineProps(['balance'])
</script>

<style scoped>
.balance-card {
  background: #f6f6f6;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
}
</style>
