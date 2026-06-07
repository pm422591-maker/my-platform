const clientId = "3297832364838545643"; 
const clientSecret = "RBX-z6LMMDaBo0ydp7J9OFOkXrw_DkNWsQmUm4UEKbyCST2jdA3Hpx3885ljFCsSv0ky";
const redirectUri = "https://faunlike-lumpily-nikola.ngrok-free.dev/profile.html";

// Элементы интерфейса
const trigger = document.getElementById('activityTrigger');
const picker = document.getElementById('timePicker');
const grid = document.getElementById('timeGrid');
const textDisplay = document.getElementById('activityText');
const iconDisplay = document.getElementById('statusIcon');

let tempProfileData = null; 
let selectedItems = []; 
let userInventoryFromDB = [];
let startHour = null;
let endHour = null;
let firstClick = null;
let isDragging = false;
let selectedCountry = ""; // Тут будет храниться код страны (напр. "UA")
let selectedLanguages = [];
let lastFollowerId = null;

// --- ГЛОБАЛЬНІ ФУНКЦІЇ МОДАЛКИ ---
window.toggleDecoModal = function(show) {
    const modal = document.getElementById('deco-modal');
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
        console.log(show ? "✅ Модалка відкрита" : "✅ Модалка закрита");
    } else {
        console.error("❌ Модалка #deco-modal не знайдена в HTML");
    }
};

// --- ОСНОВНА ІНІЦІАЛІЗАЦІЯ ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Скрипт ініціалізовано!");

    // 1. Кнопка відкриття модалки (Шукаємо за ID)
    const openBtn = document.getElementById('open-deco-modal-btn');
    if (openBtn) {
        openBtn.onclick = (e) => {
            e.preventDefault();
            window.toggleDecoModal(true);
        };
    }

    // 2. Кнопка видалення прикраси
    const removeDecoBtn = document.querySelector('.btn-danger-outline[onclick*="remove"]'); // або додай їй ID
    if (removeDecoBtn) {
        removeDecoBtn.onclick = () => {
            if (openBtn) openBtn.innerHTML = 'Обрати прикрасу';
            localStorage.removeItem('user_decoration');
        };
    }

    // 3. Відео в модалці
    const modal = document.getElementById('deco-modal');
    if (modal) {
        modal.querySelectorAll('.deco-item').forEach(item => {
            const v = item.querySelector('video');
            if (v) {
                item.onmouseenter = () => v.play();
                item.onmouseleave = () => { v.pause(); v.currentTime = 0; };
            }
        });
    }

    // 4. Завантаження даних та Roblox
    loadUserData();
    handleRobloxCallback();
    handleSteamCallback();
    
    // Перевірка збереженої прикраси
    const savedDeco = localStorage.getItem('user_decoration');
    if (savedDeco) window.applyDecoration(savedDeco);
}); 

// ==========================================
// БРОНЕБІЙНИЙ ЗАПУСК STEAM
// ==========================================
document.addEventListener('click', function(e) {
    // Шукаємо, чи клік був по кнопці з id="btn-steam-auth"
    const steamBtn = e.target.closest('#btn-steam-auth');
    
    if (steamBtn) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log("🚂 Перехоплено клік по кнопці Steam!");
        
        // Викликаємо авторизацію
        if (typeof window.startSteamAuth === 'function') {
            window.startSteamAuth();
        } else {
            console.error("❌ Функція window.startSteamAuth не знайдена!");
            alert("Помилка: Скрипт Steam не підключено.");
        }
    }
}, true); // true - перехоплює клік найпершим, обходячи будь-які інші скрипти!

document.addEventListener('DOMContentLoaded', () => {
    const emailBtn = document.getElementById('btn-save-email');
    const emailSpan = document.getElementById('edit-secondary-email');

    // 1. Завантаження збереженого email (спочатку з БД через PHP, якщо є, або з localStorage)
    // Краще, щоб PHP при завантаженні сторінки вже вставив email у цей span, 
    // але якщо ви хочете залишити localStorage як резерв:
    const savedLocal = localStorage.getItem('user_secondary_email');
    if (savedLocal && emailSpan.innerText.includes('@') === false) {
        emailSpan.innerText = savedLocal;
    }

    // 2. Логіка збереження при кліку
    if (emailBtn && emailSpan) {
        emailBtn.addEventListener('click', function() {
            // ДЛЯ SPAN ВИКОРИСТОВУЄМО innerText, А НЕ value!
            const newEmail = emailSpan.innerText.trim();

            if (!newEmail || !newEmail.includes('@')) {
                alert("Введіть коректну пошту!");
                return;
            }

            // Змінюємо текст кнопки, щоб видно було процес
            const originalText = emailBtn.innerText;
            emailBtn.innerText = "Зберігаю...";

            // Відправка на сервер
            fetch('update_email.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: newEmail })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Успіх: зберігаємо і в локальне сховище про всяк випадок
                    localStorage.setItem('user_secondary_email', newEmail);
                    alert("Пошту успішно збережено в базі даних!");
                } else {
                    alert("Помилка сервера: " + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert("Сталася помилка з'єднання.");
            })
            .finally(() => {
                emailBtn.innerText = originalText;
            });
        });
    }
});



// Закриття вікна при кліку в будь-якому іншому місці сторінки
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('notif-dropdown');
    const btn = document.querySelector('.notif-btn');
    if (dropdown && !dropdown.contains(e.target) && btn && !btn.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// --- СИСТЕМА ПІДПИСОК (ПЕРЕНЕСЕНО ВГОРУ) ---
window.followUser = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');

    if (!targetId) return;

    const btn = document.querySelector('.subscribe-btn');
    const countSpan = document.getElementById('followers-count');

    if (!btn) return;
    btn.disabled = true;

    try {
        const response = await fetch('toggle_follow.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_id: targetId }),
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            if (result.action === 'followed') {
                btn.classList.add('active');
                btn.querySelector('span').innerText = 'Відписатися';
            } else {
                btn.classList.remove('active');
                btn.querySelector('span').innerText = 'Підписатися';
            }
            
            if (countSpan && result.new_count !== undefined) {
                countSpan.innerText = result.new_count;
            }
        }
    } catch (e) {
        console.error("Помилка підписки:", e);
    } finally {
        btn.disabled = false;
    }
};

// --- 🔔 СИСТЕМА СПОВІЩЕНЬ (ПОВНЕ ВИПРАВЛЕННЯ) ---
let lastSeenFollowerId = null; 

window.toggleNotifDropdown = function(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown) return;

    const isHidden = window.getComputedStyle(dropdown).display === 'none';
    if (isHidden) {
        dropdown.style.display = 'block';
        window.loadNotifications(); 
    } else {
        dropdown.style.display = 'none';
    }
};

window.loadNotifications = async function() {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-count');
    if (!list) return;

    try {
        const response = await fetch('get_notifications.php', { credentials: 'include' });
        const data = await response.json();

        if (data.success && data.followers && data.followers.length > 0) {
            list.innerHTML = ''; 

            data.followers.forEach(user => {
                let avatar = user.avatar_url ? (user.avatar_url.startsWith('uploads') ? user.avatar_url : 'img/' + user.avatar_url) : 'img/default_avatar.png';

                // Створюємо елемент, де ім'я — це посилання на профіль
                const item = `
                    <div class="notif-item" style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #252525;">
                        <a href="profile.html?id=${user.id}">
                            <img src="${avatar}" style="width: 38px; height: 38px; border-radius: 50%; margin-right: 12px; object-fit: cover; border: 1px solid #444;">
                        </a>
                        <div class="notif-text" style="font-size: 13px; color: #ccc;">
                            <a href="profile.html?id=${user.id}" class="notif-user-link">${user.username}</a> 
                            підписався на вас
                        </div>
                    </div>
                `;
                list.insertAdjacentHTML('beforeend', item);
            });

            if (badge) {
                badge.innerText = data.followers.length;
                badge.style.display = 'flex';
            }
        } else {
            list.innerHTML = '<div class="notif-empty" style="padding: 25px; color: #666; text-align: center;">Немає нових сповіщень</div>';
            if (badge) badge.style.display = 'none';
        }
    } catch (e) {
        console.error("Помилка повідомлень:", e);
    }
};

// Функція для спливаючого повідомлення (Toast)
function showToastNotification(user) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'notif-toast-pop'; // Переконайся, що в CSS є стилі для цього класу
    
    let avatar = user.avatar_url ? (user.avatar_url.startsWith('uploads') ? user.avatar_url : 'img/' + user.avatar_url) : 'img/default_avatar.png';

    toast.innerHTML = `
        <img src="${avatar}" style="width:34px; height:34px; border-radius:50%; border: 1px solid #ff4500;">
        <div style="font-size:13px; color: white;">Новий підписник: <b style="color:#ff4500;">${user.username}</b></div>
    `;

    container.appendChild(toast);

    // Видаляємо через 5 секунд з анімацією
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// Запускаємо перевірку відразу і потім кожні 10 секунд
document.addEventListener('DOMContentLoaded', () => {
    window.loadNotifications(); 
    setInterval(window.loadNotifications, 10000);
});

document.addEventListener('DOMContentLoaded', () => {
    const userBtn = document.getElementById('btn-save-username');
    const userSpan = document.getElementById('edit-username');

    if (userBtn && userSpan) {
        userBtn.onclick = async () => {
            // Отримуємо текст саме через innerText
            const newName = userSpan.innerText.trim();

            if (!newName) {
                alert("Ім'я не може бути порожнім");
                return;
            }

            const originalText = userBtn.innerText;
            userBtn.innerText = "Зберігаю...";

            try {
                const response = await fetch('update_username.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: newName })
                });

                const data = await response.json();

                if (data.success) {
                    alert("Ім'я оновлено в БД!");
                    // Оновлюємо відображення імені в шапці, якщо треба
                    const topName = document.querySelector('.user-info h2'); 
                    if (topName) topName.innerText = newName;
                } else {
                    alert("Помилка: " + data.message);
                }
            } catch (error) {
                console.error("Помилка запиту:", error);
                alert("Не вдалося зв'язатися з сервером");
            } finally {
                userBtn.innerText = originalText;
            }
        };
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const birthdayBtn = document.getElementById('btn-save-birthday');

    if (birthdayBtn) {
        birthdayBtn.onclick = async () => {
            // Зчитуємо значення, які зараз стоять в інпутах
            const day = document.getElementById('birth-day').value;
            const month = document.getElementById('birth-month').value;
            const year = document.getElementById('birth-year').value;

            birthdayBtn.innerText = "Зберігаю...";

            try {
                const response = await fetch('update_birthday.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        day: day, 
                        month: month, 
                        year: year 
                    })
                });

                const data = await response.json();

                if (data.success) {
                    alert("Дату народження збережено!");
                } else {
                    alert("Помилка: " + data.message);
                }
            } catch (error) {
                console.error("Error:", error);
                alert("Помилка зв'язку з сервером");
            } finally {
                birthdayBtn.innerText = "Підтвердити";
            }
        };
    }
});

function applyDecoration(videoUrl) {
    const square = document.querySelector('.transparent-square');
    // ВИПРАВЛЕНО: беремо кнопку саме для прикрас за її ID
    const openBtn = document.getElementById('open-deco-modal-btn'); 

    if (!square || !videoUrl) return;

    square.innerHTML = `
        <video src="${videoUrl}" autoplay loop muted playsinline 
               style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
        </video>
    `;
    square.style.display = 'block';

    if (openBtn) {
        openBtn.innerHTML = 'Прикрасу встановлено';
    }

    localStorage.setItem('user_decoration', videoUrl);
}

// Функція ПРИМУСОВОГО видалення
console.log("✅ profile.js успішно завантажений!");

// Функція видалення
window.removeDecoration = function() {
    const square = document.querySelector('.transparent-square');
    // ВИПРАВЛЕНО: беремо кнопку саме для прикрас за її ID
    const openBtn = document.getElementById('open-deco-modal-btn');

    if (square) {
        square.innerHTML = ''; 
        square.style.display = 'none';
    }

    if (openBtn) {
        openBtn.innerHTML = 'Обрати прикрасу';
    }

    localStorage.removeItem('user_decoration');
};
//GAMES LIBRARY ---
// type: "badge" for badges, type: "pass" for gamepasses
const myGamesLibrary = [
    {
        name: "Evade",
        img: "img/evade.jpg",
        modes: [
            { id: "2128167319", name: "25 lvl", type: "badge", img: "img/25 evade.jpeg" },
            { id: "2128167321", name: "50 lvl", type: "badge", img: "img/50 evade.jpeg" },
            { id: "2128167324", name: "75 lvl", type: "badge", img: "img/75 evade.jpeg" },
            { id: "2128167328", name: "100 lvl", type: "badge", img: "img/100 evade.jpeg" },
            { id: "2128167329", name: "125 lvl", type: "badge", img: "img/125 evade.jpeg" },
            // Example Gamepass
            { id: "1045160877", name: "Crystalline Set", type: "pass", img: "img/Crystalline Set.jpeg" },
            { id: "1637578813", name: "Dog Set", type: "pass", img: "img/Dog Set.jpeg" },
            { id: "1419753648", name: "Retro Cosmetics Set", type: "pass", img: "img/Retro Cosmetics Set.jpeg" },
            { id: "1045160877", name: "Crystalline Set", type: "pass", img: "img/Crystalline Set.jpeg" }
        ]
    },
    {
        name: "99 nights in the forest",
        img: "img/99 night.jpg",
        modes: [
            { id: "2310366779580636", name: "10 days", type: "badge", img: "img/10 days.jpeg" },
            { id: "2491852490394472", name: "20 days", type: "badge", img: "img/20 days.jpeg" },
            { id: "2419608566642291", name: "30 days", type: "badge", img: "img/30 days.jpeg" },
            { id: "554308544894889", name: "40 days", type: "badge", img: "img/40 days.jpeg" },
            { id: "3412064596604231", name: "50 days", type: "badge", img: "img/50 days.jpeg" },
            { id: "2491852490394472", name: "60 days", type: "badge", img: "img/20 days.jpeg" }
        ]
    }
];

