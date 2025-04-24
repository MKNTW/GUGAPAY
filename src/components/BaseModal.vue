<template>
  <Teleport to="body">
    <div class="modal-overlay" v-if="visible" @click.self="close">
      <div class="modal-window">
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: Boolean
})
const emit = defineEmits(['close'])
function close() {
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-window {
  background: white;
  border-radius: 10px;
  padding: 20px;
  max-width: 90%;
  max-height: 80%;
  overflow-y: auto;
}
</style>
