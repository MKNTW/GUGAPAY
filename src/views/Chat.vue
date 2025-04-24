<template>
  <div class="chat">
    <h2>Чаты</h2>
    <div v-if="!selectedUserId">
      <ul>
        <li v-for="chat in chatList" :key="chat.userId">
          <button @click="selectChat(chat.userId)">
            {{ chat.name || 'Пользователь ' + chat.userId }}
          </button>
        </li>
      </ul>
    </div>

    <div v-else>
      <button @click="selectedUserId = null">Назад к списку</button>
      <div class="messages">
        <div v-for="msg in messages" :key="msg.id" class="message">
          <strong>{{ msg.fromSelf ? 'Вы' : 'Он' }}:</strong> {{ msg.text }}
        </div>
      </div>
      <form @submit.prevent="send">
        <input v-model="newMessage" placeholder="Введите сообщение..." />
        <button type="submit">Отправить</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getChatList, getMessagesWith, sendMessage } from '../api/chat'

const chatList = ref([])
const selectedUserId = ref(null)
const messages = ref([])
const newMessage = ref('')

onMounted(async () => {
  chatList.value = await getChatList()
})

async function selectChat(userId) {
  selectedUserId.value = userId
  messages.value = await getMessagesWith(userId)
}

async function send() {
  const sent = await sendMessage(selectedUserId.value, newMessage.value)
  if (sent) {
    messages.value.push({ id: Date.now(), fromSelf: true, text: newMessage.value })
    newMessage.value = ''
  }
}
</script>

<style scoped>
.chat {
  padding: 20px;
}
.messages {
  margin: 15px 0;
  max-height: 300px;
  overflow-y: auto;
  background: #f2f2f2;
  padding: 10px;
}
.message {
  margin-bottom: 8px;
}
form {
  display: flex;
  gap: 10px;
}
</style>
