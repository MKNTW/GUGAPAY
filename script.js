const SERVER_URL = "https://some-cats-beam.loca.lt";

let userId = null;

// Регистрация
document.getElementById("registerBtn").addEventListener("click", async () => {
    const response = await fetch(`https://some-cats-beam.loca.lt}/register`, { method: "POST" });
    const data = await response.json();

    if (data.success) {
        document.getElementById("phrase").textContent = `Ваша фраза: ${data.phrase}`;
        alert("Сохраните фразу! Её нельзя восстановить.");
    }
});

// Вход
document.getElementById("loginBtn").addEventListener("click", async () => {
    const phrase = document.getElementById("inputPhrase").value;

    const response = await fetch(`https://some-cats-beam.loca.lt/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase })
    });
    const data = await response.json();

    if (data.success) {
        document.getElementById("auth").style.display = "none";
        document.getElementById("main").style.display = "block";
        document.querySelector("#balance span").textContent = data.coins.toFixed(5);
    } else {
        alert(data.error || "Ошибка входа");
    }
});

// Выход
document.getElementById("logoutBtn").addEventListener("click", () => {
    document.getElementById("auth").style.display = "block";
    document.getElementById("main").style.display = "none";
});