// STEAM GAMES LIBRARY ---
const mySteamLibrary = [
    {
        name: "CS:GO / CS2",
        appId: "730", 
        img: "img/gmod_cover.jpeg",
        platform: "steam",
        modes: [
            { id: "steam_730", name: "Гра в бібліотеці", type: "game", img: "img/gmod_cover.jpeg" }
        ]
    },
    {
        name: "PEAK",
        appId: "3527290",
        img: "img/gmod_cover.jpeg",
        platform: "steam",
        modes: [
            { id: "steam_3527290", name: "Гра в бібліотеці", type: "game", img: "img/gmod_cover.jpeg" }
        ]
    }
];

function normalizeAssetId(value) {
    return String(value ?? '').trim();
}

function parseJsonArrayField(value) {
    if (!value || value === 'null') return [];
    if (Array.isArray(value)) return value;

    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error('Failed to parse saved inventory JSON:', e);
        return [];
    }
}

function normalizeInventoryItems(items) {
    return parseJsonArrayField(items)
        .map(item => {
            if (!item) return null;
            const id = normalizeAssetId(item.id ?? item.badgeId ?? item.gamePassId ?? item.appid);
            if (!id) return null;

            return {
                ...item,
                id,
                owned: item.owned !== false
            };
        })
        .filter(Boolean);
}

function isModeOwned(mode) {
    const modeId = normalizeAssetId(mode && mode.id);
    if (!modeId) return false;

    return userInventoryFromDB.some(item => normalizeAssetId(item.id) === modeId && item.owned !== false)
        || Boolean(mode && mode.owned === true);
}

function syncOwnedFlagsFromInventory() {
    const ownedIds = new Set(
        userInventoryFromDB
            .filter(item => item && item.owned !== false)
            .map(item => normalizeAssetId(item.id))
            .filter(Boolean)
    );

    myGamesLibrary.forEach(game => {
        game.modes.forEach(mode => {
            mode.owned = ownedIds.has(normalizeAssetId(mode.id));
        });
    });

    mySteamLibrary.forEach(game => {
        const modeId = `steam_${game.appId}`;
        const owned = ownedIds.has(modeId);
        game.owned = owned;
        if (game.modes && game.modes[0]) {
            game.modes[0].owned = owned;
        }
    });
}

async function syncRobloxInventoryFromServer(robloxId) {
    if (!robloxId || robloxId === 'null') return false;

    try {
        const syncRes = await fetch('sync_roblox_assets.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ roblox_id: robloxId })
        });
        const syncData = await syncRes.json();

        if (!syncData.success) {
            console.warn('Roblox inventory sync failed:', syncData.message, syncData.errors || []);
            return false;
        }

        userInventoryFromDB = normalizeInventoryItems(syncData.owned);
        syncOwnedFlagsFromInventory();
        return true;
    } catch (e) {
        console.error('Roblox inventory sync request failed:', e);
        return false;
    }
}


// --- 2. INITIALIZATION ---
// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Скрипт ініціалізовано!");

    const nameInput = document.getElementById('edit-display-name');
    const topNameBlock = document.getElementById('userName');
    const bannerInput = document.getElementById('banner-file-input');
    const trigger = document.getElementById('activityTrigger');
    const grid = document.getElementById('timeGrid');

    // Завантаження даних при старті
    loadUserData();
    initTimeGrid(grid);

    // Слухач банера
    if (bannerInput) {
        bannerInput.addEventListener('change', function() {
            if (this.files[0]) uploadBanner(this.files[0]);
        });
    }

    // Робота з Roblox OAuth\

    // Оновлення статусу кожну хвилину
    setInterval(checkStatus, 60000);
});
// --- ФУНКЦІЇ ПРОФІЛЮ ---
// --- ФУНКЦІЇ ПРОФІЛЮ ---
// --- ФУНКЦІЇ ПРОФІЛЮ ---
// --- ФУНКЦІЇ ПРОФІЛЮ ---
async function loadUserData() {
    console.log("🔄 Завантаження даних профілю...");
    
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    const fetchUrl = userId ? `get_user.php?id=${userId}` : 'get_user.php';

    try {
        const response = await fetch(fetchUrl, { credentials: 'include' });
        const text = await response.text(); // Зчитуємо як текст спочатку
        console.log("Отримано від сервера:", text); // Дивимось, що там (JSON чи помилка)
        const data = JSON.parse(text); // Потім перетворюємо на об'єкт

        if (data.success) {
            window._profileData = data; // Store for premium check
            const timestamp = Date.now();

            // === РОБОТА З ІГРАМИ (Roblox + Steam) ===
            const container = document.getElementById('roblox-games-render-zone');

            // 1. ОДРАЗУ дістаємо ігри з бази (незалежно від того, що підключено)
            let savedGames = [];
            if (data.roblox_data && data.roblox_data !== "null") {
                try {
                    savedGames = typeof data.roblox_data === 'string' ? JSON.parse(data.roblox_data) : data.roblox_data;
                } catch(e) { 
                    console.error("Помилка JSON ігор:", e);
                }
            }

            // 2. ОНОВЛЮЄМО ГЛОБАЛЬНИЙ МАСИВ (Саме це поверне галочки в модалці після рефрешу!)
            userInventoryFromDB = normalizeInventoryItems(data.roblox_inventory);
            syncOwnedFlagsFromInventory();
            selectedItems = Array.isArray(savedGames)
                ? savedGames.map(item => ({ ...item, id: normalizeAssetId(item.id) }))
                : []; 

            // 3. Перевіряємо, чи підключений ХОЧА Б ОДИН акаунт
            const isRobloxLinked = data.roblox_id && data.roblox_id !== "null";
            const isSteamLinked = data.steam_id && data.steam_id !== "null";
            window.isRobloxConnected = Boolean(isRobloxLinked);

            if (isRobloxLinked && data.is_own_profile && userInventoryFromDB.length === 0) {
                await syncRobloxInventoryFromServer(data.roblox_id);
            }

            if (isRobloxLinked || isSteamLinked) {
                console.log("✅ Знайдено підключені ігрові акаунти");
                
                if (selectedItems.length > 0) {
                    displayRobloxData({ stats: selectedItems });
                } else if (container) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 20px; color: #888;">
                            Акаунт підключено! <br> Натисніть на ⚙️, щоб вибрати ігри для профілю.
                        </div>`;
                }
                
                // Зберігаємо локально про всяк випадок
                localStorage.setItem('roblox_user', JSON.stringify({id: data.roblox_id, stats: selectedItems}));

            } else {
                // ❌ КОРИСТУВАЧ НЕ ПІДКЛЮЧИВ НІ STEAM, НІ ROBLOX
                if (container) {
                    container.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; padding: 30px 0;">
                            <span style="color: #666; margin-bottom: 12px; font-size: 13px;">Підключіть свій Roblox або Steam, щоб показати досягнення</span>
                        </div>`;
                }
            }
            // --- ГОЛОВНЕ ВИПРАВЛЕННЯ ---
            const fixPath = (path, defaultImg) => {
    // 1. Якщо шляху немає
    if (!path || path === "null" || path.trim() === "") {
        return `img/${defaultImg}`; // Дефолтні картинки залишаємо в img/
    }
    
    // 2. Якщо це шлях до нової папки uploads/
    if (path.startsWith('uploads/')) {
        return path; // Нічого не чіпаємо, шлях уже правильний!
    }
    
    // 3. Якщо це старі картинки (img/) або http
    if (path.startsWith('img/') || path.startsWith('http')) {
        return path;
    }

    // 4. Про всяк випадок (для старих записів)
    return `img/${path}`;
};


// Всередині loadUserData, там де data.success === true:
if (data.roblox_inventory && userInventoryFromDB.length === 0) {
    try {
        // Перетворюємо рядок з бази у масив об'єктів
        userInventoryFromDB = normalizeInventoryItems(data.roblox_inventory);
        syncOwnedFlagsFromInventory();
            
        console.log("🎒 Інвентар завантажено з бази:", userInventoryFromDB);
    } catch (e) {
        console.error("Помилка парсингу інвентаря:", e);
        userInventoryFromDB = [];
    }
}

// === РОБОТА ЗІ STEAM ===
if (data.steam_id && data.steam_id !== "null") {
    console.log("🚂 Знайдено Steam ID:", data.steam_id);
    
    // ДОДАЄМО ГЛОБАЛЬНИЙ ФЛАГ
    window.isSteamConnected = true; 
    
    const steamBtn = document.getElementById('btn-steam-auth');
    if (steamBtn) {
        steamBtn.innerText = "Підключено";
        steamBtn.style.background = ""; // <--- ОЧИЩАЄМО стиль, щоб кнопка стала такою ж, як інші
        steamBtn.disabled = false; 
    }

    checkSteamGamesOwnership(data.steam_id);
} else {
    window.isSteamConnected = false;
    
    const steamBtn = document.getElementById('btn-steam-auth');
    if (steamBtn) {
        steamBtn.innerText = "Підключити";
        steamBtn.style.background = ""; // Очищаємо стиль
        steamBtn.disabled = false; 
    }
}
            // ===========================
            // 1. ВІЗУАЛ (Аватар, Банер, Фон)
            // ===========================
            
           // 1. АВАТАР (avatar_url)
            // Браузер сам зрозуміє, що це GIF, і почне анімацію
            let rawAvatar = data.avatar_url || data.avatar; 
            let avatarPath = fixPath(rawAvatar, 'default_avatar.png');
            const srcAvatar = avatarPath + '?t=' + timestamp; // timestamp змушує оновити кеш гіфки

            const av1 = document.getElementById('top-nav-avatar');
            const av2 = document.getElementById('settings-avatar-img');
            if (av1) av1.src = srcAvatar;
            if (av2) av2.src = srcAvatar;

            // 2. БАНЕР (banner_url)
            let rawBanner = data.banner_url || data.banner;
            let bannerPath = fixPath(rawBanner, 'default_banner.png');
            const bannerBlock = document.getElementById('profile-banner-bg');
            
            if (bannerBlock) {
                const bannerSrc = bannerPath + '?t=' + timestamp;
                
                // Налаштування для GIF та картинок
                bannerBlock.style.backgroundImage = `url("${bannerSrc}")`;
                bannerBlock.style.backgroundSize = 'cover';      // Розтягнути, зберігаючи пропорції
                bannerBlock.style.backgroundPosition = 'center center'; // Центрувати гіфку
                bannerBlock.style.backgroundRepeat = 'no-repeat';
                
                // Оновлюємо прев'ю в налаштуваннях
                const settingsBanner = document.getElementById('settings-banner-img');
                if (settingsBanner) settingsBanner.src = bannerSrc;
            }

            // 3. ФОН САЙТУ (background_url)
            let rawBg = data.background_url;
            if (rawBg && rawBg.length > 3) {
                let siteBgPath = fixPath(rawBg, 'default_bg.png');
                const finalBgUrl = siteBgPath + '?t=' + timestamp;
                
                Object.assign(document.body.style, {
                    backgroundImage: `url('${finalBgUrl}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center top', // Фон краще рівняти по верху
                    backgroundAttachment: 'fixed',    // Щоб фон не рухався при скролі (паралакс ефект для GIF)
                    backgroundRepeat: 'no-repeat'
                });
            }

            // ===========================
            // 2. БІОГРАФІЯ (Колонка №10: bio)
            // ===========================
            const bioInput = document.getElementById('user-bio');
            const bioDisplay = document.getElementById('userBioDisplay');
            const bioTextEl = document.getElementById('userBioText');

            if (data.bio !== undefined) {
                const currentBio = data.bio || "";
                if (bioInput) bioInput.value = currentBio;
                if (bioDisplay) {
                    bioDisplay.textContent = currentBio.trim() !== "" ? currentBio : "Про себе нічого не вказано";
                }
                if (bioTextEl) {
                    bioTextEl.innerText = currentBio || "Опис відсутній";
                }
                
                if (bioInput) {
                    bioInput.onblur = async () => {
                        const newBio = bioInput.value.trim();
                        if (newBio === data.bio) return;
                        if (typeof saveBioToServer === 'function') {
                            await saveBioToServer(newBio);
                            data.bio = newBio;
                        }
                    };
                }
            }

            // ===========================
            // 3. ВІДОБРАЖУВАНЕ ІМ'Я (Колонка №2: user)
            // ===========================
            const displayNameSpan = document.getElementById('edit-display-name');
            const nameHeader = document.getElementById('userName'); 

            // СУВОРА ЛОГІКА:
            // Пріоритет №1: Display Name (data.user)
            // Пріоритет №2: Username (data.username), якщо імені немає
            const realName = (data.user && data.user.trim().length > 0 && data.user !== "null") ? data.user : "";

            // Заповнюємо шапку (якщо пусто - пишемо логін або "Без імені")
            if (nameHeader) {
                nameHeader.textContent = realName || data.username || "Без імені"; 
            }

            // Заповнюємо поле налаштувань
            if (displayNameSpan) {
                if (displayNameSpan.tagName === 'INPUT') {
                    displayNameSpan.value = realName;
                } else {
                    displayNameSpan.innerText = realName;
                }
            }

           // Дата реєстрації (Колонка №6: created_at)
            const regDateEl = document.getElementById('userRegistrationDate');
            if (regDateEl && data.created_at) {
                const dateObj = new Date(data.created_at.replace(/-/g, "/"));
                
                // Discord стиль: "18 лют. 2024 р."
                const formattedDate = dateObj.toLocaleDateString('uk-UA', {
                    day: 'numeric', 
                    month: 'short',  // Було 'long', стало 'short' (січ., лют.)
                    year: 'numeric'
                });
                
                // Змінюємо текст на "Учасник з" (Member since)
                regDateEl.innerText = "Учасник з " + formattedDate;
            }
            
           // Коли отримали дані з сервера (data.success)
const editBtn = document.getElementById('edit-profile-btn');
const visitorBlock = document.getElementById('visitor-actions');
const editGamesBtn = document.getElementById('edit-games-btn'); // Твоя шестерня
const activityTrigger = document.getElementById('activityTrigger'); // Блок, що відкриває час

// Перетворюємо в булеве значення
const isOwner = (data.is_own_profile === true || data.is_own_profile === "true");

if (isOwner) {
    console.log("🛠️ Режим власника");
    if (editBtn) editBtn.style.setProperty('display', 'inline-flex', 'important');
    if (visitorBlock) visitorBlock.style.setProperty('display', 'none', 'important');
    
    // Показуємо шестерню ігор
    if (editGamesBtn) editGamesBtn.style.setProperty('display', 'block', 'important');
    
    // Дозволяємо редагувати поля
    document.querySelectorAll('[contenteditable]').forEach(el => el.contentEditable = "true");
    
    // Дозволяємо відкривати час
    if (activityTrigger) activityTrigger.style.cursor = 'pointer';

} else {
    console.log("👤 Режим відвідувача");
    if (editBtn) editBtn.style.setProperty('display', 'none', 'important');
    if (visitorBlock) visitorBlock.style.setProperty('display', 'flex', 'important');
    
    // 1. ХОВАЄМО ШЕСТЕРНЮ ІГОР
    if (editGamesBtn) editGamesBtn.style.setProperty('display', 'none', 'important');
    
    // 2. БЛОКУЄМО ЧАС
    if (activityTrigger) {
        activityTrigger.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false; // Повністю вбиваємо клік
        };
        activityTrigger.style.cursor = 'default';
    }

    // ЗАБОРОНЯЄМО редагувати чужий профіль
    document.querySelectorAll('[contenteditable]').forEach(el => el.contentEditable = "false");
}

            // ===========================
            // 4. ЮЗЕРНЕЙМ (Колонка №3: username) - ВИПРАВЛЕНО
            // ===========================
            const usernameSpan = document.getElementById('edit-username');   
            const userHandleDisplay = document.getElementById('userHandle'); 

            if (userHandleDisplay) {
                if (data.username && data.username.trim() !== "" && data.username !== "null") {
                    userHandleDisplay.innerText = "@" + data.username;
                    userHandleDisplay.style.color = "#b0b0b0"; 
                } else {
                    userHandleDisplay.innerText = "@user_new"; 
                }
            }

            if (usernameSpan) {
                usernameSpan.innerText = (data.username && data.username !== "null") ? data.username : "Введіть логін";
                usernameSpan.onfocus = () => {
                    if (usernameSpan.innerText === "Введіть логін") usernameSpan.innerText = "";
                };
                // Логіка onblur залишається вашою...
            }

            // ===========================
            // 5. ПОШТА, ГРАДІЄНТ ТА БЕЙДЖІ
            // ===========================
            
            // Пошта (Колонка №11: secondary_email)
            const emailSpan = document.getElementById('edit-secondary-email');
            if (emailSpan) {
                emailSpan.innerText = data.secondary_email || "Додати пошту";
            }

            // Бейджі (Колонка №20: badges)
            if (data.badges && data.badges !== null && data.badges.trim() !== "") {
                const loadedBadges = data.badges.split(',');
                if (typeof renderBadgesOnProfile === 'function') renderBadgesOnProfile(loadedBadges);
            }

            // ===========================
// 6. ГРАДІЄНТ (Колонки №18 та №19)
// ===========================
const gradLeft = data.grad_color_left || '#222222'; 
const gradRight = data.grad_color_right || '#000000';
const currentGrad = `linear-gradient(135deg, ${gradLeft}, ${gradRight})`;

// 1. Оновлюємо фон нового блоку fade-rectangle
const fadeRect = document.querySelector('.fade-rectangle');
if (fadeRect) {
    fadeRect.style.setProperty('background', currentGrad, 'important');
}

// 2. Оновлюємо фон для блоку біографії
const bioDisplayBlock = document.getElementById('userBioDisplay');
if (bioDisplayBlock) {
    bioDisplayBlock.style.setProperty('background', currentGrad, 'important');
}

// 3. Оновлюємо фон секції ігор
const gamesSection = document.querySelector('.roblox-profile-section');
if (gamesSection) {
    gamesSection.style.setProperty('background', currentGrad, 'important');
}

// 4. Оновлюємо фон бічної панелі (ВИПРАВЛЕНО ІМ'Я ЗМІННОЇ)
const sidebarCard = document.querySelector('.profile-sidebar-card');
if (sidebarCard) {
    sidebarCard.style.setProperty('background', currentGrad, 'important');
}
            // --- НОВА ЧАСТИНА: Оновлюємо інтерфейс налаштувань ---

            // 2. Знаходимо елементи з твого HTML
            const inputL = document.getElementById('color-left');       // Лівий кружечок
            const inputR = document.getElementById('color-right');      // Правий кружечок
            const previewBox = document.getElementById('gradient-preview-box'); // Прямокутник прев'ю

            // 3. Записуємо кольори з бази в інпути (щоб кружечки стали кольоровими)
            if (inputL) inputL.value = gradLeft;
            if (inputR) inputR.value = gradRight;

            // 4. Фарбуємо маленький квадрат прев'ю
            if (previewBox) {
                previewBox.style.background = `linear-gradient(135deg, ${gradLeft}, ${gradRight})`;
            }
            

            // ===========================
            // 9. СТАТУС АКТИВНОСТІ (Колонки №15 та №16: status_start_hour / status_end_hour)
            // ===========================
            if (data.status_start_hour !== null && data.status_end_hour !== null) {
                const sHour = parseInt(data.status_start_hour);
                const eHour = parseInt(data.status_end_hour);
                const timeText = document.getElementById('activityText');
                if (timeText) timeText.innerText = `${sHour}:00 — ${eHour}:00`;
                
                const trigger = document.getElementById('activityTrigger');
                if (trigger) {
                    trigger.classList.add('is-set');
                    if (typeof checkStatus === 'function') {
                        window.startHour = sHour; window.endHour = eHour;
                        checkStatus();
                    }
                }
            }

            // ===========================
            // 7. ПРАПОРИ (SVG-якість + Розділювач)
            // ===========================
            const flagsContainer = document.getElementById('userFlags');

            if (flagsContainer) {
                flagsContainer.innerHTML = ''; // Очищаємо контейнер

                // Функція для додавання одного прапора
                const addFlagToContainer = (code, type) => {
                    if (!code) return false;
                    let cleanCode = code.trim().toLowerCase();
                    if (cleanCode === 'en') cleanCode = 'gb'; // Виправлення для EN

                    const img = document.createElement('img');
                    
                    // --- ВИПРАВЛЕННЯ ЯКОСТІ ---
                    // Використовуємо SVG замість PNG для ідеальної чіткості
                    img.src = `https://flagcdn.com/${cleanCode}.svg`; 
                    
                    img.alt = code;
                    img.title = (type ? type + ": " : "") + code.toUpperCase();
                    
                    // Стилі для SVG
                    // Важливо задати фіксовану висоту, ширина підлаштується
                    img.style.height = '12px'; 
                    img.style.width = 'auto';
                    img.style.marginLeft = '4px';
                    img.style.borderRadius = '3px'; // Трохи скруглимо кути
                    img.style.display = 'inline-block';
                    img.style.verticalAlign = 'middle'; // Рівняємо по центру тексту
                    img.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';

                    img.onerror = function() { this.style.display = 'none'; };
                    
                    flagsContainer.appendChild(img);
                    return true; // Повертаємо true, якщо прапор додано
                };

                // Функція для додавання розділювача
                const addSeparator = () => {
                    const span = document.createElement('span');
                    span.innerText = '|'; // Вертикальна риска
                    // Стилі розділювача
                    span.style.margin = '0 3px';
                    span.style.color = 'rgba(255, 255, 255, 0.3)'; // Напівпрозорий білий
                    span.style.fontSize = '12px';
                    span.style.verticalAlign = 'middle';
                    flagsContainer.appendChild(span);
                };

                let countryAdded = false;

                // 1. Додаємо КРАЇНУ
                if (data.country_code) {
                    countryAdded = addFlagToContainer(data.country_code, "Країна");
                }

                // 2. Додаємо МОВИ (та розділювач, якщо треба)
                if (data.languages_icons && data.languages_icons.length > 0) {
                    const langsArray = data.languages_icons.split(',').filter(l => l.trim());
                    
                    // --- ЛОГІКА РОЗДІЛЮВАЧА ---
                    // Додаємо риску тільки якщо Є країна І Є хоча б одна мова
                    if (countryAdded && langsArray.length > 0) {
                        addSeparator();
                    }

                    langsArray.forEach(lang => {
                         addFlagToContainer(lang, "Мова");
                    });
                }
            }

            // --- ВСТАВЬ ЭТО ВНУТРИ loadUserData ПОСЛЕ data.success ---

// 1. Обновляем цифры статистики (Подписчики, Подписки, Репутация)
const fCount = document.getElementById('followers-count');
const flingCount = document.getElementById('following-count');
const repVal = document.getElementById('reputation-val');

if (fCount) fCount.innerText = data.followers_count || 0;
if (flingCount) flingCount.innerText = data.following_count || 0;
if (repVal) repVal.innerText = data.reputation || 0;

// 2. Настраиваем кнопку подписки (чтобы она сразу была "Отписаться", если ты уже подписан)
const subBtn = document.querySelector('.subscribe-btn');
if (subBtn) {
    if (data.is_own_profile) {
        // Если это мой профиль — прячем кнопку подписки вообще
        subBtn.style.display = 'none';
    } else {
        subBtn.style.display = 'flex'; // Показываем, если это чужой профиль
        if (data.is_following) {
            subBtn.classList.add('active');
            subBtn.querySelector('span').innerText = 'Відписатися';
        } else {
            subBtn.classList.remove('active');
            subBtn.querySelector('span').innerText = 'Підписатися';
        }
    }
}
// --- КОНЕЦ ВСТАВКИ ---

            // ===========================
            // 8. РЕЖИМ ПЕРЕГЛЯДУ
            // ===========================
            if (data.is_own_profile === false) {
                const editables = document.querySelectorAll('[contenteditable="true"]');
                editables.forEach(el => el.setAttribute('contenteditable', 'false'));
                const settingsBtns = document.querySelectorAll('.owner-only');
                settingsBtns.forEach(btn => btn.style.display = 'none');
            }

        } else {
            console.error("❌ Сервер повернув помилку:", data.message);
        }
    } catch (err) { 
        console.error("❌ Помилка завантаження даних:", err); 
    }
}

