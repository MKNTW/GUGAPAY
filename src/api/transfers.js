import { getCsrfToken } from './csrf'

const API_URL = 'https://apiforbeta.gugapay.ru'

export async function sendTransfer(recipientId, amount, currency) {
  try {
    const res = await fetch(\`\${API_URL}/transfer/send\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      credentials: 'include',
      body: JSON.stringify({ recipientId, amount, currency })
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка отправки перевода:', error)
    return null
  }
}

export async function requestFunds(fromUserId, amount, currency) {
  try {
    const res = await fetch(\`\${API_URL}/transfer/request\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      credentials: 'include',
      body: JSON.stringify({ fromUserId, amount, currency })
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка запроса средств:', error)
    return null
  }
}
