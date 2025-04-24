<template>
  <div class="history">
    <h2>История операций</h2>
    <ul v-if="transactions.length">
      <li v-for="tx in transactions" :key="tx.id" class="tx-item">
        <TransactionItem :tx="tx" />
      </li>
    </ul>
    <p v-else>Нет операций</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TransactionItem from '../components/TransactionItem.vue'

const transactions = ref([])

onMounted(async () => {
  try {
    const res = await fetch('https://apiforbeta.gugapay.ru/transactions', { credentials: 'include' })
    const data = await res.json()
    transactions.value = data
  } catch (error) {
    console.error('Ошибка загрузки истории:', error)
  }
})
</script>

<style scoped>
.history {
  padding: 20px;
}
.tx-item {
  margin-bottom: 10px;
}
</style>