function startRobloxAuth() {
    const authUrl = `https://apis.roblox.com/oauth/v1/authorize?` + 
                    `client_id=${clientId}&` +
                    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                    `scope=openid profile&` +
                    `response_type=code`;
    window.location.href = authUrl;
}


// ==========================================
// АВТОРИЗАЦІЯ STEAM (OpenID)
// ==========================================

// 1. Універсальна функція для кнопок "Підключити"
window.linkPlatform = function(platform) {
    if (platform === 'Steam') {
        window.startSteamAuth();
    } else if (platform === 'Roblox') {
        window.startRobloxAuth();
    } else {
        console.warn("❌ Невідома платформа:", platform);
    }
};

// 2. Формуємо URL та відправляємо користувача на сторінку логіну Steam
window.startSteamAuth = function() {
    console.log("🚂 Запуск авторизації Steam...");
    
    // ЗАПОМИНАЕМ, что нужно открыть настройки после возврата
    localStorage.setItem('reopen_integrations', 'true');

    const realm = window.location.origin; 
    const returnTo = `${realm}/profile.html`; 

    const steamOpenIdUrl = `https://steamcommunity.com/openid/login?` +
        `openid.ns=http://specs.openid.net/auth/2.0&` +
        `openid.mode=checkid_setup&` +
        `openid.return_to=${encodeURIComponent(returnTo)}&` +
        `openid.realm=${encodeURIComponent(realm)}&` +
        `openid.identity=http://specs.openid.net/auth/2.0/identifier_select&` +
        `openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;

    window.location.href = steamOpenIdUrl;
};

// 3. Обробка повернення зі Steam
window.handleSteamCallback = async function() {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('openid.mode') && urlParams.get('openid.mode') === 'id_res') {
        console.log("🔄 Отримано дані від Steam, перевірка на сервері...");
        
        const steamQueryString = window.location.search;
        window.history.replaceState({}, document.title, window.location.pathname);

        try {
            const response = await fetch('steam_auth.php' + steamQueryString, {
                method: 'GET',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                console.log("✅ Steam підключено!");
                
                // Проверяем игры
                if (typeof window.checkSteamGamesOwnership === 'function') {
                    window.checkSteamGamesOwnership(result.steam_id);
                }
                
                // Обновляем данные профиля
                await loadUserData(); 

                // ПРОВЕРЯЕМ, нужно ли открыть модалку
                if (localStorage.getItem('reopen_integrations') === 'true') {
                    localStorage.removeItem('reopen_integrations'); // Сразу очищаем
                    setTimeout(() => {
                        window.openIntegrationsTab(); // Открываем вкладку интеграций
                    }, 500);
                }

            } else {
                alert("Помилка підключення Steam: " + result.message);
            }
        } catch (err) {
            console.error("❌ Помилка з'єднання:", err);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Если в памяти висит флаг открытия — открываем настройки
    if (localStorage.getItem('reopen_integrations') === 'true') {
        // Даем небольшую задержку, чтобы все стили и скрипты успели прогрузиться
        setTimeout(() => {
            if (typeof window.openIntegrationsTab === 'function') {
                window.openIntegrationsTab();
                localStorage.removeItem('reopen_integrations');
            }
        }, 800);
    }
});


window.toggleDecoModal = function(show) {
    const modal = document.getElementById('deco-modal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
};

async function handleRobloxCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        // Тут має бути твоя логіка авторизації, якщо потрібна
        console.log("Отримано код Roblox:", code);
    }
}
// 
// Функція для оновлення імені
async function updateUserName() {
    const nameSpan = document.getElementById('edit-display-name');
    const saveBtn = document.getElementById('save-name-btn');
    const newName = nameSpan.textContent.trim();

    if (!newName || newName === "Завантаження...") {
        alert("Будь ласка, введіть коректне ім'я");
        return;
    }

    saveBtn.textContent = "Зберігання...";
    saveBtn.disabled = true;

    try {
        const response = await fetch('update_user.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `new_name=${encodeURIComponent(newName)}`
        });

        const result = await response.json();

        if (result.success) {
            // Оновлюємо ім'я всюди на сторінці
            const nameHeader = document.getElementById('userName');
            if (nameHeader) nameHeader.textContent = newName;
            alert("Ім'я успішно змінено!");
        } else {
            alert("Помилка: " + result.message);
        }
    } catch (err) {
        console.error("Помилка при оновленні імені:", err);
        alert("Помилка сервера");
    } finally {
        saveBtn.textContent = "Змінити";
        saveBtn.disabled = false;
    }
}

// Прив'язуємо функцію до кнопки після завантаження сторінки
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-name-btn');
    if (saveBtn) {
        saveBtn.onclick = updateUserName;
    }

    const modal = document.getElementById('deco-modal');
    if (modal) {
        const items = modal.querySelectorAll('.deco-item');
        items.forEach(item => {
            const v = item.querySelector('video');
            item.onmouseenter = () => v.play();
            item.onmouseleave = () => {
                v.pause();
                v.currentTime = 0;
            };
        });
    }
});
// Запуск при повному завантаженні сторінки
window.addEventListener('load', loadUserData);

async function uploadBanner(file) {
    let formData = new FormData();
    formData.append('banner', file);
    try {
        const r = await fetch('upload_avatar.php', { method: 'POST', body: formData });
        const data = await r.json();
        if (data.success) loadUserData(); // Перезавантажуємо, щоб оновити картинки
    } catch (e) { console.error("Помилка завантаження банера:", e); }
}

async function saveBioToServer(text) {
    try {
        const res = await fetch('update_bio.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `bio=${encodeURIComponent(text)}`
        });
        const result = await res.json();
        if (result.success) {
            console.log("✅ Біо успішно збережено в БД");
            return true;
        }
        return false;
    } catch (err) {
        console.error("❌ Помилка збереження:", err);
        return false;
    }
}

// --- 3. ROBLOX AUTH & DATA FETCHING ---

function startRobloxAuth() {
    const authUrl = `https://apis.roblox.com/oauth/v1/authorize?` + 
                    `client_id=${clientId}&` +
                    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                    `scope=openid profile&` +
                    `response_type=code`;
    window.location.href = authUrl;
}

