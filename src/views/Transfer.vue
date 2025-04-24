<template>
  <div class="transfer">
    <h2>Перевести</h2>
    <form @submit.prevent="submitTransfer">
      <label>Получатель (ID):</label>
      <input v-model="recipientId" required />
      
      <label>Сумма:</label>
      <input v-model.number="amount" type="number" required />

      <label>Валюта:</label>
      <select v-model="currency">
        <option value="RUB">RUB</option>
        <option value="USDT">USDT</option>
      </select>

      <button type="submit">Отправить</button>
    </form>
    <p v-if="result">{{ result.message }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { sendTransfer } from '../api/transfers'

const recipientId = ref('')
const amount = ref(0)
const currency = ref('RUB')
const result = ref(null)

async function submitTransfer() {
  result.value = await sendTransfer(recipientId.value, amount.value, currency.value)
}
</script>

<style scoped>
.transfer {
  padding: 20px;
}
form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
