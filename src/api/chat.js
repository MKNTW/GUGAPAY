import { getCsrfToken } from './csrf'

const API_URL = 'https://apiforbeta.gugapay.ru'

export async function getChatList() {
  try {
    const res = await fetch(\`\${API_URL}/chat/list\`, {
      credentials: 'include'
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка загрузки списка чатов:', error)
    return []
  }
}

export async function getMessagesWith(userId) {
  try {
    const res = await fetch(\`\${API_URL}/chat/messages/\${userId}\`, {
      credentials: 'include'
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка загрузки сообщений:', error)
    return []
  }
}

export async function sendMessage(toUserId, message) {
  try {
    const res = await fetch(\`\${API_URL}/chat/send\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      credentials: 'include',
      body: JSON.stringify({ toUserId, message })
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error)
    return null
  }
}