async function handleRobloxCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        // FIX: Call exchangeCodeForData, NOT checkAssetsOwnership directly
        await exchangeCodeForData(code);
    }
}

window.exchangeCodeForData = async function(authCode) {
    try {
        const response = await fetch('roblox_auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: authCode })
        });
        const result = await response.json();

        if (result.success) {
            const robloxId = result.data.sub;

            // 1. Зберігаємо ID в базу
            await fetch('save_roblox_id.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roblox_id: robloxId })
            });

            // 2. ФОНОВА СИНХРОНІЗАЦІЯ (Новий крок!)
            console.log("⏳ Починаю фонову синхронізацію інвентаря...");
            const syncRes = await fetch('sync_roblox_assets.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roblox_id: robloxId })
            });
            const syncData = await syncRes.json();
            
            if (syncData.success) {
                console.log("✅ Інвентар синхронізовано!", syncData.owned);
                // Оновлюємо сторінку, щоб ігри підтягнулися з бази
                loadUserData(); 
            }
        }
    } catch (err) {
        console.error("Помилка авторизації:", err);
    }
};
// UNIVERSAL ASSET CHECKER (Badges + GamePasses)
// UNIVERSAL ASSET CHECKER (Оптимізована версія - без спаму запитами)
// UNIVERSAL ASSET CHECKER (Тепер працює через наш PHP сервер!)
async function checkAssetsOwnership(userId) {
    const loadingText = document.querySelector('.status-text');
    if (loadingText) loadingText.innerText = "⏳ Перевірка інвентаря Roblox...";

    console.log("🎒 Починаємо перевірку речей через наш сервер...");

    // Перевіряємо кожну гру
    for (let game of myGamesLibrary) {
        // Перевіряємо кожну річ
        for (let mode of game.modes) {
            mode.owned = false; // За замовчуванням речі немає
            
            try {
                const assetType = mode.type === 'pass' ? 'GamePass' : 'Badge';
                
                // Звертаємося до НАШОГО PHP-файлу замість сторонніх проксі
                const url = `check_roblox_assets.php?user_id=${userId}&type=${assetType}&id=${mode.id}`;
                const res = await fetch(url);
                
                if (res.ok) {
                    const data = await res.json();
                    // Якщо Roblox повернув масив data і він не порожній - річ є!
                    if (data && (data.owned === true || (data.data && data.data.length > 0))) {
                        mode.owned = true; 
                        console.log(`✅ Знайдено: ${mode.name}`);
                    }
                }
            } catch (e) {
                console.warn(`❌ Помилка перевірки ${mode.id}`);
            }
        }
    }

    console.log("✅ Всі перевірки інвентаря завершено!");
    if (loadingText) loadingText.innerText = "Підключено!";
}

function closeGamesModal() {
    const modal = document.getElementById('games-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}



// ==========================================
// ФІНАЛЬНІ ФУНКЦІЇ ДЛЯ ІГОР ТА БЕЙДЖІВ
// ==========================================

// 1. ГОЛОВНА БІБЛІОТЕКА (Список ігор)
// 1. ГОЛОВНА БІБЛІОТЕКА (Список ігор)
window.loadMainLibrary = function() {
    const grid = document.getElementById('media-grid');
    const backBtn = document.getElementById('modal-back-button');
    const title = document.getElementById('modal-games-main-title');
    const footer = document.getElementById('modal-footer-actions');
    
    if (!grid) return;
    grid.innerHTML = '';
    
    if (backBtn) backBtn.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (title) title.innerText = "Виберіть гру";

    // --- ФІЛЬТРАЦІЯ STEAM ІГОР ---
    // Показуємо всі ігри Roblox, але Steam — ТІЛЬКИ ті, що є у власності користувача
    const availableSteamGames = mySteamLibrary.filter(game => game.owned === true);
    
    // Об'єднуємо відфільтровані масиви
    const allGames = [...myGamesLibrary, ...availableSteamGames];

    if (allGames.length === 0) {
        grid.innerHTML = '<div style="color: #888; padding: 20px; text-align: center; width: 100%;">Немає доступних ігор для відображення.</div>';
        return;
    }

    allGames.forEach(game => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.style.cursor = 'pointer';
        
        const platformIcon = game.platform === 'steam' ? '🚂 Steam' : '🟥 Roblox';
        
        card.onclick = () => window.openGameModes(game.name); 
        
        card.innerHTML = `
            <div class="media-img-container" style="position: relative;">
                <img src="${game.img}" alt="${game.name}">
                <div style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); padding: 2px 6px; border-radius: 4px; font-size: 10px; color: white;">
                    ${platformIcon}
                </div>
            </div>
            <div class="media-title">${game.name}</div>
        `;
        grid.appendChild(card);
    });
};
// 2. ВІДКРИТТЯ КОНКРЕТНОЇ ГРИ (Бейджі)
// Виносимо цю функцію на самий верхній рівень файлу
// 1. Обов'язково оголоси цю змінну на самому початку файлу profile.js
window.openGameModes = function(gameName) {
    console.log("📂 Відкриваю гру:", gameName);
    const grid = document.getElementById('media-grid');
    const title = document.getElementById('modal-games-main-title');
    const backBtn = document.getElementById('modal-back-button');
    const footer = document.getElementById('modal-footer-actions');
    
    if (!grid) return;

    const allGames = [...myGamesLibrary, ...mySteamLibrary];
    const game = allGames.find(g => g.name === gameName);
    if (!game) return;

    if (title) title.innerText = game.name;
    if (backBtn) backBtn.style.display = 'block';
    if (footer) footer.style.display = 'flex';
    
    grid.innerHTML = ''; 

    game.modes.forEach(mode => {
        const card = document.createElement('div');
        card.className = 'media-card';

        // КРИТИЧЕСКИЙ ФИКС: Сравниваем ID как строки, чтобы "steam_730" находилось
        const isOwned = isModeOwned(mode);
        const isSelected = selectedItems.some(item => String(item.id) === String(mode.id));

        if (isSelected) card.classList.add('selected');

        if (!isOwned) {
            card.style.opacity = '0.4';
            card.style.cursor = 'not-allowed';
        } else {
            card.style.cursor = 'pointer';
            card.onclick = () => {
                card.classList.toggle('selected');
                window.toggleModeSelection(game.name, mode, card.classList.contains('selected'));
            };
        }

        card.innerHTML = `
            <div class="media-img-container" style="position: relative;">
                <img src="${mode.img}" alt="${mode.name}" 
                     style="filter: ${isOwned ? 'none' : 'grayscale(100%)'}"
                     onerror="this.src='img/default_game.jpg'">
                ${!isOwned ? '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#ff4500; font-size:30px; text-shadow: 0 0 10px black;">🔒</div>' : ''}
            </div>
            <div class="media-title" style="color: ${isOwned ? '#fff' : '#666'}">${mode.name}</div>
        `;
        grid.appendChild(card);
    });
};

window.openGamesModal = function() {
    const modal = document.getElementById('games-modal');
    const grid = document.getElementById('media-grid');
    const title = document.getElementById('modal-games-main-title');
    const backBtn = document.getElementById('modal-back-button');
    const footer = document.getElementById('modal-footer-actions');

    if (!modal) return;

    // --- НАДІЙНА ПЕРЕВІРКА АВТОРИЗАЦІЇ ROBLOX ---
    let isRobloxConnected = window.isRobloxConnected === true;
    try {
        const robloxData = JSON.parse(localStorage.getItem('roblox_user'));
        if (robloxData && robloxData.id && robloxData.id !== "null") {
            isRobloxConnected = true;
        }
    } catch (e) {
        const rawData = localStorage.getItem('roblox_user');
        if (rawData && rawData !== "null" && rawData !== "{}" && rawData !== "[]") {
             isRobloxConnected = true;
        }
    }

    // --- ПЕРЕВІРКА АВТОРИЗАЦІЇ STEAM ---
    // Беремо флаг, який ми встановили в loadUserData
    let isSteamConnected = window.isSteamConnected === true;

    // Скидаємо базові елементи вікна
    if (grid) grid.innerHTML = '';
    if (backBtn) backBtn.style.display = 'none';
    if (footer) footer.style.display = 'none';

    mySteamLibrary.forEach(game => {
        if (game.owned) {
            const sId = "steam_" + game.appId;
            if (!userInventoryFromDB.some(i => String(i.id) === sId)) {
                userInventoryFromDB.push({ id: sId, owned: true, type: 'steam', game: game.name });
            }
        }
    });

    // ❌ ЯКЩО НЕ АВТОРИЗОВАНИЙ НІ ТАМ, НІ ТАМ: Показуємо кнопку переходу в налаштування
    if (!isRobloxConnected && !isSteamConnected) {
        if (title) title.innerText = "Потрібна авторизація";
        
        if (grid) {
            grid.style.display = 'flex';
            grid.style.flexDirection = 'column';
            grid.style.alignItems = 'center';
            grid.style.justifyContent = 'center';
            grid.style.textAlign = 'center';
            grid.style.padding = '40px 20px';
            grid.style.height = '100%'; 

            grid.innerHTML = `
                <div style="background: rgba(255, 69, 0, 0.1); padding: 20px; border-radius: 12px; border: 1px solid rgba(255, 69, 0, 0.3);">
                    <h3 style="color: white; margin-bottom: 10px;">Бібліотека ігор закрита</h3>
                    <p style="color: #aaa; margin-bottom: 20px; font-size: 14px; max-width: 250px;">
                        Щоб додавати ігри до свого профілю, спочатку підключіть Steam або Roblox в налаштуваннях.
                    </p>
                    <button onclick="window.openIntegrationsTab();" style="background: #ff4500; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; transition: 0.2s;">
                        🔗 Перейти до підключення
                    </button>
                </div>
            `;
        }
    } 
    // ✅ ЯКЩО АВТОРИЗОВАНИЙ ХОЧА Б ДЕСЬ: Малюємо ігри
    else {
        if (grid) {
            grid.style.display = '';
            grid.style.flexDirection = '';
            grid.style.alignItems = '';
            grid.style.justifyContent = '';
            grid.style.padding = '';
            grid.style.height = '';
        }
        
        if (typeof window.loadMainLibrary === 'function') window.loadMainLibrary();
    }

    setTimeout(() => modal.classList.add('active'), 50);
    modal.style.display = 'flex';
};
window.toggleModeSelection = function(gameName, mode, isSelecting) {
    if (isSelecting) {
        if (!selectedItems.some(i => normalizeAssetId(i.id) === normalizeAssetId(mode.id))) {
            selectedItems.push({
                game: gameName,
                id: mode.id,
                name: mode.name,
                img: mode.img
            });
        }
    } else {
        selectedItems = selectedItems.filter(i => normalizeAssetId(i.id) !== normalizeAssetId(mode.id));
    }
    console.log("📦 Поточні вибрані речі:", selectedItems);
};


// --- 6. UTILITIES ---
function closeEditor() { document.getElementById('editor-modal').style.display = 'none'; }

// --- ГЛОБАЛЬНА НАВІГАЦІЯ (ВИПРАВЛЕННЯ ПОМИЛКИ DEFINED) ---
window.switchEditorTab = function(tabName) {
    console.log("📂 Перехід до вкладки:", tabName);
    const tabs = document.querySelectorAll('.editor-tab');
    const buttons = document.querySelectorAll('.sidebar-item');

    tabs.forEach(t => {
        t.style.setProperty('display', 'none', 'important');
        t.classList.remove('active');
    });
    buttons.forEach(b => b.classList.remove('active'));

    const target = document.getElementById('tab-' + tabName);
    if (target) {
        target.style.setProperty('display', 'block', 'important');
        target.classList.add('active');
    }

    buttons.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });
};

window.openIntegrationsTab = function() {
    console.log("🔗 Виклик openIntegrationsTab...");
    const modal = document.getElementById('editor-modal');
    if (modal) modal.style.display = 'flex';
    
    const gamesModal = document.getElementById('games-modal');
    if (gamesModal) {
        gamesModal.style.display = 'none';
        gamesModal.classList.remove('active');
    }
    window.switchEditorTab('integrations');
};
function changeValue(type, delta) {
    const id = type === 'day' ? 'birth-day' : (type === 'month' ? 'birth-month' : 'birth-year');
    const input = document.getElementById(id);
    let val = parseInt(input.value);
    
    if (type === 'day') {
        val += delta;
        if (val < 1) val = 31;
        if (val > 31) val = 1;
    } else if (type === 'month') {
        val += delta;
        if (val < 1) val = 12;
        if (val > 12) val = 1;
    } else if (type === 'year') {
        val += delta;
        if (val < 1950) val = 2026;
        if (val > 2026) val = 1950;
    }
    
    // Добавляем нолик спереди для красоты (01, 02...)
    input.value = val < 10 && type !== 'year' ? '0' + val : val;
}

