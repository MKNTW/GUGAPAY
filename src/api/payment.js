import { getCsrfToken } from './csrf'

const API_URL = 'https://apiforbeta.gugapay.ru'

export async function startPayment(amount, terminalId) {
  try {
    const res = await fetch(\`\${API_URL}/payment/start\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      credentials: 'include',
      body: JSON.stringify({ amount, terminal_id: terminalId })
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка создания платежа:', error)
    return null
  }
}

export async function getPaymentStatus(paymentId) {
  try {
    const res = await fetch(\`\${API_URL}/payment/status?id=\${paymentId}\`, {
      credentials: 'include'
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка получения статуса платежа:', error)
    return null
  }
}
