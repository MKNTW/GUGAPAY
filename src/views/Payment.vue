<template>
  <div class="payment">
    <h2>Оплата</h2>
    <div v-if="!payment">
      <p>Загрузка данных...</p>
    </div>
    <div v-else>
      <p><strong>Адрес:</strong> {{ payment.usdt_address }}</p>
      <p><strong>Сумма:</strong> {{ payment.usdt_amount }} USDT</p>
      <img :src="payment.qr_code" alt="QR Code" width="220" />

      <p><strong>Статус:</strong> {{ status }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { startPayment, getPaymentStatus } from '../api/payment'

const route = useRoute()
const payment = ref(null)
const status = ref('Ожидание оплаты...')

async function checkStatus(id) {
  const result = await getPaymentStatus(id)
  if (result?.status) {
    status.value = result.status
    if (result.status !== 'pending') clearInterval(interval)
  }
}

let interval = null

onMounted(async () => {
  const paymentId = route.params.id
  const result = await getPaymentStatus(paymentId)
  if (result) {
    payment.value = result
    status.value = result.status || 'Ожидание оплаты...'
    interval = setInterval(() => checkStatus(paymentId), 4000)
  }
})
</script>

<style scoped>
.payment {
  padding: 20px;
}
</style>