/* === ДАННЫЕ СТРАН === */
const countriesData = [
    { code: "UA", name: "Україна", flagPath: "img/flag/ua.png" },
    { code: "US", name: "США", flagPath: "img/flag/usa.png" },
    { code: "GB", name: "Велика Британія", flagPath: "img/flag/gb.webp" },
    { code: "PL", name: "Польща", flagPath: "img/flag/polish.webp" },
    { code: "DE", name: "Німеччина", flagPath: "img/flag/german.webp" },
    { code: "FR", name: "Франція", flagPath: "img/flag/fr.webp" },
    { code: "ES", name: "Іспанія", flagPath: "img/flag/ispan.png" },
    { code: "IT", name: "Італія", flagPath: "img/flag/itala.webp" },
    { code: "CA", name: "Канада", flagPath: "img/flag/kanada.webp" },
    { code: "JP", name: "Японія", flagPath: "img/flag/japen.png" },
    { code: "KR", name: "Південна Корея", flagPath: "img/flag/korea.png" },
    { code: "CN", name: "Китай", flagPath: "img/flag/kitai.png" },
    { code: "BR", name: "Бразилія", flagPath: "img/flag/brazil.png" },
    { code: "TR", name: "Туреччина", flagPath: "img/flag/tyrsia.jfif" },
    { code: "NL", name: "Нідерланди", flagPath: "img/flag/niderlandu.webp" },
    { code: "SE", name: "Швеція", flagPath: "img/flag/shesia.webp" },
    { code: "CH", name: "Швейцарія", flagPath: "img/flag/shversaria.jfif" },
    { code: "AU", name: "Австралія", flag: "🇦🇺" },
    { code: "AT", name: "Австрія", flag: "🇦🇹" },
    { code: "BE", name: "Бельгія", flag: "🇧🇪" },
    { code: "BG", name: "Болгарія", flag: "🇧🇬" },
    { code: "GR", name: "Греція", flag: "🇬🇷" },
    { code: "DK", name: "Данія", flag: "🇩🇰" },
    { code: "EE", name: "Естонія", flag: "🇪🇪" },
    { code: "IL", name: "Ізраїль", flag: "🇮🇱" },
    { code: "IE", name: "Ірландія", flag: "🇮🇪" },
    { code: "IS", name: "Ісландія", flag: "🇮🇸" },
    { code: "KZ", name: "Казахстан", flag: "🇰🇿" },
    { code: "LV", name: "Латвія", flag: "🇱🇻" },
    { code: "LT", name: "Литва", flag: "🇱🇹" },
    { code: "LU", name: "Люксембург", flag: "🇱🇺" },
    { code: "MX", name: "Мексика", flag: "🇲🇽" },
    { code: "NO", name: "Норвегія", flag: "🇳🇴" },
    { code: "AE", name: "ОАЕ", flag: "🇦🇪" },
    { code: "PT", name: "Португалія", flag: "🇵🇹" },
    { code: "RO", name: "Румунія", flag: "🇷🇴" },
    { code: "SK", name: "Словаччина", flag: "🇸🇰" },
    { code: "SI", name: "Словенія", flag: "🇸🇮" },
    { code: "HU", name: "Угорщина", flag: "🇭🇺" },
    { code: "FI", name: "Фінляндія", flag: "🇫🇮" },
    { code: "HR", name: "Хорватія", flag: "🇭🇷" },
    { code: "CZ", name: "Чехія", flag: "🇨🇿" },
    { code: "GE", name: "Грузія", flag: "🇬🇪" },
    { code: "AM", name: "Вірменія", flag: "🇦🇲" },
    { code: "AZ", name: "Азербайджан", flag: "🇦🇿" },
    { code: "MD", name: "Молдова", flag: "🇲🇩" },

    // --- ДОДАТКОВІ КРАЇНИ ---
    
    // Європа (інші)
    { code: "AL", name: "Албанія", flag: "🇦🇱" },
    { code: "AD", name: "Андорра", flag: "🇦🇩" },
    { code: "BA", name: "Боснія і Герцеговина", flag: "🇧🇦" },
    { code: "VA", name: "Ватикан", flag: "🇻🇦" },
    { code: "CY", name: "Кіпр", flag: "🇨🇾" },
    { code: "MT", name: "Мальта", flag: "🇲🇹" },
    { code: "MC", name: "Монако", flag: "🇲🇨" },
    { code: "ME", name: "Чорногорія", flag: "🇲🇪" },
    { code: "RS", name: "Сербія", flag: "🇷🇸" },
    { code: "MK", name: "Північна Македонія", flag: "🇲🇰" },

    // Азія
    { code: "IN", name: "Індія", flag: "🇮🇳" },
    { code: "ID", name: "Індонезія", flag: "🇮🇩" },
    { code: "TH", name: "Таїланд", flag: "🇹🇭" },
    { code: "VN", name: "В'єтнам", flag: "🇻🇳" },
    { code: "SG", name: "Сінгапур", flag: "🇸🇬" },
    { code: "MY", name: "Малайзія", flag: "🇲🇾" },
    { code: "PH", name: "Філіппіни", flag: "🇵🇭" },
    { code: "SA", name: "Саудівська Аравія", flag: "🇸🇦" },
    { code: "QA", name: "Катар", flag: "🇶🇦" },
    { code: "UZ", name: "Узбекистан", flag: "🇺🇿" },
    { code: "KG", name: "Киргизстан", flag: "🇰🇬" },

    // Америка (Південна та Центральна)
    { code: "AR", name: "Аргентина", flag: "🇦🇷" },
    { code: "CL", name: "Чилі", flag: "🇨🇱" },
    { code: "CO", name: "Колумбія", flag: "🇨🇴" },
    { code: "PE", name: "Перу", flag: "🇵🇪" },
    { code: "UY", name: "Уругвай", flag: "🇺🇾" },
    { code: "CR", name: "Коста-Рика", flag: "🇨🇷" },
    { code: "PA", name: "Панама", flag: "🇵🇦" },

    // Африка
    { code: "EG", name: "Єгипет", flag: "🇪🇬" },
    { code: "MA", name: "Марокко", flag: "🇲🇦" },
    { code: "ZA", name: "ПАР", flag: "🇿🇦" },
    { code: "NG", name: "Нігерія", flag: "🇳🇬" },
    { code: "TN", name: "Туніс", flag: "🇹🇳" },

    // Океанія
    { code: "NZ", name: "Нова Зеландія", flag: "🇳🇿" }
];
// Переменные для хранения выбора

function openCountryModal() {
    const modal = document.getElementById('region-modal'); // Или 'country-lang-modal', проверь ID в HTML
    if (modal) {
        modal.style.display = 'flex';
        renderLists(); // Рендерим списки при открытии
    }
}
function closeCountryModal() {
    const modal = document.getElementById('region-modal'); 
    if (modal) {
        modal.style.display = 'none';
    }
}

function renderLists() {
    const langContainer = document.getElementById('language-list-container');
    const countryContainer = document.getElementById('country-list-container');
    const searchInput = document.getElementById('country-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

    // Очистка
    if (langContainer) langContainer.innerHTML = '';
    if (countryContainer) countryContainer.innerHTML = '';

    if (!countriesData) return;

    countriesData.forEach(item => {
        // Фильтрация по поиску
        if (item.name.toLowerCase().includes(searchTerm)) {
            
            // Логика картинки или эмодзи
            const flagHtml = item.flagPath 
                ? `<img src="${item.flagPath}" class="flag-img" alt="${item.name}" style="width:20px; margin-right:8px;">` 
                : `<span class="flag-emoji" style="font-size:20px; margin-right:8px;">${item.flag}</span>`;
            
            const itemContent = `${flagHtml}<span class="country-name">${item.name}</span>`;

            // 1. ЛЕВАЯ КОЛОНКА (Языки)
            if (langContainer) {
                const langItem = document.createElement('div');
                // Добавляем класс 'lang-item' чтобы можно было стилизовать отдельно
                langItem.className = `lang-item list-item ${selectedLanguages.includes(item.code) ? 'selected' : ''}`;
                langItem.dataset.code = item.code;
                langItem.innerHTML = itemContent;
                langItem.onclick = () => toggleLanguage(item.code);
                langContainer.appendChild(langItem);
            }

            // 2. ПРАВАЯ КОЛОНКА (Страна)
            if (countryContainer) {
                const countryItem = document.createElement('div');
                // ВАЖНО: Добавляем класс 'country-item'
                countryItem.className = `country-item list-item ${selectedCountry === item.code ? 'selected' : ''}`;
                countryItem.dataset.code = item.code;
                countryItem.innerHTML = itemContent;
                countryItem.onclick = () => selectCountry(item.code);
                countryContainer.appendChild(countryItem);
            }
        }
    });
}

// Логика выбора ОДНОЙ страны (радио-кнопка)
function selectCountry(code) {
    selectedCountry = code; // Записываем в глобальную переменную
    console.log("Выбрана страна:", selectedCountry);
    renderLists(); // Перерисовываем, чтобы появилась подсветка
}
// Логика выбора НЕСКОЛЬКИХ языков (чекбокс)
function toggleLanguage(code) {
    if (selectedLanguages.includes(code)) {
        selectedLanguages = selectedLanguages.filter(lang => lang !== code);
    } else {
        if (selectedLanguages.length >= 4) {
            alert("Можна обрати не більше 4 мов");
            return;
        }
        selectedLanguages.push(code);
    }
    renderLists();
}

// Функция поиска
function filterCountries() {
    renderLists();
}

/// Ця функція викликається, коли ви тиснете "Зберегти зміни"
async function saveRegionSettings() {
    // Перевірка змінної
    if (!selectedCountry) {
        alert("Будь ласка, оберіть країну проживання");
        return;
    }

    const payload = {
        country: selectedCountry,              // "UA"
        languages: selectedLanguages.join(',') // "UA,EN"
    };

    console.log("💾 Отправка на сервер:", payload);

    try {
        const response = await fetch('save_region.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            // --- ЗМІНИ ТУТ ---
            // Ми прибрали renderUserFlags(payload...), щоб не дублювати код.
            // Просто перезавантажуємо сторінку. 
            // Браузер сам запустить loadUserData() і підтягне правильні SVG-прапори з інтернету.
            location.reload(); 

        } else {
            alert("Помилка сервера: " + (result.message || "Невідома помилка"));
        }
    } catch (err) {
        console.error("❌ Помилка збереження:", err);
        alert("Помилка з'єднання");
    }
}
for (let i = 0; i < 24; i++) {
    const cell = document.createElement('div');
    cell.classList.add('hour-cell');
    cell.innerText = i;
    cell.dataset.hour = i;

    // Клик по ячейке
    cell.onclick = () => {
        const currentHour = parseInt(cell.dataset.hour);

        if (firstClick === null) {
            // ПЕРВЫЙ КЛИК: устанавливаем точку старта
            firstClick = currentHour;
            resetGridClasses();
            cell.classList.add('selected');
        } else {
            // ВТОРОЙ КЛИК: фиксируем интервал
            startHour = Math.min(firstClick, currentHour);
            endHour = Math.max(firstClick, currentHour);

            renderSelection(startHour, endHour);
            saveTime(); 
            
            firstClick = null; // Выключаем режим слежения
        }
    };

    // НАВЕДЕНИЕ МЫШКИ: живое обновление полосы
    cell.onmouseenter = () => {
        if (firstClick !== null) {
            // Если первая точка выбрана, подсвечиваем путь до текущей ячейки
            const currentHour = parseInt(cell.dataset.hour);
            const tempMin = Math.min(firstClick, currentHour);
            const tempMax = Math.max(firstClick, currentHour);
            
            renderSelection(tempMin, tempMax);
        }
    };

    grid.appendChild(cell);
}
window.onmouseup = () => {
    if (isDragging) {
        isDragging = false;
        saveTime();
    }
};

function renderSelection(min, max) {
    const cells = document.querySelectorAll('.hour-cell');
    cells.forEach(cell => {
        const h = parseInt(cell.dataset.hour);
        if (h >= min && h <= max) {
            cell.classList.add('selected');
        } else {
            cell.classList.remove('selected');
        }
    });
}

function resetGridClasses() {
    const cells = document.querySelectorAll('.hour-cell');
    cells.forEach(cell => cell.classList.remove('selected'));
}
function updateSelection(current) {
    const cells = document.querySelectorAll('.hour-cell');
    let min = Math.min(startHour, current);
    let max = Math.max(startHour, current);
    
    cells.forEach(cell => {
        const h = parseInt(cell.dataset.hour);
        cell.classList.toggle('selected', h >= min && h <= max);
    });
    endHour = max;
    startHour = min;
}

async function saveTime() {
    // Перевіряємо, чи змінні існують (вони у вас глобальні)
    if (startHour !== null && endHour !== null) {
        
        // 1. ВІЗУАЛЬНЕ ОНОВЛЕННЯ (Те, що у вас вже було)
        const textDisplay = document.getElementById('activityText');
        const trigger = document.getElementById('activityTrigger');
        
        if (textDisplay) textDisplay.innerText = `${startHour}:00 — ${endHour}:00`;
        if (trigger) trigger.classList.add('is-set');
        
        checkStatus(); // Оновлюємо іконку (💤 або 🎮)

        // 2. ВІДПРАВКА НА СЕРВЕР (Цього не вистачало!)
        console.log("💾 Зберігаю час активності:", startHour, endHour);

        try {
            const response = await fetch('update_status.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    start: startHour, 
                    end: endHour 
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log("✅ Час успішно записано в БД!");
            } else {
                console.error("Помилка сервера:", result.message);
            }
        } catch (err) {
            console.error("Помилка з'єднання:", err);
        }
    }
}

function checkStatus() {
    // Если время не выбрано (startHour еще null)
    if (startHour === null || endHour === null) {
        trigger.classList.add('inactive-now');
        trigger.classList.remove('active-now');
        iconDisplay.innerHTML = '🕒'; 
        return;
    }
    
    const now = new Date().getHours();
    const isActive = (startHour <= endHour) 
        ? (now >= startHour && now <= endHour)
        : (now >= startHour || now <= endHour);

    if (isActive) {
        trigger.classList.add('active-now');
        trigger.classList.remove('inactive-now');
        iconDisplay.innerHTML = '🎮';
    } else {
        trigger.classList.add('inactive-now');
        trigger.classList.remove('active-now');
        iconDisplay.innerHTML = '💤';
    }
}

// Открытие/закрытие панели
trigger.onclick = () => picker.style.display = 'block';
document.getElementById('closePicker').onclick = (e) => {
    e.stopPropagation();
    picker.style.display = 'none';
};

// Обновляем статус каждую минуту
setInterval(checkStatus, 60000);


// Функція для отримання імені з Бази Даних (PHP)



function initTimeGrid() {
    const grid = document.getElementById('time-grid'); // Переконайся, що ID вірний
    if (!grid) return;

    // ОЧИЩЕННЯ: видаляємо старі комірки перед створенням нових
    grid.innerHTML = ''; 

    for (let i = 0; i < 24; i++) {
        const cell = document.createElement('div');
        cell.classList.add('hour-cell');
        cell.innerText = i;
        cell.dataset.hour = i;

        // Клик по ячейке
        cell.onclick = () => {
            const currentHour = parseInt(cell.dataset.hour);

            if (firstClick === null) {
                firstClick = currentHour;
                resetGridClasses();
                cell.classList.add('selected');
            } else {
                startHour = Math.min(firstClick, currentHour);
                endHour = Math.max(firstClick, currentHour);
                renderSelection(startHour, endHour);
                saveTime(); 
                firstClick = null;
            }
        };

        // Наведение мышки (живое обновление)
        cell.onmouseenter = () => {
            if (firstClick !== null) {
                const currentHour = parseInt(cell.dataset.hour);
                const tempMin = Math.min(firstClick, currentHour);
                const tempMax = Math.max(firstClick, currentHour);
                renderSelection(tempMin, tempMax);
            }
        };

        grid.appendChild(cell);
    }
}


// ==========================================
// ФУНКЦІЯ ОНОВЛЕННЯ ІМЕНІ (User / Display Name)
// ==========================================
async function updateDisplayName() {
    const nameInput = document.getElementById('edit-display-name');
    
    // Якщо у тебе немає окремої кнопки "Змінити", цей рядок не потрібен,
    // але якщо є — залиш його.
    const changeBtn = document.querySelector('.inline-btn'); 

    if (!nameInput) return;

    // Отримуємо текст (підтримка і input, і звичайного тексту)
    let newName = "";
    if (nameInput.tagName === 'INPUT') {
        newName = nameInput.value.trim();
    } else {
        newName = nameInput.innerText.trim();
    }

    if (!newName) {
        alert("Будь ласка, введіть ім'я");
        return;
    }

    // Візуальний ефект (якщо кнопка є)
    let originalBtnText = "";
    if (changeBtn) {
        originalBtnText = changeBtn.textContent;
        changeBtn.textContent = "Збереження...";
        changeBtn.disabled = true;
    }

    try {
        console.log("📤 Відправляю ім'я:", newName);

        // [ВИПРАВЛЕНО] 
        // 1. Правильне ім'я файлу (як ми створювали раніше)
        // 2. Правильний заголовок (JSON)
        // 3. Правильне тіло (JSON.stringify)
        const response = await fetch('update_user.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_name: newName }) 
        });

        const result = await response.json();

        if (result.success) {
            // 1. Оновлюємо шапку профілю відразу
            const topNameBlock = document.getElementById('userName');
            if (topNameBlock) topNameBlock.textContent = newName;
            
            alert("✅ Ім'я успішно збережено!");
        } else {
            alert("❌ Помилка сервера: " + result.message);
        }
    } catch (error) {
        console.error("Помилка запиту:", error);
        alert("Помилка з'єднання з сервером");
    } finally {
        // Повертаємо кнопку назад
        if (changeBtn) {
            changeBtn.textContent = originalBtnText;
            changeBtn.disabled = false;
        }
    }
}

