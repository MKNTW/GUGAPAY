import { getCsrfToken } from './csrf'

const API_URL = 'https://apiforbeta.gugapay.ru'

export async function fetchUserProfile() {
  try {
    const res = await fetch(\`\${API_URL}/profile\`, {
      credentials: 'include',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка загрузки профиля:', error)
    return null
  }
}

export async function loginWithToken(tgToken) {
  try {
    const res = await fetch(\`\${API_URL}/auth/telegram\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ token: tgToken }),
      credentials: 'include'
    })
    return await res.json()
  } catch (error) {
    console.error('Ошибка входа:', error)
    return null
  }
}
