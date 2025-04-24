<template>
  <div class="home">
    <h1>Добро пожаловать в Gugapay</h1>
    <img src="/images/66.png" alt="Иконка" style="width: 50px; margin-bottom: 10px;" />
    <BalanceCard :balance="balance" />

    <div class="actions">
      <ActionButton label="Перевести" to="/transfer" />
      <ActionButton label="Запросить" to="/request" />
      <ActionButton label="Обменять" to="/exchange" />
      <ActionButton label="История" to="/history" />
      <ActionButton label="Чат" to="/chat" />
    </div>

    <img src="/images/11.png" alt="Декор" style="width: 100%; margin-top: 20px;" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetchUserProfile } from '../api/user'
import BalanceCard from '../components/BalanceCard.vue'
import ActionButton from '../components/ActionButton.vue'

const balance = ref(null)

onMounted(async () => {
  const profile = await fetchUserProfile()
  if (profile && profile.balance) {
    balance.value = profile.balance
  }
})
</script>

<style scoped>
.home {
  padding: 20px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
</style>