// ==========================================
// СЛУХАЧ ПОДІЙ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const changeBtn = document.querySelector('.inline-btn');
    if (changeBtn) {
        // Видаляємо старі слухачі (cloneNode трюк), щоб кнопка не натискалася двічі
        const newBtn = changeBtn.cloneNode(true);
        changeBtn.parentNode.replaceChild(newBtn, changeBtn);
        
        // Призначаємо нашу функцію
        newBtn.onclick = updateDisplayName;
    }
});
window.openSettings = function() {
    const modal = document.getElementById('editor-modal');
    if (modal) {
        modal.style.display = 'flex';
        // При відкритті за замовчуванням показуємо вкладку профілю
        window.switchEditorTab('profile');
    }
};
function closeEditor() {
    const modal = document.getElementById('editor-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Додайте також функцію для перемикання вкладок, щоб вони працювали
function switchEditorTab(tabName) {
    // Ховаємо всі вкладки
    const tabs = document.querySelectorAll('.editor-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Прибираємо активний клас у кнопок
    const buttons = document.querySelectorAll('.sidebar-item');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Показуємо потрібну вкладку
    const activeTab = document.getElementById('tab-' + tabName);
    if (activeTab) activeTab.classList.add('active');
    
    // Робимо кнопку активною (через event або пошук тексту)
    event.currentTarget.classList.add('active');
}
async function uploadAvatar(file) {
    let formData = new FormData();
    formData.append('avatar', file); // Ключ 'avatar', який чекає PHP

    try {
        const response = await fetch('upload_avatar.php', {
            method: 'POST',
            body: formData,
            credentials: 'include' // ОБОВ'ЯЗКОВО для Docker/PHP сесій
        });

        const data = await response.json();

        if (data.success) {
            console.log("✅ Аватар успішно збережено!");
            // Оновлюємо картинки на сторінці без перезавантаження
            await loadUserData(); 
        } else {
            alert("Помилка БД: " + data.error);
        }
    } catch (err) {
        console.error("Помилка мережі:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Знаходимо наш інпут
    const avatarInput = document.getElementById('avatar-input');

    if (avatarInput) {
        // Як тільки файл вибрано (подія change)
        avatarInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                console.log("📸 Файл вибрано, починаю завантаження аватара...");
                uploadAvatar(file); // Викликаємо нашу функцію завантаження
            }
        });
    }
});


async function uploadBanner(file) {
    if (!file) return;

    let formData = new FormData();
    formData.append('banner', file);

    try {
        const response = await fetch('upload_avatar.php', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            console.log("✅ Банер оновлено в БД");
            await loadUserData();
        } else {
            alert("Помилка: " + data.error);
        }
    } catch (err) {
        console.error("Помилка завантаження банера:", err);
    }
}

async function directUpload(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const statusText = document.getElementById('upload-status-text');
    if (statusText) statusText.innerText = "⏳ Завантаження...";
    
    console.log("📤 Відправка файлу:", file.name);

    const formData = new FormData();
    formData.append('banner', file);

    try {
        const response = await fetch('upload_avatar.php', {
            method: 'POST',
            body: formData,
            // [КРИТИЧНО] Додаємо куки сесії, щоб PHP знав, який це юзер
            credentials: 'include' 
        });

        const data = await response.json();
        console.log("📥 Відповідь сервера:", data);

        if (data.success) {
            if (statusText) statusText.innerText = "✅ Готово!";
            
            // [ВИПРАВЛЕНО] Логіка шляху. 
            // Якщо PHP повертає "img/file.jpg", ми просто додаємо timestamp.
            // Прибираємо примусовий "/" на початку, якщо ти в Docker.
            let finalUrl = data.url;
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + 't=' + Date.now();

            console.log("🔗 Нова адреса банера:", finalUrl);

            // 1. Оновлюємо фон банера (використовуємо твій ID)
            const profileCard = document.getElementById('profile-banner-bg');
            if (profileCard) {
                profileCard.style.backgroundImage = `url('${finalUrl}')`;
                profileCard.style.backgroundSize = 'cover';
                profileCard.style.backgroundPosition = 'center';
            }
            
            // 2. Оновлюємо прев'ю в налаштуваннях
            const settingsBanner = document.getElementById('settings-banner-img');
            if (settingsBanner) {
                settingsBanner.src = finalUrl;
            }

            // 3. [НАЙКРАЩИЙ ВАРІАНТ] Просто викликаємо твою головну функцію,
            // щоб вона синхронізувала ВСІ дані з бази
            if (typeof loadUserData === 'function') {
                setTimeout(loadUserData, 500); 
            }

        } else {
            alert("Помилка: " + (data.error || "Невідома помилка"));
            if (statusText) statusText.innerText = "❌ Помилка";
        }
    } catch (err) {
        console.error("❌ Критична помилка:", err);
        alert("Помилка з'єднання. Перевір консоль (F12).");
    }
}
async function uploadBackground(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('background', file); 

    try {
        const response = await fetch('upload_avatar.php', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        const data = await response.json();
        if (data.success) {
            console.log("✅ Фон оновлено в БД");
            await loadUserData();
        } else {
            alert("Помилка: " + data.error);
        }
    } catch (err) {
        console.error("Помилка завантаження фону:", err);
    }
}

// 3. Логіка при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    // --- Пошук кнопок ---
    let decoSection = null;
    // Шукаємо секцію по тексту
    document.querySelectorAll('.setting-item').forEach(item => {
        if (item.textContent.includes('ПРИКРАСА АВАТАРА')) decoSection = item;
    });
    // Якщо не знайшли, запасний варіант (але краще по тексту)
    if (!decoSection) decoSection = document.querySelectorAll('.setting-item')[2];

    const selectDecoBtn = decoSection ? decoSection.querySelector('.inline-btn') : null;
    const removeDecoBtn = decoSection ? decoSection.querySelector('.btn-danger-outline') : null;
    const decoModal = document.getElementById('deco-modal');

    // --- Обробники подій ---

    // 1. Кнопка "Обрати прикрасу" -> Відкрити модалку
    if (selectDecoBtn) {
        selectDecoBtn.onclick = (e) => {
            e.preventDefault();
            if (decoModal) decoModal.style.display = 'flex';
        };
    }

    // 2. Кнопка "Видалити" -> Викликаємо функцію видалення
    if (removeDecoBtn) {
        removeDecoBtn.onclick = (e) => {
            e.preventDefault();
            window.removeDecoration(); // Викликаємо нашу головну функцію
        };
    }

    // 3. Вибір відео в модалці (Тут треба додати логіку кліку на відео)
    document.querySelectorAll('.deco-item').forEach(item => {
        const video = item.querySelector('video');
        
        // Грати при наведенні (твоя логіка)
        if (video) {
            item.onmouseenter = () => video.play().catch(() => {});
            item.onmouseleave = () => { video.pause(); video.currentTime = 0; };
        }

        // КЛІК ПО ПРИКРАСІ -> ВСТАНОВИТИ
        item.onclick = () => {
            if (video) {
                const src = video.getAttribute('src'); // Отримуємо посилання на відео
                applyDecoration(src); // Встановлюємо
                if (decoModal) decoModal.style.display = 'none'; // Закриваємо модалку
            }
        };
    });

    // 4. Закриття модалки при кліку на фон
    window.onclick = (event) => {
        if (event.target === decoModal) {
            decoModal.style.display = 'none';
        }
    };

    // --- ГОЛОВНА ПЕРЕВІРКА ПРИ ЗАВАНТАЖЕННІ ---
    const savedDeco = localStorage.getItem('user_decoration');
    
    if (savedDeco) {
        // Якщо є збережене - показуємо
        applyDecoration(savedDeco);
    } else {
        // Якщо немає - гарантовано ховаємо (на випадок, якщо в HTML щось лишилось)
        const square = document.querySelector('.transparent-square');
        if (square) square.style.display = 'none';
    }
});

// Додаємо обробник для кнопки видалення в DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const removeBtn = document.querySelector('.btn-danger-outline') || document.querySelector('button[style*="color: red"]');
    if (removeBtn) {
        removeBtn.onclick = (e) => {
            e.preventDefault();
            window.removeDecoration();
        };
    }
    
    // Автозавантаження при старті
    const saved = localStorage.getItem('user_decoration');
    if (saved) window.applyDecoration(saved);
});

// Функція для збереження додаткового email
function saveSecondaryEmail() {
    const emailInput = document.getElementById('edit-secondary-email');
    const newEmail = emailInput.innerText.trim();

    if (newEmail && !validateEmail(newEmail)) {
        alert("Будь ласка, введіть коректний email.");
        return;
    }

    // Зберігаємо в локальне сховище (поки немає сервера)
    localStorage.setItem('user_secondary_email', newEmail);
    
    alert("Додатковий email збережено!");
}

// Допоміжна функція валідації
function validateEmail(email) {
    return String(email)
        .toLowerCase()
        .match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
}

// Додай це всередину функції loadUserData, щоб email підтягувався при вході
function loadSecondaryEmail() {
    const savedEmail = localStorage.getItem('user_secondary_email');
    const emailInput = document.getElementById('edit-secondary-email');
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
    }
}

// Виклич loadSecondaryEmail() при завантаженні сторінки
document.addEventListener('DOMContentLoaded', loadSecondaryEmail);

function displayUserFlags(countryCode, languagesIconsString) {
    const flagsContainer = document.getElementById('userFlags');
    if (!flagsContainer) return;

    flagsContainer.innerHTML = ''; // Очищуємо перед заповненням

    // 1. Додаємо прапор країни проживання
    if (countryCode) {
        // Шукаємо шлях до фото в твоєму масиві countriesData
        const country = countriesData.find(c => c.code === countryCode);
        if (country && country.flagPath) {
            const img = document.createElement('img');
            img.src = country.flagPath;
            img.title = "Країна: " + country.name;
            flagsContainer.appendChild(img);
        }
    }

    // 2. Додаємо розділювач, якщо є і країна, і мови
    if (countryCode && languagesIconsString) {
        const separator = document.createElement('span');
        separator.innerText = '/';
        separator.style.color = 'gray';
        separator.style.margin = '0 4px';
        flagsContainer.appendChild(separator);
    }

    // 3. Додаємо іконки мов (розбиваємо рядок з БД назад у масив)
    if (languagesIconsString) {
        const icons = languagesIconsString.split(',');
        icons.forEach(path => {
            if (path) {
                const img = document.createElement('img');
                img.src = path;
                flagsContainer.appendChild(img);
            }
        });
    }
}

