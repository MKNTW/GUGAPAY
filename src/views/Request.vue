<template>
  <div class="request">
    <h2>Запросить средства</h2>
    <form @submit.prevent="submitRequest">
      <label>От кого (ID):</label>
      <input v-model="fromUserId" required />
      
      <label>Сумма:</label>
      <input v-model.number="amount" type="number" required />

      <label>Валюта:</label>
      <select v-model="currency">
        <option value="RUB">RUB</option>
        <option value="USDT">USDT</option>
      </select>

      <button type="submit">Запросить</button>
    </form>
    <p v-if="result">{{ result.message }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { requestFunds } from '../api/transfers'

const fromUserId = ref('')
const amount = ref(0)
const currency = ref('RUB')
const result = ref(null)

async function submitRequest() {
  result.value = await requestFunds(fromUserId.value, amount.value, currency.value)
}
</script>

<style scoped>
.request {
  padding: 20px;
}
form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
