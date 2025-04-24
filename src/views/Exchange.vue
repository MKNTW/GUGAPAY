<template>
  <div class="exchange">
    <h2>Обмен валют</h2>
    <form @submit.prevent="submitExchange">
      <label>Из валюты:</label>
      <select v-model="fromCurrency">
        <option value="RUB">RUB</option>
        <option value="USDT">USDT</option>
      </select>

      <label>В валюту:</label>
      <select v-model="toCurrency">
        <option value="RUB">RUB</option>
        <option value="USDT">USDT</option>
      </select>

      <label>Сумма:</label>
      <input v-model.number="amount" type="number" required />

      <button type="submit">Обменять</button>
    </form>

    <p v-if="result">{{ result.message }}</p>
    <div v-if="rates.length">
      <h4>Актуальные курсы:</h4>
      <ul>
        <li v-for="r in rates" :key="r.pair">{{ r.pair }} = {{ r.rate }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getExchangeRates, exchangeCurrency } from '../api/exchange'

const fromCurrency = ref('RUB')
const toCurrency = ref('USDT')
const amount = ref(0)
const result = ref(null)
const rates = ref([])

onMounted(async () => {
  rates.value = await getExchangeRates()
})

async function submitExchange() {
  result.value = await exchangeCurrency(fromCurrency.value, toCurrency.value, amount.value)
}
</script>

<style scoped>
.exchange {
  padding: 20px;
}
form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