function renderUserFlags(countryCode, langsString) {
    const container = document.getElementById('userFlags');
    if (!container) return;

    container.innerHTML = ''; // Очищуємо попередні прапорці

    // 1. Обробка КРАЇНИ проживання
    if (countryCode) {
        // Шукаємо країну в наявному масиві за кодом
        const country = countriesData.find(c => c.code === countryCode.trim().toUpperCase());
        if (country) {
            container.appendChild(createFlagElement(country));
        }
    }

    // Розділювач "/"
    if (countryCode && langsString) {
        const sep = document.createElement('span');
        sep.innerText = '/';
        sep.style.margin = "0 8px";
        sep.style.opacity = "0.5";
        container.appendChild(sep);
    }

    // 2. Обробка МОВ спілкування
    if (langsString) {
        const codes = langsString.split(',');
        codes.forEach(code => {
            const cleanCode = code.trim().toUpperCase();
            const lang = countriesData.find(c => c.code === cleanCode);
            if (lang) {
                container.appendChild(createFlagElement(lang));
            }
        });
    }
}

// Допоміжна функція для створення або IMG або SPAN (для емодзі)
function createFlagElement(data) {
    if (data.flagPath) {
        // Якщо в масиві є шлях до локального файлу
        const img = document.createElement('img');
        img.src = data.flagPath;
        img.alt = data.name;
        img.title = data.name;
        img.style.width = "24px";
        img.style.height = "auto";
        img.style.marginLeft = "4px";
        return img;
    } else {
        // Якщо є тільки емодзі (для додаткових країн)
        const span = document.createElement('span');
        span.innerText = data.flag;
        span.title = data.name;
        span.style.fontSize = "20px";
        span.style.marginLeft = "4px";
        return span;
    }
}

function updateGradientPreview() {
    const leftInput = document.getElementById('color-left');
    const rightInput = document.getElementById('color-right');
    const previewBox = document.getElementById('gradient-preview-box');

    if (leftInput && rightInput && previewBox) {
        const colorL = leftInput.value;
        const colorR = rightInput.value;

        // Оновлюємо прямокутник прев'ю
        previewBox.style.background = `linear-gradient(135deg, ${colorL}, ${colorR})`;

        // Оновлюємо колір самих кружечків (піпеток)
        if (leftInput.parentElement) leftInput.parentElement.style.backgroundColor = colorL;
        if (rightInput.parentElement) rightInput.parentElement.style.backgroundColor = colorR;
    }
}
// 2. Функція збереження градієнта в БД
async function applyGradientToBlock() {
    const colorL = document.getElementById('color-left').value;
    const colorR = document.getElementById('color-right').value;
    const btn = document.querySelector('.confirm-btn');

    // Анімація кнопки
    const originalText = btn.innerText;
    btn.innerText = "Збереження...";
    btn.disabled = true;

    try {
        const response = await fetch('update_gradient.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ color_left: colorL, color_right: colorR })
        });

        const result = await response.json();

        if (result.success) {
            const newGradient = `linear-gradient(135deg, ${colorL}, ${colorR})`;

            // Створюємо список усіх блоків, які мають змінити колір
            const targetBlocks = [
                document.querySelector('.fade-rectangle'),
                document.getElementById('userBioDisplay'),
                document.querySelector('.roblox-profile-section'),
                document.querySelector('.profile-sidebar-card') // Твій новий блок тут
            ];

            // Проходимо циклом по всіх знайдених блоках і міняємо фон
            targetBlocks.forEach(block => {
    if (block) {
        block.style.background = newGradient;
        block.style.backgroundSize = "101% 101%"; // Трохи більше за блок
        block.style.backgroundPosition = "center";
    }
});

            alert("✅ Градієнт успішно збережено!");
        } else {
            alert("❌ Помилка: " + result.message);
        }
    } catch (error) {
        console.error("Помилка:", error);
        alert("Помилка з'єднання з сервером.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// ГЛОБАЛЬНІ ЗМІННІ (Вставте це на початку файлу)
// ==========================================
const badgeImages = {
    'vip': 'img/badge 1.png',
    'admin': 'img/badge 2.png',
    'verified': 'img/badge 3.png',
    'bug_hunter': 'img/badge 4.png',
    'creative': 'img/badge 5.png'
};

// Клік по бейджу (вибір/скасування)
function toggleBadge(element) {
    // 1. Перевіряємо, чи цей бейдж вже вибраний зараз
    // (Браузери можуть зберігати колір як rgb(255, 69, 0) або hex #ff4500, тому перевіряємо обидва варіанти)
    const isSelected = (element.style.borderColor === 'rgb(255, 69, 0)' || element.style.borderColor === '#ff4500');

    if (isSelected) {
        // === ЯКЩО ВЖЕ ВИБРАНИЙ -> ЗНІМАЄМО ВИДІЛЕННЯ ===
        // Знімати виділення можна завжди, ліміт тут не важливий
        element.style.borderColor = '#444';
        element.style.background = '#222';
    } else {
        // === ЯКЩО ХОЧЕМО ВИБРАТИ НОВИЙ -> ПЕРЕВІРЯЄМО ЛІМІТ ===
        
        // а) Рахуємо, скільки бейджів вже світяться помаранчевим
        let count = 0;
        const allBadges = document.querySelectorAll('.badge-item');
        allBadges.forEach(badge => {
            if (badge.style.borderColor === 'rgb(255, 69, 0)' || badge.style.borderColor === '#ff4500') {
                count++;
            }
        });

        // б) Якщо вже вибрано 5 (або більше) -> забороняємо і показуємо попередження
        if (count >= 5) {
            alert("Максимум можна обрати 5 бейджів!");
            return; // Зупиняємо функцію, нічого не змінюємо
        }

        // в) Якщо ліміт не перевищено -> виділяємо
        element.style.borderColor = '#ff4500';
        element.style.background = '#331a15';
    }
}

function openBadgesModal() {
    document.getElementById('badges-modal').style.display = 'flex';
}

function closeBadgesModal() {
    document.getElementById('badges-modal').style.display = 'none';
}

// 3. Вибір бейджа (Клік по картинці)
function toggleBadge(element) {
    // Перевіряємо, чи вибраний елемент (за кольором рамки)
    const isSelected = (element.style.borderColor === 'rgb(255, 69, 0)' || element.style.borderColor === '#ff4500');

    if (isSelected) {
        // Якщо вже вибраний -> знімаємо виділення
        element.style.borderColor = '#444';
        element.style.background = '#222';
    } else {
        // Якщо хочемо вибрати -> перевіряємо ліміт (макс 5)
        let count = 0;
        document.querySelectorAll('.badge-item').forEach(item => {
            if (item.style.borderColor === 'rgb(255, 69, 0)' || item.style.borderColor === '#ff4500') {
                count++;
            }
        });

        if (count >= 5) {
            alert("Максимум можна обрати 5 бейджів!");
            return;
        }

        // Виділяємо
        element.style.borderColor = '#ff4500';
        element.style.background = '#331a15';
    }
}

async function saveBadgesSelection() {
    console.log("💾 Починаємо збереження бейджів...");

    const badgeItems = document.querySelectorAll('.badge-item');
    let selectedBadges = [];

    // Збираємо вибрані бейджі
    badgeItems.forEach(item => {
        // Перевіряємо обидва варіанти кольору (HEX і RGB)
        if (item.style.borderColor === 'rgb(255, 69, 0)' || item.style.borderColor === '#ff4500') {
            selectedBadges.push(item.getAttribute('data-badge'));
        }
    });

    console.log("Масив для відправки:", selectedBadges);

    // 1. Спочатку оновлюємо вигляд на сторінці (щоб було миттєво)
    renderBadgesOnProfile(selectedBadges);
    closeBadgesModal();

    // 2. Відправляємо на сервер
    try {
        const response = await fetch('save_badges.php', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' // <--- ЦЕ ДУЖЕ ВАЖЛИВО!
            },
            body: JSON.stringify({ badges: selectedBadges })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log("✅ Успішно збережено в базі:", result.saved);
        } else {
            console.error("❌ Помилка сервера:", result.message);
            alert("Помилка збереження: " + result.message);
        }
    } catch (err) {
        console.error("❌ Помилка мережі:", err);
    }
}

// 5. Функція відображення бейджів у профілі
function renderBadgesOnProfile(badgesArray) {
    const displayArea = document.getElementById('badges-display-area');
    if (!displayArea) return;

    // Очищення, якщо нічого не вибрано
    if (!badgesArray || badgesArray.length === 0 || (badgesArray.length === 1 && badgesArray[0] === "")) {
        displayArea.innerHTML = '<span style="font-size: 12px; color: #444;">Немає бейджів</span>';
        displayArea.classList.remove('has-items');
        return;
    }

    let html = '';
    badgesArray.forEach(badgeName => {
        // Беремо шлях до картинки з нашого об'єкта badgeImages
        const imagePath = badgeImages[badgeName];
        
        if (imagePath) {
            html += `<img src="${imagePath}" alt="${badgeName}" title="${badgeName}">`;
        }
    });

    displayArea.innerHTML = html;
    displayArea.classList.add('has-items');
}

// --- ФУНКЦІЇ БЛОГУ ---

function openBlogModal() {
    document.getElementById('blog-modal-overlay').style.display = 'flex';
}

function closeBlogModal() {
    document.getElementById('blog-modal-overlay').style.display = 'none';
}

// Функція для відправки повідомлення (візуально)
function sendBlogMessage() {
    const input = document.getElementById('blog-input');
    const text = input.value.trim();
    
    if (text) {
        const chatArea = document.getElementById('chat-messages-area');
        
        // Створюємо нову бульку повідомлення
        const newMsg = document.createElement('div');
        newMsg.classList.add('message-bubble');
        // Робимо його "своїм" (справа), якщо це коментар
        newMsg.style.alignSelf = 'flex-end'; 
        newMsg.style.background = '#2b5278'; // Інший колір для своїх повідомлень
        
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        newMsg.innerHTML = `${text} <div class="message-date">${time}</div>`;
        
        chatArea.appendChild(newMsg);
        
        // Прокрутка вниз
        chatArea.scrollTop = chatArea.scrollHeight;
        
        input.value = ''; // Очистити поле
    }
}
function updateProfileGifts() {
    const giftArea = document.getElementById('gifts-display-area');
    if (!giftArea) return;

    // Читаємо з того ж ключа 'my_shared_gifts'
    const gifts = JSON.parse(localStorage.getItem('my_shared_gifts')) || [];

    if (gifts.length > 0) {
        giftArea.innerHTML = ''; // Прибираємо "Подарунків немає"
        
        gifts.forEach(gift => {
            const img = document.createElement('img');
            img.src = gift.src;
            img.title = gift.name;
            img.style.width = '35px';
            img.style.height = '35px';
            img.style.margin = '5px';
            img.style.borderRadius = '5px';
            giftArea.appendChild(img);
        });
    }
}


// ==========================================
// ФУНКЦІЯ ВИДАЛЕННЯ АВАТАРКИ
// ==========================================
async function deleteAvatar() {
    // 1. Запитуємо підтвердження

    const btn = document.querySelector('.btn-danger-outline');
    const originalText = btn ? btn.innerText : 'Видалити';

    try {
        if (btn) {
            btn.innerText = "⏳...";
            btn.disabled = true;
        }

        // 2. Відправляємо запит на сервер
        const response = await fetch('delete_avatar.php', {
            method: 'POST',
            credentials: 'include' // Важливо для сесій
        });

        const result = await response.json();

        if (result.success) {
            // 3. МИТТЄВО змінюємо картинки на дефолтні
            const defaultSrc = "img/default_avatar.png"; // Перевір, чи є у тебе ця картинка в папці img!
            
            // Аватар у шапці
            const navAvatar = document.getElementById('top-nav-avatar');
            if (navAvatar) navAvatar.src = defaultSrc;

            // Аватар у налаштуваннях (великий)
            const settingsAvatar = document.getElementById('settings-avatar-img');
            if (settingsAvatar) settingsAvatar.src = defaultSrc;

            // Аватар у профілі (якщо є)
            const profileAvatar = document.querySelector('.profile-avatar');
            if (profileAvatar) profileAvatar.src = defaultSrc;

        } else {
            alert("Помилка: " + result.message);
        }

    } catch (err) {
        console.error("Помилка видалення:", err);
        alert("Помилка з'єднання з сервером");
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

// ==========================================
// ВИДАЛЕННЯ БАНЕРА
// ==========================================
async function deleteBanner() {

    const btn = document.getElementById('btn-del-banner');
    if (btn) btn.disabled = true;

    try {
        const response = await fetch('delete_banner.php', { method: 'POST', credentials: 'include' });
        const result = await response.json();

        if (result.success) {
            const defaultSrc = "img/default_banner.png"; // Переконайся, що файл існує!
            
            // 1. Оновлюємо картку профілю
            const bannerBlock = document.getElementById('profile-banner-bg');
            if (bannerBlock) {
                bannerBlock.style.backgroundImage = `url("${defaultSrc}")`;
            }

            // 2. Оновлюємо прев'ю в налаштуваннях
            const settingsBanner = document.getElementById('settings-banner-img');
            if (settingsBanner) settingsBanner.src = defaultSrc;

        } else {
            alert("Помилка: " + result.message);
        }
    } catch (err) {
        console.error(err);
        alert("Помилка з'єднання");
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ==========================================
// ВИДАЛЕННЯ ФОНУ САЙТУ
// ==========================================
async function deleteBackground() {


    const btn = document.getElementById('btn-del-bg');
    if (btn) btn.disabled = true;

    try {
        const response = await fetch('delete_background.php', { method: 'POST', credentials: 'include' });
        const result = await response.json();

        if (result.success) {
            const defaultSrc = "img/default_bg.png"; // Переконайся, що файл існує!

            // Оновлюємо фон сторінки
            Object.assign(document.body.style, {
                backgroundImage: `url('${defaultSrc}')`,
                backgroundSize: 'cover',
                backgroundAttachment: 'fixed'
            });

           
        } else {
            alert("Помилка: " + result.message);
        }
    } catch (err) {
        console.error(err);
        alert("Помилка з'єднання");
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Цей код змусить кнопку працювати в обхід усіх інших скриптів
    document.addEventListener('DOMContentLoaded', () => {
        const backBtn = document.querySelector('.back-home-btn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Зупиняємо інші скрипти
                e.preventDefault();  // Скидаємо стандартну поведінку
                window.location.replace('home.html'); // Примусовий перехід
            }, true); // true - це магія, яка запускає клік найпершим
        }
    });



// ==========================================
// БРОНЕБІЙНИЙ ЗАПУСК МОДАЛКИ (Без прив'язки до ID)
// ==========================================
document.addEventListener('click', function(e) {
    const gamesBtn = e.target.closest('#edit-games-btn');
    if (gamesBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openGamesModal === 'function') {
            window.openGamesModal();
        }
    }
}, true);

window.toggleModeSelection = function(gameName, mode, isSelecting) {
    if (isSelecting) {
        // Додаємо в масив, якщо там ще немає такого ID
        if (!selectedItems.some(i => normalizeAssetId(i.id) === normalizeAssetId(mode.id))) {
            selectedItems.push({
                game: gameName,
                id: mode.id,
                name: mode.name,
                img: mode.img
            });
        }
    } else {
        // Видаляємо з масиву, якщо користувач "відтиснув" картку
        selectedItems = selectedItems.filter(i => normalizeAssetId(i.id) !== normalizeAssetId(mode.id));
    }
    console.log("📦 Поточні вибрані речі:", selectedItems);
};

// 2. Жорстко перевіряємо сторінку ПІСЛЯ всіх завантажень
function displayRobloxData(data) {
    const container = document.getElementById('roblox-games-render-zone');
    if (!container) return;

    container.innerHTML = ''; 

    if (!data || !data.stats || data.stats.length === 0) return;

    const styleId = 'roblox-scroll-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .roblox-badges-scroll::-webkit-scrollbar { width: 3px; }
            .roblox-badges-scroll::-webkit-scrollbar-track { background: transparent; }
            /* Робимо повзунок скролу темнішим рожевим під новий дизайн */
            .roblox-badges-scroll::-webkit-scrollbar-thumb { background: #c482a5; border-radius: 2px; }
        `;
        document.head.appendChild(style);
    }

    const groups = {};
    data.stats.forEach(item => {
        if (!groups[item.game]) groups[item.game] = [];
        groups[item.game].push(item);
    });

    for (const gameName in groups) {
        const allGamesList = [...(typeof myGamesLibrary !== 'undefined' ? myGamesLibrary : []), ...(typeof mySteamLibrary !== 'undefined' ? mySteamLibrary : [])];
        const libraryGame = allGamesList.find(g => g.name === gameName) || null;
        const mainGameImg = libraryGame ? libraryGame.img : 'img/default_game.jpg';
        const platform = libraryGame ? libraryGame.platform : 'roblox'; // Визначаємо платформу
        
        let contentHtml = '';

        // === РОЗДІЛЯЄМО ЛОГІКУ ДЛЯ STEAM ТА ROBLOX ===
        if (platform === 'steam') {
            // Для Steam беремо текст годин (він лежить в name)
            const playtimeText = groups[gameName][0].name;
            contentHtml = `
                <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; padding-top: 15px;">
                    <span style="color: #371A28; font-weight: bold; font-size: 14px;">${playtimeText}</span>
                </div>
            `;
        } else {
            // Для Roblox залишаємо список бейджів (Змінено кольори на темний текст і рожеві галочки)
            contentHtml = groups[gameName].map(badge => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 12px; color: #1A1A1A; font-weight: 500;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        ${badge.name}
                    </span>
                    <span style="color: #F70087; font-size: 12px; font-weight: bold;">✔</span>
                </div>
            `).join('');
        }

        const gameCard = document.createElement('div');
        // Змінено фон на світло-рожевий, прибрано рамки
        gameCard.style.cssText = `
            background: #E6AEC9; border: none; border-radius: 12px;
            width: 140px; height: 230px; overflow: hidden; display: flex; flex-direction: column;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin-bottom: 10px; transition: transform 0.2s;
        `;
        // Залишаємо тільки анімацію підйому при наведенні
        gameCard.onmouseover = () => { gameCard.style.transform = "translateY(-3px)"; };
        gameCard.onmouseout = () => { gameCard.style.transform = "translateY(0)"; };

        gameCard.innerHTML = `
            <div style="width: 100%; height: 130px; position: relative;">
                <img src="${mainGameImg}" style="width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; border-radius: 12px 12px 0 0;" onerror="this.src='https://via.placeholder.com/140x150?text=Game'">
                <div style="position: absolute; bottom: 0; width: 100%; height: 40px; background: linear-gradient(to top, #E6AEC9, transparent);"></div>
                ${platform === 'steam' ? '<div style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); font-size: 10px; padding: 2px 6px; border-radius: 4px; color: white;">🚂 Steam</div>' : ''}
            </div>
            <div style="padding: 10px; padding-top: 5px; flex-grow: 1;">
                <div style="font-weight: 800; font-size: 15px; color: #1A1A1A; margin-bottom: 5px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${gameName}
                </div>
                <div class="roblox-badges-scroll" style="height: ${platform === 'steam' ? '100%' : '65px'}; overflow-y: auto;">
                    ${contentHtml}
                </div>
            </div>
        `;
        container.appendChild(gameCard);
    }
}
function initProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');
    if (!targetId) return;
    
    fetch(`get_profile_data.php?id=${targetId}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const elFollowers = document.getElementById('followers-count');
                const elFollowing = document.getElementById('following-count');
                const elRep = document.getElementById('reputation-val');
                const subBtn = document.querySelector('.subscribe-btn');

                if (elFollowers) elFollowers.innerText = data.followers_count || 0;
                if (elFollowing) elFollowing.innerText = data.following_count || 0;
                if (elRep) elRep.innerText = data.reputation || 0;

                if (subBtn) {
                    if (data.is_own_profile) {
                        subBtn.style.display = 'none';
                    } else {
                        if (data.is_following) {
                            subBtn.classList.add('active');
                            subBtn.querySelector('span').innerText = 'Відписатися';
                        } else {
                            subBtn.classList.remove('active');
                            subBtn.querySelector('span').innerText = 'Підписатися';
                        }
                    }
                }
            }
        }).catch(err => console.error("Помилка ініціалізації профілю:", err));
}

async function checkChatAccess() {
    // Отримуємо ID користувача, чий профіль ми відвідали, з URL
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');

    if (!targetId) return;

    try {
        const response = await fetch(`check_mutual.php?target_id=${targetId}`, { credentials: 'include' });
        const data = await response.json();

        if (data.success && data.is_mutual) {
            // Якщо підписка взаємна — перенаправляємо на home.html з параметром чату
            window.location.href = `home.html?open_chat=${targetId}`;
        } else {
            // Якщо ні — показуємо стильне вікно (або звичайний alert для початку)
            alert("❌ Чат недоступний. Ви або цей користувач ще не підписані один на одного. Спілкування можливе тільки при взаємній підписці!");
        }
    } catch (e) {
        console.error("Помилка перевірки підписки:", e);
        alert("Сталася помилка при спробі відкрити чат.");
    }
}

window.startRobloxAuth = function() {
    console.log("🚀 Запуск авторизації Roblox...");
    const authUrl = `https://apis.roblox.com/oauth/v1/authorize?` + 
                    `client_id=${clientId}&` +
                    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                    `scope=openid profile&` +
                    `response_type=code`;
    window.location.href = authUrl;
};

window.handleRobloxCallback = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        // Видаляємо код з URL відразу, щоб при рефреші не було повтору
        window.history.replaceState({}, document.title, window.location.pathname);
        
        console.log("🔄 Обмін коду на дані...");
        await window.exchangeCodeForData(code);
        
        // Після успішної авторизації - примусово оновити дані
        await loadUserData(); 
    }
};
async function confirmSelection() {
    if (selectedItems.length === 0) {
        alert("Оберіть хоча б одну гру!");
        return;
    }

    try {
        const response = await fetch('save_roblox_games.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ games: selectedItems })
        });

        const result = await response.json();

        if (result.success) {
            // МИТТЄВО малюємо вибране
            displayRobloxData({ stats: selectedItems });
            closeGamesModal();
            
            // Оновлюємо локальну копію
            localStorage.setItem('roblox_user', JSON.stringify({stats: selectedItems}));
            console.log("✅ Збережено в БД та оновлено візуально");
        } else {
            // ДОДАНО: Якщо БД не зберегла, ми побачимо чому!
            alert("❌ Помилка БД: " + result.message);
        }
    } catch (err) {
        console.error("Помилка збереження ігор:", err);
    }
}

