<template>
  <div :class="['msg', fromSelf ? 'self' : 'other']">
    {{ text }}
  </div>
</template>

<script setup>
defineProps(['text', 'fromSelf'])
</script>

<style scoped>
.msg {
  padding: 8px 12px;
  margin-bottom: 6px;
  border-radius: 8px;
  max-width: 70%;
}
.self {
  background: #d2f4d2;
  margin-left: auto;
}
.other {
  background: #f0f0f0;
  margin-right: auto;
}
</style>
