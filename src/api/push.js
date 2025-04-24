const PUBLIC_VAPID_KEY = 'BO-xrqEyeoH4EHZkg6YJgrO5tfniBp52aRL3V1JKokIe59OLPwFcoyHpciJnpJ3jBRlEXwMewKWYYcVFpuKOcoI';

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;
  return await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
  });
}