window.checkSteamGamesOwnership = async function(steamId) {
    console.log("🎮 Начинаю детальную проверку библиотеки Steam для ID:", steamId);
    
    try {
        const response = await fetch(`check_steam_games.php?steam_id=${steamId}`);
        const result = await response.json();

        if (result.private) {
            console.warn(result.message || "Steam did not return owned games.");
        }

        if (result.success && result.owned_games) {
            console.log("--- [РЕЗУЛЬТАТЫ ПРОВЕРКИ STEAM] ---");
            let foundCount = 0;

            mySteamLibrary.forEach(game => {
                const appIdStr = String(game.appId);
                
                // ШУКАЄМО ГРУ: Тепер очікуємо, що owned_games - це масив об'єктів {appid, playtime_forever}
                // (Але залишаємо сумісність, якщо сервер віддасть просто масив ID)
                const steamGameData = result.owned_games.find(g => 
                    String(g.appid || g) === appIdStr
                );
                
                if (steamGameData) {
                    game.owned = true;
                    foundCount++;

                    // РОЗРАХУНОК ГОДИН (playtime_forever повертається Steam у хвилинах)
                    const playtime = steamGameData.playtime_forever ?? steamGameData.playtime ?? 0;
                    const hours = Math.floor(Number(playtime) / 60);

                    // ОНОВЛЮЄМО ТЕКСТ (Замість "Гра в бібліотеці" пишемо години)
                    if (game.modes && game.modes.length > 0) {
                        game.modes[0].name = `${hours} год. зіграно`;
                        game.modes[0].owned = true;
                    }

                    console.log(`✅ Найдено: ${game.name} (${hours} часов)`);
                    
                    const steamModeId = "steam_" + appIdStr;
                    if (!userInventoryFromDB.some(item => String(item.id) === steamModeId)) {
                        userInventoryFromDB.push({ id: steamModeId, owned: true, type: 'steam', game: game.name });
                    }
                } else {
                    console.warn(`❌ Игра не найдена: ${game.name}`);
                    game.owned = false;
                    if (game.modes && game.modes[0]) game.modes[0].owned = false;
                }
            });

            console.log(`-----------------------------------`);
            console.log(`Итого найдено игр: ${foundCount} из ${mySteamLibrary.length}`);

            const modal = document.getElementById('games-modal');
            if (modal && modal.classList.contains('active')) {
                if (typeof window.loadMainLibrary === 'function') {
                    window.loadMainLibrary(); 
                }
            }
        } else {
            console.error("❌ Steam API не вернул список игр.");
        }
    } catch (err) {
        console.error("❌ Ошибка (Steam Check):", err);
    }
};


function setLanguage(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    console.log("Мова змінена на:", lang);
    // Тут логіка зміни мови
}

function setTheme(theme) {
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    if (theme === 'dark') {
        document.getElementById('theme-dark').classList.add('active');
    } else {
        document.getElementById('theme-light').classList.add('active');
    }
    console.log("Тема змінена на:", theme);
    // Тут логіка зміни теми (наприклад, додавання класу до body)
}

// === 1. ЛОГИКА ТЕМЫ (Оставляем как было) ===
window.setTheme = function(theme) {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        document.getElementById('theme-light')?.classList.add('active');
        document.getElementById('theme-dark')?.classList.remove('active');
    } else {
        document.body.classList.remove('light-theme');
        document.getElementById('theme-dark')?.classList.add('active');
        document.getElementById('theme-light')?.classList.remove('active');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
});


// === 2. ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ЦВЕТА КРУЖОЧКА ===
function setOnlineStatus(isOnline) {
    const statusDot = document.getElementById('status-dot');
    if (!statusDot) return;

    if (isOnline) {
        statusDot.classList.remove('status-offline');
        statusDot.classList.add('status-online');
    } else {
        statusDot.classList.remove('status-online');
        statusDot.classList.add('status-offline');
    }
}


// === 3. ПРОВЕРКА ЧУЖОГО ПРОФИЛЯ С ЛОГАМИ ===
async function loadProfileStatus(profileUserId) {
    console.log("👉 1. Початок перевірки. Шукаємо онлайн для ID:", profileUserId);
    
    try {
        const response = await fetch(`get_online_status.php?user_id=${profileUserId}`);
        const text = await response.text(); 
        
        console.log("📩 2. Що відповів сервер (PHP):", text);
        
        const data = JSON.parse(text);
        console.log("🟢 3. Фінальний статус з бази:", data.online ? "ОНЛАЙН (true)" : "ОФФЛАЙН (false)");
        
        setOnlineStatus(data.online);
    } catch (error) {
        console.error("❌ ПОМИЛКА під час перевірки:", error);
        setOnlineStatus(false);
    }
}


// === 4. САМОЕ ГЛАВНОЕ: ЗАПУСК ПРОВЕРКИ ПРИ ЗАГРУЗКЕ ===
document.addEventListener('DOMContentLoaded', () => {
    // Шукаємо ID у посиланні (наприклад, ?id=5)
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id'); 

    if (profileId) {
        // Якщо ми зайшли на ЧУЖИЙ профіль (є ID у посиланні) — перевіряємо його статус у базі
        console.log("🔍 Знайдено чужий ID у посиланні:", profileId);
        loadProfileStatus(profileId);
    } else {
        // Якщо ID немає — це ТВІЙ ВЛАСНИЙ профіль. 
        // А на своєму профілі ти завжди онлайн!
        console.log("🏠 Це твій власний профіль (ID в посиланні немає). Вмикаємо зелений.");
        setOnlineStatus(true);
    }
});

// === 5. ТВОЙ ПУЛЬС (Ты отправляешь сигнал, что ТЫ онлайн) ===
setInterval(() => {
    fetch('update_online_status.php').catch(() => {}); // catch убирает лишние ошибки в консоли
}, 120000); 

fetch('update_online_status.php').catch(() => {}); // Сигнал при входе на сайт
