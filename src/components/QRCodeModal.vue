<template>
  <div class="modal">
    <img :src="qrData" alt="QR Code" />
    <p>Отсканируйте QR-код для оплаты</p>
  </div>
</template>

<script setup>
defineProps(['qrData'])
</script>

<style scoped>
.modal {
  background: white;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
}
</style>
