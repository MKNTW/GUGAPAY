import { getCsrfToken } from './csrf'

const API_URL = 'https://apiforbeta.gugapay.ru'

export async function getExchangeRates() {
  try {
    const res = await fetch(\`\${API_URL}/exchange/rates\`, {
      credentials: 'include'
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка получения курсов:', error)
    return []
  }
}

export async function exchangeCurrency(fromCurrency, toCurrency, amount) {
  try {
    const res = await fetch(\`\${API_URL}/exchange\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      credentials: 'include',
      body: JSON.stringify({ fromCurrency, toCurrency, amount })
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка обмена валюты:', error)
    return null
  }
}
