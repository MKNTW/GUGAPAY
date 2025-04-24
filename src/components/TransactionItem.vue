<template>
  <div class="tx">
    <strong>{{ tx.type }}</strong>: {{ tx.amount }} {{ tx.currency }} → {{ tx.to }}
    <span>({{ tx.status }})</span>
  </div>
</template>

<script setup>
defineProps(['tx'])
</script>

<style scoped>
.tx {
  padding: 10px;
  border-bottom: 1px solid #ccc;
}
</style>
