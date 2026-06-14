// Теперь код сам поймет, что он запущен через ngrok, и будет слать запросы туда же
const API_URL = window.location.origin;

// ==========================================
// 1. УПРАВЛІННЯ МОДАЛЬНИМИ ВІКНАМИ
// ==========================================
const modalRegister = document.getElementById('modal-register');
const modalLogin = document.getElementById('modal-login');

// Кнопки відкриття
const btnOpenReg = document.getElementById('btn-open-register');
const btnOpenLogin = document.getElementById('btn-open-login');

// Кнопки закриття (хрестики)
const closeButtons = document.querySelectorAll('.modal-close');

// Перемикачі (Login <-> Register)
const linkToLogin = document.querySelector('.switch-to-login');
const linkToRegister = document.querySelector('.switch-to-register');

// Функції відкриття/закриття
function openModal(modal) {
    modal.classList.remove('hidden');
    // Невелика затримка для CSS анімації (opacity)
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// Події кнопок
if(btnOpenReg) btnOpenReg.onclick = () => openModal(modalRegister);
if(btnOpenLogin) btnOpenLogin.onclick = () => openModal(modalLogin);

// Закриття хрестиком
closeButtons.forEach(btn => {
    btn.onclick = (e) => {
        const targetId = e.target.getAttribute('data-target');
        closeModal(document.getElementById(targetId));
    };
});

// Закриття при кліку на фон
window.onclick = (e) => {
    if (e.target === modalRegister) closeModal(modalRegister);
    if (e.target === modalLogin) closeModal(modalLogin);
};

// Перемикання між вікнами
if(linkToLogin) {
    linkToLogin.onclick = () => {
        closeModal(modalRegister);
        setTimeout(() => openModal(modalLogin), 300);
    };
}
if(linkToRegister) {
    linkToRegister.onclick = () => {
        closeModal(modalLogin);
        setTimeout(() => openModal(modalRegister), 300);
    };
}

// ==========================================
// 2. ОБРОБКА РЕЄСТРАЦІЇ
// ==========================================
const formRegister = document.getElementById('form-register');

if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault(); // Зупиняємо перезавантаження

        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value.trim();
        const btn = formRegister.querySelector('button');

        try {
            btn.textContent = "Завантаження...";
            btn.disabled = true;

            const response = await fetch(`${API_URL}/register.php`, { // Змінили на register.php
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', 
    body: JSON.stringify({ email, password })
});

            const result = await response.json();

            // script.js — LOGIN (строка ~143)
if (result.success) {
    localStorage.setItem('user_name', result.username);
    if(result.avatar) localStorage.setItem('user_avatar', result.avatar);
    if(result.banner) localStorage.setItem('user_banner', result.banner);
    // ❌ УБЕРИ ЭТУ СТРОКУ:
    // sessionStorage.setItem('syncora_new_login', '1');
    window.location.href = "home.html";
            } else {
                alert("Помилка: " + result.message);
            }
        } catch (error) {
            console.error(error);
            alert("Помилка з'єднання з сервером");
        } finally {
            btn.textContent = "Продовжити";
            btn.disabled = false;
        }
    });
}

// ==========================================
// 3. ОБРОБКА ВХОДУ (Login)
// ==========================================
const formLogin = document.getElementById('form-login');

if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const btn = formLogin.querySelector('button');

        try {
            btn.textContent = "Вхід...";
            btn.disabled = true;

            const response = await fetch(`${API_URL}/login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // 🔥 Додали цей рядок для збереження сесії
    body: JSON.stringify({ email, password })
});

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('user_name', result.username);
                if(result.avatar) localStorage.setItem('user_avatar', result.avatar);
                if(result.banner) localStorage.setItem('user_banner', result.banner);
                // DO NOT clear tutorial/quiz here — DB is the source of truth for returning users
                sessionStorage.setItem('syncora_new_login', '1');
                // Адмін одразу потрапляє в панель модерації замість стрічки
                window.location.href = result.is_admin ? "admin.html" : "home.html";
            } else {
                alert("Невірний логін або пароль");
            }
        } catch (error) {
            console.error(error);
            alert("Помилка з'єднання");
        } finally {
            btn.textContent = "Увійти";
            btn.disabled = false;
        }
    });
}

// 4. Екран завантаження
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500);
        }, 1500);
    }
});

// 5. Google / Apple (Викликаємо глобальні функції з module)
const googleBtn = document.getElementById('google-auth');
if (googleBtn) {
    googleBtn.onclick = async () => {
        if (!window.auth) return alert("Firebase ще не завантажився");
        const provider = new window.GoogleAuthProvider();
        try {
            const result = await window.signInWithPopup(window.auth, provider);
            // Тут твоя логіка відправки на register.php (sendToMyServer)
            // ... можна скопіювати з попереднього коду
            console.log("Google user:", result.user.email);
            // Для прикладу редірект:
            window.location.href = "home.html";
        } catch (error) {
            alert(error.message);
        }
    };
}