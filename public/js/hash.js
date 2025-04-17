
// Пример загрузки истории транзакций
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("transactionList");

  try {
    const response = await fetch("/api/transactions"); // нужно реализовать этот endpoint на сервере
    const data = await response.json();

    if (!data.success) throw new Error("Ошибка при получении истории");

    container.innerHTML = data.transactions.map(tx => `
      <div class="transaction">
        <strong>${tx.hash}</strong><br>
        Сумма: ${tx.amount} ₲<br>
        От: ${tx.from_user_id}<br>
        Кому: ${tx.to_user_id}<br>
        Дата: ${new Date(tx.created_at).toLocaleString()}
      </div>
    `).join("<hr>");
  } catch (err) {
    container.textContent = "Ошибка загрузки истории: " + err.message;
  }
});
