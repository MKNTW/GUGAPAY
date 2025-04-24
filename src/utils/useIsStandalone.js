import { ref, onMounted } from 'vue'

export function useIsStandalone() {
  const isStandalone = ref(false)

  onMounted(() => {
    isStandalone.value =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
  })

  return { isStandalone }
}
