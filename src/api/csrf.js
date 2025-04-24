let csrfToken = "";

export async function fetchCsrfToken() {
  try {
    const res = await fetch("https://apiforbeta.gugapay.ru/csrf-token", {
      credentials: "include"
    });
    const data = await res.json();
    if (data.csrfToken) {
      csrfToken = data.csrfToken;
    }
  } catch (err) {
    console.error("CSRF token not fetched:", err);
  }
}

export function getCsrfToken() {
  return csrfToken;
}
