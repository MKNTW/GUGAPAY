let userId = null;

// Регистрация
document.getElementById("registerBtn").addEventListener("click", async () => {
    const response = await fetch(`https://f4be6fd44474fdeeed350e5b0a6f3936.serveo.net/register`, { method: "POST" });
    const data = await response.json();

    if (data.success) {
        const words = data.phrase.split(" ");
        for (let i = 1; i <= 12; i++) {
            document.getElementById(`word${i}`).textContent = words[i - 1];
        }
        document.getElementById("phraseTable").style.display = "block";
        alert("Сохраните фразу! Её нельзя восстановить.");
    }
});

// Вход
document.getElementById("loginBtn").addEventListener("click", async () => {
    const phrase = Array.from({ length: 12 }, (_, i) => 
        document.getElementById(`word${i + 1}`).textContent
    ).join(" ");

    const response = await fetch(`https://f4be6fd44474fdeeed350e5b0a6f3936.serveo.net/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase })
    });
    const data = await response.json();

    if (data.success) {
        userId = data.userId;
        document.getElementById("auth").style.display = "none";
        document.getElementById("phraseTable").style.display = "none";
        document.getElementById("main").style.display = "block";
        document.getElementById("userId").textContent = userId;
        document.querySelector("#balance span").textContent = data.coins.toFixed(5);
    } else {
        alert(data.error || "Ошибка входа");
    }
});

// Выход
document.getElementById("logoutBtn").addEventListener("click", () => {
    userId = null;
    document.getElementById("auth").style.display = "block";
    document.getElementById("main").style.display = "none";
});
