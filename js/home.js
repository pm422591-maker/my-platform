const postBackups = {}; 
let currentTargetBox = null;
window.currentActiveSquare = null;
// ГЛОБАЛЬНІ ЗМІННІ
if (!window.commentsData) { window.commentsData = {}; }
let currentActiveTarget = null;
let app, auth, db; // Змінні залишаємо, щоб вони були доступні
let currentTab = 'feed';
window.currentComments = [];
window.currentSelectedMsgId = null; // Змінна для зберігання ID повідомлення
window.currentSelectedTrack = null; // Тут будемо зберігати об'єкт пісні
window.selectedSticker = {};


window.appleEmojis = {
    '❤️': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2764-fe0f.png',
    '👍': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f44d.png',
    '👎': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f44e.png',
    '🔥': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f525.png',
    '😂': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f602.png'
};
// 1. ІНІЦІАЛІЗАЦІЯ FIREBASE
(async function initAuth() {
    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
        // 🔥 ДОДАНО: GoogleAuthProvider та signInWithPopup
        const { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        const firebaseConfig = {
            apiKey: "AIzaSyAnc1n52-LVhZ72vYSmvWv97enqqrqBBi4",
            authDomain: "mneploho-7ff8b.firebaseapp.com",
            projectId: "mneploho-7ff8b",
            storageBucket: "mneploho-7ff8b.firebasestorage.app",
            messagingSenderId: "554377149418",
            appId: "1:554377149418:web:44f345329d803c674c9093",
            measurementId: "G-LM2032YE2W"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        
        // Робимо їх глобальними, щоб кнопка Google могла до них доступитися
        window.auth = auth;
        window.db = db;
        window.GoogleAuthProvider = GoogleAuthProvider;
        window.signInWithPopup = signInWithPopup;

    } catch (error) {
        console.error("Помилка ініціалізації Firebase:", error);
    }
})();

// 2. ФУНКЦІЯ ПЕРЕВІРКИ PHP (Тільки для оновлення імені, без редіректу)
function updateUIFromPHP() {
    const userNameSpan = document.getElementById('userName');
    
    // ВАЖЛИВО: додаємо credentials, щоб сесія працювала між запитами
    fetch(`get_user.php?t=${new Date().getTime()}`, { 
    credentials: 'include',
    cache: 'no-store'
})
        .then(res => {
            // Перевіряємо, чи повернув сервер JSON
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new TypeError("Сервер повернув текст замість JSON! Перевір Docker.");
            }
            return res.json();
        })
        .then(data => {
            if (data.success && data.data) {
                console.log("✅ Дані отримано:", data.data.username);
                if (userNameSpan) userNameSpan.textContent = data.data.username;
            }
        })
        .catch(err => {
            console.error("❌ Помилка профілю:", err.message);
            // Якщо PHP не працює, беремо ім'я хоча б з Firebase
            const cached = localStorage.getItem('user_name');
            if (cached && userNameSpan) userNameSpan.textContent = cached;
        });
}

document.addEventListener('DOMContentLoaded', loadUserFilters);

// 3. ЗАПУСК ПРИ ЗАВАНТАЖЕННІ
document.addEventListener('DOMContentLoaded', function() {
    // Оновлюємо інтерфейс даними з PHP
    updateUIFromPHP();

    // Завантажуємо ігри ОДИН раз (loadUserGamesUI сама викличе loadAllPosts в кінці)
    loadUserGamesUI();

    // Рендер ігор — один раз
    if (typeof renderGames === 'function') renderGames();

    // Логіка вкладок
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const chatToOpen = urlParams.get('open_chat');
    
    // === ВИПРАВЛЕННЯ: Якщо відкриваємо чат, не перемикаємо на стрічку! ===
    if (chatToOpen) {
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    } else if (tab === 'blog') {
        if (typeof switchTab === 'function') switchTab('blog');
    } else if (tab === 'requests') {
        if (typeof switchTab === 'function') switchTab('requests');
    } else {
        if (typeof switchTab === 'function') switchTab('feed');
    }
});
// 2. БАЗА ДАННЫХ ИГР
const myGamesLibrary = [
    { name: "Silent Hill", img: "img/silent hill.jpg", isTop: true },
    { name: "Resident Evil", img: "img/Resident Evil.jpg", isTop: true },
    { name: "The Last of Us", img: "img/The Last of Us.webp" },
    { name: "Cry of fear", img: "img/Cry of fear.jfif" },
    { name: "Valorant", img: "img/valorant.jpg" },
    { 
        name: "Roblox", 
        img: "img/roblox.jpg", 
        isTop: true,
        modes: [ 
            { name: "Adopt Me!", img: "img/adopt me.jpg", isTop: true }, 
            { name: "99 nights in the forest ", img: "img/99 night.jpg", isTop: true},
            { name: "Steal a Brainrot", img: "img/steal a brairot.webp", isTop: true },
            { name: "Blox fruits", img: "img/blox fruirs.jpg", isTop: true }, 
            { name: "Brookhaven ", img: "img/brookhaven.png", isTop: true }, 
            { name: "Murder mystery 2 ", img: "img/mm2.jpg", isTop: true }, 
            { name: "Evade", img: "img/evade.jpg" },
            { name: "Bee swarm simulator", img: "img/bee simulator.webp"},
            { name: "Doors", img: "img/doors.jpg" } 
        ] 
    },
    { name: "Dead by Daylight", img: "img/Dead by Daylight.avif" },
    { name: "The coffin", img: "img/the coffin of andy and leyley.jpg" },
    { name: "Detroit", img: "img/Detroit.webp" },
    { name: "Homicipher", img: "img/Homicipher.webp" }

];
document.addEventListener('DOMContentLoaded', function() {
    // --- 1. ПОЛУЧЕНИЕ ИМЕНИ ИЗ БД (username) ---
    const userNameSpan = document.getElementById('userName');
    
    // Сначала проверим, есть ли имя в локальной памяти (для скорости)
    const cachedName = localStorage.getItem('user_name');
    if (cachedName && userNameSpan) {
        userNameSpan.textContent = cachedName;
    }

    // Запрос к серверу, чтобы получить актуальное имя
    fetch('get_user.php')
        .then(response => {
            if (!response.ok) throw new Error('Ошибка сети или файл не найден');
            return response.json();
        })
        .then(data => {
            if (data.username && data.username !== 'Гість' && userNameSpan) {
                userNameSpan.textContent = data.username;
                localStorage.setItem('user_name', data.username); // Сохраняем
            }
        })
        .catch(err => console.warn("PHP профиль пока не доступен:", err));

    // --- 2. ЛОГИКА НАВИГАЦИИ И ВКЛАДОК ---
    const addPostBtn = document.querySelector('.custom-button');
    const navButtons = document.querySelectorAll('.nav-button');
    const feedContent = document.getElementById('feed-content');
    const requestsContent = document.getElementById('requests-content');

    function showTab(tabName) {
        // 1. Сохраняем текущее состояние страницы
        window.currentLudoraPage = tabName; 

        if (!feedContent || !requestsContent) return;
        
        // 2. Переключаем видимость основных контейнеров (Лента / Заявки)
        if (tabName === 'feed') {
            feedContent.classList.add('active');
            requestsContent.classList.remove('active');
            if(navButtons[0]) navButtons[0].classList.add('active-tab');
            if(navButtons[1]) navButtons[1].classList.remove('active-tab');
        } else if (tabName === 'requests') {
            requestsContent.classList.add('active');
            feedContent.classList.remove('active');
            if(navButtons[1]) navButtons[1].classList.add('active-tab');
            if(navButtons[0]) navButtons[0].classList.remove('active-tab');
        }

        // ✨ 3. ЖЕСТКИЙ КОНТРОЛЬ КНОПОК И ПАНЕЛЕЙ (Фильтры тиммейта + Дополнительно)
        const reqBtn = document.getElementById('btn-toggle-requests-filters');
        // Поддерживаем оба варианта ID для панели (на случай, если ты назвала её requests-filters-area)
        const reqArea = document.getElementById('requests-filters-area');
        
        const extraBtn = document.getElementById('btn-toggle-extra');
        const extraArea = document.getElementById('post-filters-area');

        if (tabName === 'requests') {
            // Кнопку параметрів тімейта показує редактор; тут не чіпаємо.
            if (extraBtn) extraBtn.style.setProperty('display', 'inline-flex', 'important');
        } else {
            // В ЛЕНТЕ/БЛОГЕ: Прячем кнопки
            if (reqBtn) reqBtn.style.setProperty('display', 'none', 'important');
            if (extraBtn) extraBtn.style.setProperty('display', 'none', 'important');
            
            // Обязательно сворачиваем панели, если они были открыты
            if (reqArea) {
                reqArea.style.setProperty('display', 'none', 'important');
                reqArea.classList.remove('show');
            }
            if (extraArea) {
                extraArea.style.setProperty('display', 'none', 'important');
                extraArea.classList.remove('show');
            }
        }

        // 4. Сворачиваем редактор поста при переходе (хороший тон UI)
        const postEditor = document.getElementById('create-post-panel');
        if (postEditor) {
            postEditor.classList.remove('open');
        }

        // 5. Загружаем свежие посты для выбранной вкладки
        if (typeof loadAllPosts === 'function') {
            loadAllPosts(true, true);
        }
    }

    // Привязываем кнопки интерфейса
    if (addPostBtn) {
        addPostBtn.onclick = (e) => {
            e.preventDefault();
            if (typeof togglePostEditor === 'function') togglePostEditor();
        };
    }

    if (navButtons.length >= 2) {
        navButtons[0].onclick = () => setLudoraPage('feed');
        navButtons[1].onclick = () => setLudoraPage('requests');
    }

    // --- 3. ЛИМИТ ТЕКСТА ---
    const postBody = document.getElementById('new-post-body');
    if (postBody) {
        postBody.oninput = function() {
            if (this.value.length >= 500) {
                this.value = this.value.substring(0, 500);
                const alertTop = document.getElementById('alert-top');
                if (alertTop) {
                    alertTop.classList.add('show');
                    setTimeout(() => alertTop.classList.remove('show'), 3000);
                }
            }
        };
    }

    // --- 4. БЕЗОПАСНЫЙ ЗАПУСК ФУНКЦИЙ ---
    if (typeof renderGames === 'function') {
        renderGames();
    }
});
window.getSafeAvatarUrl = function(rawPath) {
    const DEFAULT_IMG = 'img/default_avatar.png'; 
    
    if (!rawPath) return DEFAULT_IMG;
    
    let cleanPath = String(rawPath).trim();
    cleanPath = cleanPath.split('?')[0]; 

    if (cleanPath.startsWith('data:image')) return cleanPath;
    if (cleanPath.includes('default_avatar')) return DEFAULT_IMG;

    // 1. СПОЧАТКУ прибираємо домен сайту (якщо він приклеївся з БД)
    if (cleanPath.startsWith(window.location.origin)) {
        cleanPath = cleanPath.replace(window.location.origin, '');
    }

    // 2. ПОТІМ ЖЕСТКИЙ БЛОК: Вирізаємо зовнішні посилання
    if (cleanPath.startsWith('http') || 
        cleanPath.startsWith('//') || 
        cleanPath.includes('googleusercontent') || 
        cleanPath.includes('ui-avatars')) {
        return DEFAULT_IMG; 
    }
    
    cleanPath = cleanPath.replace(/^\/+/, ''); 
    
    if (cleanPath === '' || 
        cleanPath.toLowerCase() === 'null' || 
        cleanPath.toLowerCase() === 'undefined' || 
        cleanPath === 'uploads' || 
        cleanPath === 'uploads/') {
        return DEFAULT_IMG; 
    }

    // Якщо шлях вже правильний (uploads/...) — повертаємо без зміни
    if (cleanPath.startsWith('uploads/')) {
        return cleanPath;
    }

    // Якщо шлях до img/ (старі записи або дефолтні картинки)
    if (cleanPath.startsWith('img/')) {
        return cleanPath;
    }

    // Для інших відносних шляхів — припускаємо що це avatars/
    return 'uploads/' + cleanPath;
};
// 4. ФУНКЦИИ РЕДАКТОРА
function togglePostEditor() {
    const wrapper = document.getElementById('create-post-panel');
    if (!wrapper) return;
    wrapper.classList.toggle('open');
    if (wrapper.classList.contains('open')) {
        updateGroupSelect();
        const titleInput = document.getElementById('new-post-title');
        if (titleInput) setTimeout(() => titleInput.focus(), 300);
    }
}

// 1. ОНОВЛЕНА ФУНКЦІЯ ЗАПОВНЕННЯ ГРУП
function updateGroupSelect() {
    const select = document.getElementById('post-target-group');
    const customList = document.getElementById('custom-group-list');
    const activeGames = document.querySelectorAll('.preview-item-wrapper');
    
    if (!select || !customList) return;

    // Очищаємо старі дані
    select.innerHTML = '<option value="all">Усі групи</option>';
    
    // Створюємо базову таблетку "Усі групи"
    customList.innerHTML = `<div class="filter-chip active" onclick="window.selectCustomGroup('all', 'Усі групи', this)">Усі групи</div>`;

    // Проходимося по іграх і додаємо їх
    activeGames.forEach(gameWrapper => {
        const gameTitle = gameWrapper.querySelector('.preview-mini-title');
        if (gameTitle && gameTitle.textContent.trim() !== "") {
            const name = gameTitle.textContent.trim();
            
            // 1. Додаємо в прихований select (для PHP бази)
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);

            // 2. Створюємо неонову таблетку для інтерфейсу
            const pill = document.createElement('div');
            pill.className = 'filter-chip'; // Твій клас таблетки!
            pill.textContent = name;
            // При кліку викликаємо функцію вибору
            pill.onclick = function() { window.selectCustomGroup(name, name, this); };
            customList.appendChild(pill);
        }
    });
}

// 2. НОВА ФУНКЦІЯ ВИБОРУ ГРУПИ
window.selectCustomGroup = function(value, label, clickedElement) {
    // 1. Записуємо значення в прихований select
    document.getElementById('post-target-group').value = value;

    // 2. Оновлюємо текст на самій кнопці (щоб користувач бачив, що вибрав)
    const btnLabel = document.getElementById('current-group-label');
    if (btnLabel) btnLabel.textContent = label;

    // 3. Змінюємо підсвітку таблеток (робимо активною лише ту, на яку клікнули)
    const allPills = document.querySelectorAll('#custom-group-list .filter-chip');
    allPills.forEach(p => p.classList.remove('active'));
    if (clickedElement) clickedElement.classList.add('active');

    // 4. Плавно закриваємо панель після вибору
    if (typeof togglePostPanel === 'function') {
        togglePostPanel('group'); // Передаємо 'group', щоб закрити саме цю панель
    }
};

function handlePostImage(input) {
    const previewImg = document.getElementById('preview-img-tag');
    const previewText = document.querySelector('.preview-text');
    const removeBtn = document.querySelector('.remove-preview');
    const container = document.getElementById('post-image-preview-large');

    if (input.files && input.files[0]) {
        const file = input.files[0];
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            alert("Файл занадто великий! Максимальний розмір — 2 МБ.");
            input.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            previewImg.style.display = 'block';
            removeBtn.style.display = 'flex';
            if (previewText) previewText.style.display = 'none';
            container.style.border = '1px solid #ddd';
        };
        reader.readAsDataURL(file);
    }
}

function clearPhotoPreview() {
    const previewImg = document.getElementById('preview-img-tag');
    const previewText = document.querySelector('.preview-text');
    const removeBtn = document.querySelector('.remove-preview');
    const fileInput = document.getElementById('post-file-input');
    const container = document.getElementById('post-image-preview-large');
    if (previewImg) {
        previewImg.src = "";
        previewImg.style.display = 'none';
    }
    if (removeBtn) removeBtn.style.display = 'none';
    if (previewText) previewText.style.display = 'block';
    if (fileInput) fileInput.value = "";
    container.style.border = '2px dashed #ccc';
}
window.publishPost = async function(event) {
    if (event) event.preventDefault();

    const bodyInput = document.getElementById('new-post-body');
    const groupSelect = document.getElementById('post-target-group');
    const previewImg = document.getElementById('preview-img-tag');
    const submitBtn = document.getElementById('submit-post-btn');
    const panelWrapper = document.getElementById('create-post-panel');
    
    const selectedColor = panelWrapper ? (panelWrapper.getAttribute('data-selected-color') || 'pink') : 'pink';
    const mentionInput = document.querySelector('input[placeholder="@нікнейм"]');
    
    // ✨ ФІКС: Оголошуємо змінну reqArea, якої не вистачало! Без неї код ламався.
    const reqArea = document.getElementById('requests-filters-area');
    
    // ✨ ЗБИРАЄМО ДАНІ (Тепер reqArea існує, тому помилок не буде)
    const fAge = reqArea ? (reqArea.querySelector('#req-chips-age .filter-chip.active')?.getAttribute('data-value') || 'any') : 'any';
    const fComm = reqArea ? (reqArea.querySelector('#chips-comm .filter-chip.active')?.getAttribute('data-value') || 'any') : 'any';
    const fLevel = reqArea ? (reqArea.querySelector('#chips-level .filter-chip.active')?.getAttribute('data-value') || 'any') : 'any';
    const fLang = reqArea ? (reqArea.querySelector('#chips-lang .filter-chip.active')?.getAttribute('data-value') || 'any') : 'any';

    if (!bodyInput.value.trim() && (!previewImg || previewImg.style.display === 'none')) {
        alert("Будь ласка, напишіть текст або додайте фото!");
        return;
    }

    const userNick = document.querySelector('.user-name-text')?.innerText || "Gamer";
    const userAvatarEl = document.querySelector('.current-user-avatar');
    let cleanAvatarToSave = userAvatarEl ? userAvatarEl.src : 'img/default_avatar.png';

    const requestsTab = document.getElementById('requests-content');
    const isRequestsOpen = requestsTab && (requestsTab.classList.contains('active') || requestsTab.style.display === 'block');
    const exactPostType = isRequestsOpen ? 'requests' : 'feed';

    const postData = {
        author: userNick.trim(),
        avatar: cleanAvatarToSave,
        image: (previewImg && previewImg.style.display !== 'none') ? previewImg.src : "",
        title: "", 
        body: bodyInput.value.trim(),
        
        // Если это заявка-анкета, группа = "all". Во всех остальных случаях (Лента или Заявка-Группа) берем стандартный селектор
        group: (exactPostType === 'requests' && window.currentRequestMode === 'anketa') 
                ? "all" 
                : (groupSelect ? groupSelect.value : "all"),
                
        type: exactPostType,
        color: selectedColor,
        mention: mentionInput ? mentionInput.value.trim() : "",
        
        // Фильтры отправляются в БД только если это режим "анкета"
        filter_age: (exactPostType === 'requests' && window.currentRequestMode === 'group') ? "any" : fAge,
        filter_comm: (exactPostType === 'requests' && window.currentRequestMode === 'group') ? "any" : fComm,
        filter_level: (exactPostType === 'requests' && window.currentRequestMode === 'group') ? "any" : fLevel,
        filter_lang: (exactPostType === 'requests' && window.currentRequestMode === 'group') ? "any" : fLang,
        
        songTitle: window.currentSelectedTrack ? window.currentSelectedTrack.title : null,
        songArtist: window.currentSelectedTrack ? window.currentSelectedTrack.artist : null,
        songImg: window.currentSelectedTrack ? window.currentSelectedTrack.img : null,
        songUrl: window.currentSelectedTrack ? window.currentSelectedTrack.url : null
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Публікація...";
    }

    try {
        const response = await fetch('save_post.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData),
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            console.log("✅ Пост успешно отправлен в: " + exactPostType);
            
            bodyInput.value = "";
            if (mentionInput) mentionInput.value = "";
            window.currentSelectedTrack = null; 
            if (typeof window.removeMusic === 'function') window.removeMusic(); 
            if (typeof window.clearPhotoPreview === 'function') window.clearPhotoPreview();
            
            // Надежно закрываем панель
            if (panelWrapper) panelWrapper.style.display = 'none';

            if (typeof loadAllPosts === 'function') {
                await loadAllPosts(true, true);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert("Помилка: " + result.message);
        }
    } catch (e) {
        console.error("Помилка мережі:", e);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Опублікувати";
        }
    }
};
// === Глобальні змінні для пагінації (нескінченної стрічки) ===
window.currentPage = 1;
window.isLoadingPosts = false;
window.hasMorePosts = true;
window.isFirstPostsLoadDone = false; // 👈 НОВА ЗМІННА (ЗАМОК)

async function loadAllPosts(reset = false, forceReload = false) {
    if (window.isLoadingPosts) return; 

    if (reset && window.isFirstPostsLoadDone && !forceReload) {
        return;
    }

    if (!reset && !window.hasMorePosts) return; 

    window.isLoadingPosts = true;
    const feedContainer = document.getElementById('feed-content');
    const requestsContainer = document.getElementById('requests-content');
    const blogContainer = document.getElementById('blog-posts-feed');

    if (reset) {
        window.currentPage = 1;
        window.loadedPostsCount = 0; // ✨ Точний offset для порційного завантаження
        window.hasMorePosts = true;
        if (feedContainer) feedContainer.innerHTML = '';
        if (requestsContainer) requestsContainer.innerHTML = '';
        if (blogContainer) blogContainer.innerHTML = '';
    }

    try {
        let currentUserName = localStorage.getItem('user_name') || "Gamer";
        let currentUserId = localStorage.getItem('user_id') || null;
        let currentUserNickLow = currentUserName.toLowerCase();

        const currentTab = window.currentLudoraPage || 'feed';
        
        // ✨ TIKTOK-STYLE: перша порція маленька (5 постів) — миттєвий рендер,
        // далі догружаємо по 10, коли користувач наближається до низу
        const batchSize = (window.loadedPostsCount || 0) === 0 ? 5 : 10;
        let fetchUrl = `get_posts.php?page=${window.currentPage}&type=${currentTab}&limit=${batchSize}&offset=${window.loadedPostsCount || 0}`;

        // 🛡️ ФІКС БЛОГУ: вантажимо ТІЛЬКИ пости власника блогу,
        // інакше чужі blog-пости "влітають" у блог іншого юзера.
        // window.currentBlogOwnerId можна виставити при перегляді чужого блогу;
        // якщо не задано — бекенд візьме user_id з сесії (мій блог).
        if (currentTab === 'blog') {
            const blogOwner = window.currentBlogOwnerId || currentUserId;
            if (blogOwner) fetchUrl += `&blog_user_id=${encodeURIComponent(blogOwner)}`;
        }

        // Якщо ми знаходимося на вкладці "Заявки" і маємо об'єкт з фільтрами
        if (currentTab === 'requests' && window.currentFilters) {
            // Беремо значення з нашого об'єкта (вони оновлюються при кліку на кружечки)
            const fAge = window.currentFilters.age || 'any';
            const fComm = window.currentFilters.comm || 'any';
            const fLevel = window.currentFilters.level || 'any';
            const fLang = window.currentFilters.lang || 'any';

            // Додаємо їх до адреси (імена параметрів мають збігатися з тими, що чекає PHP)
            fetchUrl += `&filter_age=${fAge}&filter_comm=${fComm}&filter_level=${fLevel}&filter_lang=${fLang}`;
        }

        // ✨ Перед рендером заявок підвантажуємо мої відгуки, щоб кнопки
        //    одразу показували правильний стан ("Заявку надіслано" тощо)
        if (currentTab === 'requests' && reset && typeof window.loadMyApplications === 'function') {
            await window.loadMyApplications();
        }

        // Робимо запит за новою, розширеною адресою
        const response = await fetch(fetchUrl, { 
            credentials: 'include',
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        
        if (!response.ok) throw new Error("Помилка сервера: " + response.status);
        const posts = await response.json();
        
        if (posts.length === 0) {
            window.hasMorePosts = false;
            window.isLoadingPosts = false;
            return;
        }

        let insertedInBatch = 0; // ✨ для каскадної появи постів
        posts.forEach(post => {
            const postId = 'post-' + post.id;
            if (document.getElementById(postId)) return;

            // --- 1. ЛОГІКА ТЕМИ ТА КОЛЬОРІВ (ВСЕ ВСЕРЕДИНІ ЦИКЛУ) ---
            const pColor = post.post_color || 'pink';
            let cardStyle = `background: rgba(29, 0, 22, 0.6); color: white;`; 
            let textColor = `#ffffff`; // Білий за замовчуванням
            let mutedColor = `rgba(255, 255, 255, 0.7)`; // Світлий для підписів
            let borderStyle = `none`;

            if (pColor === 'white') {
                cardStyle = `background: linear-gradient(145deg, #ffffff, #f0f0f0); color: #1a1a1a;`;
                textColor = `#1a1a1a`; // Темний для білої теми
                mutedColor = `#666666`;
                borderStyle = `1px solid rgba(0,0,0,0.1)`;
            } else if (pColor === 'black') {
                cardStyle = `background: #050505; color: white;`;
                borderStyle = `1px solid rgba(255,255,255,0.1)`;
            } else if (pColor === 'red') {
                cardStyle = `background: linear-gradient(145deg, #1a0000, #0a0000); color: white;`;
                borderStyle = `1px solid rgba(255,0,51,0.2)`;
            }

            // --- 2. ПЕРЕВІРКА ЛАЙКІВ ---
            const isPostLiked = post.my_vote == 1; 
            const postLikedClass = isPostLiked ? 'liked' : '';
            const postHeartFill = isPostLiked ? '#f0047f' : 'none';

            // --- 3. ЛОГІКА МУЗИКИ ---
            let musicHTML = '';
            if (post.song_title) {
                musicHTML = `
                <div class="track-published-mini" id="player-${postId}" style="margin-top: 15px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 12px; position: relative; overflow: hidden;">
                    <div class="play-trigger-btn" onclick="window.togglePostPlay('${postId}', '${post.song_url}')" style="width: 32px; height: 32px; background: #f0047f; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; z-index: 2;">
                        <svg id="btn-icon-${postId}" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <img src="${post.song_img}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; z-index: 2;">
                    <div style="flex-grow: 1; overflow: hidden; z-index: 2;">
                        <div style="font-size: 13px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: white;">${post.song_title}</div>
                        <div style="font-size: 11px; opacity: 0.7; color: #a38c9f;">${post.song_artist}</div>
                    </div>
                    <div class="wave-container-feed" id="wave-${postId}">
                        <div class="wave-bar-feed"></div><div class="wave-bar-feed"></div><div class="wave-bar-feed"></div><div class="wave-bar-feed"></div><div class="wave-bar-feed"></div>
                    </div>
                </div>`;
            }

            // --- 4. ЛОГІКА ФОТО ---
            let imgHTML = '';
            if (post.post_image && post.post_image.length > 50) {
                imgHTML = `
                <div class="post-media-container" style="margin-top:15px; border-radius:12px; overflow:hidden;  display: flex; justify-content: center; align-items: center; max-height: 400px;">
                    <img src="${post.post_image}" style="max-width: 100%; max-height: 400px; object-fit: contain; display: block; border-radius: 12px;">
                </div>`;
            }

           // Inside the function that generates post HTML (e.g., renderPost)

let filtersHTML = '';
if (post.post_type === 'requests') {
    // --- 1. СЛОВНИКИ ТЕКСТУ ---
    const ageMap = { 'any': 'Всі', '12-16': '12-16', '16-18': '16-18', '18+': '18+' };
    const commMap = { 'any': 'Будь-де', 'micro': 'Мікро', 'microoff': 'Без мікро', 'discord': 'Discord', 'telegram': 'Telegram' };
    const levelMap = { 'any': 'Будь-який рівень', 'shooter': 'Новачок', 'moba': 'Середній', 'profi': 'Профі' };
    const langMap = { 'any': 'Будь-яка мова', 'yes': 'UA', 'no': 'EN' };

    // --- 2. ОТРИМАННЯ ДАНИХ (Із захистом від undefined) ---
    const ageKey = (post.filter_age && post.filter_age !== 'undefined') ? post.filter_age : 'any';
    const commKey = (post.filter_comm && post.filter_comm !== 'undefined') ? post.filter_comm : 'any';
    const levelKey = (post.filter_level && post.filter_level !== 'undefined') ? post.filter_level : 'any';
    const langKey = (post.filter_lang && post.filter_lang !== 'undefined') ? post.filter_lang : 'any';

    // --- 3. ЛОГІКА ІКОНОК (Динамічні PNG) ---
    const baseIconStyle = `width: 14px; height: 14px; object-fit: contain; display: block; filter: brightness(0) saturate(100%) invert(86%) sepia(15%) saturate(718%) hue-rotate(291deg) brightness(104%) contrast(101%);`;
    
    const defUser = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>`;
    const defSignal = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 20V4"/></svg>`;
    const defMic = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/></svg>`;
    const defGlobe = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>`;

    // Підбір іконки ВІКУ
    let ageIcon = defUser;
    if (ageKey === '12-16') ageIcon = `<img src="img/free-icon-font-child-head.png" style="${baseIconStyle} margin-top: 1px;">`;
    else if (ageKey === '16-18') ageIcon = `<img src="img/free-icon-font-man-head.png" style="${baseIconStyle} margin-top: 1px;">`;
    else if (ageKey === '18+') ageIcon = `<img src="img/free-icon-font-woman-head.png" style="${baseIconStyle} margin-top: 1px;">`;

    // Підбір іконки ЗВ'ЯЗКУ (ТЯГНЕМО ВГОРУ на 2 пікселі)
    let commIcon = defMic;
    if (commKey === 'micro') commIcon = `<img src="img/microphone-black-shape.png" style="${baseIconStyle} margin-top: -2px;">`;
    else if (commKey === 'microoff') commIcon = `<img src="img/microphone-off (1).png" style="${baseIconStyle} margin-top: -2px;">`;
    else if (commKey === 'discord') commIcon = `<img src="img/discord.png" style="${baseIconStyle} margin-top: -2px;">`;
    else if (commKey === 'telegram') commIcon = `<img src="img/telegram.png" style="${baseIconStyle} margin-top: -2px;">`;

    // Підбір іконки СТАТУСУ/СКІЛА (ТЯГНЕМО ВГОРУ на 2 пікселі)
    let levelIcon = defSignal;
    if (levelKey === 'shooter') levelIcon = `<img src="img/free-icon-font-bolt.png" style="${baseIconStyle} margin-top: -2px;">`;
    else if (levelKey === 'moba') levelIcon = `<img src="img/free-icon-font-flame.png" style="${baseIconStyle} margin-top: -2px;">`;
    else if (levelKey === 'profi') levelIcon = `<img src="img/free-icon-font-trophy.png" style="${baseIconStyle} margin-top: -2px;">`;

    // Підбір іконки МОВИ
    let langIcon = defGlobe;
    if (langKey === 'yes') langIcon = `<img src="img/ukraine.png" style="${baseIconStyle} margin-top: -2px;">`;
    else if (langKey === 'no') langIcon = `<img src="img/usa-flag.png" style="${baseIconStyle} margin-top: -2px;">`;

    // --- 4. UI STYLE ТА ЗБІРКА HTML ---
    // Додано: line-height: 1; та оптимізовані відступи padding: 4px 10px 3px 10px; (низ трохи менший, щоб текст здавався по центру)
    const pillStyle = `display: inline-flex; align-items: center; line-height: 1; gap: 5px; font-size: 10px; font-weight: 700; padding: 4px 10px 3px 10px; border-radius: 15px; text-transform: uppercase; box-shadow: 0 0 8px rgba(240, 4, 127, 0.3); border: 1px solid rgba(240, 4, 127, 0.5); background: rgba(240, 4, 127, 0.1); color: #ffb3d9; white-space: nowrap;`;

    const ageText = ageMap[ageKey] || 'Всі віки';
    const levelText = levelMap[levelKey] || 'Будь-який рівень';
    const commText = commMap[commKey] || 'Будь-який зв\'язок';
    const langText = langMap[langKey] || 'Будь-яка мова';

    filtersHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; margin-bottom: 8px;">
            <span style="${pillStyle}">${ageIcon}${ageText}</span>
            <span style="${pillStyle}">${levelIcon}${levelText}</span>
            <span style="${pillStyle}">${commIcon}${commText}</span>
            <span style="${pillStyle}">${langIcon}${langText}</span>
        </div>
    `;
}
            // --- 6. ДОПОМІЖНІ ЗМІННІ ---
            let mentionHTML = post.mention_user ? `<div style="color: #f0047f; font-weight: bold; font-size: 13px; margin-bottom: 5px;">Разом з ${post.mention_user}</div>` : '';
            let safeAvatar = window.getSafeAvatarUrl ? window.getSafeAvatarUrl(post.avatar_url || post.avatar) : (post.avatar_url || post.avatar || 'img/default_avatar.png');
            const postTime = typeof window.formatDate === 'function' ? window.formatDate(post.created_at) : "щойно";

            const isMyPost = (String(post.user_id) === String(post.current_viewer_id)); 

            let deleteOptionHTML = '';
            if (isMyPost) {
                deleteOptionHTML = `
                    <div class="post-menu-item delete-item" onclick="window.deletePost('${post.id}')" style="color: #ff4d4d; display: flex; align-items: center; gap: 10px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        <span style="font-size: 12px;">Видалити пост</span>
                    </div>
                `;
            }

            // ✨ СПЕЦІАЛЬНИЙ ІНТЕРФЕЙС ДЛЯ ЗАЯВОК (Таймер і Кнопка)
            // ✨ ІНТЕРФЕЙС ДЛЯ ЗАЯВОК
let postActionsHTML = '';
let commentsDisplayHTML = ''; 

if (post.post_type === 'requests') {
    // 1. Створюємо розмітку таймера (ID мають бути time- та ring-)
    // data-seconds-left: скільки лишилось за годинником сервера на момент завантаження.
    // data-anchor: момент (мс) за годинником клієнта, коли ми отримали ці дані —
    // далі віднімаємо реальний пройдений час локально, без прив'язки до поясу.
    const _secLeft = (post.seconds_left !== undefined && post.seconds_left !== null)
        ? parseInt(post.seconds_left, 10)
        : 3600;
    const timerMarkup = `
        <div class="request-timer" data-seconds-left="${_secLeft}" data-anchor="${Date.now()}" data-created="${post.created_at}" data-post-id="${post.id}" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: rgba(240, 4, 127, 0.05); border-radius: 50%; box-shadow: 0 0 10px rgba(240, 4, 127, 0.2); flex-shrink: 0; position: relative;">
            <svg width="48" height="48" style="transform: rotate(-90deg); position: absolute; top: 0; left: 0;">
                <circle cx="24" cy="24" r="21" fill="none" stroke="rgba(240, 4, 127, 0.15)" stroke-width="3"></circle>
                <circle id="ring-${post.id}" cx="24" cy="24" r="21" fill="none" stroke="#f0047f" stroke-width="3" stroke-dasharray="132" stroke-dashoffset="0" style="transition: stroke-dashoffset 1s linear; filter: drop-shadow(0 0 4px rgba(240,4,127,0.8));"></circle>
            </svg>
            <span id="time-${post.id}" style="font-size: 13px; font-weight: bold; color: #ff80bf; text-shadow: 0 0 5px rgba(240, 4, 127, 0.5); z-index: 2;">${Math.min(60, Math.max(1, Math.ceil(_secLeft / 60)))}m</span>
        </div>
    `;

    // 2. Вставляємо кнопку відгуку (стан залежить від того, чи це наша анкета
    //    і чи ми вже відгукувались)
    const _isOwnRequest = (String(post.user_id) === String(post.current_viewer_id));
    const _appliedMap = (window.myApplications || {});
    const _appliedStatus = _appliedMap[String(post.id)]; // undefined | pending | accepted | rejected

    const _btnBaseStyle = "flex-grow: 1; padding: 12px; border-radius: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; transition: 0.3s; display: flex; justify-content: center; align-items: center; gap: 8px;";

    let _applyBtnHTML = '';
    if (_isOwnRequest) {
        // Власник своєї анкети — відгукуватись не можна
        _applyBtnHTML = `
            <div style="${_btnBaseStyle} background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); cursor: default;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ВАША АНКЕТА
            </div>`;
    } else if (_appliedStatus) {
        // Вже відгукнулись — показуємо стан
        _applyBtnHTML = window.renderApplyButton(post.id, _appliedStatus);
    } else {
        // Можна відгукнутись — відкриваємо вікно з коментарем
        _applyBtnHTML = window.renderApplyButton(post.id, null);
    }

    postActionsHTML = `
        <div id="apply-wrap-${post.id}" style="display: flex; width: 100%; gap: 15px; align-items: center;">
            ${_applyBtnHTML}
            ${timerMarkup}
        </div>
    `;
    commentsDisplayHTML = ''; 

            } else {
                // Стандартні кнопки для Стрічки та Блогу (Лайки, Коменти, Подарунки)
                postActionsHTML = `
                    <button class="post-action-btn like-btn ${postLikedClass}" onclick="window.votePost(this, '${post.id}')">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="${postHeartFill}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        <span id="post-vote-count-${post.id}">${post.vote_count || 0}</span>
                    </button>
                    <button class="post-action-btn comment-btn" onclick="window.toggleInlineComments('${post.id}')">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        <span id="comment-count-btn-${post.id}">${post.comment_count || 0}</span>
                    </button>
                    <button class="post-action-btn gift-btn" onclick="window.openGiftModal('${post.id}')">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                    </button>
                `;

                // Формуємо блок коментарів ТІЛЬКИ для звичайних постів
                commentsDisplayHTML = `
                <div id="inline-comments-block-${post.id}" style="display: none; margin-top: 15px;">
                    <div class="neon-comment-divider"></div>
                    <div id="inline-comments-list-${post.id}" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;"></div>
                    <div id="selected-sticker-preview-${post.id}" style="display: none; position: relative; width: fit-content; margin-bottom: 10px; margin-left: 12px;"></div>
                    
                    <div style="display: flex; gap: 10px; align-items: flex-end;">
                        <div class="comment-input-wrapper" style="flex-grow: 1; display: flex; align-items: center; gap: 10px; padding: 5px 12px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                            <button class="sticker-btn" onclick="window.toggleStickerPicker('${post.id}')" style="background: none; border: none; color: #888; cursor: pointer; display: flex; align-items: center;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                            </button>
                            <div 
                                id="inline-comment-input-${post.id}" 
                                class="custom-input-div" 
                                contenteditable="true" 
                                data-placeholder="Напишіть коментар..."
                                style="color: white; font-size: 13px; outline: none; min-height: 20px; word-break: break-word;"></div>
                        </div>
                        <button class="btn-send-neon" onclick="window.submitInlineComment('${post.id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
                    </div>

                    <div id="sticker-picker-${post.id}" class="sticker-picker-window" style="display: none; margin-top: 10px; background: rgba(0,0,0,0.2); border-radius: 15px; padding: 12px;">
                        <div class="picker-tabs" style="display: flex; gap: 15px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                            <button class="picker-tab-btn active" onclick="window.switchPickerTab(this, '${post.id}', 'emojis')">ЕМОДЗІ</button>
                            <button class="picker-tab-btn" onclick="window.switchPickerTab(this, '${post.id}', 'photos')">ФОТО/GIF</button>
                        </div>

                        <div class="emoji-grid-class" style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                            <div>
                                <div style="font-size: 10px; color: gray; margin-bottom: 8px; font-weight: bold; letter-spacing: 1px;">STANDARD</div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(30px, 1fr)); gap: 6px;">
                                    ${Object.entries(window.appleEmojis || {}).map(([emoji, url]) => `
                                        <span class="picker-item" onclick="window.insertEmoji('${post.id}', '${emoji}')">
                                            <img src="${url}" style="width: 20px; height: 20px;">
                                        </span>
                                    `).join('')}
                                </div>
                            </div>

                            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                                <div style="font-size: 10px; color: #f0047f; margin-bottom: 8px; font-weight: bold; letter-spacing: 1px;">MY PACK</div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(35px, 1fr)); gap: 8px;">
                                    ${Object.entries(window.customEmojis || {}).map(([code, url]) => `
                                        <span class="picker-item custom-emoji-btn" onclick="window.insertEmoji('${post.id}', '${code}')" title="${code}" style="width: 35px; height: 35px;">
                                            <img src="${url}" style="width: 26px; height: 26px; object-fit: contain;">
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <div class="photo-grid-class" style="display: none; grid-template-columns: repeat(auto-fill, 50px); gap: 6px; margin-top: 10px; justify-content: flex-start;">
                            ${(window.myCustomStickers || []).map(url => `
                                <div class="picker-item photo" onclick="window.insertPhotoComment('${post.id}', '${url}')" 
                                     style="width: 50px; height: 50px; background: #111; border-radius: 6px; overflow: hidden; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
                                    <img src="${url}" style="width: 100%; height: 100%; object-fit: cover; display: block;" 
                                         onerror="this.parentElement.style.display='none'">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                `;
            }

           // --- 7. ФОРМУЄМО HTML ---
const postHTML = `
<div id="post-${post.id}" class="user-post-card" data-post-id="${post.id}" data-is-owner="${String(post.user_id) === String(post.current_viewer_id)}" data-post-type="${(post.post_type || 'feed')}" style="${cardStyle} border-radius: 20px; padding: 20px; margin-bottom: 20px; position: relative; border: ${borderStyle}; box-shadow: 0 4px 15px rgba(0,0,0,0.15); font-family: 'Geologica', sans-serif; font-optical-sizing: auto;">
    
    <div class="post-header-info" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
        <a href="profile.html?id=${post.user_id}" style="text-decoration: none; display: flex; align-items: center; gap: 12px; color: ${textColor};">
            <img src="${safeAvatar}" onerror="this.src='img/default_avatar.png';" style="width:44px; height:44px; border-radius:50%; object-fit: cover; border: 2px solid #f0047f;">
            <div style="display: flex; flex-direction: column;">
                <div style="font-weight: 700; font-size: 15px; color: ${textColor};">${post.author_name}</div>
                <div style="font-size: 12px; color: ${mutedColor}; font-weight: 400;">@${post.group_name} • ${postTime}</div>
            </div>
        </a>

        <div class="post-options-wrapper" style="position: relative;">
            <button class="post-options-btn" onclick="window.togglePostMenu(event, '${post.id}')" style="background: none; border: none; color: ${mutedColor}; cursor: pointer; padding: 5px; transition: 0.2s;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
            </button>
            
            <div id="post-menu-${post.id}" class="post-dropdown-menu" style="display: none; position: absolute; right: 0; top: 100%; background: #3a1c2a; border: 1px solid rgba(240, 4, 127, 0.3); border-radius: 12px; padding: 5px; min-width: 160px; box-shadow: 0 4px 15px rgba(0,0,0,0.6); z-index: 100; font-family: 'Geologica', sans-serif;">
                ${deleteOptionHTML} 
                <div class="post-menu-item" onclick="window.reportPost('${post.id}')" style="color: #e0d5dd; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; padding: 8px 12px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Поскаржитись
                </div>
            </div>
        </div>
    </div>

    <div class="post-content">
        ${mentionHTML}
        ${filtersHTML}
        <div style="color: ${textColor}; line-height: 1.6; font-size: 14px; margin-top: 10px; font-family: 'Geologica', sans-serif;">
            <p style="margin: 0; white-space: pre-wrap; font-weight: 400;">${post.body}</p>
        </div>
        ${musicHTML}
        ${imgHTML}
    </div>

    <div class="post-actions" style="display: flex; align-items: center; gap: 15px; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; font-family: 'Geologica', sans-serif;">
        ${postActionsHTML}
    </div>

    ${commentsDisplayHTML}

</div>`;

            // ЯК МАЄ БУТИ:
            const currentTab = window.currentLudoraPage || 'feed';
            const pType = (post.post_type || 'feed').toLowerCase().trim();

            // 🔴 ЗУПИНЯЄМО ЧУЖІ ПОСТИ: якщо тип поста не збігається з відкритою вкладкою - викидаємо його
            if (pType !== currentTab) return; 

            // Вставляємо СТРОГО за адресою:
            let targetContainer = null;
            if (pType === 'requests' && requestsContainer) targetContainer = requestsContainer;
            else if (pType === 'blog' && blogContainer) targetContainer = blogContainer;
            else if (pType === 'feed' && feedContainer) targetContainer = feedContainer;

            if (targetContainer) {
                targetContainer.insertAdjacentHTML('beforeend', postHTML);
                // ✨ TIKTOK-STYLE: пости з'являються по черзі, а не всі одразу
                const newCard = targetContainer.lastElementChild;
                if (newCard) {
                    newCard.classList.add('post-pop-in');
                    newCard.style.animationDelay = `${Math.min(insertedInBatch * 90, 600)}ms`;
                    // 🖼️ Ліниве завантаження медіа всередині картки
                    newCard.querySelectorAll('img').forEach(img => img.setAttribute('loading', 'lazy'));
                    insertedInBatch++;
                }
            }
        });

        window.loadedPostsCount = (window.loadedPostsCount || 0) + posts.length;
        window.currentPage++;
        window.isFirstPostsLoadDone = true;

        // 🚀 ПЕРЕДЗАВАНТАЖЕННЯ: одразу після першої маленької порції тихо тягнемо наступну,
        // щоб скрол ніколи не "впирався" у порожнечу
        if (window.loadedPostsCount <= 5 && window.hasMorePosts) {
            setTimeout(() => loadAllPosts(false), 350);
        }

    } catch (e) { 
        console.error("❌ Помилка завантаження постів:", e); 
    } finally {
        window.isLoadingPosts = false;
    }
}
// === 🚀 РОЗУМНЕ ДОВАНТАЖЕННЯ (IntersectionObserver — швидше та дешевше за scroll) ===
(function initFeedSentinel() {
    function ensureSentinel() {
        let s = document.getElementById('feed-load-sentinel');
        if (!s) {
            s = document.createElement('div');
            s.id = 'feed-load-sentinel';
            s.style.cssText = 'width:100%; height:1px;';
            document.body.appendChild(s);
        }
        return s;
    }
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) loadAllPosts(false);
        }, { rootMargin: '900px 0px' }); // починаємо вантажити за ~900px до низу
        document.addEventListener('DOMContentLoaded', () => io.observe(ensureSentinel()));
        if (document.readyState !== 'loading') io.observe(ensureSentinel());
    } else {
        // Fallback для старих браузерів
        window.addEventListener('scroll', () => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 600) {
                loadAllPosts(false);
            }
        }, { passive: true });
    }
})();

// Додай це в свій скрипт ініціалізації
document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', function() {
        // Знаходимо всі чіпи в цьому ж контейнері і прибираємо active
        this.parentElement.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        // Додаємо active на той, по якому клікнули
        this.classList.add('active');
    });
});

// Завантажуємо пости відразу при вході на сторінку

// Сворачивание (ОДНА ФУНКЦИЯ)
function toggleReplies(btn) {
    const container = btn.nextElementSibling;
    const isHidden = container.style.display === 'none';
    
    if (isHidden) {
        container.style.display = 'block';
        btn.innerText = `——— Сховати відповіді (${container.querySelectorAll('.modern-comment').length})`;
    } else {
        container.style.display = 'none';
        btn.innerText = `——— Дивитися відповіді (${container.querySelectorAll('.modern-comment').length})`;
    }
}

function updatePostCommentCount(postId) {
    const count = countTotalComments(window.commentsData[postId] || []);
    
    // 1. Обновляем в живом DOM
    const btnSpan = document.querySelector(`.action-btn[onclick*="${postId}"] span`);
    if (btnSpan) btnSpan.innerText = `${count} Коментувати`;
    
    // 2. Обновляем в бэкапе, чтобы при закрытии не исчезло
    if (postBackups[postId]) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = postBackups[postId];
        const backupSpan = tempDiv.querySelector('.action-btn span');
        if (backupSpan) {
            backupSpan.innerText = `${count} Коментувати`;
            postBackups[postId] = tempDiv.innerHTML;
        }
    }
}


// 6. ОСТАЛЬНОЕ (ВЫБОР ИГР, ГОЛОСОВАНИЕ)
function handleVote(button, type) {
    const votingGroup = button.closest('.voting');
    const countElement = votingGroup.querySelector('.vote-count');
    const upBtn = votingGroup.querySelector('.upvote');
    const downBtn = votingGroup.querySelector('.downvote');
    
    let currentVote = parseInt(votingGroup.getAttribute('data-user-vote')) || 0;
    let currentCount = parseInt(countElement.innerText) || 0;

    // 1. Сначала полностью "откатываем" старый голос, чтобы вернуть счетчик в нейтральное состояние
    if (currentVote === 1) {
        currentCount -= 1; // Убираем лайк
    } else if (currentVote === -1) {
        // Если был дизлайк, мы его НЕ прибавляли к счетчику (так как он был 0)
        // Но если ты делал так, что дизлайк отнимал от лайков, то тут было бы += 1
        // В нашей логике "не ниже нуля" дизлайк просто нейтрализует лайк.
    }

    // 2. Определяем новое состояние
    if (currentVote === type) {
        // Если нажали ту же кнопку — оставляем 0 (голос снят)
        currentVote = 0;
    } else {
        // Ставим новый голос
        currentVote = type;
        // Если новый голос - лайк, прибавляем 1
        if (currentVote === 1) {
            currentCount += 1;
        }
        // Если новый голос - дизлайк, уменьшаем (но не ниже 0)
        if (currentVote === -1) {
            currentCount = Math.max(0, currentCount - 1);
        }
    }

    // Финальная проверка на всякий случай
    currentCount = Math.max(0, currentCount);

    // 3. Сохраняем и обновляем UI
    votingGroup.setAttribute('data-user-vote', currentVote);
    countElement.innerText = currentCount;

    upBtn.classList.toggle('active-up', currentVote === 1);
    downBtn.classList.toggle('active-down', currentVote === -1);
}
function toggleText(id) {
    document.getElementById(id).classList.toggle('expanded');
}

function renderGames() {
    const grid = document.getElementById('media-grid');
    const backBtn = document.getElementById('modal-back-button');
    const searchInput = document.getElementById('modal-search');
    
    if (!grid) return;
    
    // Прячем кнопку назад, но ПОИСК оставляем всегда
    if (backBtn) backBtn.style.display = 'none'; 
    if (searchInput) searchInput.style.display = 'block';

    grid.innerHTML = '';

    myGamesLibrary.forEach((game) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.onclick = () => {
            if (game.modes) {
                openGameModes(game.name);
            } else {
                finalSelectMode(card);
            }
        };
        card.innerHTML = `
            <div class="media-img-container"><img src="${game.img}"></div>
            <div class="media-title">${game.name}</div>
        `;
        grid.appendChild(card);
    });
}
function openGameModes(gameName) {
    const grid = document.getElementById('media-grid');
    const backBtn = document.getElementById('modal-back-button');
    const game = myGamesLibrary.find(g => g.name === gameName);
    
    if (!game || !game.modes) return;
    
    grid.innerHTML = '';
    
    // ПОКАЗЫВАЕМ кнопку (она встанет слева от поиска благодаря flex)
    if (backBtn) backBtn.style.display = 'flex';

    game.modes.forEach((mode) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.onclick = () => finalSelectMode(card);
        card.innerHTML = `
            <div class="media-img-container"><img src="${mode.img}"></div>
            <div class="media-title">${mode.name}</div>
        `;
        grid.appendChild(card);
    });
}

// Функция возврата
function goBackToList() {
    const backBtn = document.getElementById('modal-back-button');
    // ПРЯЧЕМ кнопку (поиск сам растянется обратно)
    if (backBtn) backBtn.style.display = 'none';
    
    renderGames();
}
function finalSelectMode(cardElement) {
    const modeName = cardElement.querySelector('.media-title').innerText.trim();
    const container = document.getElementById('media-upload-container');
    
    // Перевірка на дублікати в UI
    const existingTitles = Array.from(container.querySelectorAll('.preview-mini-title'))
                                .map(el => el.innerText.trim());
    if (existingTitles.includes(modeName)) {
        showTopAlert(`Гра "${modeName}" вже додана!`);
        return; 
    }

    const imgSrc = cardElement.querySelector('img').src;
    const target = window.currentActiveSquare;

    if (target) {
        target.innerHTML = `<img src="${imgSrc}" alt="preview">`;
        target.classList.add('filled');
        
        let titleTag = target.parentNode.querySelector('.preview-mini-title');
        if (!titleTag) {
            titleTag = document.createElement('div');
            titleTag.className = 'preview-mini-title';
            target.parentNode.appendChild(titleTag);
        }
        titleTag.innerText = modeName;

        // --- НОВЕ: ЗБЕРЕЖЕННЯ В БД ---
        fetch('save_user_game.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_name: modeName, action: 'add' }),
            credentials: 'include'
        }).then(() => loadAllPosts(true)); // Оновлюємо стрічку відразу

        const totalItems = container.getElementsByClassName('preview-item-wrapper').length;
        if (container && totalItems < 4) {
            createNewPlusBox(container);
        }
        closeGamesModal();
    }
}

function showTopAlert(message) {
    let alertBox = document.getElementById('alert-top');
    
    // Если плашки для уведомлений нет в HTML, создадим её на лету
    if (!alertBox) {
        alertBox = document.createElement('div');
        alertBox.id = 'alert-top';
        alertBox.style.cssText = `
            position: fixed; top: -50px; left: 50%; transform: translateX(-50%);
            background: #ff4d4d; color: white; padding: 10px 20px;
            border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;
            transition: top 0.4s ease; z-index: 9999; font-weight: bold;
        `;
        document.body.appendChild(alertBox);
    }

    alertBox.innerText = message;
    alertBox.style.top = "0"; // Показываем

    setTimeout(() => {
        alertBox.style.top = "-60px"; // Прячем через 3 секунды
    }, 3000);
}

function createNewPlusBox(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-item-wrapper';
    wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; width: 44px; flex-shrink: 0; gap: 6px;';
    
    wrapper.innerHTML = `
        <div class="image-preview-box" onclick="addPhotoPlaceholder(this)" style="width: 44px; height: 44px; border-radius: 10px; background: #3a1c2a; border: 1.5px solid #d1a3b8; color: #d1a3b8; font-size: 26px; font-weight: 300; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; box-sizing: border-box;">
            +
        </div>
        <div class="preview-mini-title" style="height: 14px;"></div>
    `;
    container.appendChild(wrapper);
}

function addPhotoPlaceholder(element) {
    if (element.classList.contains('filled')) return;
    window.currentActiveSquare = element;
    
    // Используем ID 'games-modal', так как он у вас в HTML для выбора игр
    const modal = document.getElementById('games-modal');
    if (modal) {
        modal.style.display = 'flex';
        renderGames(); // Сбрасываем на главный список при открытии
    }
}

function closeGamesModal() {
    const modal = document.getElementById('games-modal');
    if (modal) modal.style.display = 'none';
}
// --- НОВА ФУНКЦІЯ: ВИКЛИК МЕНЮ БЕЗПОСЕРЕДНЬО З HTML ---
window.showMsgMenu = function(e, msgNode) {
    e.preventDefault();
    e.stopPropagation();

    // Перевіряємо, чи це твоє повідомлення
    const isMyMessage = msgNode.classList.contains('msg-mine') || msgNode.style.alignSelf === 'flex-end';
    
    if (isMyMessage) {
        window.currentSelectedMsgId = msgNode.getAttribute('data-id');
        
        // Створюємо меню, якщо його ще немає
        if (!document.getElementById('msg-context-menu') && typeof window.initMessageContextMenu === 'function') {
            window.initMessageContextMenu();
        }

        const msgMenu = document.getElementById('msg-context-menu');
        const customMenu = document.getElementById('custom-context-menu');
        
        if (msgMenu) {
            if (customMenu) customMenu.style.display = 'none'; // Ховаємо меню ігор
            
            // Показуємо під курсором
            msgMenu.style.display = 'block';
            msgMenu.style.left = e.clientX + 'px';
            msgMenu.style.top = e.clientY + 'px';
        }
    }
    return false; // Залізобетонно блокує стандартне меню
};

// === ОБ'ЄДНАНИЙ ОБРОБНИК ПРАВОГО КЛІКУ ДЛЯ ІГОР І ПОВІДОМЛЕНЬ ===
// === ОБРОБНИК ПРАВОГО КЛІКУ ТІЛЬКИ ДЛЯ ІГОР ===
document.addEventListener('contextmenu', function(e) {
    // 1. ПЕРЕВІРКА НА ІГРИ
    const targetBox = e.target.closest('.image-preview-box');
    if (targetBox && targetBox.querySelector('img')) {
        e.preventDefault(); 
        e.stopPropagation();
        
        window.currentActiveTarget = targetBox;
        const menu = document.getElementById('custom-context-menu');
        const muteText = document.getElementById('mute-toggle-text');

        if (muteText) {
            muteText.innerText = targetBox.classList.contains('muted-game') ? 'Включити' : 'Заглушити';
        }

        if (menu) {
            hideAllContextMenus();
            menu.style.display = 'block';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
        }
        return; 
    } 

    // Якщо клікнули будь-де в іншому місці, але НЕ по повідомленню
    if (!e.target.closest('.message-wrapper')) {
        hideAllContextMenus();
    }
}); // <--- ВАЖЛИВО: ми прибрали 'true' звідси!

// Ховаємо всі меню при звичайному кліку лівою кнопкою
document.addEventListener('click', hideAllContextMenus);

function hideAllContextMenus() {
    const customMenu = document.getElementById('custom-context-menu');
    if (customMenu) customMenu.style.display = 'none';
    const msgMenu = document.getElementById('msg-context-menu');
    if (msgMenu) msgMenu.style.display = 'none';
}
// ===============================================================
// Скрываем все меню при обычном клике
document.addEventListener('click', function() {
    const customMenu = document.getElementById('custom-context-menu');
    if (customMenu) customMenu.style.display = 'none';
    
    const msgMenu = document.getElementById('msg-context-menu');
    if (msgMenu) msgMenu.style.display = 'none';
});
// ===============================================================

// 3. Функция "Заглушить" (переключатель)
function mutePhoto() {
    if (currentActiveTarget) {
        currentActiveTarget.classList.toggle('muted-game');
        document.getElementById('custom-context-menu').style.display = 'none';
    }
}

// 4. Функция "Вийти" (удаление игры из панели)
function removePhoto() {
    if (currentActiveTarget) {
        const gameName = currentActiveTarget.parentNode.querySelector('.preview-mini-title')?.innerText;
        const container = document.getElementById('media-upload-container');
        const wrapper = currentActiveTarget.closest('.preview-item-wrapper');
        
        if (wrapper) wrapper.remove();
        document.getElementById('custom-context-menu').style.display = 'none';

        // --- НОВЕ: ВИДАЛЕННЯ З БД ---
        if (gameName) {
            fetch('save_user_game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game_name: gameName, action: 'remove' }),
                credentials: 'include'
            }).then(() => loadAllPosts(true));
        }

        if (container) {
            const totalItems = container.querySelectorAll('.preview-item-wrapper').length;
            const hasPlus = container.querySelector('.plus-icon');
            if (totalItems < 4 && !hasPlus) {
                createNewPlusBox(container);
            }
        }
    }
}


function closeGamesModal() {
    document.getElementById('games-modal').style.display = 'none';
}

// Функция, которая вызывается при клике на игру для открытия подробностей
function openGameDetails(gameData) {
    // 1. Показываем кнопку назад
    document.getElementById('modal-back-button').style.display = 'flex';
    
    // 2. Скрываем основной список игр и поиск
    document.getElementById('games-grid-container').style.display = 'none';
    document.getElementById('modal-search-input').style.display = 'none';
    
    // 3. Показываем блок с деталями игры (создайте его, если нет)
    const detailsContainer = document.getElementById('game-details-view');
    detailsContainer.style.display = 'block';
    // ... логика наполнения данными игры ...
}

// Обработчик для кнопки "Назад"
document.getElementById('modal-back-button').addEventListener('click', function() {
    // 1. Скрываем саму кнопку
    this.style.display = 'none';
    
    // 2. Показываем список игр и поиск обратно
    document.getElementById('games-grid-container').style.display = 'grid';
    document.getElementById('modal-search-input').style.display = 'block';
    
    // 3. Скрываем блок деталей
    document.getElementById('game-details-view').style.display = 'none';
});

function showGameDetails() {
    // Показываем кнопку назад
    document.getElementById('modal-back-button').style.display = 'flex';
    
    // Скрываем заголовок "Виберіть гру", поиск и сетку
    document.querySelector('.modal-games-header h3').style.display = 'none';
    document.getElementById('modal-search').style.display = 'none';
    document.getElementById('media-grid').style.display = 'none';
    
    // Здесь должен быть ваш код для показа контента конкретной игры
}

function goBackToGamesList() {
    // Скрываем кнопку назад
    document.getElementById('modal-back-button').style.display = 'none';
    
    // Возвращаем заголовок, поиск и сетку
    document.querySelector('.modal-games-header h3').style.display = 'block';
    document.getElementById('modal-search').style.display = 'block';
    document.getElementById('media-grid').style.display = 'grid';
    
    // Если вы создавали блок с описанием игры, скройте его
    // document.getElementById('game-details-container').style.display = 'none';
}

// 1. ФУНКЦИЯ ПЕРЕХОДА (вызывайте её, когда кликаете на игру в списке)
function openGamePage() {
    // Показываем кнопку "Назад"
    document.getElementById('modal-back-button').style.display = 'flex';
    
    // Скрываем заголовок, поиск и сетку игр
    document.getElementById('modal-games-main-title').style.display = 'none';
    document.getElementById('modal-search').style.display = 'none';
    document.getElementById('media-grid').style.display = 'none';
    
    // Показываем блок с деталями игры
    const details = document.getElementById('game-details-view');
    if(details) details.style.display = 'block';
 } 

// Внутри home.js функция загрузки
function syncName() {
    fetch('get_user.php')
    .then(res => res.json())
    .then(data => {
        const nameBlock = document.getElementById('userName');
        if (nameBlock && data.username) {
            nameBlock.textContent = data.username;
        }
    });
}

// Вызывай её при загрузке страницы
document.addEventListener('DOMContentLoaded', syncName);

 // Добавим действие при клике на аватарку (например, вызов меню выхода)
// Добавим действие при клике на аватарку
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM загружен, ищу блок userName...");

    fetch('get_user.php')
    .then(response => response.json()) // Теперь можно сразу json, раз мы знаем, что ответ чистый
    .then(data => {
        console.log("Данные получены:", data);

        // Замени блок в home.js на этот:
     if (data.username && data.username !== 'Гість') {
    const nameElement = document.getElementById('userName');
    const nickLabel = document.querySelector('.user-nick'); // Проверь, может у тебя такой класс на главной?

    if (nameElement) {
        nameElement.textContent = data.username;
    } 
    
    // Если на главной странице блок называется .user-nick, обновим и его
    if (nickLabel) {
        nickLabel.textContent = data.username;
    }
}
    })
    .catch(err => {
        console.error("Ошибка при получении имени:", err);
    });
});// <-- ВОТ ЭТА СКОБКА БЫЛА ПРОПУЩЕНА

function listenToPosts() { console.log("Заглушка для listenToPosts"); }

// === ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК (ЛЕНТА / ЗАЯВКИ / БЛОГ) ===

// 1. Функция переключения
window.switchTab = function(tabName) {
    // === ❗️ ГОЛОВНИЙ ФІКС ❗️ ===
    // Оновлюємо глобальну змінну, щоб publishPost знав, де ми знаходимось
    window.currentLudoraPage = tabName;

    // Скрываем все вкладки
    document.querySelectorAll('.tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });

    // Убираем подсветку кнопок
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active-tab');
    });

    if (topFilterBar) {
    // ЗАМІНИ 'blog' на те ID вкладки, яке використовується у твоєму коді!
    if (tabName === 'blog') {
        topFilterBar.style.display = 'none'; // Ховаємо пошук і фільтри
    } else {
        topFilterBar.style.display = 'flex'; // Повертаємо (бо в HTML у тебе display: flex)
    }
}

    // Показываем нужную вкладку
    const targetContent = document.getElementById(tabName + '-content');
    if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active');
    }

    // Подсвечиваем кнопку
    const buttons = document.querySelectorAll('.nav-button');
    if (tabName === 'feed' && buttons[0]) buttons[0].classList.add('active-tab');
    if (tabName === 'requests' && buttons[1]) buttons[1].classList.add('active-tab');
    if (tabName === 'blog' && buttons[2]) buttons[2].classList.add('active-tab');

    const topFilterBar = document.getElementById('top-game-filter');
    if (topFilterBar) {
        if (tabName === 'blog') { 
            topFilterBar.style.display = 'none'; 
        } else {
            topFilterBar.style.display = 'flex'; 
        }
    }
};
// 2. Проверка ссылки при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Получаем параметры из URL (например ?tab=blog)
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const chatToOpen = urlParams.get('open_chat');

    // === ВИПРАВЛЕННЯ: Якщо чат, нічого не робимо, чекаємо чат ===
    if (chatToOpen) {
        // Чекаємо відкриття чату, вкладки не чіпаємо
    } else if (tab === 'blog') {
        switchTab('blog'); // Если в ссылке blog -> открываем блог
    } else if (tab === 'requests') {
        switchTab('requests');
    } else {
        switchTab('feed'); // По умолчанию лента
    }
});

// ==========================================
// ЛОГІКА ПЕРЕМИКАННЯ ВКЛАДОК (ОНОВЛЕНА)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Функція перемикання
    // 1. Функція перемикання
    function performSwitch(tabName) {
        console.log("Клік по вкладці:", tabName);
        // FIX: синхронізуємо обидві глобальні змінні — loadAllPosts читає currentLudoraPage
        window.currentTab = tabName;
        window.currentLudoraPage = tabName;

        // Ховаємо всі блоки контенту
        document.querySelectorAll('.tab-content').forEach(el => {
            el.style.display = 'none';
            el.classList.remove('active');
        });

        // Прибираємо підсвічування головних кнопок
        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.classList.remove('active-tab');
        });

        // Прибираємо підсвічування з чатів, якщо повертаємося на головні вкладки
        document.querySelectorAll('.chat-item').forEach(item => {
            item.style.background = 'transparent';
        });

        // Показуємо потрібний контент
        const target = document.getElementById(tabName + '-content');
        if (target) {
            target.style.display = 'block';
            setTimeout(() => target.classList.add('active'), 10);
        }

        // Підсвічуємо потрібну кнопку
        if (tabName === 'feed') document.getElementById('btn-feed')?.classList.add('active-tab');
        if (tabName === 'requests') document.getElementById('btn-requests')?.classList.add('active-tab');
        if (tabName === 'blog') document.getElementById('btn-blog')?.classList.add('active-tab');
        
        // Перевіряємо, чи відкритий чат, і якщо так — ховаємо його
        const chatWin = document.getElementById('chat-window');
        if (chatWin && chatWin.style.display === 'flex') {
             chatWin.style.display = 'none';
             const postPanel = document.getElementById('create-post-panel');
             if (postPanel) postPanel.style.display = 'block';
        }

        // Відновлюємо скролінг
        if (chatWin && chatWin.parentElement) {
            chatWin.parentElement.style.overflow = 'auto';
        }

        // FIX: завантажуємо пости для нової вкладки (forceReload=true обходить guard isFirstPostsLoadDone)
        if (typeof loadAllPosts === 'function' && tabName !== 'streams') {
            loadAllPosts(true, true);
        }
    }
    // Робимо функцію глобальною, щоб інші скрипти могли її викликати
    window.performSwitch = performSwitch;

    // 2. Навішуємо події на кнопки (Залізобетонний метод)
    const btnFeed = document.getElementById('btn-feed');
    const btnRequests = document.getElementById('btn-requests');
    const btnBlog = document.getElementById('btn-blog');

    if (btnFeed) btnFeed.addEventListener('click', () => performSwitch('feed'));
    if (btnRequests) btnRequests.addEventListener('click', () => performSwitch('requests'));
    if (btnBlog) btnBlog.addEventListener('click', () => performSwitch('blog'));

    // 3. Перевірка посилання при старті (якщо прийшли з профілю)
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const chatToOpen = urlParams.get('open_chat');

    // === ВИПРАВЛЕННЯ: Головна причина миготіння була тут ===
    if (chatToOpen) {
        // Миттєво ховаємо все, щоб не було проблисків стрічки
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        const postPanel = document.getElementById('create-post-panel');
        if (postPanel) postPanel.style.display = 'none';
    } else if (tab === 'blog') {
        performSwitch('blog');
    } else if (tab === 'requests') {
        performSwitch('requests');
    } else {
        performSwitch('feed'); // За замовчуванням
    }
});

window.currentGiftPostId = null;

// Список подарунків з картинками та цінами
window.GIFTS_LIST = [
    { id: 'gift_1', img: 'img/gifts/gift_1.png', label: 'Серце', price: 50 },
    { id: 'gift_2', img: 'img/gifts/gift_2.png', label: 'Зірка', price: 75 },
    { id: 'gift_3', img: 'img/gifts/gift_3.png', label: 'Корона', price: 150 },
    { id: 'gift_4', img: 'img/gifts/gift_4.png', label: 'Квітка', price: 50 },
    { id: 'gift_5', img: 'img/gifts/gift_5.png', label: 'Діамант', price: 300 },
    { id: 'gift_6', img: 'img/gifts/gift_6.png', label: 'Торт', price: 100 },
    { id: 'gift_7', img: 'img/gifts/gift_7.png', label: 'Ракета', price: 200 },
    { id: 'gift_8', img: 'img/gifts/gift_8.png', label: 'Вогонь', price: 100 },
    { id: 'gift_9', img: 'img/gifts/gift_9.png', label: 'Магія', price: 250 },
];

window.openGiftModal = function(postId) {
    if (!postId) {
        console.error("❌ Спроба відкрити модалку без ID поста!");
        return;
    }
    window.currentGiftPostId = postId;
    console.log("🎁 Готуємо подарунок для поста:", postId);

    // Видаляємо старий модал якщо є
    const old = document.getElementById('giftModal');
    if (old) old.remove();

    const giftsHTML = window.GIFTS_LIST.map(g => `
        <div class="gift-item-select" onclick="window.sendGift('${g.img}', '${g.id}')">
            <div class="gift-item-img-wrap">
                <img src="${g.img}" alt="${g.label}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/616/616490.png'">
            </div>
            <div class="gift-item-label">${g.label}</div>
            <div class="gift-item-price">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-2h2v2zm0-4h-2V7h2v5.5z"/></svg>
                ${g.price > 0 ? g.price.toLocaleString() : 'Безкоштовно'}
            </div>
        </div>
    `).join('');

    const modalHTML = `
    <div id="giftModal" class="gift-modal-overlay">
        <div class="gift-modal-box">
            <div class="gift-modal-glow"></div>
            <div class="gift-modal-header">
                <div class="gift-modal-title">
                    <span class="gift-modal-icon">🎁</span>
                    Нагородити автора
                </div>
                <button class="gift-modal-close" onclick="window.closeGiftModal()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <p class="gift-modal-subtitle">Подарунок з'явиться на пості анонімно</p>
            <div class="gift-items-grid">
                ${giftsHTML}
            </div>
            <button onclick="window.closeGiftModal()" class="gift-cancel-btn">Скасувати</button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Анімація появи
    requestAnimationFrame(() => {
        const modal = document.getElementById('giftModal');
        if (modal) {
            modal.style.opacity = '0';
            modal.style.display = 'flex';
            requestAnimationFrame(() => { modal.style.opacity = '1'; });
        }
    });
};

window.sendGift = async function(iconUrl, giftId) {
    const postId = window.currentGiftPostId;
    if (!postId) {
        alert("Помилка: пост не вибрано.");
        return;
    }

    // 💰 Перевірка балансу монет
    const giftObj = (window.GIFTS_LIST || []).find(g => g.id === giftId);
    const cost = giftObj ? (giftObj.price || 0) : 0;
    const balance = window.currentUserCoins || 0;

    if (cost > 0 && balance < cost) {
        window.closeGiftModal();
        if (typeof window.openCoinShop === 'function') window.openCoinShop();
        return;
    }

    // Анімація вибраного подарунку
    const allItems = document.querySelectorAll('.gift-item-select');
    allItems.forEach(el => el.style.pointerEvents = 'none');

    try {
        const response = await fetch('save_gift.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                post_id: postId, 
                gift_icon: iconUrl,
                gift_id: giftId || '',
                cost: cost
            })
        });

        const result = await response.json();
        if (result.success) {
            // Списуємо монети локально (бекенд за бажанням теж може списати)
            if (cost > 0) {
                window.refreshCoinsDisplay(Math.max(0, balance - cost));
            }
            window.closeGiftModal();
            if (typeof window.showTopAlert === 'function') {
                window.showTopAlert("Подарунок відправлено! 🎁");
            }
            // Обов'язково оновлюємо пости, щоб побачити нову іконку
            loadAllPosts(true);
        } else {
            allItems.forEach(el => el.style.pointerEvents = 'auto');
            alert("Помилка сервера: " + result.message);
        }
    } catch (e) {
        allItems.forEach(el => el.style.pointerEvents = 'auto');
        console.error("❌ Помилка Fetch:", e);
    }
};

window.closeGiftModal = function() {
    const modal = document.getElementById('giftModal');
    if (modal) modal.style.display = 'none';
};


/// ==========================================
// 4. КОМЕНТАРІ (Вбудовані під постом, як у TikTok)
// ==========================================

window.replyStates = {};

window.toggleInlineComments = function(postId) {
    const cleanPostId = postId.toString().replace('post-', '');
    const block = document.getElementById(`inline-comments-block-${cleanPostId}`);
    const list = document.getElementById(`inline-comments-list-${cleanPostId}`);
    
    if (!block || !list) return;

    if (block.style.display === 'none') {
        block.style.display = 'block'; 
        list.innerHTML = '<p style="color:gray; font-size:13px; text-align:center;">Завантаження...</p>';
        window.replyStates[cleanPostId] = 0; 
        loadInlineComments(cleanPostId); 
    } else {
        block.style.display = 'none'; 
    }
};
// Створюємо глобальний об'єкт для збереження фільтра, щоб кнопки "підсвічувалися"
window.commentSorts = window.commentSorts || {};

async function loadInlineComments(postId, sortType = 'new') {
    const cleanPostId = postId.toString().replace('post-', '');
    // Запам'ятовуємо вибір для цього поста
    window.commentSorts[cleanPostId] = sortType;
    
    const listContainer = document.getElementById(`inline-comments-list-${cleanPostId}`);
    
    // Додаємо іконки фільтрації перед списком (якщо їх ще немає)
    const filterHeader = `
        <div class="comment-filter-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 0 5px;">
            <span style="font-size: 11px; color: #666; font-weight: bold; letter-spacing: 1px;">КОМЕНТАРІ</span>
            <div style="display: flex; gap: 12px; align-items: center;">
                <span onclick="window.loadInlineComments('${cleanPostId}', 'new')" 
                      style="cursor:pointer; font-size: 11px; font-weight: bold; color: ${sortType === 'new' ? '#f0047f' : '#555'}; transition: 0.3s;">
                      НОВІ
                </span>
                <span onclick="window.loadInlineComments('${cleanPostId}', 'popular')" 
                      style="cursor:pointer; font-size: 11px; font-weight: bold; color: ${sortType === 'popular' ? '#f0047f' : '#555'}; transition: 0.3s;">
                      ТОП
                </span>
            </div>
        </div>
    `;
    
    try {
        // Відправляємо запит із параметром sort
        const response = await fetch(`get_comments.php?post_id=${cleanPostId}&sort=${sortType}`, { credentials: 'include' });
        const comments = await response.json();
        
        let currentUserName = document.querySelector('.user-nick')?.innerText || document.getElementById('userName')?.innerText || localStorage.getItem('user_name') || "Gamer";
        let currentUserNickLow = currentUserName.trim().toLowerCase();
        let currentUserId = localStorage.getItem('user_id');
        
        if (Array.isArray(comments) && comments.length > 0) {
            const parents = comments.filter(c => !c.parent_id || parseInt(c.parent_id) === 0 || isNaN(parseInt(c.parent_id)));
            const replies = comments.filter(c => parseInt(c.parent_id) > 0);
            
            let html = filterHeader; // Починаємо з кнопок фільтрації

            parents.forEach(p => {
                const authorName = (p.author_name || p.author || 'Гість').trim();
                const currentCommentId = p.id || p.comment_id || p.ID; 
                const pUserId = p.user_id || p.author_id || ''; 
                
                let isMyComment = (currentUserId && pUserId) ? (String(currentUserId) === String(pUserId)) : (authorName.toLowerCase() === currentUserNickLow);

                const pParsedBody = window.parseiPhoneEmojis(p.body || "");
                const pStickerHTML = p.sticker_url ? `
                    <div style="margin-top: 8px; width: fit-content; max-width: 160px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 3px 10px rgba(0,0,0,0.2);">
                        <img src="${p.sticker_url}" style="display: block; width: 100%; max-height: 200px; object-fit: contain;">
                    </div>` : '';

                const parentContentHTML = `
                    <div style="color: #e0d5dd; font-size: 13px; line-height: 1.5;">${pParsedBody}</div>
                    ${pStickerHTML}
                `;

                // Логіка гілок (відповідей)
                const getDescendants = (parentId) => {
                    let children = replies.filter(r => parseInt(r.parent_id) === parseInt(parentId));
                    let result = [...children];
                    children.forEach(c => {
                        const subChildren = getDescendants(c.id || c.comment_id || c.ID);
                        result = result.concat(subChildren);
                    });
                    return result;
                };

                let childReplies = getDescendants(currentCommentId);
                // Відповіді завжди сортуємо від старих до нових для логіки діалогу
                childReplies.sort((a, b) => new Date(a.created_at?.replace(' ', 'T') || 0).getTime() - new Date(b.created_at?.replace(' ', 'T') || 0).getTime());

                const repliesCount = childReplies.length;
                let safeCommentAvatar = window.getSafeAvatarUrl(p.avatar_url || p.avatar || p.user_avatar);
                if (isMyComment) {
                    const actualAvatar = localStorage.getItem('user_avatar');
                    if (actualAvatar && actualAvatar !== 'null' && actualAvatar !== 'undefined') safeCommentAvatar = actualAvatar;
                }

                const myVote = p.my_vote || 0;
                const voteCount = p.vote_count || 0;
                const pTime = window.formatDate(p.created_at);
                const likedClass = (myVote == 1) ? 'liked' : '';

                let repliesHTML = '';
                if (repliesCount > 0) {
                    const repliesItems = childReplies.map(r => {
                        const rAuthorName = (r.author_name || r.author || 'Гість').trim();
                        const rId = r.id || r.comment_id || r.ID;
                        const rUserId = r.user_id || r.author_id || ''; 
                        let isMyReply = (currentUserId && rUserId) ? (String(currentUserId) === String(rUserId)) : (rAuthorName.toLowerCase() === currentUserNickLow);

                        let safeReplyAvatar = window.getSafeAvatarUrl(r.avatar_url || r.avatar || r.user_avatar); 
                        if (isMyReply) {
                            const actualAvatar = localStorage.getItem('user_avatar');
                            if (actualAvatar && actualAvatar !== 'null' && actualAvatar !== 'undefined') safeReplyAvatar = actualAvatar;
                        }
                        
                        const rParsedBody = window.parseiPhoneEmojis(r.body || "");
                        const rStickerHTML = r.sticker_url ? `
                            <div style="margin-top: 6px; width: fit-content; max-width: 120px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
                                <img src="${r.sticker_url}" style="display: block; width: 100%; max-height: 150px; object-fit: contain;">
                            </div>` : '';

                        const replyContentHTML = `
                            <div style="color: #e0d5dd; font-size: 13px; line-height: 1.4;">${rParsedBody}</div>
                            ${rStickerHTML}
                        `;

                        const rMyVote = r.my_vote || 0;
                        const rVoteCount = r.vote_count || 0;
                        const rTime = window.formatDate(r.created_at);
                        const rLikedClass = (rMyVote == 1) ? 'liked' : '';
                        
                        let replyTargetHTML = '';
                        if (parseInt(r.parent_id) !== parseInt(currentCommentId)) {
                            const directParent = comments.find(c => parseInt(c.id || c.comment_id || c.ID) === parseInt(r.parent_id));
                            if (directParent) {
                                const targetName = (directParent.author_name || directParent.author || 'Гість').trim();
                                replyTargetHTML = `<a href="profile.html?id=${directParent.user_id || ''}" style="color: #f0047f; font-weight: normal; margin-left: 5px; font-size: 11px; text-decoration: none;">▶ ${targetName}</a>`;
                            }
                        }
                        
                        return `
                        <div style="margin-bottom: 12px; margin-left: 42px; display: flex; gap: 10px; align-items: flex-start;">
                            <a href="profile.html?id=${rUserId}"><img src="${safeReplyAvatar}" onerror="this.src='img/default_avatar.png';" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(240,4,127,0.5);"></a>
                            <div style="display: flex; flex-direction: column; max-width: 85%;">
                                <div class="comment-bubble-neon" style="padding: 8px 12px; font-size: 12px;">
                                    <div style="font-weight: bold; color: white; display: flex; align-items: center; flex-wrap: wrap; margin-bottom: 3px;">
                                        <a href="profile.html?id=${rUserId}" class="neon-author-name" style="text-decoration: none;">${rAuthorName}</a> ${replyTargetHTML}
                                        <span style="color:rgba(255,255,255,0.3); font-size:10px; font-weight:normal; margin-left:8px;">${rTime}</span>
                                    </div>
                                    ${replyContentHTML}
                                </div>
                                <div class="neon-comment-actions" style="margin-left: 5px;">
                                    <span class="neon-heart-btn ${rLikedClass}" onclick="window.voteComment(this, ${rId})">
                                        <svg width="14" height="14" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                        <span class="comment-vote-count" style="font-weight:600; font-size:11px;">${rVoteCount > 0 ? rVoteCount : ''}</span>
                                    </span>
                                    <span class="reply-link-neon" onclick="window.initReply('${cleanPostId}', '${rId}', '${rAuthorName}')">Відповісти</span>
                                    ${isMyReply ? `<span class="delete-link-neon" onclick="window.deleteMyComment(${rId}, '${cleanPostId}', '${rAuthorName}')">Видалити</span>` : `<span class="reply-link-neon" style="color:#aa4444;" onclick="window.reportComment(${rId})">Скарж.</span>` }
                                </div>
                            </div>
                        </div>`;
                    }).join('');

                    repliesHTML = `
                    <div style="margin-top: 8px; margin-left: 5px;">
                        <span style="cursor:pointer; font-size: 12px; color: #aaa; font-weight: bold; display: flex; align-items: center; gap: 4px;" onclick="window.toggleRepliesList('${currentCommentId}', this, ${repliesCount})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            Показати відповіді (${repliesCount})
                        </span>
                    </div>
                    <div id="replies-container-${currentCommentId}" style="display: none; margin-top: 10px;">${repliesItems}</div>`;
                }

                html += `
                <div style="margin-bottom: 15px; display: flex; gap: 10px; align-items: flex-start;">
                    <a href="profile.html?id=${pUserId}"><img src="${safeCommentAvatar}" onerror="this.src='img/default_avatar.png';" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1.5px solid #f0047f;"></a>
                    <div style="display: flex; flex-direction: column; width: 100%;">
                        <div class="comment-bubble-neon">
                            <div style="margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                                <a href="profile.html?id=${pUserId}" class="neon-author-name" style="text-decoration: none;">${authorName}</a>
                                <span style="color:rgba(255,255,255,0.3); font-size:10px; font-weight:normal; margin-left:15px;">${pTime}</span>
                            </div>
                            ${parentContentHTML}
                        </div>
                        <div class="neon-comment-actions">
                            <span class="neon-heart-btn ${likedClass}" onclick="window.voteComment(this, ${currentCommentId})">
                                <svg width="15" height="15" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                <span class="comment-vote-count" style="font-weight:600; font-size:12px;">${voteCount > 0 ? voteCount : ''}</span>
                            </span>
                            <span class="reply-link-neon" onclick="window.initReply('${cleanPostId}', '${currentCommentId}', '${authorName}')">Відповісти</span>
                            ${isMyComment ? `<span class="delete-link-neon" onclick="window.deleteMyComment(${currentCommentId}, '${cleanPostId}', '${authorName}')">Видалити</span>` : `<span class="reply-link-neon" style="color: #aa4444;" onclick="window.reportComment(${currentCommentId})">Скаржитися</span>`}
                        </div>
                        ${repliesHTML}
                    </div>
                </div>`;
            });
            listContainer.innerHTML = html;
        } else {
            listContainer.innerHTML = filterHeader + '<p style="color:gray; font-size:13px; text-align:center; margin-top: 10px;">Коментарів ще немає.</p>';
        }
    } catch (e) {
        console.error("Помилка завантаження коментарів:", e);
    }
}
// Змінна для зберігання того, на який коментар ми зараз відповідаємо
window.replyToId = {}; 

window.initReply = function(postId, commentId, authorName) {
    const input = document.getElementById(`inline-comment-input-${postId}`);
    if (!input) return;

    // Зберігаємо ID батьківського коментаря для цього поста
    window.replyToId[postId] = commentId;

    // Додаємо візуальну підказку в поле вводу
    input.placeholder = `Відповідь для ${authorName}...`;
    input.focus();
    
    // Прокручуємо до поля вводу, якщо воно далеко
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
// ==========================================
// 5. ДІЇ З КОМЕНТАРЯМИ
// ==========================================

window.likeComment = function(btnElement) {
    if (btnElement.style.color === 'rgb(76, 175, 80)') {
        btnElement.style.color = '#888'; 
    } else {
        btnElement.style.color = '#4CAF50'; 
        btnElement.nextElementSibling.style.color = '#888'; 
    }
};

window.dislikeComment = function(btnElement) {
    if (btnElement.style.color === 'rgb(244, 67, 54)') {
        btnElement.style.color = '#888'; 
    } else {
        btnElement.style.color = '#F44336'; 
        btnElement.previousElementSibling.style.color = '#888'; 
    }
};

window.replyToComment = function(postId, commentId, authorName) {
    console.log(`[DEBUG] Готуємо відповідь: PostID=${postId}, ParentID=${commentId}`); // ПЕРЕВІРКА В КОНСОЛІ
    window.replyStates[postId] = commentId; 
    const textarea = document.getElementById(`inline-comment-input-${postId}`);
    if (textarea) {
        textarea.placeholder = `Відповідь для ${authorName}...`; 
        textarea.focus();
    }
};

window.reportComment = function(commentId) {
    alert("Скаргу на цей коментар успішно відправлено модераторам!");
};
window.submitInlineComment = async function(postId) {
    const cleanId = postId.toString().replace('post-', '');
    const inputDiv = document.getElementById(`inline-comment-input-${cleanId}`);
    if (!inputDiv) return;

    // Створюємо копію контенту для обробки
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = inputDiv.innerHTML;

    // Магія: замінюємо всі <img> назад на їхні текстові коди
    tempDiv.querySelectorAll('img').forEach(img => {
        const code = img.getAttribute('data-code') || img.getAttribute('data-emoji');
        if (code) {
            img.replaceWith(code); // Міняємо картинку на текст :custom1: або ❤️
        }
    });

    const bodyText = tempDiv.innerText.trim();
    const stickerUrl = (window.selectedStickers && window.selectedStickers[cleanId]) ? window.selectedStickers[cleanId] : null;

    if (!bodyText && !stickerUrl) return;

    try {
        const response = await fetch('save_comment.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                post_id: cleanId,
                body: bodyText,
                sticker: stickerUrl,
                parent_id: window.replyToId ? window.replyToId[cleanId] : 0
            }),
            credentials: 'include'
        });

        const result = await response.json();
        
        if (result.success) {
            // Очищаємо поле (div)
            inputDiv.innerHTML = '';
            
            // Ховаємо прев'ю великої гіфки (якщо вона була)
            const previewContainer = document.getElementById(`selected-sticker-preview-${cleanId}`);
            if (previewContainer) {
                previewContainer.style.display = 'none';
                previewContainer.innerHTML = '';
            }
            if (window.selectedStickers) window.selectedStickers[cleanId] = null;

            // Оновлюємо список
            loadInlineComments(cleanId);
        }
    } catch (e) {
        console.error("Помилка відправки:", e);
    }
};
window.toggleRepliesList = function(commentId, btnElement, count) {
    // Шукаємо контейнер
    const container = document.getElementById(`replies-container-${commentId}`);
    
    // Перевірка (щоб уникнути помилок)
    if (!container) {
        console.error("Контейнер відповідей не знайдено!");
        return; 
    }
    
    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block'; // Розгортаємо
        btnElement.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
            Сховати відповіді
        `;
    } else {
        container.style.display = 'none'; // Згортаємо
        btnElement.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            Показати відповіді (${count})
        `;
    }
};

// ==========================================
// 6. ВИДАЛЕННЯ (ПОСТИ ТА КОМЕНТАРІ)
// ==========================================

window.deleteMyPost = async function(postId, authorName) {
    if (!confirm("Ви впевнені, що хочете видалити цей пост?")) return;
    
    try {
        const response = await fetch('delete_post.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ post_id: postId, author_name: authorName })
        });
        
        const result = await response.json();
        if (result.success) {
    const postNode = document.getElementById('post-' + postId);
    if (postNode) {
        postNode.style.transition = 'opacity 0.3s';
        postNode.style.opacity = '0';
        setTimeout(() => postNode.remove(), 300);
    }
}
    } catch (e) {
        console.error("Помилка видалення:", e);
    }
};

window.deleteMyComment = async function(commentId, postId, authorName) {
    if (!confirm('Видалити цей коментар?')) return;
    
    // Підстраховка: беремо дані з пам'яті, якщо їх немає
    const safeAuthorName = authorName || localStorage.getItem('user_name') || "Gamer";
    const currentUserId = localStorage.getItem('user_id') || 0;

    try {
        const response = await fetch('delete_comment.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                comment_id: commentId,
                author_name: safeAuthorName,
                user_id: currentUserId // Відправляємо ID для надійності
            }),
            credentials: 'include'
        });

        const result = await response.json();
        if (result.success) {
            loadInlineComments(postId); // Одразу оновлюємо список
        } else {
            console.error("Помилка від сервера:", result.message);
        }
    } catch (e) {
        console.error("Помилка запиту видалення:", e);
    }
};
// ==========================================
// 7. СИСТЕМА ЛАЙКІВ
// ==========================================

// Лайки для постів
window.handleVote = function(button, type, postId) {
    const votingGroup = button.closest('.voting');
    const countElement = votingGroup.querySelector('.vote-count');
    const upBtn = votingGroup.querySelector('.upvote');
    const downBtn = votingGroup.querySelector('.downvote');

    let currentVote = parseInt(votingGroup.getAttribute('data-user-vote')) || 0;
    let newVote = (currentVote === type) ? 0 : type; // Якщо натиснути ще раз - голос знімається

    let currentCount = parseInt(countElement.innerText) || 0;
    let newCount = currentCount - currentVote + newVote;

    // Миттєво міняємо інтерфейс
    countElement.innerText = newCount;
    votingGroup.setAttribute('data-user-vote', newVote);
    upBtn.style.color = (newVote === 1) ? '#4CAF50' : 'white';
    downBtn.style.color = (newVote === -1) ? '#F44336' : 'white';

    // Відправляємо в базу
    fetch('vote.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ item_type: 'post', item_id: postId, vote_value: newVote })
    });
};

window.voteComment = async function(element, commentId) {
    // Захист від спаму кліками
    if (element.classList.contains('is-processing')) return;
    element.classList.add('is-processing');

    const countSpan = element.querySelector('.comment-vote-count');
    let currentCount = parseInt(countSpan.innerText) || 0;
    
    // Перевіряємо, чи вже стоїть лайк
    const isCurrentlyLiked = element.classList.contains('liked');
    const currentUserId = localStorage.getItem('user_id') || 0;

    // МИТТЄВЕ ВІЗУАЛЬНЕ ОНОВЛЕННЯ (Неон)
    if (isCurrentlyLiked) {
        // Знімаємо лайк
        element.classList.remove('liked');
        currentCount--;
    } else {
        // Ставимо лайк
        element.classList.add('liked');
        currentCount++;
    }
    
    // Оновлюємо цифру
    countSpan.innerText = currentCount > 0 ? currentCount : '';

    // Відправляємо дані на сервер
    try {
        const response = await fetch('vote.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                comment_id: commentId,
                user_id: currentUserId,
                action: isCurrentlyLiked ? 'unlike' : 'like' 
            }),
            credentials: 'include'
        });
        
        // === РОЗУМНА ПЕРЕВІРКА ВІДПОВІДІ ===
        const textData = await response.text(); // Спочатку читаємо як звичайний текст
        
        try {
            const result = JSON.parse(textData); // Пробуємо перетворити в JSON
            if (!result.success) {
                console.error("Помилка бази даних:", result.message);
                // Повертаємо візуальний стан назад, якщо сталася помилка
                if (isCurrentlyLiked) {
                    element.classList.add('liked');
                    countSpan.innerText = currentCount + 1;
                } else {
                    element.classList.remove('liked');
                    countSpan.innerText = currentCount > 1 ? currentCount - 1 : '';
                }
            }
        } catch (parseError) {
            // Якщо це не JSON (а HTML), виводимо його в консоль, щоб зрозуміти проблему
            console.error("🚨 Сервер повернув HTML замість JSON! Ось що він надіслав:");
            console.error(textData); 
        }

    } catch (e) {
        console.error("Помилка мережі:", e);
    } finally {
        element.classList.remove('is-processing');
    }
};
// Функція для красивого відображення часу (ДД.ММ о ГГ:ХВ)
window.formatDate = function(dateString) {
    if (!dateString) return '';
    // Fix для Safari/iOS, щоб час правильно читався
    const safeDateString = dateString.replace(' ', 'T');
    const d = new Date(safeDateString);
    if (isNaN(d.getTime())) return ''; 
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}.${month} о ${hours}:${minutes}`;
};

async function loadUserGamesUI() {
    try {
        const response = await fetch('get_user_games.php', { 
    credentials: 'include',
    headers: {
        'ngrok-skip-browser-warning': 'true' // 👈 І тут також
    }
});
        const selectedGames = await response.json();

        
        const container = document.getElementById('media-upload-container');
        if (!container) return;

        // 1. Очищаємо панель
        container.innerHTML = '';

        // 2. Рахуємо реально додані ігри
        let renderedCount = 0;

        if (Array.isArray(selectedGames)) {
            selectedGames.forEach(gameObj => {
                // ...
const gameName = gameObj.game_name;
const isMuted = parseInt(gameObj.is_muted) === 1;

// 1. Приводимо назву з бази до нижнього регістру і прибираємо пробіли по краях
const searchName = gameName.toLowerCase().trim();

let gameData = null;
for (let g of myGamesLibrary) {
    // 2. Порівнюємо імена без врахування регістру
    if (g.name.toLowerCase().trim() === searchName) { 
        gameData = g; 
        break; 
    }
    if (g.modes) {
        let mode = g.modes.find(m => m.name.toLowerCase().trim() === searchName);
        if (mode) { 
            gameData = mode; 
            break; 
        }
    }
}

// 3. ✨ СУПЕР-ФІКС: Якщо картинку не знайшли, робимо заглушку!
if (!gameData) {
    gameData = {
        name: gameName, // Беремо оригінальну назву
        img: 'img/placeholder.png' // 👈 Встав сюди шлях до якоїсь стандартної картинки (або залиш порожнім, фон буде чорним)
    };
    console.warn(`Картинку для ${gameName} не знайдено в бібліотеці, використано заглушку.`);
}


if (gameData) {
    renderedCount++;
                    const wrapper = document.createElement('div');
                    wrapper.className = 'preview-item-wrapper';
                    wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; width: 45px; flex-shrink: 0; gap: 6px;';
                   wrapper.innerHTML = `
    <div class="image-preview-box filled ${isMuted ? 'muted-game' : ''}" onclick="addPhotoPlaceholder(this)" style="width: 45px; height: 45px; border-radius: 10px; overflow: hidden; background: #2a2a2a; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center;">
        <img src="${gameData.img}" alt="preview" onerror="this.onerror=null;this.src='img/default_avatar.png';" style="width: 100%; height: 100%; object-fit: cover;">
    </div>
    <div class="preview-mini-title" title="${gameData.name}">${gameData.name}</div>
`;
                    container.appendChild(wrapper);
                }
            });
        }

        // 3. ГОЛОВНЕ: Якщо ігор менше 4, ДОДАЄМО ПЛЮСИК (щоб не було пусто)
        if (renderedCount < 4) {
            createNewPlusBox(container);
        }
        
        // 4. Тільки тепер вантажимо пости
        loadAllPosts(true);
        
    } catch (e) {
        console.error("Критична помилка панелі ігор:", e);
        // Якщо все зламалося, хоча б покажемо один порожній квадрат
        const container = document.getElementById('media-upload-container');
        if (container) {
            container.innerHTML = '';
            createNewPlusBox(container);
        }
        loadAllPosts(true);
    }
}

window.mutePhoto = async function() {
    if (currentActiveTarget) {
        // Отримуємо назву гри з підпису під іконкою
        const gameName = currentActiveTarget.parentNode.querySelector('.preview-mini-title')?.innerText.trim();
        
        if (!gameName) return;

        try {
            const response = await fetch('save_user_game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game_name: gameName, action: 'toggle_mute' }),
                credentials: 'include'
            });

            if (response.ok) {
                // Візуально перемикаємо клас
                currentActiveTarget.classList.toggle('muted-game');
                // Оновлюємо пости
                loadAllPosts(true);
            }
        } catch (e) {
            console.error("Помилка при глушінні гри:", e);
        }
        
        document.getElementById('custom-context-menu').style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadMutualFriends();
});

async function loadMutualFriends() {
    const chatList = document.getElementById('personal-chats');
    if (!chatList) return;

    try {
        const response = await fetch('get_mutual_friends.php', { credentials: 'include', cache: 'no-store' });
        const data = await response.json();

        if (data.success && data.friends.length > 0) {
            // Прибираємо напис про відсутність друзів, якщо він там був
            if (chatList.innerHTML.includes('Немає взаємних підписок')) {
                chatList.innerHTML = '';
            }

            data.friends.forEach(friend => {
                const avatar = window.getSafeAvatarUrl(friend.avatar_url || friend.avatar);
                const unreadCount = parseInt(friend.unread_count) || parseInt(friend.unread) || 0;
                
                let existingItem = document.getElementById(`chat-item-${friend.id}`);
                
                if (existingItem) {
                    // Якщо чат вже є — просто оновлюємо бейдж
                    const badgeContainer = existingItem.querySelector('.chat-info');
                    let existingBadge = document.getElementById(`unread-badge-${friend.id}`);
                    
                    if (unreadCount > 0 && !(window.currentChatUserId == friend.id && document.getElementById('chat-window').style.display !== 'none')) {
                        const displayCount = unreadCount > 99 ? '99+' : unreadCount;
                        if (existingBadge) {
                            existingBadge.innerText = displayCount;
                            existingBadge.style.display = 'flex';
                        } else {
                            badgeContainer.insertAdjacentHTML('beforeend', `<span id="unread-badge-${friend.id}" style="background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(4px); color: white; font-size: 11px; font-weight: bold; border-radius: 50px; padding: 0 6px; min-width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); box-sizing: border-box;">${displayCount}</span>`);
                        }
                    } else if (existingBadge) {
                        existingBadge.style.display = 'none'; // Ховаємо, якщо прочитано
                    }
                } else {
                    // Якщо такого чату ще немає — додаємо його
                    let unreadBadge = '';
if (unreadCount > 0) {
    const displayCount = unreadCount > 99 ? '99+' : unreadCount;
    unreadBadge = `<span id="unread-badge-${friend.id}" style="background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(4px); color: white; font-size: 11px; font-weight: bold; border-radius: 50px; padding: 0 6px; min-width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); box-sizing: border-box;">${displayCount}</span>`; 
}

const friendItem = `
    <div class="chat-item" id="chat-item-${friend.id}" onclick="window.openChatUI('${friend.id}', '${friend.username}', '${avatar}')" style="display: flex; align-items: center; padding: 8px 12px; cursor: pointer; border-radius: 10px; transition: background 0.2s ease;">
        
        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; max-width: 100%;">
            <img src="${avatar}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.1);">
            <span class="chat-name" style="margin: 0 !important; padding: 0 !important; text-align: left !important; font-weight: 600; color: #eaeaea; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block !important;">
                ${friend.username}
            </span>
            <div style="flex-shrink: 0; display: flex; align-items: center;">
                ${unreadBadge}
            </div>
        </div>

    </div>
`;
                    
                    // 🔥 ГОЛОВНИЙ ФІКС: додаємо сформований HTML в контейнер 🔥
                    chatList.insertAdjacentHTML('beforeend', friendItem);
                }
            });
        } else {
            chatList.innerHTML = '<div style="padding:10px; color:#666; font-size:12px; text-align:center;">Немає взаємних підписок</div>';
        }
    } catch (e) {
        console.error("Помилка завантаження друзів:", e);
    }
}
// === 1. ГЛОБАЛЬНІ ЗМІННІ (Обов'язково на початку) ===
window.currentChatUserId = null;
window.mediaRecorder = null;
window.audioChunks = [];
window.isRecording = false;

// Іконки статусу (SVG)


// === 2. ФУНКЦІЯ ВІДКРИТТЯ ЧАТУ ===
window.openChatUI = function(userId, userName, userAvatar) {
    window.currentChatUserId = userId;
    
    // 1. Ховаємо бейдж і кажемо серверу, що ми все прочитали
    const badge = document.getElementById(`unread-badge-${userId}`);
    if (badge) {
        badge.style.display = 'none'; 
        fetch(`mark_read.php?target_id=${userId}`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => console.log("Повідомлення прочитані:", data))
            .catch(err => console.error("Помилка скидання лічильника:", err));
    }

    // 2. Керування видимістю вкладок
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const postPanel = document.getElementById('create-post-panel');
    if (postPanel) postPanel.style.display = 'none';

    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active-tab'));
    document.querySelectorAll('.chat-item').forEach(item => item.style.background = 'transparent');
    
    const activeChatItem = document.getElementById(`chat-item-${userId}`);
    if (activeChatItem) activeChatItem.style.background = '#2A1520'; 

    const chatWin = document.getElementById('chat-window');
    const parentBox = chatWin.parentElement; 
    if (parentBox) {
        parentBox.style.position = 'relative'; 
        parentBox.style.overflow = 'hidden';   
    }

    // Показуємо сам чат
    chatWin.style.display = 'flex';

    // 3. Завантаження шпалер для зони повідомлень
    const msgContainer = document.getElementById('chat-messages');
    if (msgContainer) {
        const savedBg = localStorage.getItem('custom_chat_wallpaper_' + userId);
        if (savedBg) {
            msgContainer.style.background = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${savedBg}')`;
            msgContainer.style.backgroundSize = 'cover';
            msgContainer.style.backgroundPosition = 'center';
            msgContainer.style.backgroundRepeat = 'no-repeat';
            msgContainer.style.backgroundAttachment = 'scroll';
        } else {
            msgContainer.style.background = '#170A11'; // Темний фон за замовчуванням
        }
    }
    
    // 4. Оновлення шапки чату
    const targetName = document.getElementById('chat-target-name');
    const targetAvatar = document.getElementById('chat-target-avatar');

    if(targetName) targetName.innerText = userName;
    if(targetAvatar) targetAvatar.src = userAvatar;
    if(targetName) targetName.style.cursor = 'pointer';
    if(targetAvatar) targetAvatar.style.cursor = 'pointer';
    if(targetName) targetName.onclick = () => window.location.href = `profile.html?id=${userId}`;
    if(targetAvatar) targetAvatar.onclick = () => window.location.href = `profile.html?id=${userId}`;

    // 5. ПРИЗНАЧАЄМО ФУНКЦІЇ ДЛЯ ІКОНОК З HTML (Без дублювання коду)
    
    // --- Іконки в шапці ---
    // Шукаємо їх по порядку. Якщо ти додав їх у HTML точно за моєю інструкцією:
    // 1: Дзвінок, 2: Відео, 3: Видалити, 4: Блок
    const headerIcons = document.querySelectorAll('.chat-header-icons svg');
    if (headerIcons.length >= 4) {
        headerIcons[0].onclick = () => window.startAudioCall(userId);
        headerIcons[1].onclick = () => window.startVideoCall(userId);
        headerIcons[2].onclick = () => window.openDeleteChatModal(userId, userName);
        headerIcons[3].onclick = () => window.blockUserFromChat(userId, userName);
    }

    // --- Іконки біля поля вводу ---
    // 1: Скріпка, 2: Мікрофон, 3: GIF
    const inputIcons = document.querySelectorAll('.chat-input-icons svg');
    if (inputIcons.length >= 3) {
        // Для скріпки (фото)
        inputIcons[0].onclick = () => {
            let photoInput = document.getElementById('chat-photo-input');
            if (!photoInput) {
                // Створюємо невидимий інпут для файлів, якщо його немає
                photoInput = document.createElement('input');
                photoInput.type = 'file';
                photoInput.id = 'chat-photo-input';
                photoInput.accept = 'image/*';
                photoInput.style.display = 'none';
                photoInput.onchange = function() { window.sendChatMedia(this, 'image'); };
                document.body.appendChild(photoInput);
            }
            photoInput.click();
        };
        
        // Для мікрофону
        inputIcons[1].onclick = () => window.toggleVoiceRecord();
        inputIcons[1].id = 'chat-mic-btn'; // Даємо ID для анімації пульсації
        
        // Для GIF
        inputIcons[2].onclick = () => window.toggleGifPicker();
    }


    // 6. Завантаження повідомлень
    loadChatMessages(userId, true); 

    // 7. Перевірка блокування (залишено один раз, дубль видалено)
    fetch(`check_block.php?target_id=${userId}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            const msgInput = document.getElementById('msg-input');
            const sendBtn = document.getElementById('send-btn');
            const inputIconsContainer = document.querySelector('.chat-input-icons');

            if (data.i_blocked_him) {
                if(typeof window.toggleBlockUI === 'function') window.toggleBlockUI(true, userId, userName);
            } else if (data.he_blocked_me) {
                // Якщо нас заблокували - ховаємо поле вводу і кнопки
                if (msgInput) msgInput.style.display = 'none';
                if (sendBtn) sendBtn.style.display = 'none';
                if (inputIconsContainer) inputIconsContainer.style.display = 'none';
                
                if(targetName) targetName.innerText = "Анонімний користувач";
                if(targetAvatar) targetAvatar.src = "img/default_avatar.png"; 
                if(targetName) targetName.onclick = null; 
                if(targetAvatar) targetAvatar.onclick = null;
            } else {
                // Все добре - показуємо інтерфейс
                if(typeof window.toggleBlockUI === 'function') window.toggleBlockUI(false, userId, userName);
                if (msgInput) msgInput.style.display = 'block';
                if (sendBtn) sendBtn.style.display = 'block';
                if (inputIconsContainer) inputIconsContainer.style.display = 'flex';
            }
        });
        // Скидаємо кнопку прокрутки при відкритті нового чату
    const scrollBtn = document.getElementById('chat-scroll-to-bottom-btn');
    if (scrollBtn) {
        scrollBtn.style.display = 'none';
        const counter = document.getElementById('chat-unread-counter');
        if(counter) {
            counter.style.display = 'none';
            counter.innerText = '0';
        }
    }

    setTimeout(() => {
        if(typeof window.updateWallpaperButtonUI === 'function') window.updateWallpaperButtonUI();
    }, 50); 
    
};

// Функція для GIF та відправки
window.sendGif = function(gifUrl) {
    if (!currentChatUserId) return;
    const formData = new FormData();
    formData.append('receiver_id', currentChatUserId);
    formData.append('text', gifUrl); // Гіфка йде як текст
    formData.append('media_type', 'text');
    uploadFormData(formData);
};
window.getChatTime = function(dateString) {
    const d = dateString ? new Date(dateString.replace(' ', 'T')) : new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

// === 4. ПІКЕР СТІКЕРІВ (Щоб кнопка GIF працювала) ===
const myStickers = [
    { name: "LOL", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueXF4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKVUn7iM8FMEU24/giphy.gif" },
    { name: "Dance", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueXF4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/l3vRlTKu2RQwk8Yz6/giphy.gif" }
];

window.toggleGifPicker = async function() {
    let picker = document.getElementById('gif-picker-window');
    
    if (!picker) {
       const html = `
<div id="gif-picker-window" style="display:none; position:absolute; bottom:150px; left:576px; width:320px; height:450px; background:#2A1520; border-radius:16px; border:1px solid rgba(255,255,255,0.08); box-shadow: 0 15px 35px rgba(0,0,0,0.5); flex-direction:column; z-index:10000; padding:20px; overflow-y:auto; box-sizing: border-box;">
    
    <div style="color: #ffffff; font-size: 15px; margin-bottom: 12px; font-weight: 600; font-family: sans-serif;">Ваші стікери</div>
    <div id="saved-stickers-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;"></div>
    
    <div style="color: #ffffff; font-size: 15px; margin-bottom: 12px; font-weight: 600; font-family: sans-serif;">Стандартні</div>
    <div id="standard-stickers-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;"></div>

</div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        picker = document.getElementById('gif-picker-window');
    }

    if (picker.style.display === 'none' || picker.style.display === '') {
        // Відкриваємо пікер
        await loadMyStickersFromServer(); // Тепер async працює коректно
        
        const savedGrid = document.getElementById('saved-stickers-grid');
        const standardGrid = document.getElementById('standard-stickers-grid');
        
        if (savedGrid) renderSavedStickersUI(savedGrid);
        if (standardGrid) renderStandardStickers(); // Викликаємо рендер стандартних

        picker.style.display = 'flex';
    } else {
        // Закриваємо пікер
        picker.style.display = 'none';
    }
};
window.sendGif = function(gifUrl) {
    const formData = new FormData();
    formData.append('receiver_id', currentChatUserId);
    formData.append('text', gifUrl); // Відправляємо посилання як текст
    formData.append('media_type', 'text');
    uploadFormData(formData);
};
// === ВІДПРАВКА ФОТО/ФАЙЛІВ ===
window.sendChatMedia = async function(inputElement, type) {
    if (!inputElement.files || !inputElement.files[0] || !currentChatUserId) return;

    const file = inputElement.files[0];
    const formData = new FormData();
    formData.append('receiver_id', currentChatUserId);
    formData.append('text', '');
    formData.append('media_type', type);
    formData.append('file', file);

    inputElement.value = ''; // Скидаємо input
    await uploadFormData(formData);
};

// === ЗАПИС ТА ВІДПРАВКА ГОЛОСОВОГО (ВИПРАВЛЕНО) ===
window.toggleVoiceRecord = async function() {
    const micBtn = document.getElementById('chat-mic-btn');
    
    if (!window.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
            
            window.mediaRecorder = new MediaRecorder(stream, { mimeType });
            window.audioChunks = [];

            window.mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) window.audioChunks.push(e.data);
            };

            window.mediaRecorder.onstop = async () => {
                // ПОВЕРТАЄМО колір мікрофона в норму, коли запис зупинено
                micBtn.style.color = '#aaa';
                micBtn.classList.remove('recording-active');

                const audioBlob = new Blob(window.audioChunks, { type: mimeType });
                stream.getTracks().forEach(track => track.stop());

                if (audioBlob.size > 500) {
                    const formData = new FormData();
                    formData.append('receiver_id', window.currentChatUserId);
                    formData.append('media_type', 'audio');
                    const ext = mimeType.includes('webm') ? 'webm' : 'm4a';
                    formData.append('file', audioBlob, `voice_${Date.now()}.${ext}`);
                    await window.uploadFormData(formData);
                }
            };

            window.mediaRecorder.start();
            window.isRecording = true;
            
            // ВСТАНОВЛЮЄМО червоний колір
            micBtn.style.color = '#ff4d4d'; 
            micBtn.classList.add('recording-active'); // Для анімації (опціонально)
            
        } catch (err) {
            console.error("ДЕТАЛЬНА ПОМИЛКА МІКРОФОНА:", err.name, err.message);
            
            let errorReason = "Невідома помилка";
            if (err.name === 'NotAllowedError') errorReason = "Браузер або Windows/Mac заблокували доступ.";
            if (err.name === 'NotFoundError') errorReason = "Мікрофон фізично не підключено або не знайдено.";
            if (err.name === 'NotReadableError') errorReason = "Мікрофон зайнятий іншою програмою (Discord, Zoom тощо).";
            if (err.name === 'SecurityError' || (err.message && err.message.includes('secure'))) errorReason = "Браузер вимагає HTTPS!";

            // Показуємо точну причину на екрані
            if (typeof window.showTopAlert === 'function') {
                window.showTopAlert(`Мікрофон вимкнено: ${errorReason}`);
            } else {
                alert(`Мікрофон вимкнено: ${errorReason} (${err.name})`);
            }
        }
    } else {
        if (window.mediaRecorder) window.mediaRecorder.stop();
        window.isRecording = false;
        // Колір зміниться в події onstop (вище)
    }
};
// УНІВЕРСАЛЬНА ФУНКЦІЯ ВІДПРАВКИ НА СЕРВЕР
window.uploadFormData = async function(formData) {
    try {
        const response = await fetch('save_message.php', {
            method: 'POST',
            body: formData, // JSON тут не використовуємо
            credentials: 'include'
        });
        const result = await response.json();
        
        if (result.success) {
            // Оновлюємо чат після успішної відправки
            loadChatMessages(currentChatUserId).then(() => {
                const msgContainer = document.getElementById('chat-messages');
                msgContainer.scrollTop = msgContainer.scrollHeight;
            });
        } else {
            alert(result.message || 'Помилка відправки');
        }
    } catch (e) {
        console.error("Помилка:", e);
    }
};
window.loadChatMessages = async function(friendId, isInitialLoad = false) {
    const msgContainer = document.getElementById('chat-messages');
    if (!msgContainer || window.isRecording) return; 

    // Отключаем нативный якорь браузера, который может ломать наш скролл
    if (!msgContainer.hasAttribute('data-scroll-init')) {
        window.setupChatScrollListener();
        msgContainer.style.overflowAnchor = 'none'; 
        msgContainer.setAttribute('data-scroll-init', 'true');
    }

    const currentScrollTop = msgContainer.scrollTop;
    // Используем Math.abs и увеличили порог до 60px для надежности на разных экранах
    const isAtBottom = Math.abs(msgContainer.scrollHeight - msgContainer.scrollTop - msgContainer.clientHeight) <= 60;

    // === АБСОЛЮТНЫЙ ЭКРАННЫЙ ЯКОРЬ ===
    let anchorMsgId = null;
    let anchorOffset = 0;

    if (!isAtBottom && !isInitialLoad) {
        const messages = msgContainer.querySelectorAll('.msg-row');
        for (let msg of messages) {
            // Ищем первое сообщение, которое сейчас находится в видимой зоне
            if (msg.offsetTop + msg.offsetHeight > msgContainer.scrollTop) {
                anchorMsgId = msg.getAttribute('data-id');
                // Запоминаем точную дистанцию от верха видимой области до сообщения
                anchorOffset = msg.offsetTop - msgContainer.scrollTop;
                break;
            }
        }
    }

    try {
        const response = await fetch(`get_messages.php?friend_id=${friendId}`, { credentials: 'include' });
        const messages = await response.json();
        
        if (currentChatUserId !== friendId) return;

        let newHtml = '';
        let lastMessageIsMe = false;
        let unreadIncomingCount = 0;

        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            lastMessageIsMe = (lastMsg.is_me == 1 || lastMsg.is_me == true);
            unreadIncomingCount = messages.filter(msg => !(msg.is_me == 1 || msg.is_me == true) && !(msg.is_read == 1 || msg.is_read == true)).length;
        }

        // ============================================
        // ТВОЙ КОД ГЕНЕРАЦИИ HTML (Оставлен без изменений)
        messages.forEach(msg => {
            const safeMsgId = msg.id || msg.message_id || msg.ID;
            const isMe = msg.is_me == 1 || msg.is_me == true;
            const isRead = msg.is_read == 1 || msg.is_read == true;
            const timeStr = getChatTime(msg.created_at);
            
            const checkColor = isMe ? '#1A1A1A' : '#E6AEC9'; 
            const checkOpacity = isRead ? '1' : '0.5';
            
            let statusIcon = isMe ? 
                `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${checkColor}" stroke-width="2" style="opacity: ${checkOpacity}; margin-left: 2px;">
                    ${isRead ? '<polyline points="18 6 7 17 2 12"></polyline><polyline points="22 6 11 17 8 14"></polyline>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                 </svg>` : '';
            
            let isEditedLocal = false;
            const existingMsgNode = document.querySelector(`.msg-row[data-id="${safeMsgId}"]`);
            if (existingMsgNode && existingMsgNode.innerHTML.includes('(ред.)')) { isEditedLocal = true; }
            const isEdited = msg.is_edited == 1 || msg.is_edited == true || isEditedLocal;
            const editedHTML = isEdited ? `<span style="font-size: 9px; opacity: 0.6; margin-right: 4px;">(ред.)</span>` : '';

            let textContent = msg.message ? msg.message.trim() : '';
            let isGif = textContent.includes('giphy.com') || textContent.includes('tenor.com') || textContent.toLowerCase().endsWith('.gif') || (textContent.startsWith('http') && textContent.includes('/media/'));

            let messageBody = '';
            let extraClass = ''; 
            
            let reactionHTML = '';
            if (msg.reaction && msg.reaction.trim() !== '') {
                const myAvatarEl = document.querySelector('.current-user-avatar') || document.getElementById('top-bar-avatar');
                const myAvatarUrl = myAvatarEl ? myAvatarEl.getAttribute('src') : 'img/default_avatar.png';
                const targetAvatarEl = document.getElementById('chat-target-avatar');
                const targetAvatarUrl = targetAvatarEl ? targetAvatarEl.getAttribute('src') : 'img/default_avatar.png';

                let reactionsArray = [];
                try {
                    reactionsArray = JSON.parse(msg.reaction);
                    if (!Array.isArray(reactionsArray)) throw new Error();
                } catch (e) {
                    reactionsArray = [{ emoji: msg.reaction.trim(), avatar: myAvatarUrl, is_mine: true }];
                }

                if (reactionsArray.length > 0) {
                    let badgesHTML = reactionsArray.map(r => {
                        let rText = String(r.emoji || r.reaction || r).trim(); 
                        let isMineAttr = r.is_mine ? 'true' : 'false';
                        let rawAvatar = r.avatar || (r.is_mine ? myAvatarUrl : targetAvatarUrl);
                        let rAvatar = window.getSafeAvatarUrl(rawAvatar);
                        let imgSrc = window.appleEmojis ? window.appleEmojis[rText] : '';
                        let displayContent = imgSrc ? `<img src="${imgSrc}" style="width:14px; height:14px; display:block;">` : rText;

                        return `
                        <div class="msg-reaction-badge" data-reaction="${rText}" data-mine="${isMineAttr}" onclick="window.reactToMessage('${rText}', '${safeMsgId}', event)">
                            ${displayContent}
                            <img src="${rAvatar}" onerror="this.onerror=null; this.src='img/default_avatar.png';" style="width:14px; height:14px; border-radius:50%; object-fit:cover;">
                        </div>`;
                    }).join('');
                    
                    reactionHTML = `<div class="msg-reactions-container">${badgesHTML}</div>`;
                }
            }

            if (msg.media_type === 'audio') {
                extraClass = 'media-only-container';
                const textColor = '#F70087'; 
                const lineBg = isMe ? 'rgba(26, 26, 26, 0.2)' : 'rgba(230, 174, 201, 0.2)';
                const containerBg = isMe ? '#E6AEC9' : '#2A1520';
                
                messageBody = `
                    <div class="voice-msg-container" style="display: flex; align-items: center; gap: 10px; background: ${containerBg}; padding: 6px 12px !important; border-radius: 14px; width: 220px; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                        <button class="voice-play-btn" onclick="window.playVoice(this, '${msg.media_url}')" style="background: #F70087; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.2s;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 2px;"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        
                        <div style="display: flex; flex-direction: column; flex-grow: 1;">
                            <div class="voice-progress-track" style="width: 100%; height: 2px; background: ${lineBg}; position: relative; border-radius: 2px; margin-bottom: 5px; cursor: pointer;">
                                <div class="voice-progress-fill" style="position: absolute; left: 0; top: 0; height: 100%; width: 0%; background: #F70087; border-radius: 2px;"></div>
                                <div class="voice-progress-thumb" style="position: absolute; left: 0%; top: -3px; width: 8px; height: 8px; background: #F70087; border-radius: 50%;"></div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; line-height: 1;">
                                <span class="voice-time-current" style="font-size: 10px; color: ${textColor}; font-weight: 600;">0:00 / 0:00</span>
                                <div style="font-size: 9px; opacity: 0.7; color: ${isMe ? '#1A1A1A' : '#E6AEC9'}; display: flex; align-items: center; gap: 2px;">
                                    <span>${timeStr}</span>
                                    ${statusIcon}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else if (msg.media_type === 'image' || isGif || msg.media_type === 'video') {
                extraClass = 'media-only-container';
                let src = isGif ? textContent : msg.media_url;
                let mediaElement = msg.media_type === 'video' 
                    ? `<video src="${src}" autoplay loop muted playsinline style="max-width: 100%; border-radius: 12px; display: block; cursor: pointer; min-height: 150px;"></video>`
                    : `<img src="${src}" style="max-width: 100%; border-radius: 12px; display: block; cursor: zoom-in; min-height: 150px;" onclick="window.open('${src}', '_blank')">`;

                messageBody = `
                    <div class="sticker-hover-container media-sticker-wrapper" style="position: relative; max-width: 250px;">
                        ${mediaElement}
                        <button class="save-sticker-btn" onclick="window.saveToStickers('${src}')">★</button>
                    </div>
                `;
            } else {
                messageBody = `<div style="font-size: 14px; line-height: 1.3; word-break: break-word;">${textContent}</div>`;
            }

            let bubbleWrapper = '';
            
            if (extraClass === 'media-only-container') {
                if (msg.media_type === 'audio') {
                    bubbleWrapper = messageBody;
                } else {
                    bubbleWrapper = `
                        ${messageBody}
                        <div style="font-size: 10px; opacity: 0.7; display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 4px; color: white;">
                            <span>${timeStr}</span>
                            ${statusIcon}
                        </div>
                    `;
                }
            } else {
                let bubbleClass = isMe ? 'msg-bubble msg-sent' : 'msg-bubble msg-received';
                bubbleWrapper = `
                    <div class="${bubbleClass}" style="position: relative; cursor: context-menu; padding: 6px 12px !important; border-radius: 14px; min-width: 60px;">
                        ${messageBody}
                        <div style="font-size: 9px; opacity: 0.7; display: flex; justify-content: flex-end; align-items: center; gap: 3px; margin-top: 2px; margin-bottom: -2px;">
                            ${editedHTML}
                            <span>${timeStr}</span>
                            ${statusIcon}
                        </div>
                    </div>
                `;
            }

            newHtml += `
                <div class="msg-row" data-id="${safeMsgId}" oncontextmenu="return window.showMsgMenu(event, this);" style="display: flex; flex-direction: column; width: 100%; margin-bottom: 6px; align-items: ${isMe ? 'flex-end' : 'flex-start'};">
                    ${bubbleWrapper}
                    ${reactionHTML}
                </div>`;
                
        });
        // КОНЕЦ ГЕНЕРАЦИИ HTML
        // ============================================

        if (msgContainer.getAttribute('data-raw-html') !== newHtml) {
            
            window.isChatRestoring = true; 

            // Скрываем скроллбар на долю секунды, чтобы не было визуального дергания
            msgContainer.style.overflowY = 'hidden';
            msgContainer.innerHTML = newHtml;
            msgContainer.setAttribute('data-raw-html', newHtml); 

            // Коригування скролу після завантаження картинок
const newImages = msgContainer.querySelectorAll('img');
newImages.forEach(img => {
    img.onload = () => {
        if (!isAtBottom && !window.isChatRestoring) {
            // Якщо користувач читає історію, а картинка завантажилась і розширилась, 
            // треба підтримувати якір. 
            // (Але зазвичай min-height або фіксований aspect-ratio вирішує 99% проблем)
        }
    };
});
            
            requestAnimationFrame(() => {
                if (isInitialLoad) {
                    const savedScrollState = localStorage.getItem('chat_scroll_' + friendId);
                    
                    if (unreadIncomingCount > 0 || savedScrollState === 'BOTTOM' || !savedScrollState) {
                        msgContainer.scrollTop = msgContainer.scrollHeight;
                    } else {
                        const targetMsg = msgContainer.querySelector(`.msg-row[data-id="${savedScrollState}"]`);
                        if (targetMsg) {
                            msgContainer.scrollTop = Math.max(0, targetMsg.offsetTop - 20); 
                            window.ensureScrollToBottomBtn().style.display = 'flex';
                        } else {
                            msgContainer.scrollTop = msgContainer.scrollHeight;
                        }
                    }
                } else {
                    if (isAtBottom || lastMessageIsMe) {
                        msgContainer.scrollTop = msgContainer.scrollHeight;
                    } else {
                        // ВОССТАНАВЛИВАЕМ КООРДИНАТЫ ПО ЭКРАНУ (Магия здесь)
                        // ВОССТАНАВЛИВАЕМ КООРДИНАТЫ ПО ЭКРАНУ (Магия здесь)
                        // ВОССТАНАВЛИВАЕМ КООРДИНАТЫ ПО ЭКРАНУ (Магия здесь)
                        if (anchorMsgId) {
                            const targetMsg = msgContainer.querySelector(`.msg-row[data-id="${anchorMsgId}"]`);
                            if (targetMsg) {
                                // Просто ставим скролл так, чтобы элемент оказался на той же дистанции от верха
                                msgContainer.scrollTop = targetMsg.offsetTop - anchorOffset;
                            } else {
                                msgContainer.scrollTop = currentScrollTop;
                            }
                        } else {

                            msgContainer.scrollTop = currentScrollTop;
                        }
                        
                        if (!lastMessageIsMe && unreadIncomingCount > 0) {
                            const btn = window.ensureScrollToBottomBtn();
                            const counter = document.getElementById('chat-unread-counter');
                            
                            btn.style.display = 'flex';
                            counter.innerText = unreadIncomingCount > 99 ? '99+' : unreadIncomingCount;
                            counter.style.display = 'flex';
                            
                            btn.style.transform = 'scale(1.1)';
                            setTimeout(() => btn.style.transform = 'scale(1)', 150);
                        }
                    }
                }

                // Возвращаем видимость скролла и снимаем блокировку
                msgContainer.style.overflowY = 'auto';
                setTimeout(() => { window.isChatRestoring = false; }, 50);
            });
        }

    } catch (e) { console.error("Ошибка:", e); }
};
document.addEventListener('DOMContentLoaded', () => {
    const navBtns = document.querySelectorAll('.nav-button');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const chatWin = document.getElementById('chat-window');
            if (chatWin && chatWin.style.display === 'flex') {
                closeChat();
            }
        });
    });
});

// Прив'язуємо клік до кнопки "Надіслати


document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-btn');
    const msgInput = document.getElementById('msg-input');

    if (sendBtn) {
        // Використовуємо ТІЛЬКИ onclick, щоб уникнути нашарування addEventListener
        sendBtn.onclick = (e) => {
            e.preventDefault();
            sendMessage();
        };
    }

    if (msgInput) {
        msgInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        };
    }
});


function getChatTime(dateString) {
    let d;
    if (!dateString) {
        d = new Date(); // Якщо дати немає (відправляємо прямо зараз), беремо поточний час
    } else {
        const safeDate = dateString.replace(' ', 'T');
        d = new Date(safeDate);
        if (isNaN(d.getTime())) d = new Date(); // Запасний варіант
    }
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

const iconSent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const iconRead = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#53a6fd" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 6 7 17 2 12"></polyline><polyline points="22 10 11 21 9 19"></polyline></svg>`;
// Перевірка наявності блогу при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    checkUserBlog();
});
async function checkUserBlog() {
    try {
        const response = await fetch('get_my_blog.php', { credentials: 'include' });
        const data = await response.json();

        // 1. Находим основные контейнеры (проверь, чтобы ID совпадали с HTML)
        const setupView = document.getElementById('blog-setup-view');
        const activeView = document.getElementById('blog-active-view');

        if (data.success && data.has_blog) {
            const blog = data.blog;

            // Показываем блок блога, скрываем настройки
            if (setupView) setupView.style.display = 'none';
            if (activeView) activeView.style.display = 'block';

            // 2. Заполняем форму редактирования (чтобы данные не сбрасывались)
            if (document.getElementById('setup-blog-title')) document.getElementById('setup-blog-title').value = blog.title || '';
            if (document.getElementById('setup-blog-desc')) document.getElementById('setup-blog-desc').value = blog.description || '';
            if (document.getElementById('setup-blog-bg')) document.getElementById('setup-blog-bg').value = blog.bg_color || '#f0047f';
            if (document.getElementById('setup-blog-slug')) document.getElementById('setup-blog-slug').value = blog.slug || '';

            // 3. Выводим данные в шапку блога
            if (document.getElementById('display-blog-title')) document.getElementById('display-blog-title').innerText = blog.title;
            if (document.getElementById('display-blog-desc')) document.getElementById('display-blog-desc').innerText = blog.description;
            if (document.getElementById('display-blog-privacy')) {
                document.getElementById('display-blog-privacy').innerText = blog.privacy === 'public' ? 'Публічний' : 'Приватний 🔒';
            }

            // 4. ✨ МАГИЯ ФОНА (Картинка + прозрачность) ✨
            const color = blog.bg_color || '#f0047f';
            const imageUrl = blog.bg_image;

            // Создаем цвет с 50% прозрачностью (добавляем '80' к hex-коду)
            const colorWithAlpha = color.startsWith('#') ? color + '80' : color;

            if (activeView) {
                if (imageUrl && imageUrl.trim() !== '' && imageUrl !== 'null') {
                    // Если картинка есть: накладываем полупрозрачный выбранный цвет ПОВЕРХ нее
                    activeView.style.background = `linear-gradient(0deg, rgba(10, 0, 8, 1) 0%, ${colorWithAlpha} 100%), url('${imageUrl}') center/cover no-repeat`;
                } else {
                    // Если картинки нет: просто градиент выбранного цвета
                    activeView.style.background = `linear-gradient(180deg, ${color} 0%, rgba(10, 0, 8, 1) 100vh)`;
                }
            }

        } else {
            // Если блога нет — показываем окно создания (через flex для центровки)
            if (activeView) activeView.style.display = 'none';
            if (setupView) setupView.style.display = 'flex';
        }
    } catch (e) {
        console.error("Ошибка прогрузки блога:", e);
    }
}
window.createNewBlog = async function() {
    // Збираємо дані
    const title = document.getElementById('setup-blog-title').value;
    const desc = document.getElementById('setup-blog-desc').value;
    const privacy = document.getElementById('setup-blog-privacy').value;
    const bgColor = document.getElementById('setup-blog-bg').value;
    const slug = document.getElementById('setup-blog-slug').value;
    
    // Отримуємо файл картинки
    const imageInput = document.getElementById('setup-blog-image');
    const imageFile = imageInput.files[0];

    // Використовуємо FormData для відправки файлу
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', desc);
    formData.append('privacy', privacy);
    formData.append('bg_color', bgColor);
    formData.append('slug', slug);
    
    if (imageFile) {
        formData.append('bg_image', imageFile);
    }

    try {
        // Зверни увагу: ми не вказуємо 'Content-Type', бо браузер сам поставить 'multipart/form-data'
        const response = await fetch('save_blog.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            // Закриваємо модальне вікно і оновлюємо блог
            document.getElementById('blog-setup-view').style.display = 'none';
            checkUserBlog(); // Перезавантажуємо, щоб побачити новий фон
        } else {
            alert(result.message || 'Помилка збереження');
        }
    } catch (error) {
        console.error('Помилка:', error);
    }
};
function editBlogSettings() {
    console.log("✅ Кнопку редагування натиснуто!");
    
    // Знаходимо наші блоки
    const activeView = document.getElementById('blog-active-view');
    const setupView = document.getElementById('blog-setup-view');
    
    // Перемикаємо видимість
    if (activeView) activeView.style.display = 'none';
    if (setupView) setupView.style.display = 'block';

    // Змінюємо заголовки, щоб було зрозуміло, що це редагування
    const header = document.getElementById('setup-blog-header');
    if (header) header.innerText = "Редагувати блог ✏️";
    
    const submitBtn = document.getElementById('submit-blog-btn');
    if (submitBtn) submitBtn.innerText = "Зберегти зміни";
    
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.style.display = 'block'; // Показуємо кнопку скасування

    // Беремо поточні тексти з банера і вставляємо у форму
    const titleEl = document.getElementById('display-blog-title');
    const descEl = document.getElementById('display-blog-desc');
    
    if (titleEl && titleEl.innerText !== "🎮 Блог Геймера") {
        document.getElementById('setup-blog-title').value = titleEl.innerText;
    }
    
    if (descEl && descEl.innerText !== "Новости, обновления и мысли...") {
        document.getElementById('setup-blog-desc').value = descEl.innerText;
    }
}

function cancelBlogEdit() {
    console.log("❌ Редагування скасовано");
    // Повертаємо все як було
    document.getElementById('blog-setup-view').style.display = 'none';
    document.getElementById('blog-active-view').style.display = 'block';
}

window.loadAllUserAvatars = async function() {
    // Шукаємо ВСІ можливі класи та ID твоєї аватарки
    const avatars = document.querySelectorAll('.current-user-avatar, #top-bar-avatar, .user-avatar-top');
    const DEFAULT_IMG = 'img/default_avatar.png'; // Без першого сліша!

    try {
        const response = await fetch(`get_user.php?t=${new Date().getTime()}`, { 
            credentials: 'include',
            cache: 'no-store'
        });
        const data = await response.json();

        if (data.success || data.username) {
            // Дістаємо шлях
            let rawPath = data.avatar || data.avatar_url || (data.data ? data.data.avatar : null);
            
            // Проганяємо через надійну функцію
            let finalSrc = window.getSafeAvatarUrl(rawPath);

            // === ГОЛОВНИЙ ФІКС: СИНХРОНІЗУЄМО БРАУЗЕР ІЗ СЕРВЕРОМ ===
            if (finalSrc.includes('default_avatar')) {
                localStorage.removeItem('user_avatar'); // Видаляємо старий кеш
            } else {
                localStorage.setItem('user_avatar', finalSrc); // Записуємо новий актуальний
            }

            // Оновлюємо КОЖНУ знайдену аватарку на сторінці
            avatars.forEach(img => {
                img.src = finalSrc;
                
                // Захист, якщо картинка фізично видалена з папки uploads
                img.onerror = function() {
                    if (!this.src.includes('default_avatar')) {
                        console.warn("⚠️ Файл аватарки не знайдено на сервері, ставлю дефолт.");
                        this.onerror = null; // Блокуємо нескінченний цикл
                        this.src = DEFAULT_IMG;
                        localStorage.removeItem('user_avatar'); // Чистимо кеш, бо файл битий
                    }
                };
            });
        }
    } catch (e) {
        console.error("❌ Помилка завантаження аватарок:", e);
        // Якщо сервер впав — ставимо дефолт всім
        avatars.forEach(img => img.src = DEFAULT_IMG);
    }
};
// ЄДИНИЙ ОБРОБНИК ЗАПУСКУ
document.addEventListener('DOMContentLoaded', () => {
    // 1. Запускаємо аватари
    loadAllUserAvatars();
    
    // 2. Перевіряємо блог
    if (typeof checkUserBlog === 'function') checkUserBlog();
    
    // 3. Завантажуємо друзів (якщо ми на головній)
    if (typeof loadMutualFriends === 'function') loadMutualFriends();

    // Перевірка, чи прийшли ми з профілю для відкриття чату
    const urlParams = new URLSearchParams(window.location.search);
    const chatToOpen = urlParams.get('open_chat');

    if (chatToOpen) {
        // ОДРАЗУ ховаємо контент стрічки ще раз для максимальної певності,
        // щоб вона фізично не могла з'явитись на екрані
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        const postPanel = document.getElementById('create-post-panel');
        if (postPanel) postPanel.style.display = 'none';

        // Чекаємо трохи, поки завантажиться список друзів, і відкриваємо чат
        setTimeout(() => {
            // Шукаємо кнопку чату в списку за ID
            const chatItem = document.getElementById(`chat-item-${chatToOpen}`);
            if (chatItem) {
                chatItem.click(); // Симулюємо клік для відкриття вікна
            } else {
                console.warn("Друга не знайдено в списку чатів, але підписка взаємна.");
                // Якщо не змогли відкрити чат, повертаємо стрічку
                if (typeof window.performSwitch === 'function') {
                    window.performSwitch('feed');
                }
            }
        }, 500); // Півсекунди затримки для надійності
    }
    
    // 4. Оновлюємо ім'я користувача (username)
    fetch('get_user.php', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const name = data.username || (data.data ? data.data.username : null);
                if (name) {
                    const el1 = document.getElementById('userName');
                    const el2 = document.querySelector('.user-nick');
                    if (el1) el1.textContent = name;
                    if (el2) el2.textContent = name;
                }
            }
        });

        const submitPostBtn = document.getElementById('ВАШ_ID_КНОПКИ_ОТПРАВКИ'); // Замени на реальный ID кнопки
if (submitPostBtn) {
    submitPostBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.publishPost(e);
    });
}
});

// ==========================================
// ФУНКЦІОНАЛ МЕСЕНДЖЕРА (Дзвінки, Мут, Видалення, Блок)
// ==========================================

// 1. Дзвінки (Тепер відкривають Телеграм-екран)
window.startAudioCall = function(userId) {
    window.startTelegramCall(); // Запускаємо нашу нову красиву анімацію дзвінка!
};

// 🗑️ ВИДАЛЕНО ЗАГЛУШКУ startVideoCall ("Функція в розробці"):
// справжня функція відеодзвінка оголошена нижче у файлі та працює.

// 2. Заглушити чат (Мут)
window.toggleChatMute = async function(userId) {
    const btn = document.getElementById(`mute-btn-${userId}`);
    if (!btn) return;

    try {
        const response = await fetch('toggle_chat_mute.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_id: userId }),
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            if (data.is_muted) {
                // Змінюємо іконку на "перекреслений дзвіночок" і підсвічуємо червоним
                btn.style.color = '#ff4d4d';
                btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M17 17v-5a6 6 0 0 0-12 0v5"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
            } else {
                // Звичайний дзвіночок
                btn.style.color = '#aaa';
                btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
            }
        }
    } catch (e) {
        console.error("Помилка при муті:", e);
    }
};

// 3. Видалення чату (Модальне вікно вибору)
window.openDeleteChatModal = function(userId, userName) {
    let modal = document.getElementById('deleteChatModal');
    if (!modal) {
        const modalHTML = `
        <div id="deleteChatModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; align-items:center; justify-content:center;">
            <div style="background:#1d0016; padding:30px; border-radius:20px; width:320px; text-align:center; font-family: Arial, sans-serif;">
    <h3 style="color:white; margin-top:0; margin-bottom:15px; font-weight:bold;">Видалити чат?</h3>
    <p style="color:#c5a6ba; font-size:16px; margin-bottom:25px; line-height: 1.4;">Історія повідомлень буде видалена безповоротно</p>
    
    <div style="display:flex; flex-direction:column; gap:10px;">
        <button id="btn-del-me" style="background:#dfb0c7; color:#1d0016; border:none; padding:15px; border-radius:10px; cursor:pointer; font-weight:bold;">Видалити тільки в мене</button>
        <button id="btn-del-both" style="background:#f0047f; color:#1d0016; border:none; padding:15px; border-radius:10px; cursor:pointer; font-weight:bold;">Видалити в обох</button>
        <button onclick="document.getElementById('deleteChatModal').style.display='none'" style="background:none; color:white; border:1px solid #f0047f; padding:15px; border-radius:10px; cursor:pointer; font-weight:bold;">Скасувати</button>
    </div>
</div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('deleteChatModal');
    }
    
    // Прив'язуємо події до кнопок
    document.getElementById('btn-del-me').onclick = () => confirmDeleteChat(userId, 'me');
    document.getElementById('btn-del-both').onclick = () => confirmDeleteChat(userId, 'both');
    
    modal.style.display = 'flex';
};

window.confirmDeleteChat = async function(userId, type) {
    try {
        const response = await fetch('delete_chat.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_id: userId, delete_type: type }),
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            // Ховаємо модалку
            document.getElementById('deleteChatModal').style.display = 'none';
            // Миттєво стираємо повідомлення з екрану
            document.getElementById('chat-messages').innerHTML = ''; 
            // Закриваємо чат
            if(typeof window.closeChat === 'function') {
                window.closeChat(); 
            }
        } else {
            alert("Помилка: " + (data.message || "Не вдалося видалити"));
        }
    } catch (e) {
        console.error("Помилка видалення чату:", e);
    }
}

// === ФУНКЦІЯ БЛОКУВАННЯ (ВИКЛИК МОДАЛКИ) ===
window.blockUserFromChat = function(userId, userName) {
    let modal = document.getElementById('blockUserModal');
    
    if (!modal) {
        const modalHTML = `
        <div id="blockUserModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:none; align-items:center; justify-content:center; backdrop-filter: blur(5px);">
            <div style="background:#1d0016; padding:30px; border-radius:24px; width:320px; text-align:center; border: 1px solid rgba(240, 4, 127, 0.3); box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <div style="font-size: 40px; margin-bottom: 15px;">🚫</div>
                <h3 style="color:white; margin:0 0 10px 0; font-weight:bold;">Заблокувати?</h3>
                <p style="color:#c5a6ba; font-size:15px; margin-bottom:25px; line-height: 1.4;">
                    Ви впевнені, що хочете заблокувати <b id="block-target-name" style="color:#f0047f;"></b>? Взаємна підписка буде скасована.
                </p>
                
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button id="btn-confirm-block-exec" style="background:#f0047f; color:white; border:none; padding:15px; border-radius:12px; cursor:pointer; font-weight:bold; font-size:15px;">Заблокувати</button>
                    <button onclick="document.getElementById('blockUserModal').style.display='none'" style="background:none; color:white; border:1px solid #f0047f; padding:15px; border-radius:12px; cursor:pointer; font-weight:bold; font-size:15px;">Скасувати</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('blockUserModal');
    }

    // Вставляємо ім'я в модалку
    document.getElementById('block-target-name').innerText = userName;

    // Прив'язуємо подію до кнопки "Заблокувати"
    document.getElementById('btn-confirm-block-exec').onclick = () => {
        modal.style.display = 'none';
        window.executeBlockLogic(userId, userName); // Викликаємо сам запит
    };

    modal.style.display = 'flex';
};

// === ЛОГІКА ВІДПРАВКИ ЗАПИТУ НА СЕРВЕР ===
window.executeBlockLogic = async function(userId, userName) {
    try {
        const response = await fetch('block_user.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_id: userId, action: 'block' }),
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            // 1. Оновлюємо інтерфейс блокування
            if (typeof toggleBlockUI === 'function') toggleBlockUI(true, userId, userName);
            
            // 2. Видаляємо чат зі списку
            const chatEl = document.getElementById(`chat-item-${userId}`);
            if (chatEl) chatEl.remove();
            
            // 3. Оновлюємо стрічку постів
            if (typeof loadAllPosts === 'function') loadAllPosts(true);
            
            console.log(`✅ ${userName} успішно заблокований`);
        } else {
            alert("Помилка: " + data.message);
        }
    } catch (e) {
        console.error("Помилка блокування:", e);
    }
};
// === МОДАЛЬНЕ ВІКНО БЛОКУВАННЯ ===
window.openBlockUserModal = function(userId, userName) {
    let modal = document.getElementById('blockUserModal');
    
    if (!modal) {
        const modalHTML = `
        <div id="blockUserModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:none; align-items:center; justify-content:center; backdrop-filter: blur(5px);">
            <div style="background:#1d0016; padding:30px; border-radius:24px; width:340px; text-align:center; border: 1px solid rgba(240, 4, 127, 0.3); box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <div style="font-size: 40px; margin-bottom: 10px;">🚫</div>
                <h3 style="color:white; margin-top:0; margin-bottom:10px; font-weight:bold; font-family: sans-serif;">Заблокувати?</h3>
                <p id="block-modal-desc" style="color:#c5a6ba; font-size:14px; margin-bottom:25px; line-height: 1.5; font-family: sans-serif;">
                    Ви впевнені, що хочете заблокувати користувача <b id="block-modal-username" style="color:#f0047f;"></b>? <br>Взаємна підписка буде скасована.
                </p>
                
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <button id="btn-confirm-block" style="background:#f0047f; color:white; border:none; padding:14px; border-radius:12px; cursor:pointer; font-weight:bold; font-size:15px; transition: 0.2s;" onmouseover="this.style.background='#ff1a8c'" onmouseout="this.style.background='#f0047f'">Заблокувати</button>
                    <button onclick="document.getElementById('blockUserModal').style.display='none'" style="background:rgba(255,255,255,0.05); color:white; border:1px solid rgba(240, 4, 127, 0.5); padding:14px; border-radius:12px; cursor:pointer; font-weight:bold; font-size:15px;">Скасувати</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('blockUserModal');
    }

    // Оновлюємо ім'я в тексті модалки
    document.getElementById('block-modal-username').innerText = userName;

    // Прив'язуємо дію до кнопки підтвердження
    document.getElementById('btn-confirm-block').onclick = async () => {
        modal.style.display = 'none';
        await window.confirmBlockAction(userId, userName);
    };

    modal.style.display = 'flex';
};

window.confirmBlockAction = async function(userId, userName) {
    try {
        const response = await fetch('block_user.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_id: userId, action: 'block' }),
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            // Візуальні зміни в UI
            if (typeof toggleBlockUI === 'function') toggleBlockUI(true, userId, userName);
            
            // Видаляємо зі списку чатів
            const chatEl = document.getElementById(`chat-item-${userId}`);
            if (chatEl) chatEl.remove();
            
            // Оновлюємо стрічку
            if (typeof loadAllPosts === 'function') loadAllPosts(true);
            
            console.log(`✅ Користувач ${userName} заблокований`);
        } else {
            alert("Помилка блокування: " + data.message);
        }
    } catch (e) {
        console.error("Помилка блокування:", e);
    }
};
// === ФУНКЦІЯ РОЗБЛОКУВАННЯ КОРИСТУВАЧА ===
window.unblockUserFromChat = async function(userId, userName) {
    try {
        const response = await fetch('block_user.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_id: userId, action: 'unblock' }),
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            // Повертаємо нормальне поле вводу повідомлень
            toggleBlockUI(false, userId, userName);
        } else {
            alert("Помилка розблокування: " + data.message);
        }
    } catch (e) {
        console.error("Помилка розблокування:", e);
    }
};

// === ФУНКЦІЯ ПЕРЕМИКАННЯ ІНТЕРФЕЙСУ (ПОЛЕ ВВОДУ <-> КНОПКА РОЗБЛОКУВАТИ) ===
window.toggleBlockUI = function(isBlocked, userId, userName) {
    const msgInput = document.getElementById('msg-input');
    const sendBtn = document.getElementById('send-btn');
    let inputContainer = msgInput ? msgInput.closest('div') : null;
    
    if (!inputContainer) return;

    // Шукаємо або створюємо блок для кнопки розблокування
    let unblockOverlay = document.getElementById('unblock-overlay');
    
    if (isBlocked) {
        // ХОВАЄМО поле вводу і кнопку відправки
        msgInput.style.display = 'none';
        if (sendBtn) sendBtn.style.display = 'none';
        
        // ПОКАЗУЄМО кнопку розблокування
        if (!unblockOverlay) {
            unblockOverlay = document.createElement('div');
            unblockOverlay.id = 'unblock-overlay';
            unblockOverlay.style.cssText = 'width: 100%; display: flex; justify-content: center; align-items: center; padding: 10px 0;';
            inputContainer.appendChild(unblockOverlay);
        }
        unblockOverlay.style.display = 'flex';
        unblockOverlay.innerHTML = `
            <button onclick="window.unblockUserFromChat(${userId}, '${userName}')" 
                    style="width: 100%; max-width: 300px; padding: 12px; border-radius: 8px; background: transparent; border: 1px solid #ff4d4d; color: #ff4d4d; font-weight: bold; cursor: pointer; text-transform: uppercase; transition: 0.2s;"
                    onmouseover="this.style.background='#ff4d4d'; this.style.color='white';"
                    onmouseout="this.style.background='transparent'; this.style.color='#ff4d4d';">
                РОЗБЛОКУВАТИ КОРИСТУВАЧА
            </button>
        `;
    } else {
        // ПОВЕРТАЄМО поле вводу
        msgInput.style.display = 'block';
        if (sendBtn) sendBtn.style.display = 'block';
        if (unblockOverlay) unblockOverlay.style.display = 'none';
    }
};

// === КРАСИВИЙ СІРИЙ СКРОЛБАР ДЛЯ ЧАТУ ===
(function addScrollbarStyle() {
    if (document.getElementById('chat-scrollbar-style')) return; // Щоб не додавати двічі
    
    const style = document.createElement('style');
    style.id = 'chat-scrollbar-style';
    style.innerHTML = `
        /* Ширина смуги прокрутки */
        #chat-messages::-webkit-scrollbar {
            width: 8px;
        }
        /* Фон під скролбаром (робимо прозорим, щоб зливався з фоном чату) */
        #chat-messages::-webkit-scrollbar-track {
            background: transparent; 
        }
        /* Сам повзунок (сірий, під колір твоїх кнопок) */
        #chat-messages::-webkit-scrollbar-thumb {
            background: #4e5058; 
            border-radius: 10px;
        }
        /* Повзунок при наведенні мишки (трохи світліший) */
        #chat-messages::-webkit-scrollbar-thumb:hover {
            background: #686a73; 
        }
    `;
    document.head.appendChild(style);
})();

// === ГЛОБАЛЬНА ФУНКЦІЯ ЗАКРИТТЯ ЧАТУ ===
window.closeChat = function() {
    const chatWin = document.getElementById('chat-window');
    if (chatWin) {
        chatWin.style.display = 'none';
        // Повертаємо скрол батьківському блоку!
        if (chatWin.parentElement) {
            chatWin.parentElement.style.overflow = 'auto'; 
        }
    }
    
    // Повертаємо панель публікації постів
    const postPanel = document.getElementById('create-post-panel');
    if (postPanel) postPanel.style.display = 'block';

    // Знімаємо підсвітку з чатів
    document.querySelectorAll('.chat-item').forEach(item => item.style.background = 'transparent');

    // Автоматично повертаємося на поточну вкладку (наприклад, стрічку)
    if (typeof window.performSwitch === 'function') {
        window.performSwitch(window.currentTab || 'feed');
    }
};

// === ВИПРАВЛЕНИЙ БЛОК СТИЛІВ ДЛЯ ЧАТУ ===
(function addModernChatStyles() {
    if (document.getElementById('modern-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'modern-chat-styles';
    style.innerHTML = `
        .voice-msg-container {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #2a2a2a;
            padding: 10px 14px;
            border-radius: 20px;
            min-width: 200px;
            max-width: 250px;
            border: 1px solid #333;
            user-select: none;
        }
        .voice-play-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #53a6fd;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: white;
            flex-shrink: 0;
            transition: transform 0.1s, background 0.2s;
        }
        .voice-play-btn:hover { background: #65b1ff; }
        .voice-play-btn:active { transform: scale(0.9); }
        
        .voice-msg-info {
            display: flex;
            flex-direction: column;
            flex-grow: 1;
            gap: 6px;
            overflow: hidden;
        }
        .voice-waveform {
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            position: relative;
            width: 100%;
            cursor: pointer;
        }
        .voice-progress {
            position: absolute;
            left: 0; top: 0; height: 100%;
            background: #53a6fd;
            width: 0%;
            border-radius: 2px;
            pointer-events: none;
        }
        .voice-timer {
            font-size: 11px !important;
            color: #888;
            display: flex;
            justify-content: space-between;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            pointer-events: none;
        }
        .voice-loader {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
})();

// Допоміжна функція для красивого часу (секунди -> 0:00)
window.formatSeconds = function(s) {
    if (isNaN(s) || s === Infinity) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return mins + ":" + (secs < 10 ? "0" : "") + secs;
};

// === ОБНОВЛЕННЫЙ И ИСПРАВЛЕННЫЙ ПЛЕЕР ГОЛОСОВЫХ ===
window.playVoice = function(btn, url) {
    // Находим актуальный контейнер конкретного сообщения
    const container = btn.closest('.voice-msg-container');
    if (!container) return;

    // ПРАВИЛЬНЫЕ КЛАССЫ, которые совпадают с твоим HTML!
    const fill = container.querySelector('.voice-progress-fill');
    const thumb = container.querySelector('.voice-progress-thumb');
    const timeDisplay = container.querySelector('.voice-time-current');

    const iconPlay = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 2px;"><path d="M8 5v14l11-7z"/></svg>`;
    const iconPause = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

    // Вспомогательная функция для форматирования секунд в 0:00
    const formatTime = (secs) => {
        if (isNaN(secs) || !isFinite(secs)) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // 1. Если кликнули по ТОМУ ЖЕ САМОМУ аудио — ставим на паузу / снимаем с паузы
    if (window.currentAudio && window.currentAudioUrl === url) {
        if (window.currentAudio.paused) {
            window.currentAudio.play();
        } else {
            window.currentAudio.pause();
        }
        return;
    }

    // 2. Останавливаем предыдущее аудио, если играло другое
    if (window.currentAudio) {
        window.currentAudio.pause();
        if (window.currentAudioBtn && document.body.contains(window.currentAudioBtn)) {
            window.currentAudioBtn.innerHTML = iconPlay;
        }
    }

    // 3. Создаем новое аудио
    const audio = new Audio(url);
    window.currentAudio = audio;
    window.currentAudioUrl = url; 
    window.currentAudioBtn = btn;

    // СОСТОЯНИЕ: Воспроизведение
    audio.onplay = () => {
        window.isPlayingAudio = true; // БЛОКИРУЕМ автообновление чата, чтобы не сбивалось!
        btn.innerHTML = iconPause;
    };

    // СОСТОЯНИЕ: Пауза
    audio.onpause = () => {
        window.isPlayingAudio = false; 
        btn.innerHTML = iconPlay;
    };

    // СОСТОЯНИЕ: Конец аудио
    audio.onended = () => {
        window.isPlayingAudio = false; 
        btn.innerHTML = iconPlay;
        if (fill) fill.style.width = '0%';
        if (thumb) thumb.style.left = '0%';
        if (timeDisplay) timeDisplay.innerText = `0:00 / ${formatTime(audio.duration)}`;
    };

    // Когда аудио загрузилось и мы знаем его длину
    audio.addEventListener('loadedmetadata', () => {
        if (timeDisplay && audio.duration && audio.duration !== Infinity) {
            timeDisplay.innerText = `0:00 / ${formatTime(audio.duration)}`;
        }
    });

    // ДВИГАТЕЛЬ ЛИНИИ И ВРЕМЕНИ
    audio.ontimeupdate = () => {
        // Обновляем текст времени "Текущее / Всего"
        if (timeDisplay) {
            timeDisplay.innerText = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        }

        // Двигаем линию (fill) и кружочек (thumb)
        if (audio.duration && audio.duration !== Infinity && fill && thumb) {
            const percent = (audio.currentTime / audio.duration) * 100;
            fill.style.width = percent + '%';
            thumb.style.left = percent + '%';
        }
    };

    // Запускаем
    audio.play().catch(e => {
        console.error("Ошибка воспроизведения:", e);
        window.isPlayingAudio = false;
    });
};
// Додай ці стилі до існуючих
const extraStyles = `
    .voice-msg-info {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        gap: 4px;
    }
    .voice-timer {
        font-size: 3px;
        color: #aaa;
        font-family: monospace;
        display: flex;
        justify-content: space-between;
    }
`;
// Примітка: Просто додай це в свій тег <style>

// Колекція збережених стікерів
window.mySavedStickers = JSON.parse(localStorage.getItem('user_saved_stickers')) || [];

window.saveToStickers = async function(url) {
    try {
        const response = await fetch('save_favorite_gif.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gif_url: url }),
            credentials: 'include'
        });
        const result = await response.json();
        
        if (result.success) {
            alert(result.action === 'added' ? "Додано в обране! ⭐" : "Видалено з обраного.");
            // Оновлюємо список у пам'яті, якщо вікно відкрите
            loadMyStickersFromServer(); 
        }
    } catch (e) {
        console.error("Помилка збереження стікера:", e);
    }
};

window.mySavedStickers = []; // Тепер це просто тимчасовий масив

async function loadMyStickersFromServer() {
    try {
        const res = await fetch('get_favorites.php', { credentials: 'include' });
        const data = await res.json();
        window.mySavedStickers = Array.isArray(data) ? data : [];
        
        const savedGrid = document.getElementById('saved-stickers-grid');
        if (savedGrid) renderSavedStickersUI(savedGrid);
    } catch (e) {
        console.error("Не вдалося завантажити обране:", e);
    }
}

function renderSavedStickersUI(container) {
    container.innerHTML = '';
    if (window.mySavedStickers.length === 0) {
        container.innerHTML = '<div style="color: #555; font-size: 12px; grid-column: 1/3; padding: 10px;">Тут порожньо...</div>';
        return;
    }
    window.mySavedStickers.forEach(url => {
        const div = document.createElement('div');
        div.style.cursor = "pointer";
        div.innerHTML = `<img src="${url}" style="width:100%; border-radius:8px; display:block;">`;
        div.onclick = () => { 
            window.sendGif(url); 
            document.getElementById('gif-picker-window').style.display = 'none'; 
        };
        container.appendChild(div);
    });
}

window.initMessageContextMenu = function() {
    const oldMenu = document.getElementById('msg-context-menu');
    if (oldMenu) oldMenu.remove();
    
    const oldStyle = document.getElementById('msg-context-menu-styles');
    if (oldStyle) oldStyle.remove();
    
    const style = document.createElement('style');
    style.id = 'msg-context-menu-styles'; 
    style.innerHTML = `
        #msg-context-menu { display: none; position: fixed; background: linear-gradient(180deg, #2a0d1d 0%, #170810 100%); border: 1px solid rgba(240,4,127,0.55); border-radius: 14px; box-shadow: 0 14px 44px rgba(0,0,0,0.7), 0 0 24px rgba(240,4,127,0.25); z-index: 10001; width: 220px; padding: 0 0 5px 0; overflow: hidden; }
        .reactions-bar { display: flex; justify-content: center; gap: 2px; padding: 8px; background: transparent; border-bottom: 1px solid rgba(240,4,127,0.25); margin-bottom: 4px; }
        .reaction-emoji { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); user-select: none; }
        .reaction-emoji img { width: 18px !important; height: 18px !important; } .reaction-emoji:hover { transform: scale(1.3) translateY(-2px); background: rgba(240,4,127,0.3); }
        .msg-menu-item { padding: 10px 15px; color: #ddd; cursor: pointer; font-size: 14px; transition: background 0.2s; display: flex; align-items: center; gap: 10px; }
        .msg-menu-item:hover { background: rgba(240,4,127,0.18); color: white; }
        .msg-menu-item.delete { color: #ff4d6d; }
        .msg-menu-item.delete:hover { background: rgba(255,0,51,0.18); }
        
        @keyframes tg-pop-in {
            0% { transform: scale(0.3); opacity: 0; }
            60% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }
        @keyframes tg-pop-out {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(0.3); opacity: 0; }
        }
        
        /* === ВАЖНО: ИСПРАВЛЕННЫЕ СТИЛИ РЕАКЦИЙ === */
        .msg-reactions-container {
            display: flex; 
            gap: 4px; 
            z-index: 10; 
            width: max-content; 
            flex-wrap: nowrap;
            position: relative; 
            margin-top: -8px; /* Заставляет реакции слегка налезать на пузырь сообщения */
            padding: 0 5px; 
        }
        
        .msg-reaction-badge { 
            background: #3D1329; border: 1px solid #444; border-radius: 12px; 
            padding: 2px 6px; font-size: 13px; display: inline-flex; align-items: center; gap: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3); cursor: pointer; 
            transition: transform 0.2s;
        }
        .msg-reaction-badge.new-reaction {
            animation: tg-pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .msg-reaction-badge:hover { transform: scale(1.1); transition: transform 0.2s; }
    `;
    document.head.appendChild(style);

    const menu = document.createElement('div');
    menu.id = 'msg-context-menu';
    menu.innerHTML = `
        <div class="reactions-bar">
            <span class="reaction-emoji" onclick="window.reactToMessage('❤️', null, event)">
                <img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2764-fe0f.png" style="width:28px; height:28px; pointer-events:none;">
            </span>
            <span class="reaction-emoji" onclick="window.reactToMessage('👍', null, event)">
                <img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f44d.png" style="width:28px; height:28px; pointer-events:none;">
            </span>
            <span class="reaction-emoji" onclick="window.reactToMessage('👎', null, event)">
                <img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f44e.png" style="width:28px; height:28px; pointer-events:none;">
            </span>
            <span class="reaction-emoji" onclick="window.reactToMessage('🔥', null, event)">
                <img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f525.png" style="width:28px; height:28px; pointer-events:none;">
            </span>
            <span class="reaction-emoji" onclick="window.reactToMessage('😂', null, event)">
                <img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f602.png" style="width:28px; height:28px; pointer-events:none;">
            </span>
        </div>
        <div class="msg-menu-item action-edit" onclick="window.prepareEditMessage()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Редагувати
        </div>
        <div class="msg-menu-item delete action-delete" onclick="window.confirmDeleteMessage()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Видалити
        </div>
    `;
    document.body.appendChild(menu);
};
// Створюємо меню відразу після завантаження сторінки
document.addEventListener('DOMContentLoaded', window.initMessageContextMenu);
// === ТЕЛЕГРАМ-СТАЙЛ РЕДАГУВАННЯ ===
window.editingMessageId = null; // Глобальна змінна для стану редагування

// ЗМІНИЛИ НАЗВУ ТУТ, щоб співпадало з твоїм HTML:
window.startEditMessage = function() {
    const msgId = window.currentSelectedMsgId;
    if (!msgId) return;

    const msgEl = document.querySelector(`.msg-row[data-id="${msgId}"] .text-bubble`);
    if (!msgEl) {
        alert("Редагувати можна тільки текстові повідомлення!");
        document.getElementById('msg-context-menu').style.display = 'none';
        return;
    }

    const oldText = msgEl.innerText;
    const input = document.getElementById('msg-input');
    
    // Переносимо текст у поле вводу
    input.value = oldText;
    input.focus();
    window.editingMessageId = msgId;

    // Створюємо або показуємо плашку редагування над полем вводу
    let editBanner = document.getElementById('edit-msg-banner');
    if (!editBanner) {
        const inputWrapper = input.closest('div'); // Контейнер з інпутом
        editBanner = document.createElement('div');
        editBanner.id = 'edit-msg-banner';
        editBanner.style.cssText = `
            display: flex; align-items: center; justify-content: space-between; 
            background: #2a2a2a; padding: 6px 12px; border-left: 3px solid #53a6fd; 
            margin-bottom: 5px; border-radius: 6px; font-size: 13px; color: #aaa;
        `;
        // Вставляємо перед контейнером вводу
        inputWrapper.parentElement.insertBefore(editBanner, inputWrapper);
    }
    
    editBanner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#53a6fd" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            <div style="overflow: hidden;">
                <div style="color: #53a6fd; font-weight: bold; font-size: 12px; margin-bottom: 2px;">Редагування повідомлення</div>
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; color: #ddd;">${oldText}</div>
            </div>
        </div>
        <button onclick="window.cancelEditMessage()" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 18px; padding: 0 5px; transition: 0.2s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#aaa'">✕</button>
    `;
    
    editBanner.style.display = 'flex';
    document.getElementById('msg-context-menu').style.display = 'none'; // Ховаємо меню
};

// Про всяк випадок робимо "аліас" (дублікат назви), щоб працювало 100% з будь-яких кнопок
window.prepareEditMessage = window.startEditMessage;

window.cancelEditMessage = function() {
    window.editingMessageId = null;
    const editBanner = document.getElementById('edit-msg-banner');
    if (editBanner) editBanner.style.display = 'none';
    const input = document.getElementById('msg-input');
    if (input) input.value = ''; // Очищаємо поле
};


// === ЄДИНА УНІВЕРСАЛЬНА ФУНКЦІЯ ВІДПРАВКИ/РЕДАГУВАННЯ ===
window.sendMessage = async function() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();

    if (!text || !currentChatUserId) return;

    // 1. ЯКЩО МИ В РЕЖИМІ РЕДАГУВАННЯ
    if (window.editingMessageId) {
        const msgId = window.editingMessageId;
        
        try {
            const response = await fetch('edit_message.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_id: msgId, text: text }),
                credentials: 'include'
            });
            
            // Читаємо відповідь ЯК ТЕКСТ спочатку
            const rawText = await response.text(); 
            
            try {
                // Пробуємо перетворити в JSON
                const data = JSON.parse(rawText); 
                
                if (data.success) {
                    // Миттєво оновлюємо текст у чаті
                    const msgEl = document.querySelector(`.msg-row[data-id="${msgId}"] .text-bubble`);
                    if (msgEl) {
                        msgEl.innerText = text;
                        if (!msgEl.parentElement.innerHTML.includes('(ред.)')) {
                            const editedMark = document.createElement('span');
                            editedMark.style.cssText = "font-size: 10px; color: rgba(255,255,255,0.4); margin-left: 5px;";
                            editedMark.innerText = "(ред.)";
                            msgEl.parentElement.querySelector('div[style*="font-size: 11px"]').appendChild(editedMark);
                        }
                    }
                    window.cancelEditMessage();
                } else {
                    alert("Помилка редагування: " + (data.message || "Невідома помилка"));
                }
            } catch (jsonError) {
                // ЯКЩО ПАРСИНГ ВПАВ, ВИВОДИМО ТЕ, ЩО ПОВЕРНУВ PHP
                console.error("❌ Сервер повернув не JSON! Ось справжня помилка від PHP:");
                console.error(rawText);
                alert("Помилка на сервері! Відкрий консоль (F12), щоб подивитися деталі.");
            }
            
        } catch (e) {
            console.error("Помилка мережі:", e);
        }
        return; 
    }

    // 2. ЯКЩО ЦЕ НОВЕ ПОВІДОМЛЕННЯ
    input.value = ''; 
    const formData = new FormData();
    formData.append('receiver_id', currentChatUserId);
    formData.append('text', text);
    formData.append('media_type', 'text');
    
    await window.uploadFormData(formData);
};
// === ТЕЛЕГРАМ-СТАЙЛ ВИДАЛЕННЯ ===
window.confirmDeleteMessage = function() {
    const msgId = window.currentSelectedMsgId;
    if (!msgId) return;
    
    document.getElementById('msg-context-menu').style.display = 'none'; // Ховаємо меню

    let modal = document.getElementById('deleteMsgModal');
    if (!modal) {
        const modalHTML = `
        <div id="deleteMsgModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10005; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(2px);">
            <div style="background:#1e1e1e; padding:20px; border-radius:12px; width:280px; border:1px solid #333; box-shadow: 0 5px 20px rgba(0,0,0,0.5); text-align: left;">
                <h3 style="color:white; margin-top:0; margin-bottom:10px; font-size: 18px;">Видалити повідомлення?</h3>
                <p style="color:#aaa; font-size:14px; margin-bottom:20px;">Ви впевнені, що хочете видалити це повідомлення? Цю дію неможливо скасувати.</p>
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button onclick="document.getElementById('deleteMsgModal').style.display='none'" style="background:none; color:#53a6fd; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; transition: 0.2s;" onmouseover="this.style.background='rgba(83, 166, 253, 0.1)'" onmouseout="this.style.background='none'">Скасувати</button>
                    <button id="confirm-del-msg-btn" style="background:none; color:#ff4d4d; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; transition: 0.2s;" onmouseover="this.style.background='rgba(255, 77, 77, 0.1)'" onmouseout="this.style.background='none'">Видалити</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('deleteMsgModal');
    }
    
    // Прив'язуємо ID до кнопки підтвердження
    document.getElementById('confirm-del-msg-btn').onclick = () => window.executeDeleteMessage(msgId);
    modal.style.display = 'flex';
};

window.executeDeleteMessage = function(msgId) {
    // Спочатку ховаємо модалку
    document.getElementById('deleteMsgModal').style.display = 'none';

    fetch('delete_message.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msgId }),
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Анімація зникнення (опціонально, але красиво)
            const msgNode = document.querySelector(`.msg-row[data-id="${msgId}"]`);
            if (msgNode) {
                msgNode.style.transition = "opacity 0.2s, transform 0.2s";
                msgNode.style.opacity = "0";
                msgNode.style.transform = "scale(0.9)";
                setTimeout(() => msgNode.remove(), 200);
            }
        } else {
            alert("Помилка видалення: " + (data.message || "Невідома помилка"));
        }
    }).catch(e => console.error(e));
};

// === АГРЕСИВНЕ ПЕРЕХОПЛЕННЯ ПРАВОГО КЛІКУ ТА ДІАГНОСТИКА ===
window.addEventListener('contextmenu', function(e) {

    // === ГРУПИ ТА КАНАЛИ: ПКМ відкриває НАШЕ рожеве меню і виходить ===
    const groupRow = e.target.closest('.msg-row[data-gid]');
    if (groupRow) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const gMenuOld = document.getElementById('msg-context-menu');
        if (gMenuOld) gMenuOld.style.display = 'none';
        if (!groupRow.querySelector('.group-system-chip') && typeof window.openMsgContextMenu === 'function') {
            const msgId = parseInt(groupRow.getAttribute('data-gid'));
            const isMe = groupRow.classList.contains('mine');
            const canEdit = !!groupRow.querySelector('.text-bubble');
            window.openMsgContextMenu(e, msgId, isMe, canEdit);
        }
        return;
    }



    // 1. ПЕРЕВІРКА ПОВІДОМЛЕНЬ
    // 1. ПЕРЕВІРКА ПОВІДОМЛЕНЬ
    const msgNode = e.target.closest('.message-wrapper') || e.target.closest('.msg-row');
    if (msgNode) {
        e.preventDefault(); 
        e.stopImmediatePropagation();

        const isMy = msgNode.classList.contains('msg-mine') || msgNode.style.alignSelf === 'flex-end';
        window.currentSelectedMsgId = msgNode.getAttribute('data-id');

        let menu = document.getElementById('msg-context-menu');
        if (!menu && typeof window.initMessageContextMenu === 'function') {
            window.initMessageContextMenu();
            menu = document.getElementById('msg-context-menu');
        }

        if (menu) {
            // Ховаємо меню ігор
            const gameMenu = document.getElementById('custom-context-menu');
            if (gameMenu) gameMenu.style.display = 'none';

            // ХОВАЄМО кнопки редагування/видалення для чужих повідомлень
            const editBtn = menu.querySelector('.action-edit');
            const deleteBtn = menu.querySelector('.action-delete');
            if (editBtn) editBtn.style.display = isMy ? 'flex' : 'none';
            if (deleteBtn) deleteBtn.style.display = isMy ? 'flex' : 'none';

            // Координати
            let x = e.clientX;
            let y = e.clientY;
            if (x + 220 > window.innerWidth) x = window.innerWidth - 230;
            if (y + 120 > window.innerHeight) y = window.innerHeight - 130;

            menu.style.display = 'block';
            menu.style.position = 'fixed';
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.style.zIndex = '9999999';
        }
        return; 
    }

    // 2. ПЕРЕВІРКА ІГОР
    const targetBox = e.target.closest('.image-preview-box');
    if (targetBox && targetBox.querySelector('img')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        window.currentActiveTarget = targetBox;
        const menu = document.getElementById('custom-context-menu');
        const muteText = document.getElementById('mute-toggle-text');

        if (muteText) muteText.innerText = targetBox.classList.contains('muted-game') ? 'Включити' : 'Заглушити';

        if (menu) {
            const msgMenu = document.getElementById('msg-context-menu');
            if (msgMenu) msgMenu.style.display = 'none';

            menu.style.display = 'block';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            menu.style.zIndex = '9999999';
        }
    }
}, true); // TRUE - фаза Capture (перехоплюємо раніше за всіх)

// ==========================================
// ДІЇ З ІГРАМИ В БОКОВІЙ ПАНЕЛІ (МУТ ТА ВИДАЛЕННЯ)
// ==========================================

window.mutePhoto = async function() {
    const target = window.currentActiveTarget;
    if (!target) return;

    // Отримуємо назву гри
    const gameName = target.parentNode.querySelector('.preview-mini-title')?.innerText.trim();
    if (!gameName) return;

    try {
        // 1. Миттєво міняємо інтерфейс для швидкодії (додаємо/забираємо сірий фільтр)
        target.classList.toggle('muted-game');
        document.getElementById('custom-context-menu').style.display = 'none';

        // 2. Відправляємо на сервер
        const response = await fetch('save_user_game.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_name: gameName, action: 'toggle_mute' }),
            credentials: 'include'
        });

        if (response.ok) {
            // 3. Оновлюємо стрічку постів, щоб сховати або показати пости цієї гри
            if (typeof window.loadAllPosts === 'function') {
                window.loadAllPosts(true);
            }
        }
    } catch (e) {
        console.error("Помилка при глушінні гри:", e);
    }
};

window.removePhoto = async function() {
    const target = window.currentActiveTarget;
    if (!target) return;

    const wrapper = target.closest('.preview-item-wrapper');
    const gameName = target.parentNode.querySelector('.preview-mini-title')?.innerText.trim();
    const container = document.getElementById('media-upload-container');

    // 1. Миттєво видаляємо з екрану та ховаємо меню
    if (wrapper) wrapper.remove();
    document.getElementById('custom-context-menu').style.display = 'none';

    // 2. Якщо ігор стало менше 4, повертаємо "плюсик"
    if (container) {
        const totalItems = container.querySelectorAll('.preview-item-wrapper').length;
        const hasPlus = container.querySelector('.plus-icon');
        if (totalItems < 4 && !hasPlus) {
            if (typeof window.createNewPlusBox === 'function') {
                window.createNewPlusBox(container);
            }
        }
    }

    // 3. Видаляємо з бази даних
    if (gameName) {
        try {
            await fetch('save_user_game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game_name: gameName, action: 'remove' }),
                credentials: 'include'
            });
            
            // Оновлюємо стрічку
            if (typeof window.loadAllPosts === 'function') {
                window.loadAllPosts(true);
            }
        } catch (e) {
            console.error("Помилка при видаленні гри:", e);
        }
    }
};

window.renderStandardStickers = function() {
    const standardGrid = document.getElementById('standard-stickers-grid');
    if (!standardGrid) return;
    
    standardGrid.innerHTML = ''; 
    
    myStickers.forEach(sticker => {
        const div = document.createElement('div');
        div.style.cursor = "pointer";
        div.innerHTML = `<img src="${sticker.url}" style="width:100%; border-radius:8px; display:block;" title="${sticker.name}">`;
        
        div.onclick = () => { 
            window.sendGif(sticker.url); 
            document.getElementById('gif-picker-window').style.display = 'none'; 
        };
        
        standardGrid.appendChild(div);
    });
};
document.addEventListener('DOMContentLoaded', () => {
    // 1. Запускаємо аватари та інший базовий функціонал
    if (typeof loadAllUserAvatars === 'function') loadAllUserAvatars();
    if (typeof checkUserBlog === 'function') checkUserBlog();
    
    // Завантажуємо список друзів при вході і запускаємо таймер
    if (typeof loadMutualFriends === 'function') {
        loadMutualFriends();
        // ДОДАНО: Автооновлення списку друзів і бейджів кожні 10 секунд
        setInterval(loadMutualFriends, 10000); 
    }


setInterval(() => {
    const chatWin = document.getElementById('chat-window');
    
    // Оновлюємо тільки якщо чат відкритий І ми не ставимо реакцію І ми НЕ слухаємо голосове!
    if (window.currentChatUserId && chatWin && chatWin.style.display !== 'none' && !window.isReacting && !window.isPlayingAudio) {
        window.loadChatMessages(window.currentChatUserId, false);
    }
}, 3000);

    // 2. Оновлюємо ім'я користувача (username)
    fetch('get_user.php', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const name = data.username || (data.data ? data.data.username : null);
                if (name) {
                    const el1 = document.getElementById('userName');
                    const el2 = document.querySelector('.user-nick');
                    if (el1) el1.textContent = name;
                    if (el2) el2.textContent = name;
                }
            }
        }).catch(err => console.error("Помилка отримання імені:", err));

    // 3. ПРАВИЛЬНА ПРИВ'ЯЗКА КНОПКИ ВІДПРАВКИ ПОСТА
    const submitPostBtn = document.getElementById('submit-post-btn'); // ВАЖНО: ID должен совпадать с HTML!
    
    if (submitPostBtn) {
        // Используем onclick вместо addEventListener, чтобы избежать двойных срабатываний
        submitPostBtn.onclick = function(e) {
            e.preventDefault(); // Жестко блокируем перезагрузку страницы
            window.publishPost(e); // Вызываем функцию отправки
        };
    } else {
        console.error("❌ Кнопка отправки поста (id='submit-post-btn') не найдена в HTML!");
    }
});
// === ГЛОБАЛЬНІ ЗМІННІ ДЛЯ ШПАЛЕР ===
window.pendingWallpaperFile = null; 
window.pendingWallpaperDataUrl = null;

// === 1. ОБРОБКА ВИБРАНОГО ФАЙЛУ ===
window.changeChatBackground = function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (file.size > 3 * 1024 * 1024) {
            alert("Файл занадто великий! Оберіть фото до 3 МБ.");
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            window.pendingWallpaperDataUrl = e.target.result;
            window.pendingWallpaperFile = file;
            window.showWallpaperChoiceModal(); // Відкриваємо вікно вибору
        };
        reader.readAsDataURL(file);
        input.value = ''; // Скидаємо інпут, щоб можна було вибрати той самий файл ще раз
    }
};

// === 2. МОДАЛЬНЕ ВІКНО ВИБОРУ ===
window.showWallpaperChoiceModal = function() {
    let modal = document.getElementById('wallpaperChoiceModal');
    if (!modal) {
        const modalHTML = `
        <div id="wallpaperChoiceModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10005; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(2px);">
            <div style="background:#1e1e1e; padding:20px; border-radius:15px; width:300px; text-align:center; border:1px solid #333; box-shadow: 0 5px 20px rgba(0,0,0,0.5);">
                <h3 style="color:white; margin-top:0; margin-bottom:15px;">Встановити шпалери 🎨</h3>
                <p style="color:#aaa; font-size:14px; margin-bottom:20px;">Для кого ви хочете встановити цей фон?</p>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button onclick="window.applyWallpaper('me')" style="background:#4e5058; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold; transition: 0.2s;" onmouseover="this.style.background='#686a73'" onmouseout="this.style.background='#4e5058'">Тільки для мене</button>
                    <button onclick="window.applyWallpaper('both')" style="background:#53a6fd; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold; transition: 0.2s;" onmouseover="this.style.background='#65b1ff'" onmouseout="this.style.background='#53a6fd'">Запропонувати для обох</button>
                    <button onclick="document.getElementById('wallpaperChoiceModal').style.display='none'" style="background:none; color:#aaa; border:1px solid #555; padding:10px; border-radius:8px; cursor:pointer; transition: 0.2s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#aaa'">Скасувати</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('wallpaperChoiceModal');
    }
    modal.style.display = 'flex';
};

// === 3. ЗАСТОСУВАННЯ ШПАЛЕР ТА ВІДПРАВКА В ЧАТ ===
// === 3. ЗАСТОСУВАННЯ ШПАЛЕР ТА ВІДПРАВКА В ЧАТ ===
window.applyWallpaper = async function(type) {
    document.getElementById('wallpaperChoiceModal').style.display = 'none';

    // Встановлюємо фон візуально для себе
    const msgContainer = document.getElementById('chat-messages');
    if (msgContainer && window.pendingWallpaperDataUrl) {
        msgContainer.style.background = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${window.pendingWallpaperDataUrl}')`;
        msgContainer.style.backgroundSize = 'cover';
        msgContainer.style.backgroundPosition = 'center';
        msgContainer.style.backgroundRepeat = 'no-repeat';
        msgContainer.style.backgroundAttachment = 'scroll';
    }
    
    // Зберігаємо в пам'ять (ВИПРАВЛЕНО: додано ID поточного чату)
    localStorage.setItem('custom_chat_wallpaper_' + window.currentChatUserId, window.pendingWallpaperDataUrl);
    
    window.updateWallpaperButtonUI(); // Міняємо іконку на хрестик

    // Якщо вибрано "Для обох" - відправляємо як спеціальне повідомлення в чат
    if (type === 'both' && window.currentChatUserId && window.pendingWallpaperFile) {
        const formData = new FormData();
        formData.append('receiver_id', window.currentChatUserId);
        // СЕКРЕТНИЙ КЛЮЧ: по ньому ми розпізнаємо, що це шпалери, а не звичайне фото
        formData.append('text', 'WALLPAPER_PROPOSAL'); 
        formData.append('media_type', 'image');
        formData.append('file', window.pendingWallpaperFile);

        await window.uploadFormData(formData);
    }

    // Очищаємо тимчасові змінні
    window.pendingWallpaperDataUrl = null;
    window.pendingWallpaperFile = null;
};

// === 4. ВИДАЛЕННЯ ШПАЛЕР ===
window.removeChatBackground = function() {
    localStorage.removeItem('custom_chat_wallpaper_' + window.currentChatUserId);
    const msgContainer = document.getElementById('chat-messages');
    if (msgContainer) {
        msgContainer.style.background = '#121212'; // Повертаємо стандартний колір
    }
    window.updateWallpaperButtonUI(); // Міняємо іконку назад на картинку
};

// === 5. ДИНАМІЧНА ЗМІНА ІКОНКИ КНОПКИ ===
window.updateWallpaperButtonUI = function() {
    const btn = document.getElementById('chat-bg-btn'); // Шукаємо кнопку по ID
    if (!btn) return;

    const hasCustom = localStorage.getItem('custom_chat_wallpaper_' + window.currentChatUserId);
    if (hasCustom) {
        // Якщо фон Є -> показуємо червоний ХРЕСТИК
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        btn.title = "Видалити фон";
        btn.onclick = window.removeChatBackground; // Вішаємо функцію видалення
        btn.style.color = "#ff4d4d"; // Червоний колір
    } else {
        // Якщо фону НЕМАЄ -> показуємо стандартну КАРТИНКУ
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
        btn.title = "Змінити фон чату";
        btn.onclick = () => document.getElementById('chat-bg-input').click(); // Вішаємо виклик інпуту
        btn.style.color = "#aaa"; // Стандартний сірий колір
    }
};

// === ВСТАНОВЛЕННЯ ШПАЛЕР ВІД СПІВРОЗМОВНИКА ===
window.applyReceivedWallpaper = function(url) {
    const msgContainer = document.getElementById('chat-messages');
    if (msgContainer) {
        msgContainer.style.background = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${url}')`;
        msgContainer.style.backgroundSize = 'cover';
        msgContainer.style.backgroundPosition = 'center';
        msgContainer.style.backgroundRepeat = 'no-repeat';
        msgContainer.style.backgroundAttachment = 'scroll';
    }
    
    // Зберігаємо і міняємо іконку на хрестик
    // Зберігаємо і міняємо іконку на хрестик тільки для цього чату
    localStorage.setItem('custom_chat_wallpaper_' + window.currentChatUserId, url);
    if (typeof window.updateWallpaperButtonUI === 'function') {
        window.updateWallpaperButtonUI();
    }
    
    // Показуємо плашку, що все успішно
    if (typeof window.showTopAlert === 'function') {
        window.showTopAlert("Шпалери успішно встановлено! 🎨");
    } else {
        alert("Шпалери успішно встановлено! 🎨");
    }
};

// === ОНОВЛЕНА ФУНКЦІЯ РЕАКЦІЙ (БЛОКУВАННЯ ДРУГОЇ РЕАКЦІЇ) ===
window.reactToMessage = async function(emoji, msgId = null, eventData = null) {
    if (eventData) {
        eventData.preventDefault();
        eventData.stopPropagation(); 
    }

    const cleanEmoji = emoji.trim();
    const targetMsgId = msgId || window.currentSelectedMsgId;

    if (!targetMsgId || targetMsgId === 'undefined' || targetMsgId === 'null') return;

    // Ховаємо контекстне меню, якщо воно відкрите
    const menu = document.getElementById('msg-context-menu');
    if (menu) menu.style.display = 'none';

    // Захист від спаму кліками
    window.isReacting = true;
    if (window.reactionTimeout) clearTimeout(window.reactionTimeout);
    window.reactionTimeout = setTimeout(() => { window.isReacting = false; }, 2500);

    const msgNode = document.querySelector(`.msg-row[data-id="${targetMsgId}"]`);
    if (!msgNode) return;

    let container = msgNode.querySelector('.msg-reactions-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'msg-reactions-container';
        msgNode.appendChild(container);
    }

    // Отримуємо свою аватарку для точного розпізнавання своїх реакцій
    const userAvatarEl = document.querySelector('.current-user-avatar') || document.getElementById('top-bar-avatar');
    let myAvatarUrl = userAvatarEl ? userAvatarEl.getAttribute('src') : localStorage.getItem('user_avatar') || 'img/default_avatar.png';
    const myAvatar = window.getSafeAvatarUrl(myAvatarUrl);
    
    // Витягуємо тільки ім'я файлу (наприклад, "avatar.jpg"), щоб надійно порівнювати
    const myAvatarFilename = myAvatar.split('?')[0].split('/').pop();

    // ЖОРСТКИЙ ПОШУК СВОЄЇ РЕАКЦІЇ (навіть якщо сервер забув data-mine)
    let existingMyBadge = Array.from(container.children).find(b => {
        if (b.getAttribute('data-mine') === 'true') return true;
        
        // Перевіряємо по аватарці всередині
        const avatarImg = b.querySelector('img[title="Відправник"]');
        if (avatarImg && avatarImg.src && avatarImg.src.includes(myAvatarFilename)) {
            return true;
        }
        return false;
    });

    let actionToBackend = 'add';

    if (existingMyBadge) {
        const existingEmoji = existingMyBadge.getAttribute('data-reaction');

        // 1. Якщо ми клікаємо ПО ТІЙ САМІЙ реакції -> знімаємо її
        if (existingEmoji === cleanEmoji) {
            actionToBackend = 'remove';
            existingMyBadge.style.animation = 'tg-pop-out 0.2s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards';
            setTimeout(() => {
                existingMyBadge.remove();
                if (container.children.length === 0) container.remove();
            }, 200);
        } else {
            // 2. ЯКЩО МИ КЛІКАЄМО ПО ІНШІЙ -> ЖОРСТКО БЛОКУЄМО!
            if (typeof window.showTopAlert === 'function') {
                window.showTopAlert("Ви вже поставили реакцію! Спочатку зніміть поточну.");
            } else {
                alert("Ви вже поставили реакцію! Спочатку зніміть поточну (натисніть на неї).");
            }
            
            // Анімація "трясіння" для підказки
            existingMyBadge.style.transform = 'translateX(5px)';
            setTimeout(() => existingMyBadge.style.transform = 'translateX(-5px)', 100);
            setTimeout(() => existingMyBadge.style.transform = 'translateX(0)', 200);
            
            return; // ПЕРЕРИВАЄМО ФУНКЦІЮ, нічого на сервер не шлемо
        }
    } else {
        // 3. Якщо наших реакцій ще немає -> ставимо нову
        const badge = document.createElement('div');
        badge.className = 'msg-reaction-badge new-reaction';
        badge.setAttribute('data-reaction', cleanEmoji);
        badge.setAttribute('data-mine', 'true');

        const imgSrc = window.appleEmojis[cleanEmoji];
        const displayContent = imgSrc ? `<img src="${imgSrc}" style="width:16px; height:16px; display:block;">` : cleanEmoji;
        const avatarHTML = `<img src="${myAvatar}" style="width:14px; height:14px; border-radius:50%; object-fit:cover; border:1px solid #555;" title="Відправник">`;

        badge.innerHTML = `${displayContent}${avatarHTML}`;
        badge.onclick = (e) => window.reactToMessage(cleanEmoji, targetMsgId, e);

        container.appendChild(badge);
    }

    // ВІДПРАВКА НА СЕРВЕР (тепер гарантовано тільки один запит, без багів)
    try {
        const response = await fetch('save_reaction.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message_id: targetMsgId, 
                reaction: cleanEmoji,
                avatar: myAvatar,
                action: actionToBackend
            }),
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error(`Помилка HTTP: ${response.status}`);
        
        const rawText = await response.text();
        try {
            const result = JSON.parse(rawText);
            if (!result.success) {
                console.error("❌ Помилка БД:", result.message);
            }
        } catch (parseError) {
            console.error("❌ Сервер повернув не JSON:", rawText);
        }
    } catch (e) {
        console.error("❌ Помилка мережі:", e.message);
    }
};

function renderPostGifts(gifts) {
    if (!gifts || gifts.length === 0) return '';

    // Групуємо подарунки по іконці
    const counts = gifts.reduce((acc, g) => {
        if (!acc[g.icon]) acc[g.icon] = { count: 0 };
        acc[g.icon].count++;
        return acc;
    }, {});

    let html = '<div class="post-gifts-row">';
    for (const [icon, data] of Object.entries(counts)) {
        // Знаходимо мета-інфо подарунка зі списку (назва, ціна)
        const meta = (window.GIFTS_LIST || []).find(g => g.img === icon);
        const label = meta ? meta.label : 'Подарунок';
        const price = meta ? meta.price : 0;
        const count = data.count;

        html += `
            <div class="post-gift-card">
                <div class="post-gift-img-wrap">
                    <img src="${icon}" alt="${label}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/616/616490.png'">
                    ${count > 1 ? `<span class="post-gift-count">×${count}</span>` : ''}
                </div>
                <div class="post-gift-name">${label}</div>
                <div class="post-gift-price">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                    ${price} SC
                </div>
            </div>`;
    }
    html += '</div>';
    return html;
}
document.addEventListener('DOMContentLoaded', () => {
    // Викликаємо нашу оновлену глобальну функцію
    if (typeof window.loadAllUserAvatars === 'function') {
        window.loadAllUserAvatars();
    }
    // ... інший код
});

// === БРОНЕЖИЛЕТ ДЛЯ АВАТАРОК ===
(function enforceDefaultAvatar() {
    const DEFAULT_IMG = 'img/default_avatar.png';
    
    function cleanAvatars() {
        // Ищем все места, где может быть аватарка в топ-баре и не только
        const avatars = document.querySelectorAll('.current-user-avatar, #top-bar-avatar, .user-avatar-top');
        
        avatars.forEach(img => {
            const src = img.src || '';
            
            // Если ссылка содержит след Google, сторонних генераторов 
            // или просто ведет на чужой домен — беспощадно меняем на дефолтную
            if (src.includes('googleusercontent') || 
                src.includes('lh3.google') || 
                src.includes('ui-avatars') || 
                (src.startsWith('http') && !src.includes(window.location.hostname))) {
                
                img.src = DEFAULT_IMG;
            }
        });
    }

    // Очищаем кэш локального хранилища от старых гугл-ссылок
    if (localStorage.getItem('user_avatar') && localStorage.getItem('user_avatar').includes('http')) {
        localStorage.removeItem('user_avatar');
    }

    // Запускаем проверку сразу при загрузке
    document.addEventListener('DOMContentLoaded', cleanAvatars);
    

})();

// === КРАСИВИЙ СІРИЙ СКРОЛБАР ДЛЯ ЧАТУ ТА БОКОВОЇ ПАНЕЛІ (Discord Style) ===
(function addScrollbarStyle() {
    if (document.getElementById('custom-scrollbar-style')) return; // Щоб не додавати двічі
    
    // Видаляємо старий стиль, якщо він був
    const oldStyle = document.getElementById('chat-scrollbar-style');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'custom-scrollbar-style';
    style.innerHTML = `
        /* Задаємо правильну поведінку для списку чатів збоку */
        #personal-chats {
            overflow-y: auto;
            overflow-x: hidden;
            flex-grow: 1; /* Дозволяє блоку розтягуватися і скролитися */
            max-height: calc(100vh - 180px); /* Приблизна висота мінус шапка/низ (підлаштуй за потреби) */
            padding-right: 5px; /* Відступ від скролбара до контенту */
        }

        /* Ширина смуги прокрутки для чату та бокової панелі */
        #chat-messages::-webkit-scrollbar,
        #personal-chats::-webkit-scrollbar {
            width: 6px; /* Тонкий акуратний скролбар як у Discord */
        }
        
        /* Фон під скролбаром (прозорий) */
        #chat-messages::-webkit-scrollbar-track,
        #personal-chats::-webkit-scrollbar-track {
            background: transparent; 
        }
        
        /* Сам повзунок (темно-сірий) */
        #chat-messages::-webkit-scrollbar-thumb,
        #personal-chats::-webkit-scrollbar-thumb {
            background: #202225; /* Темний Discord-колір */
            border-radius: 10px;
        }
        
        /* Повзунок при наведенні мишки */
        #chat-messages::-webkit-scrollbar-thumb:hover,
        #personal-chats::-webkit-scrollbar-thumb:hover {
            background: #2b2d31; /* Трохи світліший при наведенні */
        }
    `;
    document.head.appendChild(style);
})();

// Знаходимо наше поле пошуку
    const searchInput = document.getElementById('game-search-input');

    // Слухаємо кожне введення символу з клавіатури
    searchInput.addEventListener('input', function() {
        // Отримуємо те, що ввів користувач (і переводимо в малі літери)
        const searchQuery = this.value.toLowerCase();
        
        // ВАЖЛИВО: Заміни '.searchable-item' на той клас, який стоїть у твоїх постів/квадратиків!
        // Це список всіх елементів, серед яких ми шукаємо
        const items = document.querySelectorAll('.searchable-item'); 

        // Перевіряємо кожен елемент
        items.forEach(function(item) {
            // Беремо весь текст, який є всередині елемента
            const itemText = item.textContent.toLowerCase();
            
            // Якщо текст містить те, що ми шукаємо - показуємо елемент
            if (itemText.includes(searchQuery)) {
                item.style.display = ''; // Повертає стандартне відображення
            } else {
                item.style.display = 'none'; // Ховає елемент, якщо немає збігів
            }
        });
    });

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('game-search-input');
    const feedContent = document.getElementById('feed-content'); 
    const dashboard = document.getElementById('search-dashboard');
    const searchContainer = document.getElementById('search-results-container');
    const searchGrid = document.getElementById('search-people-grid');
    const createPostPanel = document.getElementById('create-post-panel');

    let searchTimeout = null;
    if (!searchInput) return;

    // --- 1. ЛОГІКА ІСТОРІЇ ---
    window.saveToHistory = function(id, username, avatar) {
        let history = JSON.parse(localStorage.getItem('profile_view_history')) || [];
        history = history.filter(user => user.id !== id);
        history.unshift({ id, username, avatar });
        if (history.length > 6) history.pop();
        localStorage.setItem('profile_view_history', JSON.stringify(history));
    };

    window.renderViewHistory = function() {
        const historyContainer = document.getElementById('real-history-list');
        if (!historyContainer) return;
        const history = JSON.parse(localStorage.getItem('profile_view_history')) || [];
        if (history.length === 0) {
            historyContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #444; font-size: 12px;">Історія порожня</div>`;
            return;
        }
        historyContainer.innerHTML = history.map(user => `
            <div class="hist-user" onclick="window.location.href='profile.html?id=${user.id}'" style="cursor: pointer;">
                <img src="${user.avatar}" onerror="this.src='img/default_avatar.png'">
                <span>${user.username}</span>
            </div>
        `).join('');
    };

    window.clearSearchHistory = function() {
        localStorage.removeItem('profile_view_history');
        window.renderViewHistory();
    };

    function hideAllTabsForSearch() {
        // ФІКС: Використовуємо правильні ID з дефісами, як у твоєму HTML
        const feed = document.getElementById('feed-content');
        const requests = document.getElementById('requests-content');
        
        if (feed) feed.style.display = 'none';
        if (requests) requests.style.display = 'none';
        
        // ФІКС: Звертаємося до змінної createPostPanel напряму, без window.
        if (createPostPanel) createPostPanel.style.display = 'none';
    }

// --- 2. ФУНКЦІЯ ПЕРЕМИКАННЯ РЕЖИМІВ ПОШУКУ ---
function updateSearchUI() {
    hideAllTabsForSearch(); // Одразу ховаємо все, що під пошуком
    
    const query = searchInput.value.trim();
    if (query.length > 0) {
        if (dashboard) dashboard.style.display = 'none';
        if (searchContainer) searchContainer.style.display = 'block';
    } else {
        if (dashboard) dashboard.style.display = 'block';
        if (searchContainer) searchContainer.style.display = 'none';
        if (typeof window.renderViewHistory === 'function') {
            window.renderViewHistory();
        }
    }
}
    // --- 3. ОБРОБНИКИ ПОДІЙ ---

    // Фокус на пошук
    searchInput.addEventListener('focus', updateSearchUI);

    // Введення тексту
    searchInput.addEventListener('input', function() {
        updateSearchUI();
        const query = this.value.trim();
        if (query.length === 0) return;

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            if (searchGrid) searchGrid.innerHTML = '<div style="color: #888; text-align: center; width: 100%; padding: 40px;">Шукаємо...</div>';
            try {
                const response = await fetch(`search_users.php?q=${encodeURIComponent(query)}`, { credentials: 'include' });
                const data = await response.json();
                if (searchGrid) searchGrid.innerHTML = '';
                if (data.success && data.users.length > 0) {
                    data.users.forEach(user => {
                        const avatar = user.avatar || 'img/default_avatar.png';
                        const userCard = document.createElement('div');
                        userCard.className = 'user-search-card';
                        userCard.innerHTML = `
                            <div class="user-card-bg" style="background: linear-gradient(45deg, #1d0016, #f0047f33);"></div>
                            <div class="user-card-info">
                                <img src="${avatar}" class="user-card-avatar" onerror="this.src='img/default_avatar.png'">
                                <div class="user-card-text">
                                    <span class="user-card-name">${user.username}</span>
                                    <span class="user-card-status">ONLINE</span>
                                </div>
                                <button class="user-card-btn" onclick="window.saveToHistory('${user.id}', '${user.username}', '${avatar}'); window.location.href='profile.html?id=${user.id}'">Профіль</button>
                            </div>`;
                        searchGrid.appendChild(userCard);
                    });
                } else {
                    searchGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #555;">Нікого не знайдено</div>`;
                }
            } catch (err) { console.error("Помилка:", err); }
        }, 300);
    });

    // --- 4. ГОЛОВНИЙ ФІКС ЗАКРИТТЯ ПОШУКУ (Фінальний) ---
    document.addEventListener('mousedown', (e) => {
        // 🚨 РЯТІВНИЙ КРУГ ДЛЯ ЧАТУ: Якщо клік був у вікні чату, контекстному меню повідомлень або дзвінку - ігноруємо!
        const isClickInChat = e.target.closest('#chat-window') || e.target.closest('#msg-context-menu') || e.target.closest('#telegram-call-screen');
        if (isClickInChat) return;

        const isClickOnInput = searchInput && searchInput.contains(e.target);
        const isClickOnDashboard = dashboard && dashboard.contains(e.target);
        const isClickOnResults = searchContainer && searchContainer.contains(e.target);

        // Якщо клік був поза елементами пошуку
        if (!isClickOnInput && !isClickOnDashboard && !isClickOnResults) {
            
            // ✨ ПЕРЕВІРКА НА ФІЗИЧНУ ВИДИМІСТЬ (замість перевірки тексту стилів)
            const isDashboardVisible = dashboard && dashboard.offsetWidth > 0;
            const isResultsVisible = searchContainer && searchContainer.offsetWidth > 0;

            // Якщо пошук реально відкритий на екрані — ховаємо його і повертаємо вкладку
            if (isDashboardVisible || isResultsVisible) {
                if (dashboard) dashboard.style.display = 'none';
                if (searchContainer) searchContainer.style.display = 'none';
                
                const currentTab = window.currentLudoraPage || window.currentTab || 'feed';
                
                if (typeof window.performSwitch === 'function') {
                    window.performSwitch(currentTab);
                } else {
                    const activeContent = document.getElementById(currentTab + '-content');
                    if (activeContent) {
                        activeContent.style.display = 'block';
                        activeContent.classList.add('active');
                    }
                    if (createPostPanel && currentTab !== 'blog') {
                        createPostPanel.style.display = 'block';
                    }
                }
            }
        }
    });

    // Забороняємо закриття при кліках всередині дашборду (на кнопки, блоки і т.д.)
    if (dashboard) {
        dashboard.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    }
});
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

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('back-to-top');
    // Знаходимо блок, який може скролитись (у тебе це main-content-block)
    const mainContent = document.querySelector('.main-content-block');

    const handleScroll = (e) => {
        // Перевіряємо скрол або вікна, або контейнера з постами
        const scrollTop = window.scrollY || (mainContent ? mainContent.scrollTop : 0);
        
        if (scrollTop > 400) {
            btn.classList.add('show');
        } else {
            btn.classList.remove('show');
        }
    };

    // Слухаємо скрол скрізь
    window.addEventListener('scroll', handleScroll);
    if (mainContent) {
        mainContent.addEventListener('scroll', handleScroll);
    }

    // Функція натискання
    btn.onclick = () => {
        if (mainContent && mainContent.scrollTop > 0) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});

const translations = {
    'uk': {
        'alert-top': 'Більше 500 символів ввести не можна!',
        'btn-feed': 'СТРІЧКА',
        'btn-requests': 'ЗАЯВКИ',
        'btn-blog': 'БЛОГ',
        'txt-add-post': 'Додати пост',
        'txt-header-channels': 'КАНАЛИ',
        'txt-header-personal': 'ОСОБИСТІ ЧАТИ',
        'txt-header-groups': 'ГРУПИ',
        'game-search-input': 'Шукати користувачів...',
        'new-post-title': 'Заголовок поста',
        'new-post-body': 'Про що думаєте?',
        'txt-add-photo': 'Додати фото',
        'submit-post-btn': 'Опублікувати',
        'btn-cancel-post': 'Скасувати',
        'msg-input': 'Напишіть повідомлення...',
        'send-btn': 'Надіслати',
        'txt-filter': 'Фільтр',
        'setup-blog-header': 'Створити свій блог 🚀',
        'lbl-blog-name': 'Назва блогу',
        'lbl-blog-desc': 'Опис блогу',
        'lbl-blog-privacy': 'Приватність',
        'lbl-blog-bg': 'Колір фону (Банер)',
        'lbl-blog-url': 'Власне посилання (URL)',
        'opt-privacy-public': 'Публічний (бачать усі)',
        'opt-privacy-private': 'Приватний (тільки для друзів)',
        'submit-blog-btn': 'Створити блог',
        'cancel-edit-btn': 'Скасувати',
        'txt-ctx-edit': 'Редагувати',
        'txt-ctx-delete': 'Видалити',
        'txt-edit-label': 'Редагування',
        'opt-group-all': 'Усі групи',
        'setup-blog-title': 'Мій крутий геймерський блог',
        'setup-blog-desc': 'Про що будете писати?',
        'setup-blog-slug': 'my-blog'
    },
    'en': {
        'alert-top': 'Cannot enter more than 500 characters!',
        'btn-feed': 'FEED',
        'btn-requests': 'REQUESTS',
        'btn-blog': 'BLOG',
        'txt-add-post': 'Add Post',
        'txt-header-channels': 'CHANNELS',
        'txt-header-personal': 'DIRECT MESSAGES',
        'txt-header-groups': 'GROUPS',
        'game-search-input': 'Search users...',
        'new-post-title': 'Post Title',
        'new-post-body': 'What is on your mind?',
        'txt-add-photo': 'Add Photo',
        'submit-post-btn': 'Publish',
        'btn-cancel-post': 'Cancel',
        'msg-input': 'Type a message...',
        'send-btn': 'Send',
        'txt-filter': 'Filter',
        'setup-blog-header': 'Create Your Blog 🚀',
        'lbl-blog-name': 'Blog Title',
        'lbl-blog-desc': 'Blog Description',
        'lbl-blog-privacy': 'Privacy',
        'lbl-blog-bg': 'Background Color (Banner)',
        'lbl-blog-url': 'Custom Link (URL)',
        'opt-privacy-public': 'Public (visible to everyone)',
        'opt-privacy-private': 'Private (friends only)',
        'submit-blog-btn': 'Create Blog',
        'cancel-edit-btn': 'Cancel',
        'txt-ctx-edit': 'Edit',
        'txt-ctx-delete': 'Delete',
        'txt-edit-label': 'Editing',
        'opt-group-all': 'All groups',
        'setup-blog-title': 'My awesome gamer blog',
        'setup-blog-desc': 'What are you going to write about?',
        'setup-blog-slug': 'my-blog'
    }
};

window.setLanguage = function(lang) {
    localStorage.setItem('lang', lang);
    
    // Оновлюємо кнопки (шукаємо за текстом або атрибутом)
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if(btn.textContent.toLowerCase().includes(lang === 'uk' ? 'укр' : 'eng')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const t = translations[lang];

    // 3. Змінюємо тексти за ID
    // Текстові елементи
   const textIds = [
        'txt-filter', 'setup-blog-header', 'lbl-blog-name', 'lbl-blog-desc', 
        'lbl-blog-privacy', 'lbl-blog-bg', 'lbl-blog-url', 'opt-privacy-public', 
        'opt-privacy-private', 'submit-blog-btn', 'cancel-edit-btn', 
        'txt-ctx-edit', 'txt-ctx-delete', 'txt-edit-label', 'opt-group-all',
        'btn-feed', 'btn-requests', 'btn-blog', 'txt-add-post', 'send-btn'
    ];
    
    textIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = t[id];
    });

    // 4. Змінюємо плейсхолдери (для input та textarea)
    const placeholderIds = ['game-search-input', 'new-post-title', 'new-post-body', 'msg-input'];
    placeholderIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.placeholder = t[id];
    });
};

// При завантаженні сторінки перевіряємо збережену мову
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('lang') || 'uk';
    // Викликаємо функцію, щоб інтерфейс став потрібною мовою
    // Але нам треба знайти кнопку, щоб передати її як event, або просто викликати логіку
    // Для простоти просто перевизначимо функцію вище, щоб вона не залежала від event.target для ініціалізації
});

window.setTheme = function(theme) {
    // 1. Зберігаємо вибір у пам'ять
    localStorage.setItem('theme', theme);

    // 2. Логіка перемикання
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        
        // Оновлюємо кнопки
        document.getElementById('theme-light').classList.add('active');
        document.getElementById('theme-dark').classList.remove('active');
    } else {
        document.body.classList.remove('light-theme');
        
        // Оновлюємо кнопки
        document.getElementById('theme-dark').classList.add('active');
        document.getElementById('theme-light').classList.remove('active');
    }
};

// 3. ПЕРЕВІРКА ПРИ ЗАВАНТАЖЕННІ (додай це в свій DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
});
// ==========================================
// 📞 ЄДИНА СИСТЕМА ДЗВІНКІВ (АУДІО ТА ВІДЕО)
// ==========================================
let callTimerInterval;
let callStartTime = 0; 
let localAudioStream = null;
let callState = 'idle'; 
let callRingTimeout; 
let isServerNotified = false; 
let lastSignalTime = 0; 
window.isVideoCall = false; 

let peerConnection;
let remoteAudioEl = null; 
let incomingSdpOffer = null; 
let audioContext, analyser, visualizerFrame;

const rtcServers = {
    iceServers: [ 
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" }
    ],
    iceCandidatePoolSize: 10 // ✨ заздалегідь збираємо кандидатів — швидше з'єднання
};

// ❄️ TRICKLE ICE: кандидати, що прийшли до створення peerConnection, чекають у черзі
window.pendingRemoteCandidates = [];
window.localCandIdx = 0; // скільки кандидатів партнера ми вже отримали з сервера

async function applyRemoteCandidates(cands) {
    if (!Array.isArray(cands) || cands.length === 0) return;
    for (const c of cands) {
        if (!c) continue;
        if (peerConnection && peerConnection.remoteDescription) {
            try { await peerConnection.addIceCandidate(new RTCIceCandidate(c)); } 
            catch (e) { console.warn("ICE candidate skip:", e.message); }
        } else {
            window.pendingRemoteCandidates.push(c);
        }
    }
}

async function flushPendingCandidates() {
    if (!peerConnection || !peerConnection.remoteDescription) return;
    const queue = window.pendingRemoteCandidates.splice(0);
    for (const c of queue) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
    }
}

// 🛡️ МОНІТОРИНГ З'ЄДНАННЯ + АВТОВІДНОВЛЕННЯ (як у Telegram)
function attachConnectionWatchdog(pc) {
    pc.onicecandidate = (e) => {
        if (e.candidate) {
            // Надсилаємо кожного кандидата одразу (trickle), не чекаючи повного збору
            fetch('call_sync.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'candidate', candidate: e.candidate.toJSON() }),
                credentials: 'include'
            }).catch(() => {});
        }
    };
    pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        const statusText = document.getElementById('call-status');
        if (st === 'connected' && callState === 'active' && statusText) {
            // нічого — таймер сам показує час
        } else if (st === 'disconnected') {
            if (statusText && callState === 'active') statusText.innerText = "Слабкий зв'язок, відновлюємо...";
            // даємо 3 сек на самовідновлення, потім ICE restart
            setTimeout(() => {
                if (peerConnection === pc && pc.connectionState === 'disconnected') {
                    try { pc.restartIce(); } catch (e) {}
                }
            }, 3000);
        } else if (st === 'failed') {
            if (statusText) statusText.innerText = "Перепідключення...";
            try { pc.restartIce(); } catch (e) {}
        }
    };
}


// 🛠️ БРОНЕЖИЛЕТ ДЛЯ КЛЮЧІВ (SDP)
function parseSdp(sdp) {
    if (!sdp || sdp === "null" || sdp === "undefined") return null;
    if (typeof sdp === 'string') {
        try { return JSON.parse(sdp); } 
        catch (e) { return null; }
    }
    return sdp;
}

// 🎤 ВІЗУАЛІЗАТОР ЗВУКУ (Для аудіо)
function startVisualizer(stream) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const avatarImg = document.getElementById('call-avatar-img');

    function animate() {
        visualizerFrame = requestAnimationFrame(animate);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        let avg = sum / dataArray.length;
        let scale = 1 + (avg / 400); 
        let glow = avg / 3;

        if (avatarImg && avatarImg.style.display !== 'none') {
            avatarImg.style.transform = `scale(${scale})`;
            avatarImg.style.boxShadow = `0 0 ${15 + glow}px rgba(240, 4, 127, ${0.3 + (avg/150)})`;
        }
    }
    animate();
}

function stopVisualizer() {
    if (visualizerFrame) cancelAnimationFrame(visualizerFrame);
    const avatarImg = document.getElementById('call-avatar-img');
    if (avatarImg) {
        avatarImg.style.transform = `scale(1)`;
        avatarImg.style.boxShadow = `none`;
    }
}

function waitForIceGathering(pc) {
    return new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') return resolve();
        
        let isResolved = false;
        const checkState = () => {
            if (pc.iceGatheringState === 'complete' && !isResolved) {
                isResolved = true;
                pc.removeEventListener('icegatheringstatechange', checkState);
                resolve();
            }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
        
        setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                pc.removeEventListener('icegatheringstatechange', checkState);
                resolve(); 
            }
        }, 3000); // ✨ було 500мс — SDP відлітав без кандидатів і дзвінок зривався
    });
}

function setupRemoteAudio(event) {
    if (!remoteAudioEl) {
        remoteAudioEl = document.createElement('audio');
        remoteAudioEl.id = 'remote-telegram-audio';
        remoteAudioEl.autoplay = true;
        document.body.appendChild(remoteAudioEl);
    }
    remoteAudioEl.srcObject = event.streams[0];
    remoteAudioEl.play().catch(e => console.error(e));
    startVisualizer(event.streams[0]);
}

window.setupRemoteVideoStream = function(event) {
    ensureAdvancedControls(); 
    ensureVideoElements();
    const avatarImg = document.getElementById('call-avatar-img');
    const videoContainer = document.getElementById('video-call-container');
    const remoteVid = document.getElementById('remote-video');
    
    if (avatarImg) avatarImg.style.display = 'none';
    if (videoContainer) videoContainer.style.display = 'block';
    
    if (remoteVid && event.streams && event.streams[0]) {
        remoteVid.srcObject = event.streams[0];
        remoteVid.play().catch(e => console.error("Помилка відтворення віддаленого відео:", e));
    }
};

// ==========================================
// ✨ ДВИЖОК ВІДЕО-ЕФЕКТІВ (CANVAS) - ВИПРАВЛЕНО!
// ==========================================
window.currentVideoEffect = 'none';
window.hardwareVideoTrack = null;
let effectCanvas = document.createElement('canvas');
let effectCtx = effectCanvas.getContext('2d', { willReadFrequently: true });

// Створюємо прихований відеоплеєр
let rawVideoObj = document.createElement('video');
rawVideoObj.autoplay = true; 
rawVideoObj.muted = true; 
rawVideoObj.playsInline = true;
// ФІКС 1: Додаємо відео в DOM невидимим, щоб браузер не блокував відтворення!
rawVideoObj.style.cssText = 'position:absolute; top:-9999px; left:-9999px; width:1px; height:1px; opacity:0; pointer-events:none;';
document.body.appendChild(rawVideoObj);

let isEffectLooping = false;

async function setupVideoEffectPipeline(rawStream) {
    rawVideoObj.srcObject = rawStream;
    try { await rawVideoObj.play(); } catch(e) { console.warn("Очікуємо метадані камери..."); }
    
    effectCanvas.width = 640; 
    effectCanvas.height = 480;

    const processedStream = effectCanvas.captureStream(30); // 30 кадрів на секунду
    if (rawStream.getAudioTracks().length > 0) {
        processedStream.addTrack(rawStream.getAudioTracks()[0]); 
    }

    if (!isEffectLooping) {
        isEffectLooping = true;
        renderEffectLoop();
    }
    return processedStream;
}

function renderEffectLoop() {
    if (!isEffectLooping) return;
    requestAnimationFrame(renderEffectLoop);
    
    // Перевіряємо, чи відео вже завантажилось
    if (rawVideoObj.readyState >= 2 && rawVideoObj.videoWidth > 0) {
        
        // ФІКС 2: Змінюємо розмір канваса ТІЛЬКИ якщо він змінився!
        // (Бо зміна розміру скидає всі ефекти)
        if (effectCanvas.width !== rawVideoObj.videoWidth || effectCanvas.height !== rawVideoObj.videoHeight) {
            effectCanvas.width = rawVideoObj.videoWidth;
            effectCanvas.height = rawVideoObj.videoHeight;
        }

        // Застосовуємо магію фільтрів
        if (window.currentVideoEffect === 'none') {
            effectCtx.filter = 'none';
        } else if (window.currentVideoEffect === 'blur') {
            effectCtx.filter = 'blur(12px)';
        } else if (window.currentVideoEffect === 'sepia') {
            effectCtx.filter = 'sepia(100%)';
        } else if (window.currentVideoEffect === 'neon') {
            effectCtx.filter = 'hue-rotate(280deg) saturate(300%) contrast(120%)'; 
        } else if (window.currentVideoEffect === 'bw') {
            effectCtx.filter = 'grayscale(100%) contrast(120%)';
        } else if (window.currentVideoEffect === 'invert') {
            effectCtx.filter = 'invert(100%)';
        } else if (window.currentVideoEffect === 'acid') {
            effectCtx.filter = 'saturate(400%) hue-rotate(90deg) contrast(150%)';
        }

        // Малюємо кадр
        effectCtx.drawImage(rawVideoObj, 0, 0, effectCanvas.width, effectCanvas.height);
    }
}

// ==========================================
// 🎤/📹 БЕЗПЕЧНИЙ ДОСТУП ДО ПРИСТРОЇВ (З РОЗШИРЕНИМ ФОЛБЕКОМ)
// ==========================================
async function getSafeMediaStream(requestVideo, micId = null) {
    window.isCameraMuted = false;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("КРИТИЧНА ПОМИЛКА: Браузер блокує пристрої! Використовуйте HTTPS або localhost.");
        throw new Error("mediaDevices API is missing");
    }

    const isHDVoice = document.getElementById('setting-hd-voice') ? document.getElementById('setting-hd-voice').checked : true;
    let audioSettings = {
        deviceId: micId ? { exact: micId } : undefined,
        echoCancellation: isHDVoice,
        noiseSuppression: isHDVoice,
        autoGainControl: isHDVoice
    };

    try {
        // Спроба 1: Підключаємо з вказаними налаштуваннями
        let rawStream = await navigator.mediaDevices.getUserMedia({ video: requestVideo, audio: audioSettings });
        
        if (requestVideo) {
            window.hardwareVideoTrack = rawStream.getVideoTracks()[0];
            return await setupVideoEffectPipeline(rawStream);
        }
        
        return rawStream;
        
    } catch (err) {
        console.warn(`Помилка медіа (${err.name}):`, err.message);

        // 🟢 ФОЛБЕК 1: Якщо обраний мікрофон зайнятий/зламаний (NotReadableError/OverconstrainedError)
        if ((err.name === 'NotReadableError' || err.name === 'OverconstrainedError') && micId) {
            console.warn("Специфічний мікрофон зайнятий. Пробуємо дефолтний системний...");
            audioSettings.deviceId = undefined; // Знімаємо жорстку прив'язку до конкретного мікрофона
            
            try {
                let fallbackStream = await navigator.mediaDevices.getUserMedia({ video: requestVideo, audio: audioSettings });
                if (requestVideo) {
                    window.hardwareVideoTrack = fallbackStream.getVideoTracks()[0];
                    return await setupVideoEffectPipeline(fallbackStream);
                }
                return fallbackStream;
            } catch (fallbackErr) {
                err = fallbackErr; // Якщо і дефолтний впав, передаємо помилку далі
            }
        }

        // 🟠 ФОЛБЕК 2: Якщо падає ВІДЕО, пробуємо ТІЛЬКИ АУДІО
        if (requestVideo) {
            window.isCameraMuted = true; 
            const btnCamera = document.getElementById('btn-camera');
            if (btnCamera) btnCamera.classList.add('active');
            
            try {
                console.log("Пробуємо підключити лише аудіо...");
                return await navigator.mediaDevices.getUserMedia({ video: false, audio: audioSettings });
            } catch (audioErr) {
                // Дружня підказка користувачу, якщо аудіо все ще зайняте
                if (audioErr.name === 'NotReadableError') {
                    alert("АПАРАТНА ПОМИЛКА: Ваш мікрофон використовується іншою програмою (Zoom, Discord) або завис. Закрийте їх або перепідключіть мікрофон.");
                } else {
                    alert(`ПОВНЕ БЛОКУВАННЯ!\nПричина: ${audioErr.message}`);
                }
                throw audioErr;
            }
        }
        
        // Якщо це був аудіо-only запит і він впав остаточно
        if (err.name === 'NotReadableError') {
            alert("Мікрофон недоступний: він використовується іншою програмою або вимкнений у системі.");
        }
        throw err; 
    }
}


// ==========================================
// 📞 1. АУДІОДЗВІНКИ
// ==========================================
window.startTelegramCall = async function(eventOrIncoming, targetName = null, targetAvatar = null) {
    if (eventOrIncoming && eventOrIncoming.preventDefault) eventOrIncoming.preventDefault();
    let isIncoming = eventOrIncoming === true; 

    window.isVideoCall = false;
    prepareCallUI(isIncoming, targetName, targetAvatar, "Вхідний дзвінок...", "Запит мікрофона...");

    if (!isIncoming) {
        try {
            localAudioStream = await getSafeMediaStream(false);
            if (callState === 'idle') return stopAllMedia(); 
            await makeOffer(setupRemoteAudio);
        } catch (err) { handleMediaError(err, "Мікрофон заблоковано!"); }
    }
};

window.acceptTelegramCall = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (window.isVideoCall) return window.acceptVideoCall();

    const statusText = document.getElementById('call-status');
    statusText.innerText = "Запит мікрофона..."; 
    
    try {
        localAudioStream = await getSafeMediaStream(false);
        if (callState === 'idle') return stopAllMedia();
        await makeAnswer(setupRemoteAudio);
    } catch (err) { handleMediaError(err, "Дзвінок відхилено"); }
};

// ==========================================
// 📹 2. ВІДЕОДЗВІНКИ
// ==========================================
window.startVideoCall = async function(eventOrIncoming, targetName = null, targetAvatar = null) {
    if (eventOrIncoming && eventOrIncoming.preventDefault) eventOrIncoming.preventDefault();
    let isIncoming = eventOrIncoming === true; 

    window.isVideoCall = true;
    prepareCallUI(isIncoming, targetName, targetAvatar, "Вхідний відеодзвінок...", "Запит камери...");

    if (!isIncoming) {
        try {
            localAudioStream = await getSafeMediaStream(true);
            if (callState === 'idle') return stopAllMedia(); 
            showLocalVideo();
            await makeOffer(window.setupRemoteVideoStream);
        } catch (err) { handleMediaError(err, "Пристрої заблоковано!"); }
    }
};

window.acceptVideoCall = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const statusText = document.getElementById('call-status');
    statusText.innerText = "Запит камери..."; 
    
    try {
        localAudioStream = await getSafeMediaStream(true);
        if (callState === 'idle') return stopAllMedia(); 
        showLocalVideo();
        await makeAnswer(window.setupRemoteVideoStream);
    } catch (err) { handleMediaError(err, "Дзвінок відхилено"); }
};

// ==========================================
// 🛠 РОЗШИРЕНИЙ UI З ВКАДКАМИ (РОЖЕВИЙ ДИЗАЙН)
// ==========================================
function ensureAdvancedControls() {
    const callScreen = document.getElementById('telegram-call-screen');
    const activeActions = document.getElementById('call-active-actions');
    if (!callScreen || !activeActions) return;

    if (!document.getElementById('call-settings-btn')) {
        let gearBtn = document.createElement('div');
        gearBtn.id = 'call-settings-btn';
        gearBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        gearBtn.style.cssText = 'position:absolute; top:20px; right:20px; cursor:pointer; z-index:10000; background:rgba(240, 4, 127, 0.2); border: 1px solid rgba(240, 4, 127, 0.4); padding:10px; border-radius:50%; display:flex; justify-content:center; align-items:center;';
        gearBtn.onclick = window.openCallSettings;
        callScreen.appendChild(gearBtn);
    }

    if (!document.getElementById('call-settings-modal')) {
        let modal = document.createElement('div');
        modal.id = 'call-settings-modal';
        modal.style.cssText = 'display:none; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:#1a0912; padding:20px; border-radius:16px; z-index:10001; color:white; width:340px; box-shadow:0 10px 40px rgba(240, 4, 127, 0.3); border: 1px solid rgba(240, 4, 127, 0.4); max-height:85vh; overflow-y:auto;';
        
        modal.innerHTML = `
            <h3 style="margin:0 0 15px 0; text-align:center; color:#f0047f;">Налаштування</h3>
            
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid rgba(240, 4, 127, 0.3); padding-bottom:10px;">
                <div id="tab-audio" onclick="window.switchTab('audio')" style="cursor:pointer; color:#f0047f; font-weight:bold; flex-grow:1; text-align:center;">🎙️ Звук</div>
                <div id="tab-video" onclick="window.switchTab('video')" style="cursor:pointer; color:gray; flex-grow:1; text-align:center;">📷 Відео</div>
            </div>

            <div id="panel-audio">
                <label style="font-size:14px;">Мікрофон</label>
                <select id="setting-mic" onchange="window.changeMicDevice()" style="width:100%; background:#2a111c; color:white; border:1px solid rgba(240, 4, 127, 0.4); padding:8px; border-radius:8px; margin-bottom:10px;"></select>
                
                <label style="font-size:14px;">Динамік</label>
                <select id="setting-speaker" onchange="window.changeSpeakerDevice()" style="width:100%; background:#2a111c; color:white; border:1px solid rgba(240, 4, 127, 0.4); padding:8px; border-radius:8px; margin-bottom:10px;"></select>
                
                <div style="margin-bottom:15px;">
                    <label style="font-size:14px;">Гучність: <span id="vol-val">100%</span></label>
                    <input type="range" id="setting-volume" min="0" max="1" step="0.1" value="1" oninput="window.updateCallVolume()" style="width:100%; accent-color:#f0047f;">
                </div>
            </div>

            <div id="panel-video" style="display:none;">
            <label style="font-size:14px;">Пристрій камери</label>
            <select id="setting-camera" onchange="window.changeCameraDevice()" style="width:100%; background:#2a111c; color:white; border:1px solid rgba(240, 4, 127, 0.4); padding:8px; border-radius:8px; margin-bottom:10px;"></select>

            <div style="width:100%; height:160px; background:#111; border-radius:8px; border:1px solid #f0047f; overflow:hidden; display:flex; justify-content:center; align-items:center; position:relative; margin-bottom:15px;">
                <video id="settings-video-preview" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; display:none;"></video>
                <div id="settings-video-placeholder" style="color:gray; font-size:12px;">Камера вимкнена</div>
                <button id="btn-preview-cam" onclick="window.previewCameraInSettings()" style="position:absolute; bottom:10px; background:rgba(240,4,127,0.8); border:none; color:white; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;">Увімкнути прев'ю</button>
            </div>

            <label style="font-size:14px; font-weight:bold; color:#f0047f;">Корекція та Розмиття</label>
            <div style="display: flex; flex-direction: column; gap: 10px; background: #221018; padding: 10px; border-radius: 8px; border: 1px solid rgba(240, 4, 127, 0.2); margin-bottom:15px;">
                <button id="btn-bg-blur" onclick="window.toggleBgBlur()" style="background: #2a111c; color: white; border: 1px solid #f0047f; border-radius: 6px; padding: 8px; cursor: pointer; font-weight: bold;">✨ Розмиття фону: ВИМК</button>
                <div>
                    <label style="font-size:12px; color:#ccc;">Яскравість <span id="val-brightness">100%</span></label>
                    <input type="range" min="50" max="150" value="100" style="width: 100%; accent-color: #f0047f;" oninput="window.updateVidFilter('brightness', this.value)">
                </div>
                <div>
                    <label style="font-size:12px; color:#ccc;">Контраст <span id="val-contrast">100%</span></label>
                    <input type="range" min="50" max="150" value="100" style="width: 100%; accent-color: #f0047f;" oninput="window.updateVidFilter('contrast', this.value)">
                </div>
            </div>
        </div>
        
        <button onclick="window.closeCallSettings()" style="width:100%; padding:12px; margin-top:15px; background:#f0047f; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Закрити</button>
    `;
        callScreen.appendChild(modal);
    }
}

// ==========================================
// 🎛️ ЛОГІКА ПОВЗУНКІВ ТА РОЗМИТТЯ (БЕЗ ЗМІНИ HTML)
// ==========================================

window.vidFilters = { blurBg: false, brightness: 100, contrast: 100, grayscale: 0 };

window.updateVidFilter = function(type, val) {
    window.vidFilters[type] = parseInt(val);
    const label = document.getElementById(`val-${type}`);
    if (label) label.innerText = val + '%';
};

window.toggleBgBlur = function() {
    window.vidFilters.blurBg = !window.vidFilters.blurBg;
    const btn = document.getElementById('btn-bg-blur');
    if (btn) {
        if (window.vidFilters.blurBg) {
            btn.style.background = '#f0047f';
            btn.innerText = 'Розмиття фону: УВІМК';
        } else {
            btn.style.background = '#2a111c';
            btn.innerText = 'Розмиття фону: ВИМК';
        }
    }
};

window.setupVideoEffectPipeline = async function(rawStream) {
    const video = document.createElement('video');
    video.srcObject = rawStream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Динамічне завантаження нейромережі Google MediaPipe
    if (!window.selfieSegmenter) {
        if (!document.getElementById('mediapipe-script')) {
            const script = document.createElement('script');
            script.id = 'mediapipe-script';
            script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js";
            script.crossOrigin = "anonymous";
            document.head.appendChild(script);
            await new Promise(r => script.onload = r); // Чекаємо на завантаження
        }

        window.selfieSegmenter = new window.SelfieSegmentation({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });
        window.selfieSegmenter.setOptions({ modelSelection: 1 }); // Швидка модель
    }

    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = canvas.width;
    blurCanvas.height = canvas.height;
    const blurCtx = blurCanvas.getContext('2d');

    // Callback нейромережі
    window.selfieSegmenter.onResults((results) => {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Застосовуємо яскравість/контраст/ЧБ
        ctx.filter = `brightness(${window.vidFilters.brightness}%) contrast(${window.vidFilters.contrast}%) grayscale(${window.vidFilters.grayscale}%)`;

        if (window.vidFilters.blurBg) {
            ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
            
            ctx.globalCompositeOperation = 'source-out';
            blurCtx.filter = 'blur(12px)';
            blurCtx.drawImage(results.image, 0, 0, blurCanvas.width, blurCanvas.height);
            ctx.drawImage(blurCanvas, 0, 0);

            ctx.globalCompositeOperation = 'destination-atop';
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();
    });

    window.isEffectLooping = true;
    async function processFrame() {
        if (!window.isEffectLooping) return;

        if (window.vidFilters.blurBg && window.selfieSegmenter) {
            await window.selfieSegmenter.send({ image: video });
        } else {
            // Малюємо напряму (без нейромережі) для економії ресурсів, якщо розмиття вимкнено
            ctx.filter = `brightness(${window.vidFilters.brightness}%) contrast(${window.vidFilters.contrast}%) grayscale(${window.vidFilters.grayscale}%)`;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        window.effectProcessorFrame = requestAnimationFrame(processFrame);
    }
    
    processFrame();
    return canvas.captureStream(30); 
};

window.changeCameraDevice = async function() {
    let camId = document.getElementById('setting-camera').value;
    if (!camId) return;

    try {
        // 1. Отримуємо потік з нової камери
        const newRawStream = await navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: { exact: camId } } 
        });
        const newRawTrack = newRawStream.getVideoTracks()[0];

        // 2. Якщо у нас увімкнені ефекти (Canvas), оновлюємо джерело для Canvas
        if (isEffectLooping) {
            rawVideoObj.srcObject = newRawStream;
            await rawVideoObj.play();
            // Потік Canvas (processedStream) автоматично почне малювати нову камеру
        }

        // 3. Якщо зараз йде активний дзвінок, замінюємо трек у PeerConnection
        if (peerConnection) {
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                // Якщо ефекти увімкнені, ми не міняємо трек у сендера (бо він і так шле Canvas),
                // але якщо ефектів немає — замінюємо на чистий трек
                if (!isEffectLooping) {
                    sender.replaceTrack(newRawTrack);
                }
            }
        }

        // 4. Оновлюємо локальне прев'ю
        const localVid = document.getElementById('local-video');
        const settingsVid = document.getElementById('settings-video-preview');
        
        if (localVid) localVid.srcObject = isEffectLooping ? effectCanvas.captureStream() : newRawStream;
        if (settingsVid && settingsVid.style.display !== 'none') {
             settingsVid.srcObject = isEffectLooping ? effectCanvas.captureStream() : newRawStream;
        }

        // 5. Оновлюємо глобальну змінну треку
        window.hardwareVideoTrack = newRawTrack;

    } catch (e) {
        console.error("Помилка зміни камери:", e);
        alert("Не вдалося переключитися на цю камеру.");
    }
};

window.switchTab = function(tab) {
    // Створюємо список елементів, які ми хочемо перевірити
    const elements = {
        'panel-audio': document.getElementById('panel-audio'),
        'panel-video': document.getElementById('panel-video'),
        'tab-audio': document.getElementById('tab-audio'),
        'tab-video': document.getElementById('tab-video')
    };

    // Змінюємо відображення панелей (якщо вони існують)
    if (elements['panel-audio']) {
        elements['panel-audio'].style.display = tab === 'audio' ? 'block' : 'none';
    }
    if (elements['panel-video']) {
        elements['panel-video'].style.display = tab === 'video' ? 'block' : 'none';
    }

    // Змінюємо колір тексту вкладок (якщо вони існують)
    if (elements['tab-audio']) {
        elements['tab-audio'].style.color = tab === 'audio' ? '#f0047f' : 'gray';
    }
    if (elements['tab-video']) {
        elements['tab-video'].style.color = tab === 'video' ? '#f0047f' : 'gray';
    }
};
window.openCallSettings = async function() {
    document.getElementById('call-settings-modal').style.display = 'block';
    
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const micSelect = document.getElementById('setting-mic');
        const spkSelect = document.getElementById('setting-speaker');
        const camSelect = document.getElementById('setting-camera'); // Нарешті працює!

        micSelect.innerHTML = ''; spkSelect.innerHTML = ''; camSelect.innerHTML = '';
        
        devices.forEach(d => {
            let opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.text = d.label || (d.kind === 'audioinput' ? 'Мікрофон ' : d.kind === 'videoinput' ? 'Камера ' : 'Динамік ') + d.deviceId.substring(0,5);
            
            if (d.kind === 'audioinput') micSelect.appendChild(opt);
            if (d.kind === 'audiooutput') spkSelect.appendChild(opt);
            if (d.kind === 'videoinput') camSelect.appendChild(opt); // Додаємо камери у список
        });
    } catch(e) { console.error("Помилка отримання пристроїв:", e); }

    // Перевірка прев'ю
    const preview = document.getElementById('settings-video-preview');
    const placeholder = document.getElementById('settings-video-placeholder');
    const btnPreview = document.getElementById('btn-preview-cam');
    
    if (localAudioStream && localAudioStream.getVideoTracks().length > 0 && !window.isCameraMuted) {
        preview.srcObject = localAudioStream;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        btnPreview.style.display = 'none';
    }
};

window.closeCallSettings = function() {
    document.getElementById('call-settings-modal').style.display = 'none';
    if (window.micTestFrame) window.testMic(); 
    
    if (window.settingsPreviewStream && !window.isVideoCall) {
        window.settingsPreviewStream.getTracks().forEach(t => t.stop());
        window.settingsPreviewStream = null;
        document.getElementById('settings-video-preview').style.display = 'none';
        document.getElementById('settings-video-placeholder').style.display = 'block';
        document.getElementById('btn-preview-cam').style.display = 'block';
        isEffectLooping = false; 
    }
};

window.setEffect = function(eff, btn) {
    window.currentVideoEffect = eff;
    document.querySelectorAll('.fx-btn').forEach(b => {
        b.style.background = '#2a111c';
        b.style.color = 'white';
        b.style.border = '1px solid #f0047f';
    });
    btn.style.background = '#f0047f';
    btn.style.border = 'none';
};

window.previewCameraInSettings = async function() {
    const preview = document.getElementById('settings-video-preview');
    const placeholder = document.getElementById('settings-video-placeholder');
    const btn = document.getElementById('btn-preview-cam');
    const camId = document.getElementById('setting-camera').value; // Беремо ID обраної камери
    
    try {
        const constraints = { 
            video: camId ? { deviceId: { exact: camId } } : true 
        };
        const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
        const processedStream = await setupVideoEffectPipeline(rawStream);
        
        preview.srcObject = processedStream;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        btn.style.display = 'none';
        
        window.settingsPreviewStream = rawStream; 
    } catch(e) { 
        alert("Не вдалося підключитися до обраної камери!"); 
        console.error(e);
    }
};

// 🔊 ТЕСТУВАННЯ ПРИСТРОЇВ
window.testSpeaker = function() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        
        const spkId = document.getElementById('setting-speaker').value;
        if (typeof ctx.setSinkId === 'function' && spkId) {
            ctx.setSinkId(spkId).catch(e=>{});
        } else { gain.connect(ctx.destination); }

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch(e) { console.error("Speaker test failed", e); }
};

window.micTestFrame = null;
window.testMicStream = null;
window.testMic = async function() {
    const btn = document.getElementById('btn-test-mic');
    const bar = document.getElementById('mic-test-bar');
    
    if (window.micTestFrame) {
        cancelAnimationFrame(window.micTestFrame);
        window.micTestFrame = null;
        if (window.testMicStream) {
            window.testMicStream.getTracks().forEach(t => t.stop());
            window.testMicStream = null;
        }
        bar.style.width = '0%';
        bar.style.boxShadow = 'none';
        btn.innerHTML = '🎤 Тест';
        btn.style.background = '#f0047f';
        return;
    }

    try {
        btn.innerHTML = '🛑 Зупинити';
        btn.style.background = '#ff4d4d';
        
        const micId = document.getElementById('setting-mic').value;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: micId ? { exact: micId } : undefined } });
        window.testMicStream = stream;
        
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const testAnalyser = ctx.createAnalyser();
        testAnalyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(testAnalyser);
        
        const dataArr = new Uint8Array(testAnalyser.frequencyBinCount);
        
        function drawMicLevel() {
            if(!window.micTestFrame) return; 
            window.micTestFrame = requestAnimationFrame(drawMicLevel);
            testAnalyser.getByteFrequencyData(dataArr);
            let sum = 0; for(let i=0; i<dataArr.length; i++) sum += dataArr[i];
            let avg = sum / dataArr.length;
            let pct = Math.min(100, (avg / 100) * 100);
            bar.style.width = pct + '%';
            if(pct > 5) {
                bar.style.boxShadow = `0 0 ${pct/4}px #f0047f`;
            } else {
                bar.style.boxShadow = 'none';
            }
        }
        window.micTestFrame = requestAnimationFrame(drawMicLevel);
        
        setTimeout(() => { if (window.micTestFrame) window.testMic(); }, 15000);
        
    } catch(e) { 
        alert("Помилка тесту мікрофона!"); 
        btn.innerHTML = '🎤 Тест';
        btn.style.background = '#f0047f';
    }
};

window.updateCallVolume = function() {
    let vol = document.getElementById('setting-volume').value;
    document.getElementById('vol-val').innerText = Math.round(vol * 100) + '%';
    if (remoteAudioEl) remoteAudioEl.volume = vol;
    let remoteVid = document.getElementById('remote-video');
    if (remoteVid) remoteVid.volume = vol;
};

window.reapplyAudioConstraints = async function() {
    if (!localAudioStream) return;
    const isHDVoice = document.getElementById('setting-hd-voice').checked;
    const audioTrack = localAudioStream.getAudioTracks()[0];
    if (audioTrack && audioTrack.applyConstraints) {
        await audioTrack.applyConstraints({ noiseSuppression: isHDVoice, echoCancellation: isHDVoice, autoGainControl: isHDVoice });
    }
};

window.changeMicDevice = async function() {
    let micId = document.getElementById('setting-mic').value;
    if (!micId || !peerConnection) return;
    try {
        let newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: micId } } });
        let newAudioTrack = newStream.getAudioTracks()[0];
        localAudioStream.removeTrack(localAudioStream.getAudioTracks()[0]);
        localAudioStream.addTrack(newAudioTrack);
        let sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (sender) sender.replaceTrack(newAudioTrack);
        window.reapplyAudioConstraints(); 
    } catch(e) { console.error("Mic change error", e); }
};

window.changeSpeakerDevice = async function() {
    let spkId = document.getElementById('setting-speaker').value;
    let remoteVid = document.getElementById('remote-video');
    try {
        if (remoteAudioEl && remoteAudioEl.setSinkId) await remoteAudioEl.setSinkId(spkId);
        if (remoteVid && remoteVid.setSinkId) await remoteVid.setSinkId(spkId);
    } catch(e) { console.error("Speaker change error", e); }
};

// Створення HTML для відео
function ensureVideoElements() {
    let container = document.getElementById('video-call-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'video-call-container';
        container.style.cssText = 'display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 5; background: #111; overflow: hidden; border-radius: inherit;';
        container.innerHTML = `
            <video id="remote-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
            <video id="local-video" autoplay muted playsinline style="position: absolute; bottom: 120px; right: 20px; width: 100px; height: 140px; object-fit: cover; border-radius: 12px; border: 2px solid rgba(240,4,127,0.5); box-shadow: 0 4px 15px rgba(240,4,127,0.3); z-index: 10;"></video>
        `;
        const callScreen = document.getElementById('telegram-call-screen');
        if (callScreen) callScreen.appendChild(container); 
        else document.body.appendChild(container);
    }
}

function showLocalVideo() {
    ensureAdvancedControls(); 
    ensureVideoElements();
    const videoContainer = document.getElementById('video-call-container');
    const localVid = document.getElementById('local-video');
    if (videoContainer) videoContainer.style.display = 'block';
    if (localVid && localAudioStream) {
        localVid.srcObject = localAudioStream;
        localVid.play().catch(e => console.error("Помилка відео:", e));
    }
}

function handleMediaError(err, msg) {
    console.error("Збій пристроїв/зв'язку:", err);
    const statusText = document.getElementById('call-status');
    if (statusText) statusText.innerText = msg;
    setTimeout(() => window.endTelegramCall(false), 2000);
}

function prepareCallUI(isIncoming, targetName, targetAvatar, incomingMsg, outgoingMsg) {
    const callScreen = document.getElementById('telegram-call-screen');
    const statusText = document.getElementById('call-status');
    const incomingActions = document.getElementById('call-incoming-actions');
    const outgoingActions = document.getElementById('call-outgoing-actions');
    const activeActions = document.getElementById('call-active-actions');
    
    lastSignalTime = Date.now(); 
    isServerNotified = false;

    if (incomingActions) { incomingActions.style.position = 'relative'; incomingActions.style.zIndex = '9999'; }
    if (outgoingActions) { outgoingActions.style.position = 'relative'; outgoingActions.style.zIndex = '9999'; }
    if (activeActions) { activeActions.style.position = 'relative'; activeActions.style.zIndex = '9999'; }
    
    let finalName = targetName || (document.getElementById('chat-target-name') ? document.getElementById('chat-target-name').innerText : "Співрозмовник");
    let finalAvatar = targetAvatar || (document.getElementById('chat-target-avatar') ? document.getElementById('chat-target-avatar').src : "img/default_avatar.png");
    
    document.getElementById('call-username').innerText = finalName;
    document.getElementById('call-avatar-img').src = finalAvatar;
    document.getElementById('call-avatar-img').style.display = 'block'; 
    if(document.getElementById('video-call-container')) document.getElementById('video-call-container').style.display = 'none';

    ensureAdvancedControls();

    clearInterval(callTimerInterval);
    clearTimeout(callRingTimeout);
    document.querySelectorAll('.tg-pulse-ring').forEach(ring => ring.style.display = 'block');
    callScreen.style.display = 'flex';
    setTimeout(() => callScreen.classList.add('active'), 10);

    if (isIncoming) {
        callState = 'ringing';
        statusText.innerText = incomingMsg;
        outgoingActions.style.display = 'none';
        activeActions.style.display = 'none';
        incomingActions.style.display = 'flex';
        
        callRingTimeout = setTimeout(() => {
            if (callState === 'ringing') {
                statusText.innerText = "Пропущений дзвінок";
                setTimeout(() => window.endTelegramCall(false), 2000);
            }
        }, 60000);
    } else {
        callState = 'calling';
        statusText.innerText = outgoingMsg;
        incomingActions.style.display = 'none';
        activeActions.style.display = 'none';
        outgoingActions.style.display = 'flex'; 
    }
}
async function makeOffer(trackHandler) {
    window.pendingRemoteCandidates = [];
    window.localCandIdx = 0;
    peerConnection = new RTCPeerConnection(rtcServers);
    attachConnectionWatchdog(peerConnection); // ✨ trickle ICE + автовідновлення
    localAudioStream.getTracks().forEach(track => peerConnection.addTrack(track, localAudioStream));
    peerConnection.ontrack = trackHandler;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    document.getElementById('call-status').innerText = "З'єднання...";
    await waitForIceGathering(peerConnection);

    if (callState === 'idle' || !peerConnection) return; 

    document.getElementById('call-status').innerText = "Телефонуємо...";
    window.sendCallSignal('start', peerConnection.localDescription);

    callRingTimeout = setTimeout(() => {
        if (callState === 'calling') {
            document.getElementById('call-status').innerText = "Немає відповіді";
            setTimeout(() => window.endTelegramCall(false), 2000);
        }
    }, 60000);
}

async function makeAnswer(trackHandler) {
    let sdpObj = parseSdp(incomingSdpOffer);
    if (!sdpObj || !sdpObj.type) { return handleMediaError(new Error("Пошкоджені SDP"), "Помилка зв'язку з сервером"); }

    peerConnection = new RTCPeerConnection(rtcServers);
    attachConnectionWatchdog(peerConnection); // ✨ trickle ICE + автовідновлення
    localAudioStream.getTracks().forEach(track => peerConnection.addTrack(track, localAudioStream));
    peerConnection.ontrack = trackHandler;

    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdpObj));
        await flushPendingCandidates(); // ❄️ застосовуємо кандидатів, що чекали в черзі
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        document.getElementById('call-status').innerText = "Підключення...";
        await waitForIceGathering(peerConnection);

        if (callState === 'idle' || !peerConnection) return; 

        document.getElementById('call-incoming-actions').style.display = 'none';
        document.getElementById('call-active-actions').style.display = 'flex';
        clearTimeout(callRingTimeout); 
        
        callState = 'active';
        window.sendCallSignal('answer', peerConnection.localDescription);
        startCallTimer(0);
    } catch (e) { handleMediaError(e, "Збій шифрування"); }
}

// ==========================================
// ❌ ЗАВЕРШЕННЯ ДЗВІНКА
// ==========================================
window.endTelegramCall = function(eventOrSkip) {
    if (eventOrSkip && eventOrSkip.preventDefault) eventOrSkip.preventDefault();
    const shouldSkip = (eventOrSkip === true);

    const callScreen = document.getElementById('telegram-call-screen');
    if (callScreen) {
        callScreen.classList.remove('active');
        setTimeout(() => { callScreen.style.display = 'none'; }, 300);
    }
    const statusText = document.getElementById('call-status');
    if (statusText) statusText.innerText = "Дзвінок завершено";

    let sysMsg = "";
    if (callState !== 'idle') {
        const callTag = window.isVideoCall ? 'SYS_VIDEO_CALL' : 'SYS_CALL';
        if (callState === 'active') {
            let elapsed = Math.floor((Date.now() - callStartTime) / 1000);
            let m = Math.floor(Math.max(0, elapsed) / 60);
            let s = Math.max(0, elapsed) % 60;
            sysMsg = `[${callTag}|active|${m}:${s < 10 ? '0' : ''}${s}]`; 
        } else if (callState === 'ringing') {
            sysMsg = `[${callTag}|missed|]`; 
        } else if (callState === 'calling') {
            sysMsg = `[${callTag}|canceled|]`; 
        }
        if (!shouldSkip && sysMsg !== "") { window.sendSystemMessageToChat(sysMsg); }
    }

    callState = 'idle';
    isServerNotified = false; 
    lastSignalTime = 0; 
    incomingSdpOffer = null;
    isEffectLooping = false; 
    window.pendingRemoteCandidates = []; // ❄️ чистимо чергу ICE
    window.localCandIdx = 0;
    
    clearInterval(callTimerInterval);
    clearTimeout(callRingTimeout);
    
    if (!shouldSkip) { window.sendCallSignal('end'); }
    
    window.isVideoCall = false; 
    stopAllMedia();
};

function stopAllMedia() {
    try { stopVisualizer(); } catch(e) {}
    
    if (window.isScreenSharing) window.isScreenSharing = false;

    if (window.hardwareVideoTrack) {
        try { window.hardwareVideoTrack.stop(); } catch(e){}
        window.hardwareVideoTrack = null;
    }

    if (localAudioStream) {
        try { localAudioStream.getTracks().forEach(track => { track.enabled = false; track.stop(); }); } catch(e) {}
        localAudioStream = null;
    }
    if (peerConnection) {
        try { peerConnection.ontrack = null; peerConnection.onicecandidate = null; peerConnection.close(); } catch(e) {}
        peerConnection = null;
    }
    if (typeof remoteAudioEl !== 'undefined' && remoteAudioEl) { 
        try { remoteAudioEl.pause(); } catch(e) {}
        remoteAudioEl.srcObject = null; 
    }

    const remoteVid = document.getElementById('remote-video');
    const localVid = document.getElementById('local-video');
    const videoContainer = document.getElementById('video-call-container');
    const avatarImg = document.getElementById('call-avatar-img');
    
    if (remoteVid) { try { remoteVid.pause(); } catch(e) {} remoteVid.srcObject = null; remoteVid.src = ""; }
    if (localVid) { try { localVid.pause(); } catch(e) {} localVid.srcObject = null; localVid.src = ""; }
    
    if (videoContainer) videoContainer.style.display = 'none';
    if (avatarImg) avatarImg.style.display = 'block';
    
    const settingsModal = document.getElementById('call-settings-modal');
    if (settingsModal) settingsModal.style.display = 'none';

    window.isMicMuted = false;
    window.isSpeakerMuted = false;
    window.isCameraMuted = false;
    document.querySelectorAll('.call-btn').forEach(btn => btn.classList.remove('active'));
    
    let advCam = document.getElementById('btn-adv-camera');
    let advScr = document.getElementById('btn-adv-screen');
    if (advCam) { advCam.style.background = 'rgba(255,255,255,0.2)'; advCam.style.color = 'white'; advCam.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`; }
    if (advScr) { advScr.style.background = 'rgba(255,255,255,0.2)'; advScr.style.color = 'white'; }

    window.currentVideoEffect = 'none';
    let fxBtns = document.querySelectorAll('.fx-btn');
    fxBtns.forEach(b => { b.style.background = '#2a111c'; b.style.color = 'white'; b.style.border = '1px solid #f0047f'; });
    if(fxBtns[0]) { fxBtns[0].style.background = '#f0047f'; fxBtns[0].style.border = 'none'; }
}

// ==========================================
// 📡 ЗВ'ЯЗОК З СЕРВЕРОМ
// ==========================================
window.sendCallSignal = function(action, sdpData = null) {
    const receiverId = window.currentChatUserId; 
    if (!receiverId && action === 'start') return; 

    fetch('call_sync.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: action, 
            target_id: receiverId,
            caller_name: localStorage.getItem('user_name') || "Користувач",       
            caller_avatar: localStorage.getItem('user_avatar') || "img/default_avatar.png",
            sdp: sdpData,
            is_video: window.isVideoCall
        }),
        credentials: 'include'
    }).then(() => {
        isServerNotified = true; 
        lastSignalTime = Date.now();
    }).catch(e => console.error(e));
};

function startCallTimer(startOffset = 0) {
    const statusText = document.getElementById('call-status');
    document.querySelectorAll('.tg-pulse-ring').forEach(ring => ring.style.display = 'none');
    clearInterval(callTimerInterval); 
    callStartTime = Date.now() - (startOffset * 1000);
    
    callTimerInterval = setInterval(() => {
        let elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        let mins = Math.floor(Math.max(0, elapsed) / 60);
        let secs = Math.max(0, elapsed) % 60;
        statusText.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }, 1000);
}

// 🔥 ЄДИНИЙ РАДАР ДЗВІНКІВ
setInterval(async () => {
    try {
        const response = await fetch('call_sync.php?action=check&cand_idx=' + (window.localCandIdx || 0), { credentials: 'include' });
        const data = await response.json();

        // ❄️ TRICKLE ICE: приймаємо нових кандидатів партнера
        if (data.candidates && data.candidates.length) {
            window.localCandIdx = data.cand_idx || (window.localCandIdx + data.candidates.length);
            await applyRemoteCandidates(data.candidates);
        }

        if (data.is_calling && callState === 'idle') {
            window.currentChatUserId = data.caller_id; 
            incomingSdpOffer = data.sdp_offer; 
            const cName = data.caller_name || "Користувач";
            const cAvatar = data.caller_avatar || "img/default_avatar.png";
            
            let sdpStr = typeof data.sdp_offer === 'string' ? data.sdp_offer : JSON.stringify(data.sdp_offer || {});
            let hasVideo = (data.is_video == true || data.is_video == 'true' || data.is_video == 1 || sdpStr.includes('m=video'));

            if (hasVideo) { window.startVideoCall(true, cName, cAvatar); } 
            else { window.startTelegramCall(true, cName, cAvatar); }
        }

        if (data.call_answered && callState === 'calling') {
            callState = 'active'; 
            document.getElementById('call-outgoing-actions').style.display = 'none';
            document.getElementById('call-active-actions').style.display = 'flex';
            clearTimeout(callRingTimeout);
            
            if (data.sdp_answer && peerConnection && peerConnection.signalingState !== 'closed') {
                let ansObj = parseSdp(data.sdp_answer);
                if (ansObj && ansObj.type) {
                    try { 
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(ansObj)); 
                        await flushPendingCandidates(); // ❄️ кандидати, що прийшли раніше за answer
                    } 
                    catch(e) { console.error("Помилка підключення:", e); }
                }
            }
            startCallTimer(data.active_time ? data.active_time : 0); 
        }

        if (data.call_ended && (Date.now() - lastSignalTime > 6000)) {
            if (callState === 'ringing' || ((callState === 'calling' || callState === 'active') && isServerNotified)) {
                window.endTelegramCall(true);
            }
        }
    } catch(e) {}
}, 500); 

// ==========================================
// 🎛️ УПРАВЛІННЯ ПРИСТРОЯМИ / ЕКРАНОМ
// ==========================================
window.isMicMuted = false;
window.isSpeakerMuted = false;
window.isCameraMuted = false;
window.isScreenSharing = false;

window.toggleMic = function() {
    if (!localAudioStream) return;
    window.isMicMuted = !window.isMicMuted;
    localAudioStream.getAudioTracks().forEach(track => track.enabled = !window.isMicMuted);
    const btn = document.getElementById('btn-mic') || document.getElementById('btn-mute-mic');
    if (btn) btn.classList.toggle('active', window.isMicMuted);
};

window.toggleSpeaker = function() {
    window.isSpeakerMuted = !window.isSpeakerMuted;
    if (remoteAudioEl) remoteAudioEl.volume = window.isSpeakerMuted ? 0 : 1;
    let remoteVid = document.getElementById('remote-video');
    if (remoteVid) remoteVid.volume = window.isSpeakerMuted ? 0 : document.getElementById('setting-volume') ? document.getElementById('setting-volume').value : 1;
    const btn = document.getElementById('btn-speaker') || document.getElementById('btn-mute-speaker');
    if (btn) btn.classList.toggle('active', window.isSpeakerMuted);
};

window.toggleCamera = async function() {
    if (!localAudioStream && !window.isCameraMuted) return;

    window.isCameraMuted = !window.isCameraMuted;
    let advCam = document.getElementById('btn-adv-camera');

    if (window.isCameraMuted) {
        if (window.hardwareVideoTrack) { window.hardwareVideoTrack.stop(); }
        if (localAudioStream) {
            localAudioStream.getVideoTracks().forEach(track => {
                track.enabled = false;
                track.stop(); 
                localAudioStream.removeTrack(track);
            });
        }
        const localVid = document.getElementById('local-video');
        if (localVid) localVid.style.display = 'none';

        if (advCam) {
            advCam.style.background = 'white';
            advCam.style.color = 'black';
            advCam.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        }
    } else {
        try {
            const rawStream = await navigator.mediaDevices.getUserMedia({ video: true });
            window.hardwareVideoTrack = rawStream.getVideoTracks()[0];
            
            const newStreamWithEffect = await setupVideoEffectPipeline(rawStream);
            const newVideoTrack = newStreamWithEffect.getVideoTracks()[0];

            if (localAudioStream) { localAudioStream.addTrack(newVideoTrack); }

            if (peerConnection) {
                const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) { sender.replaceTrack(newVideoTrack); } 
                else { peerConnection.addTrack(newVideoTrack, localAudioStream); }
            }

            const localVid = document.getElementById('local-video');
            if (localVid) {
                localVid.srcObject = new MediaStream([newVideoTrack]);
                localVid.style.display = 'block';
            }

            if (advCam) {
                advCam.style.background = 'rgba(255,255,255,0.2)';
                advCam.style.color = 'white';
                advCam.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
            }
        } catch (err) {
            console.error("Не вдалося увімкнути камеру:", err);
            window.isCameraMuted = true; 
            alert("Не вдалося отримати доступ до камери.");
        }
    }
};

window.toggleScreenShare = async function() {
    if (!peerConnection) return;
    let advScr = document.getElementById('btn-adv-screen');
    
    try {
        if (!window.isScreenSharing) {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack);
            
            const localVid = document.getElementById('local-video');
            if (localVid) localVid.srcObject = new MediaStream([screenTrack]);

            window.isScreenSharing = true;
            if (advScr) { advScr.style.background = '#f0047f'; advScr.style.color = 'white'; }
            
            screenTrack.onended = () => { window.revertToCamera(); };
        } else {
            window.revertToCamera();
        }
    } catch (e) { console.error("Помилка захоплення екрану:", e); }
};

window.revertToCamera = function() {
    if (!localAudioStream) return;
    const camTrack = localAudioStream.getVideoTracks()[0];
    const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender && camTrack) sender.replaceTrack(camTrack);
    
    const localVid = document.getElementById('local-video');
    if (localVid) localVid.srcObject = localAudioStream;
    
    window.isScreenSharing = false;
    let advScr = document.getElementById('btn-adv-screen');
    if (advScr) advScr.style.background = 'rgba(255,255,255,0.2)';
};

// ==========================================
// 💬 ВІДЖЕТИ ТА ПОВІДОМЛЕННЯ В ЧАТІ
// ==========================================
if (!document.getElementById('tg-call-magic-styles')) {
    const style = document.createElement('style');
    style.id = 'tg-call-magic-styles';
    style.innerHTML = `
        *:has(> .tg-call-widget), *:has(> * > .tg-call-widget), .text-bubble:has(.tg-call-widget) {
            background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important;
        }
    `;
    document.head.appendChild(style);
}

setInterval(function() {
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer) return;
    const bubbles = chatContainer.querySelectorAll('div, span, p'); 
    
    bubbles.forEach(bubble => {
        if (bubble.innerHTML.includes('[SYS_') && !bubble.innerHTML.includes('tg-call-widget')) {
            const regex = /\[(SYS_CALL|SYS_VIDEO_CALL)\|(active|missed|canceled)\|([^\]]*)\]/g;
            const newHTML = bubble.innerHTML.replace(regex, (match, sysType, type, duration) => {
                let isVideo = sysType === 'SYS_VIDEO_CALL';
                let title = type === 'active' ? (isVideo ? 'Відеодзвінок завершено' : 'Дзвінок завершено') : (type === 'missed' ? 'Пропущений дзвінок' : 'Скасований дзвінок');
                let desc = type === 'active' ? duration : 'Натисніть, щоб перетелефонувати';
                
                let iconColor = type === 'active' ? 'rgba(240, 4, 127, 0.15)' : 'rgba(255, 77, 77, 0.15)';
                let iconStroke = type === 'active' ? '#f0047f' : '#ff4d4d';
                
                let svgIcon = isVideo 
                    ? `<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>`
                    : `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>`;
                let clickAction = isVideo ? "window.startVideoCall(event)" : "window.startTelegramCall(event)";

                return `
                    <div class="tg-call-widget" onclick="${clickAction}" style="display: flex; align-items: center; gap: 14px; cursor: pointer; padding: 12px 16px 12px 12px; border-radius: 16px; background: #221018; border: 1px solid rgba(240, 4, 127, 0.15); user-select: none; width: max-content; min-width: 240px; transition: 0.2s; margin: 0;" onmouseover="this.style.background='#311622'" onmouseout="this.style.background='#221018'">
                        <div style="width: 44px; height: 44px; border-radius: 50%; background: ${iconColor}; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${iconStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgIcon}</svg>
                        </div>
                        <div style="display: flex; flex-direction: column; text-align: left;">
                            <span style="color: white; font-weight: bold; font-size: 15px; margin-bottom: 2px; font-family: sans-serif; line-height: 1;">${title}</span>
                            <span style="color: rgba(255,255,255,0.5); font-size: 13px; font-family: sans-serif; line-height: 1;">${desc}</span>
                        </div>
                    </div>`;
            });
            if (bubble.innerHTML !== newHTML) bubble.innerHTML = newHTML;
        }
    });
}, 300);

window.sendSystemMessageToChat = async function(text) {
    let receiverId = typeof currentChatUserId !== 'undefined' ? currentChatUserId : window.currentChatUserId;
    if (!receiverId) return;

    const formData = new FormData();
    formData.append('receiver_id', receiverId);
    formData.append('text', text);
    formData.append('media_type', 'text');
    
    try {
        if (typeof window.uploadFormData === 'function') await window.uploadFormData(formData);
        else if (typeof uploadFormData === 'function') await uploadFormData(formData);
        
        if (typeof window.loadChatMessages === 'function') window.loadChatMessages(receiverId, false);
        else if (typeof loadChatMessages === 'function') loadChatMessages(receiverId, false);
    } catch (e) {}
};

// === КНОПКА "ВНИЗ" У СТИЛІ TELEGRAM ===
window.ensureScrollToBottomBtn = function() {
    let btn = document.getElementById('chat-scroll-to-bottom-btn');
    if (!btn) {
        const parentBox = document.getElementById('chat-messages').parentElement;
        
        btn = document.createElement('div');
        btn.id = 'chat-scroll-to-bottom-btn';
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
            <div id="chat-unread-counter" style="display:none; position:absolute; top:-5px; right:-5px; background:#f0047f; color:white; font-size:11px; font-weight:bold; border-radius:50px; min-width:18px; height:18px; align-items:center; justify-content:center; padding:0 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">0</div>
        `;
        // ИЗМЕНЕНО: bottom: 140px; чтобы кнопка была выше поля ввода
        btn.style.cssText = 'display:none; position:absolute; bottom:140px; right:50px; width:44px; height:44px; border-radius:50%; background:#2A1520; border:1px solid #f0047f; color:#f0047f; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 5px 15px rgba(0,0,0,0.4); z-index:9999; transition:transform 0.2s, background 0.2s; backdrop-filter: blur(4px);';
        
        btn.onmouseover = () => { btn.style.background = '#3D1329'; };
        btn.onmouseout = () => { btn.style.background = '#2A1520'; };
        
        btn.onclick = () => {
            const msgContainer = document.getElementById('chat-messages');
            msgContainer.scrollTo({ top: msgContainer.scrollHeight, behavior: 'smooth' });
            btn.style.display = 'none';
            document.getElementById('chat-unread-counter').style.display = 'none';
            document.getElementById('chat-unread-counter').innerText = '0';
        };
        
        parentBox.appendChild(btn);
    }
    return btn;
};

// === СЛУХАЧ СКРОЛУ ЧАТУ ===
window.setupChatScrollListener = function() {
    const msgContainer = document.getElementById('chat-messages');
    if (!msgContainer) return;
    
    let scrollTimeout;
    msgContainer.addEventListener('scroll', () => {
        // Блокуємо збереження під час оновлення DOM
        if (window.isChatRestoring) return;

        const btn = window.ensureScrollToBottomBtn();
        const isAtBottom = msgContainer.scrollHeight - msgContainer.clientHeight <= msgContainer.scrollTop + 50;

        if (isAtBottom) {
            btn.style.display = 'none';
            const counter = document.getElementById('chat-unread-counter');
            if(counter) {
                counter.style.display = 'none';
                counter.innerText = '0';
            }
            // Якщо в самому низу - запам'ятовуємо статус "BOTTOM"
            if (window.currentChatUserId) {
                localStorage.setItem('chat_scroll_' + window.currentChatUserId, 'BOTTOM');
            }
        } else {
            if (msgContainer.scrollHeight > msgContainer.clientHeight + 100) {
                if (btn.style.display !== 'flex') btn.style.display = 'flex';
            }

            // Розумне збереження: шукаємо ID повідомлення, яке зараз перед очима
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                if (window.currentChatUserId && !window.isChatRestoring) {
                    const messages = msgContainer.querySelectorAll('.msg-row');
                    for (let msg of messages) {
                        if (msg.offsetTop >= msgContainer.scrollTop) {
                            localStorage.setItem('chat_scroll_' + window.currentChatUserId, msg.getAttribute('data-id'));
                            break;
                        }
                    }
                }
            }, 150);
        }
    });
};

function openExtraFilters() {
    document.getElementById('extraFiltersModal').style.display = 'flex';
    document.body.classList.add('modal-is-open'); // Вмикаємо блокування
}

function closeExtraFilters() {
    document.getElementById('extraFiltersModal').style.display = 'none';
    document.body.classList.remove('modal-is-open'); // Вимикаємо блокування
}

function applyExtraFilters() {
    // 1. Зчитуємо значення з активних чіпсів
    const ageValue = document.querySelector('#chips-age .filter-chip.active')?.dataset.value || 'any';
    const styleValue = document.querySelector('#chips-style .filter-chip.active')?.dataset.value || 'any';
    const genreValue = document.querySelector('#chips-genre .filter-chip.active')?.dataset.value || 'any';
    const voiceValue = document.querySelector('#chips-voice .filter-chip.active')?.dataset.value || 'any';

    const filters = {
        age: ageValue,
        style: styleValue,
        genre: genreValue,
        voice: voiceValue
    };

    console.log("🚀 Зберігаємо фільтри:", filters);

    // 2. Відправляємо на наш новий PHP-скрипт
    fetch('save_filters.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log("✅ Фільтри успішно збережено в БД!");
            // Тут можеш викликати функцію оновлення стрічки постів, якщо вона є
        }
    })
    .catch(err => console.error("Помилка збереження фільтрів:", err));
    
    // Закриваємо модалку (використовуємо твою існуючу функцію)
    closeExtraFilters();
}


// ЖОРСТКЕ БЛОКУВАННЯ ПРОКРУТКИ МИШЕЮ ТА ТАЧПАДОМ (СЕНСОРОМ)
document.addEventListener('DOMContentLoaded', () => {
    const filtersModal = document.getElementById('extraFiltersModal');
    
    if (filtersModal) {
        // Блокуємо коліщатко миші
        filtersModal.addEventListener('wheel', function(e) {
            e.preventDefault(); // Скасовує стандартну поведінку (скрол)
        }, { passive: false });

        // Блокуємо свайпи на телефоні
        filtersModal.addEventListener('touchmove', function(e) {
            e.preventDefault();
        }, { passive: false });
    }
});

// Нова функція ЗАВАНТАЖЕННЯ ФІЛЬТРІВ (викликай її при завантаженні сторінки)
function loadUserFilters() {
    fetch('get_filters.php')
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log("📥 Завантажено фільтри з БД:", data);
            
            // Встановлюємо активні чіпси
            setActiveChip('chips-age', data.age);
            setActiveChip('chips-style', data.style);
            setActiveChip('chips-genre', data.genre);
            setActiveChip('chips-voice', data.voice);
        }
    })
    .catch(err => console.error("Помилка завантаження фільтрів:", err));
}

// Допоміжна функція для підсвічування потрібного чіпса
function setActiveChip(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Знімаємо active з усіх чіпсів у контейнері
    const allChips = container.querySelectorAll('.filter-chip');
    allChips.forEach(chip => chip.classList.remove('active'));

    // Шукаємо потрібний чіпс і додаємо йому active
    const targetChip = container.querySelector(`.filter-chip[data-value="${value}"]`);
    if (targetChip) {
        targetChip.classList.add('active');
    }
}

// Викликаємо завантаження при старті сторінки
document.addEventListener('DOMContentLoaded', () => {
    loadUserFilters();
});
let filterVoiceRequired = true;

window.setVoiceFilter = function(val) {
    filterVoiceRequired = val;
    const btnYes = document.getElementById('voice-yes');
    const btnNo = document.getElementById('voice-no');

    if (val) {
        btnYes.style.background = '#dfb0c7'; btnYes.style.color = '#1d0016';
        btnNo.style.background = '#2d0f1e'; btnNo.style.color = '#dfb0c7';
    } else {
        btnNo.style.background = '#dfb0c7'; btnNo.style.color = '#1d0016';
        btnYes.style.background = '#2d0f1e'; btnYes.style.color = '#dfb0c7';
    }
};


window.currentFilters = { 
    age: 'any', 
    comm: 'any',   // Замість style
    level: 'any',  // Замість genre
    lang: 'any'    // Замість voice
};

function initFilterChips() {
    const containers = document.querySelectorAll('.filter-chips-container');
    
    containers.forEach(container => {
        const chips = container.querySelectorAll('.filter-chip');
        const filterType = container.id.replace('chips-', ''); 

        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                window.currentFilters[filterType] = chip.getAttribute('data-value');
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', initFilterChips);

// 1. ВІДКРИТТЯ ФІЛЬТРІВ
window.openExtraFilters = function() {
    document.getElementById('extraFiltersModal').style.display = 'flex';

    // 1. Створюємо жорсткий стиль, який на 100% співпадає з твоїм класом
    let oldStyle = document.getElementById('kill-ghost-scroll');
    if (oldStyle) oldStyle.remove();

    let style = document.createElement('style');
    style.id = 'kill-ghost-scroll';
    style.innerHTML = `
        /* Блокуємо прокрутку і мишку для фону */
        .main-content-block {
            overflow: hidden !important;
            pointer-events: none !important;
        }
        /* Знищуємо саму графіку скролбара */
        .main-content-block::-webkit-scrollbar,
        .main-content-block::-webkit-scrollbar-thumb,
        .main-content-block::-webkit-scrollbar-track {
            display: none !important;
            width: 0px !important;
        }
        /* Повертаємо кліки для модалки, щоб ти могла натискати фільтри */
        #extraFiltersModal, #extraFiltersModal * {
            pointer-events: auto !important;
        }
    `;
    document.head.appendChild(style);

    // 2. МАГІЯ ПРОТИ CHROME: Змушуємо браузер кліпнути (перемалювати екран)
    const block = document.querySelector('.main-content-block');
    if (block) {
        // Змінюємо паддінг на 0.01px, щоб браузер був змушений стерти скролбар
        const currentPadding = getComputedStyle(block).padding;
        block.style.padding = '40.01px'; 
        
        // Повертаємо нормальний паддінг через мілісекунду
        setTimeout(() => {
            block.style.padding = currentPadding;
        }, 10);
    }
};

// 2. ЗАКРИТТЯ ФІЛЬТРІВ
window.closeExtraFilters = function() {
    document.getElementById('extraFiltersModal').style.display = 'none';

    // Видаляємо стиль-вбивцю
    let style = document.getElementById('kill-ghost-scroll');
    if (style) style.remove();

    // Знову змушуємо браузер кліпнути, щоб повернути скролбар
    const block = document.querySelector('.main-content-block');
    if (block) {
        const currentPadding = getComputedStyle(block).padding;
        block.style.padding = '40.01px';
        setTimeout(() => {
            block.style.padding = currentPadding;
        }, 10);
    }
};


window.resetFilters = function() {
    document.querySelectorAll('.filter-chips-container').forEach(container => {
        const chips = container.querySelectorAll('.filter-chip');
        chips.forEach(c => c.classList.remove('active'));
        if(chips.length > 0) chips[0].classList.add('active');
    });
    
    window.currentFilters = { age: 'any', style: 'any', genre: 'any', voice: 'any' };
    applyExtraFilters(); // Застосовуємо одразу чисті фільтри
};

document.addEventListener('click', function(e) {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return; 

    const container = chip.closest('.filter-chips-container');
    if (!container) return;

    // Знімаємо рожевий колір з усіх
    container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));

    // Додаємо рожевий колір вибраному
    chip.classList.add('active');

    console.log('🔘 Вибрано:', chip.dataset.value, 'у', container.id);
});

window.applyExtraFilters = function() {
    const searchModal = document.getElementById('extraFiltersModal');
    if (!searchModal) return;

    const filters = {
        age: searchModal.querySelector('#chips-age .filter-chip.active')?.dataset.value || 'any',
        comm_style: searchModal.querySelector('#chips-style .filter-chip.active')?.dataset.value || 'any',
        skill_level: searchModal.querySelector('#chips-genre .filter-chip.active')?.dataset.value || 'any',
        language: searchModal.querySelector('#chips-voice .filter-chip.active')?.dataset.value || 'any'
    };

    fetch('save_filters.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log("✅ Фільтри збережено!");
            
            // ✨ ДОДАЛИ ЦЕ ✨ Відмальовуємо кружечки одразу після збереження
            updateFilterCirclesUI(filters); 
            
            document.getElementById('extraFiltersModal').style.display = 'none';
        }
    });
};
window.loadUserFilters = function() {
    fetch('get_filters.php')
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log("📥 Отримано з БД:", data);
            setActiveChipInModal('extraFiltersModal', 'chips-age', data.age);
            setActiveChipInModal('extraFiltersModal', 'chips-style', data.comm_style);
            setActiveChipInModal('extraFiltersModal', 'chips-genre', data.skill_level);
            setActiveChipInModal('extraFiltersModal', 'chips-voice', data.language);

            // ✨ ДОДАЛИ ЦЕ ✨ Відмальовуємо кружечки при оновленні сторінки
            const loadedFilters = {
                age: data.age,
                comm_style: data.comm_style,
                skill_level: data.skill_level,
                language: data.language
            };
            updateFilterCirclesUI(loadedFilters);
        }
    });
};
function setActiveChipInModal(modalId, containerId, value) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const container = modal.querySelector('#' + containerId);
    if (!container) return;

    container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    const target = container.querySelector(`.filter-chip[data-value="${value}"]`);
    if (target) target.classList.add('active');
}

// Допоміжна функція для підсвічування кружечків
function setActiveChip(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    const target = container.querySelector(`.filter-chip[data-value="${value}"]`);
    if (target) target.classList.add('active');
}

// Завантаження фільтрів уже запускається при DOMContentLoaded на початку файлу (без дублювання)

window.saveToHistory = function(id, username, avatar) {
    let history = JSON.parse(localStorage.getItem('profile_view_history')) || [];
    
    // Видаляємо дублікат, якщо він уже є, щоб підняти профіль вгору
    history = history.filter(user => user.id !== id);
    
    // Додаємо новий перегляд на початок списку
    history.unshift({ id, username, avatar });
    
    // Зберігаємо лише останні 6 профілів, щоб не забивати пам'ять
    if (history.length > 6) history.pop();
    
    localStorage.setItem('profile_view_history', JSON.stringify(history));
};

// ФУНКЦІЯ ОНОВЛЕННЯ СПИСКУ НА ЕКРАНІ
window.renderViewHistory = function() {
    const historyContainer = document.getElementById('real-history-list');
    if (!historyContainer) return;

    const history = JSON.parse(localStorage.getItem('profile_view_history')) || [];

    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #444; font-size: 12px;">
                Історія порожня
            </div>`;
        return;
    }

    historyContainer.innerHTML = history.map(user => `
        <div class="hist-user" onclick="window.location.href='profile.html?id=${user.id}'" style="cursor: pointer;">
            <img src="${user.avatar}" onerror="this.src='img/default_avatar.png'">
            <span>${user.username}</span>
        </div>
    `).join('');
};

// ФУНКЦІЯ МИТТЄВОГО СКИДАННЯ (БЕЗ ПІДТВЕРДЖЕННЯ)
window.clearSearchHistory = function() {
    // Видаляємо запис зі сховища браузера
    localStorage.removeItem('profile_view_history');
    
    // Відразу викликаємо перемальовку інтерфейсу
    if (typeof window.renderViewHistory === 'function') {
        window.renderViewHistory();
    }
};
// МОДИФІКУЄМО існуючий пошук:
// У твій обробник події фокусу на пошук (focus) додай виклик:
searchInput.addEventListener('focus', function() {
    // ... твій код ...
    window.renderViewHistory(); // Оновлюємо історію при відкритті
});

// МОДИФІКУЄМО вивід результатів пошуку людей:
// Там, де ти створюєш картку користувача в результатах, додай onclick:
// userCard.innerHTML = `... <button onclick="window.saveToHistory('${user.id}', '${user.username}', '${avatar}'); window.location.href='profile.html?id=${user.id}'"> ...`;

window.selectPostColor = function(element, colorName) {
        let swatches = document.querySelectorAll('.color-swatch-sm');
        swatches.forEach(swatch => swatch.classList.remove('active'));
        element.classList.add('active');
        
        // Магія, яка змінює тему всієї картки:
        document.getElementById('create-post-panel').setAttribute('data-selected-color', colorName);
    };

/* ═══════════════════════════════════════════════════════════════
   ПАРАМЕТРИ ТІМЕЙТА (фільтри при створенні анкети)
   Ці функції викликаються з home.html, але раніше були відсутні —
   тому кнопка "Параметри тімейта" нічого не відкривала.
   ═══════════════════════════════════════════════════════════════ */

// Поточний режим публікації заявки: 'anketa' (за замовч.) або 'group'
window.currentRequestMode = window.currentRequestMode || 'anketa';

// Відкриває / ховає панель параметрів тімейта (чіпи фільтрів)
window.toggleRequestPanel = function(mode) {
    // mode тут лише підказка ('anketa' | 'group'); реальний режим тримаємо в currentRequestMode
    if (mode === 'group' || mode === 'anketa') {
        window.currentRequestMode = mode;
    }

    const area      = document.getElementById('requests-filters-area');
    const anketaBlk = document.getElementById('req-anketa-fields-block');
    const groupBlk  = document.getElementById('requests-group-list-area');
    const btn       = document.getElementById('btn-toggle-requests-filters');

    if (!area) return;

    // Перемикаємо потрібний блок усередині панелі
    if (anketaBlk) anketaBlk.style.display = (window.currentRequestMode === 'group') ? 'none' : 'block';
    if (groupBlk)  groupBlk.style.display  = (window.currentRequestMode === 'group') ? 'block' : 'none';

    // Тогл видимості самої панелі
    const isHidden = window.getComputedStyle(area).display === 'none' || area.style.display === 'none';
    if (isHidden) {
        area.style.setProperty('display', 'block', 'important');
        area.classList.add('show');
        if (btn) btn.classList.add('active-btn');
        // Ховаємо інші панелі редактора, щоб не накладались
        ['post-filters-area', 'group-settings-area', 'extra-settings-area'].forEach(id => {
            const p = document.getElementById(id);
            if (p) p.style.setProperty('display', 'none', 'important');
        });
    } else {
        area.style.setProperty('display', 'none', 'important');
        area.classList.remove('show');
        if (btn) btn.classList.remove('active-btn');
    }
};

// Перемикає режим публікації (Анкета / Для групи) у тумблері редактора
window.switchRequestPublishMode = function(mode) {
    window.currentRequestMode = (mode === 'group') ? 'group' : 'anketa';

    const btnAnketa = document.getElementById('req-mode-anketa');
    const btnGroup  = document.getElementById('req-mode-group');

    if (btnAnketa) {
        const on = window.currentRequestMode === 'anketa';
        btnAnketa.classList.toggle('active', on);
        btnAnketa.style.background = on ? '#f0047f' : 'transparent';
        btnAnketa.style.color = on ? 'white' : '#ccc';
    }
    if (btnGroup) {
        const on = window.currentRequestMode === 'group';
        btnGroup.classList.toggle('active', on);
        btnGroup.style.background = on ? '#f0047f' : 'transparent';
        btnGroup.style.color = on ? 'white' : '#ccc';
    }

    // Якщо панель параметрів уже відкрита — оновлюємо, який блок показувати
    const area = document.getElementById('requests-filters-area');
    const anketaBlk = document.getElementById('req-anketa-fields-block');
    const groupBlk  = document.getElementById('requests-group-list-area');
    const areaOpen = area && !(window.getComputedStyle(area).display === 'none' || area.style.display === 'none');
    if (areaOpen) {
        if (anketaBlk) anketaBlk.style.display = (window.currentRequestMode === 'group') ? 'none' : 'block';
        if (groupBlk)  groupBlk.style.display  = (window.currentRequestMode === 'group') ? 'block' : 'none';
    }
};

window.togglePostPanel = function(panelName) {
    // 1. Всі панелі
    const panels = {
        'filters': document.getElementById('post-filters-area'),
        'group': document.getElementById('group-settings-area'),
        'extra': document.getElementById('extra-settings-area'),
        'requests-filters': document.getElementById('requests-filters-area')
    };

    // 2. Всі кнопки (щоб робити їх активними)
    const buttons = {
        'filters': document.getElementById('btn-toggle-filters'),
        'group': document.getElementById('btn-toggle-group'),
        'extra': document.getElementById('btn-toggle-extra'),
        'requests-filters': document.getElementById('btn-toggle-requests-filters')
    };

    // 3. Перебираємо все
    for (let key in panels) {
        const panel = panels[key];
        const btn = buttons[key];
        
        if (!panel) continue; 

        if (key === panelName) {
            // ЦЕ ТА ПАНЕЛЬ, НА ЯКУ МИ КЛІКНУЛИ
            const isHidden = window.getComputedStyle(panel).display === 'none' || panel.style.display === 'none';
            
            if (isHidden) {
                // Відкриваємо
                panel.style.setProperty('display', 'block', 'important');
                if (btn) btn.classList.add('active-btn'); // Підсвічуємо кнопку
            } else {
                // Закриваємо
                panel.style.setProperty('display', 'none', 'important');
                if (btn) btn.classList.remove('active-btn'); // Знімаємо підсвітку
            }
        } else {
            // ЦЕ ВСІ ІНШІ ПАНЕЛІ (ХОВАЄМО ЇХ)
            panel.style.setProperty('display', 'none', 'important');
            if (btn) btn.classList.remove('active-btn');
        }
    }
};
    // 3. НЕОНОВІ ТАБЛЕТКИ
    document.addEventListener("DOMContentLoaded", function() {
        const chips = document.querySelectorAll('.filter-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', function() {
                const container = this.closest('.filter-chips-container');
                container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
            });
        });
    });


    const ludoraMusicDB = [
    { 
        id: 1, 
        title: " The Hills", 
        artist: "The Weeknd", 
        img: "img/the hills.jpg", // Твоя обкладинка
        url: "music/The Weeknd - The Hills.mp3" // MP3 файл
    },
    { 
        id: 2, 
        title: "Lost In The Fire", 
        artist: "Gesaffelstein & The Weeknd", 
        img: "img/lost in the fire.jpg",
        url: "music/Gesaffelstein & The Weeknd - Lost In The Fire.mp3"
    },
    { 
        id: 3, 
        title: "Into It", 
        artist: "Chase Atlantic", 
        img: "img/Into It.jpg",
        url: "music/Chase Atlantic - Into It.mp3"
    },
    { 
        id: 4, 
        title: "Blinding Lights", 
        artist: "The Weeknd", 
        img: "https://i.ibb.co/LpYfM1n/photo-ludora.png",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
    }
];

   // Функція пошуку в твоїй базі
window.searchMockMusic = function() {
    const query = document.getElementById('music-search-input').value.toLowerCase();
    const dropdown = document.getElementById('music-search-dropdown');
    dropdown.innerHTML = '';

    if (query.length < 1) {
        dropdown.style.display = 'none';
        return;
    }

    // Шукаємо збіги в ludoraMusicDB
    const results = ludoraMusicDB.filter(track => 
        track.title.toLowerCase().includes(query) || 
        track.artist.toLowerCase().includes(query)
    );

    if (results.length > 0) {
        dropdown.style.display = 'block';
        results.forEach(track => {
            dropdown.innerHTML += `
                <div class="music-item" onclick="selectTrack(${track.id})">
                    <img src="${track.img}" class="music-thumb" alt="Cover">
                    <div class="music-details">
                        <span class="music-title">${track.title}</span>
                        <span class="music-artist">${track.artist}</span>
                    </div>
                </div>
            `;
        });
    } else {
        dropdown.style.display = 'block';
        dropdown.innerHTML = `<div class="music-item"><span class="music-artist">Трек не знайдено</span></div>`;
    }
};

// Вибір пісні з бази
window.selectTrack = function(trackId) {
    const track = ludoraMusicDB.find(t => t.id === trackId); // Шукаємо у твоїй базі
    if (!track) return;

    window.currentSelectedTrack = track;
    const playerContainer = document.getElementById('active-music-player');
    const audioEngine = document.getElementById('spotify-audio-engine');
    
    if (!track) return;

    // Ховаємо пошук
    document.getElementById('music-search-dropdown').style.display = 'none';
    document.getElementById('music-search-input').value = '';

    // Запускаємо звук
    if (audioEngine) {
        audioEngine.src = track.url;
        audioEngine.play().catch(e => console.log("Потрібен клік по сторінці для звуку"));
    }

    // Твій унікальний дизайн плеєра
    playerContainer.style.display = 'block';
    playerContainer.innerHTML = `
        <div class="track-card-minimal">
            <img src="${track.img}" class="album-art-minimal" alt="Cover">
            <div class="track-info-minimal">
                <span class="track-title-minimal">${track.title}</span>
                <span class="track-artist-minimal">${track.artist}</span>
            </div>
            <div class="wave-container-minimal">
                <div class="wave-bar-min"></div><div class="wave-bar-min"></div><div class="wave-bar-min"></div>
                <div class="wave-bar-min"></div><div class="wave-bar-min"></div><div class="wave-bar-min"></div>
            </div>
            <button class="btn-remove-minimal" onclick="removeMusic()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
    `;
};
// 4. ОНОВЛЕНА ФУНКЦІЯ ВИДАЛЕННЯ МУЗИКИ (ЗУПИНЯЄ ЗВУК)
window.removeMusic = function() {
    const playerContainer = document.getElementById('active-music-player');
    const audioEngine = document.getElementById('spotify-audio-engine');

    // Зупиняємо музику
    audioEngine.pause();
    audioEngine.src = "";

    playerContainer.innerHTML = '';
    playerContainer.style.display = 'none';
};
window.togglePostPlay = function(postId, songUrl) {
    const audio = document.getElementById('spotify-audio-engine');
    const container = document.getElementById('player-' + postId); // Шукає той самий ID
    const currentIcon = document.getElementById('btn-icon-' + postId);
    
    const playPath = 'M8 5v14l11-7z';
    const pausePath = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';

    if (!audio || !container || !currentIcon) {
        console.error("Елементи плеєра не знайдені!");
        return;
    }

    if (window.currentPlayingId === postId) {
        if (!audio.paused) {
            audio.pause();
            container.classList.remove('playing'); // Зупиняє хвилю
            currentIcon.querySelector('path').setAttribute('d', playPath); // Міняє на Play
        } else {
            audio.play();
            container.classList.add('playing'); // Запускає хвилю
            currentIcon.querySelector('path').setAttribute('d', pausePath); // Міняє на Pause
        }
        return;
    }

    // Зупиняємо попередній трек, якщо він був
    if (window.currentPlayingId) {
        const oldContainer = document.getElementById('player-' + window.currentPlayingId);
        const oldIcon = document.getElementById('btn-icon-' + window.currentPlayingId);
        if (oldContainer) oldContainer.classList.remove('playing');
        if (oldIcon) oldIcon.querySelector('path').setAttribute('d', playPath);
    }

    // Запускаємо новий
    window.currentPlayingId = postId;
    audio.src = songUrl;
    audio.play().then(() => {
        container.classList.add('playing');
        currentIcon.querySelector('path').setAttribute('d', pausePath);
    });

    audio.onended = () => {
        container.classList.remove('playing');
        currentIcon.querySelector('path').setAttribute('d', playPath);
    };
};
window.handlePostFileSelect = function(input) {
    const file = input.files[0];
    const preview = document.getElementById('preview-img-tag');
    const uploadContent = document.getElementById('upload-icon-content');

    if (file) {
        const reader = new FileReader();

        reader.onload = function(e) {
            // Вставляємо результат у картинку
            preview.src = e.target.result;
            preview.style.display = 'block';
            
            // Ховаємо іконку та текст "Додати фото"
            uploadContent.style.display = 'none';
            
            // Зберігаємо дані в глобальну змінну для publishPost (як ми робили раніше)
            window.currentPostImageBase64 = e.target.result;
        };

        reader.readAsDataURL(file);
    }
};

// Також корисно додати функцію очищення (для кнопки "Скасувати")
window.clearPhotoPreview = function() {
    const preview = document.getElementById('preview-img-tag');
    const uploadContent = document.getElementById('upload-icon-content');
    const fileInput = document.getElementById('post-file-input');

    if (preview) {
        preview.src = "";
        preview.style.display = 'none';
        uploadContent.style.display = 'block';
        fileInput.value = ""; // Скидаємо сам інпут
        window.currentPostImageBase64 = null;
    }
};
// ПРИМУСОВЕ ВІДНОВЛЕННЯ ФУНКЦІЙ
// Ставимо їх як властивості window, щоб HTML їх точно бачив

// 1. Функція лайків
window.votePost = async function(element, postId) {
    if (element.classList.contains('is-processing')) return;
    element.classList.add('is-processing');

    const countSpan = element.querySelector('span');
    let currentCount = parseInt(countSpan.innerText) || 0;
    const isCurrentlyLiked = element.classList.contains('liked');

    if (isCurrentlyLiked) {
        element.classList.remove('liked');
        currentCount = Math.max(0, currentCount - 1);
    } else {
        element.classList.add('liked');
        currentCount++;
    }
    countSpan.innerText = currentCount > 0 ? currentCount : '0';

    try {
        await fetch('vote_post.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                post_id: postId.replace('post-', ''),
                action: isCurrentlyLiked ? 'unlike' : 'like'
            }),
            credentials: 'include'
        });
    } catch (e) {
        console.error("Помилка мережі:", e);
    } finally {
        element.classList.remove('is-processing');
    }
};

// 2. Функція коментарів
window.toggleInlineComments = function(postId) {
    const cleanId = postId.toString().replace('post-', '');
    const block = document.getElementById(`inline-comments-block-${cleanId}`);
    const list = document.getElementById(`inline-comments-list-${cleanId}`);
    
    if (!block) {
        console.error("Не знайдено блок для поста:", cleanId);
        return;
    }

    if (block.style.display === 'none' || block.style.display === '') {
        block.style.display = 'block';
        if (typeof window.loadInlineComments === 'function') {
            window.loadInlineComments(cleanId);
        }
    } else {
        block.style.display = 'none';
    }
};

// === ЛОГІКА ВІКНА СТІКЕРІВ ТА ЕМОДЗІ ===

window.toggleStickerPicker = function(postId) {
    const picker = document.getElementById(`sticker-picker-${postId}`);
    if (!picker) return;

    // Якщо ми відкриваємо вікно (воно було приховане)
    if (picker.style.display === 'none' || picker.style.display === '') {
        picker.style.display = 'block';

        // --- СКИДАННЯ ДО ДЕФОЛТУ ---
        // 1. Знаходимо сітки
        const emojiGrid = picker.querySelector('.emoji-grid-class');
        const photoGrid = picker.querySelector('.photo-grid-class');
        
        // 2. Показуємо тільки емодзі, ховаємо гіфки
        if (emojiGrid) emojiGrid.style.setProperty('display', 'grid', 'important');
        if (photoGrid) photoGrid.style.setProperty('display', 'none', 'important');

        // 3. Робимо кнопку "ЕМОДЗІ" активною
        const tabs = picker.querySelectorAll('.picker-tab-btn');
        tabs.forEach(btn => {
            if (btn.innerText === 'ЕМОДЗІ') btn.classList.add('active');
            else btn.classList.remove('active');
        });
    } else {
        // Якщо клікнули знову — просто ховаємо
        picker.style.display = 'none';
    }
};

// 3. Вставлення емодзі в поле тексту коментаря
window.insertEmoji = function(postId, emojiOrCode) {
    const inputDiv = document.getElementById(`inline-comment-input-${postId}`);
    if (!inputDiv) return;

    inputDiv.focus(); // Повертаємо фокус, щоб курсор не зникав

    let contentToInsert = '';

    // 1. Якщо це твоя кастомна гіфка
    if (window.customEmojis && window.customEmojis[emojiOrCode]) {
        const url = window.customEmojis[emojiOrCode];
        contentToInsert = `<img src="${url}" data-code="${emojiOrCode}" class="custom-emoji-in-text" style="width:28px; height:28px; vertical-align:middle; border-radius:4px;">`;
    } 
    // 2. Якщо це стандартний Apple емодзі
    else if (window.appleEmojis && window.appleEmojis[emojiOrCode]) {
        const url = window.appleEmojis[emojiOrCode];
        contentToInsert = `<img src="${url}" data-emoji="${emojiOrCode}" class="apple-emoji-in-text" style="width:20px; height:20px; vertical-align:middle;">`;
    }
    // 3. Просто символ
    else {
        contentToInsert = emojiOrCode;
    }

    // Вставляємо саме в місце курсору
    document.execCommand('insertHTML', false, contentToInsert);
    
    // МИ НЕ ХОВАЄМО ПІКЕР. Тепер ти можеш клікати скільки завгодно!
};

window.insertPhotoComment = function(postId, url) {
    if (!window.selectedStickers) window.selectedStickers = {};
    window.selectedStickers[postId] = url;

    const previewContainer = document.getElementById(`selected-sticker-preview-${postId}`);
    
    if (previewContainer) {
        previewContainer.style.display = 'block';
        previewContainer.innerHTML = `
            <div style="position: relative; width: 100px; height: 100px; border-radius: 12px; overflow: hidden; border: 2px solid #f0047f; box-shadow: 0 0 15px rgba(240, 4, 127, 0.4);">
                <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
                <div onclick="window.cancelSticker('${postId}')" style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); color: white; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer;">×</div>
            </div>
        `;
    }
    
    document.getElementById(`sticker-picker-${postId}`).style.display = 'none';
};

// Функція скасування гіфки
window.cancelSticker = function(postId) {
    window.selectedStickers[postId] = null;
    document.getElementById(`selected-sticker-preview-${postId}`).style.display = 'none';
};

window.parseiPhoneEmojis = function(text) {
    if (!text) return "";
    let formattedText = text;

    // 1. СТАНДАРТНІ APPLE ЕМОДЗІ
    if (window.appleEmojis) {
        Object.entries(window.appleEmojis).forEach(([emoji, url]) => {
            const img = `<img src="${url}" style="width:20px; height:20px; vertical-align:middle; margin:0 2px; display:inline-block;">`;
            formattedText = formattedText.split(emoji).join(img);
        });
    }

    // 2. ТВОЇ КАСТОМНІ ГІФ-ЕМОДЗІ
    if (window.customEmojis) {
        Object.entries(window.customEmojis).forEach(([code, url]) => {
            // Створюємо безпечний пошук для кодів типу :custom1:
            const safeCode = code.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(safeCode, 'g');
            const customImg = `<img src="${url}" style="width:28px; height:28px; vertical-align:middle; margin:0 2px; display:inline-block; border-radius:4px;">`;
            formattedText = formattedText.replace(regex, customImg);
        });
    }
    return formattedText;
};
window.switchPickerTab = function(element, postId, tabName) {
    console.log("Перемикання вкладки на:", tabName, "для поста:", postId); // Для перевірки в F12
    
    // 1. Шукаємо саме той блок, у якому натиснули кнопку
    const parentBlock = element.closest('.sticker-picker-window');
    if (!parentBlock) return;

    const emojiGrid = parentBlock.querySelector('.emoji-grid-class');
    const photoGrid = parentBlock.querySelector('.photo-grid-class');
    
    // 2. Скидаємо активність кнопок
    const buttons = parentBlock.querySelectorAll('.picker-tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');

    // 3. Пряме керування відображенням
    if (tabName === 'emojis') {
        emojiGrid.style.setProperty('display', 'grid', 'important');
        photoGrid.style.setProperty('display', 'none', 'important');
    } else {
        emojiGrid.style.setProperty('display', 'none', 'important');
        photoGrid.style.setProperty('display', 'grid', 'important');
    }
};

// Твій список гіфок та стікерів. Просто додавай сюди назви файлів!
// 🛡️ ФІКС 404: залишені тільки файли, які реально існують в img/.
// 'sticker4.png' відсутній на сервері, а 'imgsticker5/6.png' були з помилкою
// (загублений слеш "img/") і теж не існують — вони давали 404 в консолі.
window.myCustomStickers = [
    'img/sticker1.gif',
    'img/sticker2.gif',
    'img/sticker3.png'
];

window.customEmojis = {
    ':custom1:': 'img/custom/cat1.gif',
    ':custom2:': 'img/custom/cat2.gif',
    ':custom3:': 'img/custom/cat3.gif',
    ':custom4:': 'img/custom/cat4.gif',
    ':custom5:': 'img/custom/cat5.gif',
    ':custom6:': 'img/custom/cat6.gif',
    ':custom7:': 'img/custom/cat7.gif',
    ':custom8:': 'img/custom/cat8.gif'
};

document.addEventListener('mousedown', function(e) {
    if (!e.target.closest('.sticker-picker-window') && !e.target.closest('.emoji-btn')) {
        document.querySelectorAll('.sticker-picker-window').forEach(p => p.style.display = 'none');
    }
});
// === ЛОГІКА ВІДМІТОК (РОЗУМНА КОМА) ===
window.mentionTimeout = null;

// Допоміжна функція: дістає тільки останнє слово
window.getCurrentMentionQuery = function() {
    const input = document.getElementById('mention-search-input');
    if (!input) return '';
    const parts = input.value.split(',');
    return parts[parts.length - 1].trim().replace('@', '');
};

// 1. Головна функція завантаження
window.loadMentionResults = async function() {
    const dropdown = document.getElementById('mention-dropdown');
    if (!dropdown) return;

    const query = window.getCurrentMentionQuery();

    try {
        const response = await fetch(`search_users.php?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        const data = await response.json();

        if (data.success) {
            const input = document.getElementById('mention-search-input');
            const currentText = input.value.toLowerCase();
            
            // Фільтр дублів
            const availableUsers = data.users.filter(u => !currentText.includes('@' + u.username.toLowerCase()));

            window.renderMentionDropdown(dropdown, availableUsers, data.mode === 'mutual' ? 'Взаємні підписки' : 'Результати пошуку');
        } else {
            dropdown.innerHTML = `<div style="padding: 10px; color: #ff4d4d; font-size: 12px; text-align: center;">Помилка: ${data.message}</div>`;
        }
    } catch (e) {
        console.error("Помилка запиту:", e);
    }
};

// 2. Відмальовка списку
window.renderMentionDropdown = function(container, items, title) {
    if (!items || items.length === 0) {
        container.innerHTML = `<div style="padding: 10px 15px; color: gray; font-size: 11px; text-align: center;">Нікого не знайдено (або всі вже відмічені)</div>`;
        return;
    }

    let html = `<div class="mention-category-title">${title}</div>`;
    items.forEach(item => {
        const avatarUrl = item.avatar ? item.avatar : 'img/default_avatar.png';
        html += `
            <div class="mention-item" onclick="window.selectMention(event, '${item.username}')">
                <img src="${avatarUrl}" class="mention-avatar" onerror="this.src='img/default_avatar.png'">
                <span class="mention-name-text">@${item.username}</span>
            </div>
        `;
    });
    container.innerHTML = html;
};

// 3. Вибір користувача (БЕЗ КОМИ В КІНЦІ)
window.selectMention = function(event, username) {
    if (event) event.stopPropagation();
    
    const input = document.getElementById('mention-search-input');
    
    let existingTags = input.value.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    
    const currentQuery = window.getCurrentMentionQuery();
    if (existingTags.length > 0) {
        const lastTag = existingTags[existingTags.length - 1];
        if (lastTag === currentQuery || lastTag === '@' + currentQuery) {
            existingTags.pop();
        }
    }

    // Додаємо нового користувача
    existingTags.push('@' + username);
    
    // Збираємо все назад через кому, АЛЕ БЕЗ коми в самому кінці!
    input.value = existingTags.join(', '); 
    
    // Ховаємо вікно (і НЕ ставимо input.focus(), щоб не викликати повторне відкриття)
    document.getElementById('mention-dropdown').style.display = 'none';
};

// 4. ПРИВ'ЯЗКА ПОДІЙ ДО ПОЛЯ ВВОДУ
setTimeout(() => {
    const mentionInput = document.getElementById('mention-search-input');
    const mentionDropdown = document.getElementById('mention-dropdown');

    if (mentionInput && mentionDropdown) {
        
        const openMenu = (e) => {
            if (e) e.stopPropagation();
            
            // РОЗУМНА КОМА: Якщо поле не пусте і там ще немає коми в кінці — додаємо її
            if (mentionInput.value.trim() !== '' && !mentionInput.value.trim().endsWith(',')) {
                mentionInput.value = mentionInput.value.trim() + ', ';
            }
            
            // Відкриваємо вікно
            mentionDropdown.style.display = 'flex';
            mentionDropdown.innerHTML = `<div style="padding: 15px; color: #f0047f; font-size: 12px; text-align: center; font-weight: bold;">Завантаження...</div>`;
            
            window.loadMentionResults();
        };

        // Вікно вилітає при кліку або фокусі
        mentionInput.addEventListener('click', openMenu);
        mentionInput.addEventListener('focus', openMenu);

        // Обробка вводу
        mentionInput.addEventListener('input', (e) => {
            clearTimeout(window.mentionTimeout);
            
            const query = window.getCurrentMentionQuery();
            if (query === '') {
                window.loadMentionResults(); // Якщо стерли до коми - показуємо друзів
                return;
            }
            
            window.mentionTimeout = setTimeout(() => {
                window.loadMentionResults();
            }, 300);
        });
    }
}, 500);

// 5. Закриття меню при кліку в інше місце
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('mention-dropdown');
    if (dropdown && !e.target.closest('.mention-search-wrapper')) {
        dropdown.style.display = 'none';
    }
});

// ✨ ГЛАВНЫЙ ФИКС 2: Блокиратор прыжков (Скрипт-Охранник)
document.addEventListener('click', function(e) {
    // Если кликнули по кнопке "Додати пост"
    if (e.target.closest('#add-post-btn') || e.target.closest('.custom-button-action')) {
        const requestsTab = document.getElementById('requests-content');
        const feedTab = document.getElementById('feed-content');
        
        // Запоминаем: были ли мы в "Заявках" до нажатия?
        if (requestsTab && (requestsTab.classList.contains('active') || requestsTab.style.display === 'block')) {
            
            // Ждем 10 миллисекунд (даем старой глючной функции отработать)
            setTimeout(() => {
                // И ЖЕСТКО возвращаем всё на место!
                if (feedTab) {
                    feedTab.classList.remove('active');
                    feedTab.style.display = 'none';
                }
                requestsTab.classList.add('active');
                requestsTab.style.display = 'block';
                window.currentLudoraPage = 'requests';
                
                // Убеждаемся, что панель редактора открылась
                const panel = document.getElementById('create-post-panel');
                if (panel) panel.style.display = 'block';
                
            }, 10);
        }
    }
}, true);
// 4. ЖОРСТКА ПРИВ'ЯЗКА ПОДІЙ ДО ПОЛЯ ВВОДУ
setTimeout(() => {
    const mentionInput = document.getElementById('mention-search-input');
    const mentionDropdown = document.getElementById('mention-dropdown');

    if (mentionInput && mentionDropdown) {
        
        // Функція відкриття вікна
        const openMenu = (e) => {
            if (e) e.stopPropagation();
            
            // Якщо вікно вже відкрите і там не порожньо - не перемальовуємо
            if (mentionDropdown.style.display === 'flex' && mentionDropdown.innerHTML.trim() !== '') return;

            // МИТТЄВО відкриваємо вікно і пишемо "Завантаження..."
            mentionDropdown.style.display = 'flex';
            mentionDropdown.innerHTML = `<div style="padding: 15px; color: #f0047f; font-size: 12px; text-align: center; font-weight: bold;">Завантаження...</div>`;
            
            // Беремо текст (якщо він є) і йдемо в базу
            const query = mentionInput.value.trim().replace('@', '');
            window.loadMentionResults(query);
        };

        // Вікно вилітає і при кліку, і при фокусі
        mentionInput.addEventListener('click', openMenu);
        mentionInput.addEventListener('focus', openMenu);

        // Обробка вводу (коли ти друкуєш букви)
        mentionInput.addEventListener('input', (e) => {
            clearTimeout(window.mentionTimeout);
            
            // Якщо поле повністю очистили - одразу показуємо друзів
            const query = e.target.value.trim().replace('@', '');
            if (query === '') {
                openMenu(e);
                return;
            }
            
            // Якщо ввели текст - чекаємо 300мс і шукаємо
            window.mentionTimeout = setTimeout(() => {
                window.loadMentionResults(query);
            }, 300);
        });
    }
}, 500); // Чекаємо півсекунди, щоб сторінка точно завантажилась

// 5. Закриття меню при кліку в будь-яке інше місце
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('mention-dropdown');
    if (dropdown && !e.target.closest('.mention-search-wrapper')) {
        dropdown.style.display = 'none';
    }
});

// === ЛОГІКА МЕНЮ ПОСТА (ТРИ КРАПКИ) ===

window.togglePostMenu = function(event, postId) {
    // 1. ✨ БЛОКУЄМО СПЛИВАННЯ (щоб клік не відкривав редактор поста)
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    // 2. На всякий випадок примусово ховаємо редактор поста
    const postEditor = document.getElementById('create-post-panel');
    if (postEditor) {
        postEditor.classList.remove('open');
        // Якщо він ховається через display:
        postEditor.style.display = 'none'; 
    }

    // 3. Шукаємо меню цього конкретного поста
    const menu = document.getElementById('post-menu-' + postId);
    if (!menu) return;

    // 4. Закриваємо всі інші відкриті меню трьох крапок (щоб не було кілька на екрані)
    document.querySelectorAll('.post-dropdown-menu').forEach(m => {
        if (m.id !== 'post-menu-' + postId) {
            m.style.display = 'none';
        }
    });

    // 5. Відкриваємо або закриваємо наше меню
    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
};

// ✨ ДОДАТКОВИЙ БОНУС: Закриваємо меню, якщо клікнути будь-де в іншому місці екрана
document.addEventListener('click', function(event) {
    // Перевіряємо, чи клікнули НЕ по меню і НЕ по кнопці трьох крапок
    if (!event.target.closest('.post-options-wrapper')) {
        document.querySelectorAll('.post-dropdown-menu').forEach(m => {
            m.style.display = 'none';
        });
    }
});
// 4. Функція скарги
window.reportPost = function(postId) {
    alert("Скаргу надіслано модераторам. Дякуємо за допомогу!");
    // ТУТ БУДЕ ТВІЙ FETCH ЗАПИТ НА СКАРГУ (report_post.php)
    
    // Закриваємо меню після скарги
    const menu = document.getElementById(`post-menu-${postId}`);
    if (menu) menu.style.display = 'none';
};

// 3. ФУНКЦІЯ ЕФЕКТУ ПІСКУ
window.disintegratePost = async function(element, postId) {
    try {
        const rect = element.getBoundingClientRect();
        const canvas = await html2canvas(element, { 
            backgroundColor: null, 
            useCORS: true, 
            logging: false 
        });
        
        const ctx = canvas.getContext('2d');
        
        // Ховаємо оригінал, але НЕ видаляємо його поки що
        element.style.visibility = 'hidden';

        canvas.style.position = 'fixed';
        canvas.style.left = rect.left + 'px';
        canvas.style.top = rect.top + 'px';
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        canvas.style.zIndex = '10000';
        canvas.style.pointerEvents = 'none';
        document.body.appendChild(canvas);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const particles = [];
        const step = 6; 

        for (let y = 0; y < canvas.height; y += step) {
            for (let x = 0; x < canvas.width; x += step) {
                const i = (y * canvas.width + x) * 4;
                if (imageData[i + 3] > 0) {
                    particles.push(new PostParticle(x, y, [imageData[i], imageData[i+1], imageData[i+2]], ctx));
                }
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = particles.length - 1; i >= 0; i--) {
                particles[i].update();
                particles[i].draw();
                if (particles[i].life <= 0) particles.splice(i, 1);
            }

            if (particles.length > 0) {
                requestAnimationFrame(animate);
            } else {
                // Коли анімація закінчилась — прибираємо все
                canvas.remove();
                element.remove();
                console.log("Пост №" + postId + " розсипався!");
            }
        }
        animate();
    } catch (err) {
        console.error("Анімація зламалася:", err);
        element.remove();
    }
};
window.deletePost = async function(postId) {
    const postElement = document.getElementById(postId) || document.getElementById(`post-${postId}`);
    if (!postElement) return;

    // 🛡️ ЗАМОК: Якщо функція вже запущена для цього поста — виходимо
    if (postElement.dataset.processingDelete === 'true') return;
    postElement.dataset.processingDelete = 'true';

    // --- 1. ПЕРЕВІРКА ВИДИМОСТІ (Рятуємо сайт від лагів) ---
    const rect = postElement.getBoundingClientRect();
    const isVisible = (
        rect.top < window.innerHeight && 
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0
    );

    // --- 2. ФОНОВЕ ВИДАЛЕННЯ З БД (Завжди працює) ---
    fetch('delete_post.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId.replace('post-', '') }) 
    }).catch(err => console.log("БД:", err));

    // --- 3. ЛОГІКА ВИДАЛЕННЯ ---
    if (!isVisible || typeof html2canvas === 'undefined') {
        // Якщо пост не бачимо або бібліотека не завантажена — просто видаляємо
        postElement.remove();
        console.log(`Пост ${postId} видалено без анімації (поза екраном)`);
        return;
    }

    // --- 4. ЯКЩО ПОСТ ВИДИМИЙ — ЗАПУСКАЄМО ПИЛ ---
    postElement.style.setProperty('transition', 'none', 'important');

    // Лікування пустих картинок
    const blankPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    postElement.querySelectorAll('img').forEach(img => {
        if (!img.complete || img.naturalWidth === 0) {
            img.src = blankPixel;
            img.removeAttribute('srcset');
        }
    });

    await new Promise(r => setTimeout(r, 50)); 

    try {
        // Робимо скріншот тільки якщо пост перед очима
        const originalCanvas = await html2canvas(postElement, {
            backgroundColor: '#1d0016',
            useCORS: true,
            scale: 1,
            logging: false
        });

        // Прячемо справжній пост
        postElement.style.setProperty('opacity', '0', 'important');
        postElement.style.setProperty('visibility', 'hidden', 'important');
        postElement.style.setProperty('pointer-events', 'none', 'important');

        // Налаштовуємо холст
        const displayCanvas = document.createElement('canvas');
        displayCanvas.width = rect.width;
        displayCanvas.height = rect.height;
        displayCanvas.style.position = 'fixed';
        displayCanvas.style.left = rect.left + 'px';
        displayCanvas.style.top = rect.top + 'px';
        displayCanvas.style.zIndex = '999999';
        displayCanvas.style.pointerEvents = 'none';
        document.body.appendChild(displayCanvas);

        const ctx = displayCanvas.getContext('2d', { alpha: true });
        const imageData = originalCanvas.getContext('2d').getImageData(0, 0, rect.width, rect.height).data;

        let dissolveY = displayCanvas.height;
        const sweepSpeed = displayCanvas.height / 15; 
        const particles = [];
        const step = 2; 

        class DustWave {
            constructor(x, y, color) {
                this.x = x; this.y = y; this.color = color;
                this.vx = (Math.random() - 0.5) * 3; 
                this.vy = -(Math.random() * 6 + 2);
                this.size = Math.random() * 1.5 + 1;
                this.life = 100;
            }
            update() {
                this.vx *= 0.92; this.vy *= 0.95; this.vy -= 0.2;
                this.x += this.vx; this.y += this.vy;
                this.life -= 2; 
            }
            draw(ctx) {
                if (this.life <= 0) return;
                ctx.fillStyle = this.color;
                ctx.globalAlpha = Math.max(0, (this.life / 100) * 0.6);
                ctx.fillRect(this.x, this.y, this.size, this.size);
            }
        }

        function animate() {
            ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
            if (dissolveY > 0) {
                const nextY = Math.max(0, dissolveY - sweepSpeed);
                for (let y = Math.floor(nextY); y < Math.ceil(dissolveY); y += step) {
                    for (let x = 0; x < displayCanvas.width; x += step) {
                        const i = (y * displayCanvas.width + x) * 4;
                        if (imageData[i + 3] > 15) { 
                            const color = `rgb(${imageData[i]},${imageData[i+1]},${imageData[i+2]})`;
                            particles.push(new DustWave(x, y, color));
                        }
                    }
                }
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, displayCanvas.width, nextY);
                ctx.clip();
                ctx.drawImage(originalCanvas, 0, 0);
                ctx.restore();
                dissolveY = nextY;
            }

            let alive = false;
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw(ctx);
                if (particles[i].life > 0) alive = true;
            }

            if (alive || dissolveY > 0) {
                requestAnimationFrame(animate);
            } else {
                displayCanvas.remove();
                // Схлопуємо місце
                postElement.style.setProperty('transition', 'all 0.5s ease', 'important');
                postElement.style.setProperty('height', '0px', 'important');
                postElement.style.setProperty('margin', '0px', 'important');
                postElement.style.setProperty('padding', '0px', 'important');
                postElement.style.setProperty('overflow', 'hidden', 'important');
                setTimeout(() => postElement.remove(), 500);
            }
        }
        animate();

    } catch (err) {
        console.error("Помилка анімації:", err);
        postElement.remove();
    }
};
window.setLudoraPage = function(tabName) {
    window.currentLudoraPage = tabName;
    document.body.setAttribute('data-active-tab', tabName);

    // 1. Прячем все вкладки и показываем нужную (ИСПРАВЛЕНО)
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        // Используем setProperty, чтобы добавить !important
        el.style.setProperty('display', 'none', 'important'); 
    });
    
    const target = document.getElementById(tabName + '-content');
    if (target) {
        target.classList.add('active');
        // Здесь тоже добавляем !important для надежности
        target.style.setProperty('display', 'block', 'important'); 
    }

    // 2. Переключаем стили бокового меню
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active-tab'));
    const activeBtn = document.getElementById('btn-' + tabName);
    if (activeBtn) activeBtn.classList.add('active-tab');

    // 3. Закрываем редактор постов, если он открыт
    const postEditor = document.getElementById('create-post-panel');
    if (postEditor) postEditor.classList.remove('open'); 

    // === 4. ДИНАМИЧЕСКОЕ ПЕРЕИМЕНОВАНИЕ КНОПКИ ===
    const addPostText = document.getElementById('txt-add-post'); // Это ID span'а с текстом в кнопке

    if (addPostText) {
        if (tabName === 'streams') {
            addPostText.innerText = 'Почати стрім'; 
        } else if (tabName === 'requests') {
            addPostText.innerText = 'Створити заявку';
        } else if (tabName === 'blog') {
            addPostText.innerText = 'Написати статтю';
        } else {
            addPostText.innerText = 'Додати пост';
        }
    }

    // 5. Отрисовываем контент для стримов
    if (tabName === 'streams' && typeof window.renderStreams === 'function') {
        window.renderStreams();
    }

    // 6. Логика дополнительных панелей (как было у тебя)
    const btnExtra = document.getElementById('btn-toggle-extra');
    const wrapperFilters = document.getElementById('post-filter-toggle-wrapper'); 
    const btnReqFilters = document.getElementById('btn-toggle-requests-filters');
    const areaReqFilters = document.getElementById('requests-filters-area');

    if (btnExtra) btnExtra.style.setProperty('display', 'inline-flex', 'important');
    if (wrapperFilters) wrapperFilters.style.setProperty('display', 'inline-block', 'important');

    if (tabName === 'requests') {
        // Кнопку "Параметри тімейта" показує сам редактор (togglePostEditor),
        // тут лишаємо приховану, щоб не висіла без панелі.
        if (btnReqFilters) btnReqFilters.style.setProperty('display', 'none', 'important');
    } else {
        if (btnReqFilters) btnReqFilters.style.setProperty('display', 'none', 'important');
        if (areaReqFilters) areaReqFilters.style.setProperty('display', 'none', 'important');
    }

    // Кнопка "Пошта заявок" — лише на вкладці ЗАЯВКИ
    const btnAppInbox = document.getElementById('btn-applications-inbox');
    if (btnAppInbox) {
        if (tabName === 'requests') {
            btnAppInbox.style.setProperty('display', 'flex', 'important');
            if (typeof window.checkApplicationsBadge === 'function') window.checkApplicationsBadge();
        } else {
            btnAppInbox.style.setProperty('display', 'none', 'important');
        }
    }

    const areaExtra = document.getElementById('extra-settings-area');
    const areaFilters = document.getElementById('post-filters-area');
    if (areaExtra) areaExtra.style.setProperty('display', 'none', 'important');
    if (areaFilters) areaFilters.style.setProperty('display', 'none', 'important');

    // Загружаем посты, только если мы не на вкладке стримов
    if (typeof loadAllPosts === 'function' && tabName !== 'streams') {
        loadAllPosts(true, true);
    }
};

// Чтобы старые кнопки (если у них прописано switchTab) тоже работали правильно
window.switchTab = window.setLudoraPage;

/* ═══════════════════════════════════════════════════════════════
   ВІДГУКИ НА АНКЕТИ (ЗАЯВКИ) + ПОШТА ЗАЯВОК ВЛАСНИКА
   ═══════════════════════════════════════════════════════════════ */

// Кеш моїх відгуків: { post_id: 'pending' | 'accepted' | 'rejected' }
window.myApplications = window.myApplications || {};

// Малює кнопку відгуку в потрібному стані
window.renderApplyButton = function(postId, status) {
    const base = "flex-grow: 1; padding: 12px; border-radius: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; transition: 0.3s; display: flex; justify-content: center; align-items: center; gap: 8px;";

    if (status === 'accepted') {
        return `<div style="${base} background: rgba(46, 204, 113, 0.15); border: 1px solid #2ecc71; color: #7CFFB0; cursor: default;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ВАШУ ЗАЯВКУ ПРИЙНЯТО
        </div>`;
    }
    if (status === 'rejected') {
        return `<div style="${base} background: rgba(255,255,255,0.05); border: 1px solid rgba(255,77,77,0.5); color: #ff8080; cursor: default;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ЗАЯВКУ ВІДХИЛЕНО
        </div>`;
    }
    if (status === 'pending') {
        // Вже надіслано — чекає розгляду
        return `<div style="${base} background: rgba(240, 4, 127, 0.08); border: 1px solid rgba(240, 4, 127, 0.4); color: #ff80bf; cursor: default;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ЗАЯВКУ НАДІСЛАНО
        </div>`;
    }
    // Можна відгукнутись
    return `<button onclick="window.openApplyModal('${postId}')" style="${base} background: rgba(240, 4, 127, 0.15); border: 1px solid #f0047f; color: #ff80bf; box-shadow: 0 0 15px rgba(240, 4, 127, 0.4), inset 0 0 8px rgba(240, 4, 127, 0.1); text-shadow: 0 0 8px rgba(240, 4, 127, 0.5); cursor: pointer;" onmouseover="this.style.background='rgba(240,4,127,0.3)'" onmouseout="this.style.background='rgba(240,4,127,0.15)'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        ВІДГУКНУТИСЬ НА АНКЕТУ
    </button>`;
};

// Перемальовує кнопку конкретного поста за поточним станом
window.refreshApplyButton = function(postId) {
    const wrap = document.getElementById('apply-wrap-' + postId);
    if (!wrap) return;
    const btn = wrap.querySelector('button, [data-apply-btn]');
    const status = window.myApplications[String(postId)] || null;
    const newHTML = window.renderApplyButton(postId, status);
    // Замінюємо лише першу дитину (кнопку), таймер лишаємо
    const first = wrap.firstElementChild;
    if (first) first.outerHTML = newHTML;
};

// Завантажує мої відгуки, щоб кнопки одразу були в правильному стані
window.loadMyApplications = async function() {
    try {
        const res = await fetch('check_my_applications.php?t=' + Date.now(), { credentials: 'include' });
        const data = await res.json();
        if (data && data.success && data.applied) {
            window.myApplications = data.applied;
        }
    } catch (e) {
        console.warn('loadMyApplications failed', e);
    }
};

// ── МОДАЛКА З КОМЕНТАРЕМ ПРИ ВІДГУКУ ──
window.openApplyModal = function(postId) {
    // Прибираємо стару, якщо була
    const old = document.getElementById('apply-modal-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'apply-modal-overlay';
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(10,0,8,0.8); backdrop-filter: blur(10px); z-index: 80000; display: flex; align-items: center; justify-content: center; padding: 20px;";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div style="width: 100%; max-width: 420px; background: #1a0a14; border: 1px solid rgba(240,4,127,0.35); border-radius: 20px; padding: 24px; box-shadow: 0 10px 50px rgba(240,4,127,0.25); font-family: 'Geologica', sans-serif;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom: 6px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f0047f" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                <h3 style="margin:0; color:#fff; font-size:17px;">Відгукнутись на анкету</h3>
            </div>
            <p style="margin:0 0 14px; color:rgba(255,255,255,0.55); font-size:13px;">Додайте короткий коментар (необов'язково) — власник побачить його у своїй пошті заявок.</p>
            <textarea id="apply-comment-input" maxlength="500" placeholder="Напр.: Привіт! Граю в цей режим щодня, мікрофон є 🎮" style="width:100%; box-sizing:border-box; min-height:90px; resize:vertical; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:12px; color:#fff; font-size:14px; font-family:inherit; outline:none;"></textarea>
            <div style="display:flex; gap:10px; margin-top:18px;">
                <button onclick="document.getElementById('apply-modal-overlay').remove()" style="flex:1; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); background:transparent; color:#ccc; font-weight:600; cursor:pointer;">Скасувати</button>
                <button id="apply-submit-btn" onclick="window.submitApplication('${postId}')" style="flex:2; padding:12px; border-radius:12px; border:none; background:linear-gradient(135deg,#f0047f,#c70368); color:#fff; font-weight:700; cursor:pointer; box-shadow:0 4px 18px rgba(240,4,127,0.4);">Відправити заявку</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => { const t = document.getElementById('apply-comment-input'); if (t) t.focus(); }, 50);
};

// ── ВІДПРАВКА ВІДГУКУ ──
window.submitApplication = async function(postId) {
    const input = document.getElementById('apply-comment-input');
    const btn = document.getElementById('apply-submit-btn');
    const comment = input ? input.value.trim() : '';
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.innerText = 'Відправляємо...'; }

    try {
        const res = await fetch('apply_to_request.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: parseInt(postId, 10), comment })
        });
        const data = await res.json();

        if (data.success || data.already) {
            window.myApplications[String(postId)] = 'pending';
            window.refreshApplyButton(postId);
            const ov = document.getElementById('apply-modal-overlay');
            if (ov) ov.remove();
            if (typeof window.showGroupToast === 'function') {
                window.showGroupToast(data.already ? '✅ Ви вже відгукувались' : '📨 Заявку відправлено!');
            }
        } else {
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerText = 'Відправити заявку'; }
            if (typeof window.showGroupToast === 'function') window.showGroupToast('⚠️ ' + (data.message || 'Помилка'));
        }
    } catch (e) {
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerText = 'Відправити заявку'; }
        if (typeof window.showGroupToast === 'function') window.showGroupToast('⚠️ Помилка мережі');
    }
};

/* ── ПОШТА ЗАЯВОК ВЛАСНИКА ── */

window.openApplicationsInbox = function() {
    const old = document.getElementById('app-inbox-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'app-inbox-overlay';
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(10,0,8,0.8); backdrop-filter: blur(10px); z-index: 80000; display: flex; align-items: center; justify-content: center; padding: 20px;";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div style="width:100%; max-width:480px; max-height:80vh; display:flex; flex-direction:column; background:#1a0a14; border:1px solid rgba(240,4,127,0.35); border-radius:20px; box-shadow:0 10px 50px rgba(240,4,127,0.25); font-family:'Geologica',sans-serif; overflow:hidden;">
            <div style="display:flex; align-items:center; justify-content:space-between; padding:20px 22px; border-bottom:1px solid rgba(255,255,255,0.07);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f0047f" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <h3 style="margin:0; color:#fff; font-size:18px;">Пошта заявок</h3>
                </div>
                <button onclick="document.getElementById('app-inbox-overlay').remove()" style="background:none; border:none; color:#aaa; cursor:pointer; font-size:22px; line-height:1;">&times;</button>
            </div>
            <div id="app-inbox-list" style="flex:1; overflow-y:auto; padding:16px 18px;">
                <div style="text-align:center; color:rgba(255,255,255,0.5); padding:40px 0;">Завантаження...</div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    window.loadApplicationsInbox();

    // Позначаємо всі як прочитані → скидаємо бейдж
    fetch('respond_application.php', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read_all' })
    }).then(() => window.updateApplicationsBadge(0)).catch(() => {});
};

window.loadApplicationsInbox = async function() {
    const list = document.getElementById('app-inbox-list');
    if (!list) return;
    try {
        const res = await fetch('get_applications.php?t=' + Date.now(), { credentials: 'include' });
        const data = await res.json();

        if (!data.success || !data.applications || data.applications.length === 0) {
            list.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.45); padding:50px 10px;">
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5; margin-bottom:12px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <div style="font-size:14px;">Поки що немає заявок на ваші анкети</div>
            </div>`;
            return;
        }

        list.innerHTML = data.applications.map(a => window.renderApplicationCard(a)).join('');
    } catch (e) {
        list.innerHTML = `<div style="text-align:center; color:#ff8080; padding:40px 0;">Помилка завантаження</div>`;
    }
};

window.renderApplicationCard = function(a) {
    const esc = (typeof escapeGroupHTML === 'function') ? escapeGroupHTML : (s => (s || ''));
    const avatar = (window.getSafeAvatarUrl ? window.getSafeAvatarUrl(a.applicant_avatar) : (a.applicant_avatar || 'img/default_avatar.png'));
    const when = (a.created_at || '').slice(0, 16).replace('T', ' ');
    const postTitle = a.post_title ? esc(a.post_title) : (a.post_body ? esc(String(a.post_body).slice(0, 40)) : 'анкету');

    let statusBadge = '';
    let actions = '';
    if (a.status === 'accepted') {
        statusBadge = `<span style="font-size:11px; color:#7CFFB0; background:rgba(46,204,113,0.12); padding:3px 10px; border-radius:20px;">✓ Прийнято</span>`;
    } else if (a.status === 'rejected') {
        statusBadge = `<span style="font-size:11px; color:#ff8080; background:rgba(255,77,77,0.12); padding:3px 10px; border-radius:20px;">✕ Відхилено</span>`;
    } else {
        actions = `
            <div style="display:flex; gap:8px; margin-top:12px;">
                <button onclick="window.respondToApplication('${a.id}','accept',this)" style="flex:1; padding:9px; border-radius:10px; border:none; background:linear-gradient(135deg,#2ecc71,#27ae60); color:#fff; font-weight:700; font-size:13px; cursor:pointer;">Прийняти</button>
                <button onclick="window.respondToApplication('${a.id}','reject',this)" style="flex:1; padding:9px; border-radius:10px; border:1px solid rgba(255,77,77,0.5); background:transparent; color:#ff8080; font-weight:700; font-size:13px; cursor:pointer;">Відхилити</button>
            </div>`;
    }

    const commentHTML = a.comment
        ? `<div style="margin-top:8px; padding:10px 12px; background:rgba(255,255,255,0.04); border-radius:10px; border-left:3px solid #f0047f; color:rgba(255,255,255,0.85); font-size:13px; line-height:1.4;">${esc(a.comment)}</div>`
        : `<div style="margin-top:8px; color:rgba(255,255,255,0.35); font-size:12px; font-style:italic;">Без коментаря</div>`;

    return `
        <div id="app-card-${a.id}" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:16px; margin-bottom:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <a href="profile.html?id=${a.applicant_id}" style="display:flex; align-items:center; gap:10px; text-decoration:none;">
                    <img src="${avatar}" onerror="this.src='img/default_avatar.png'" style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid #f0047f;">
                    <div>
                        <div style="color:#fff; font-weight:700; font-size:14px;">${esc(a.applicant_name)}</div>
                        <div style="color:rgba(255,255,255,0.4); font-size:11px;">на «${postTitle}» • ${esc(when)}</div>
                    </div>
                </a>
                ${statusBadge}
            </div>
            ${commentHTML}
            ${actions}
        </div>
    `;
};

window.respondToApplication = async function(appId, action, btnEl) {
    if (btnEl) { btnEl.disabled = true; btnEl.style.opacity = '0.6'; }
    try {
        const res = await fetch('respond_application.php', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ application_id: parseInt(appId, 10), action })
        });
        const data = await res.json();
        if (data.success) {
            // Перемальовуємо картку в новому статусі
            window.loadApplicationsInbox();
            if (typeof window.showGroupToast === 'function') {
                window.showGroupToast(action === 'accept' ? '✅ Заявку прийнято' : '✕ Заявку відхилено');
            }
        } else {
            if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; }
            if (typeof window.showGroupToast === 'function') window.showGroupToast('⚠️ ' + (data.message || 'Помилка'));
        }
    } catch (e) {
        if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; }
        if (typeof window.showGroupToast === 'function') window.showGroupToast('⚠️ Помилка мережі');
    }
};

// Оновлює бейдж кількості нових заявок біля кнопки пошти
window.updateApplicationsBadge = function(count) {
    const badge = document.getElementById('app-inbox-badge');
    if (!badge) return;
    if (count > 0) {
        badge.innerText = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
};

// Тихо перевіряє кількість нових заявок (для бейджа)
window.checkApplicationsBadge = async function() {
    try {
        const res = await fetch('get_applications.php?t=' + Date.now(), { credentials: 'include' });
        const data = await res.json();
        if (data && data.success) window.updateApplicationsBadge(data.unread || 0);
    } catch (e) { /* мовчки */ }
};

// Перевіряємо нові заявки при завантаженні та раз на 60с
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.checkApplicationsBadge === 'function') {
        window.checkApplicationsBadge();
        setInterval(window.checkApplicationsBadge, 60000);
    }
});

// Ставимо мітку при першому завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    const blogContent = document.getElementById('blog-content');
    if (blogContent && blogContent.classList.contains('active')) {
        document.body.setAttribute('data-active-tab', 'blog');
    } else {
        // Якщо відкрита стрічка за замовчуванням
        document.body.setAttribute('data-active-tab', 'feed'); 
    }
});
// ==========================================
// ГЕЙМЕРСЬКИЙ ТАЙМЕР: ВЕРСІЯ 2.0 (БЕЗ ГЛЮКІВ)
// ==========================================
if (!window.requestsTimerStarted) {
    window.requestsTimerStarted = true;

    setInterval(() => {
        const timers = document.querySelectorAll('.request-timer');
        
        timers.forEach(timer => {
            const postId = timer.getAttribute('data-post-id');
            const postCard = document.getElementById(postId) || document.getElementById(`post-${postId}`);

            if (!postCard || postCard.getAttribute('data-is-deleting') === 'true') return;

            // 1. Базуємось на серверному залишку (data-seconds-left) + локальному якорі.
            //    Це не залежить від часового поясу — на відміну від парсингу created_at.
            const secLeftAttr = timer.getAttribute('data-seconds-left');
            const anchorAttr  = timer.getAttribute('data-anchor');

            let timeLeftMs;
            const timeLimitMs = 60 * 60 * 1000; // 60 хвилин

            if (secLeftAttr !== null && anchorAttr !== null) {
                const baseSec   = parseInt(secLeftAttr, 10);
                const anchorMs  = parseInt(anchorAttr, 10);
                const elapsedMs = Date.now() - anchorMs;           // скільки минуло з моменту завантаження
                timeLeftMs = (baseSec * 1000) - elapsedMs;
            } else {
                // Фолбек на старий метод (created_at як UTC), якщо немає seconds_left
                const createdStr = timer.getAttribute('data-created');
                if (!createdStr) return;
                const safeDateStr = createdStr.replace(' ', 'T') + "Z";
                const createdMs = new Date(safeDateStr).getTime();
                let elapsedMs = Date.now() - createdMs;
                if (elapsedMs < 0) elapsedMs = 0;
                timeLeftMs = timeLimitMs - elapsedMs;
            }

            if (timeLeftMs > timeLimitMs) timeLeftMs = timeLimitMs;

            const textEl = document.getElementById(`time-${postId}`);
            const ringEl = document.getElementById(`ring-${postId}`);

            if (timeLeftMs <= 0) {
                // ЧАС ВИЙШОВ. Прибираємо картку візуально у всіх,
                // але DELETE у БД ініціює лише автор поста (інакше чужий пост не видалиться,
                // а сервер усе одно почистить старі заявки сам).
                postCard.setAttribute('data-is-deleting', 'true');
                const isOwner = postCard.getAttribute('data-is-owner') === 'true';
                if (isOwner && window.deletePost) {
                    window.deletePost(postId);
                } else {
                    // Просто ховаємо в інтерфейсі
                    postCard.style.transition = 'opacity 0.4s';
                    postCard.style.opacity = '0';
                    setTimeout(() => { if (postCard && postCard.parentNode) postCard.remove(); }, 450);
                }
            } else {
                // ОНОВЛЮЄМО ІНТЕРФЕЙС
                const minutesLeft = Math.ceil(timeLeftMs / 60000);
                if (textEl) textEl.innerText = Math.min(60, Math.max(1, minutesLeft)) + 'm';

                if (ringEl) {
                    const maxOffset = 132;
                    const offset = maxOffset - (maxOffset * (timeLeftMs / timeLimitMs));
                    ringEl.style.strokeDashoffset = Math.max(0, Math.min(maxOffset, offset));
                }
            }
        });
    }, 1000);
}

// === 4. МАЛЮЄМО КРУЖЕЧКИ З ІКОНКАМИ БІЛЯ КНОПКИ ===
function updateFilterCirclesUI(filters) {
    // Знаходимо твою кнопку фільтрів
    const filterBtn = document.querySelector('.mini-filter-btn');
    if (!filterBtn) return;

    // Шукаємо контейнер для кружечків або створюємо його
    let circlesContainer = document.getElementById('active-filters-circles');
    if (!circlesContainer) {
        circlesContainer = document.createElement('div');
        circlesContainer.id = 'active-filters-circles';
        circlesContainer.style.display = 'flex';
        circlesContainer.style.gap = '10px';
        circlesContainer.style.marginRight = '15px'; // Відступ від самої кнопки
        filterBtn.parentNode.insertBefore(circlesContainer, filterBtn);
    }

    // Очищаємо старі кружечки
    circlesContainer.innerHTML = '';

    // Створюємо словник із шляхами до твоїх картинок.
    // Шляхи точно такі, як у тебе в HTML (data-active-src)
    const iconPaths = {
        '12-16': 'img/free-icon-font-child-head.png',
        '16-18': 'img/free-icon-font-man-head.png',
        '18+': 'img/free-icon-font-woman-head.png',
        
        'micro': 'img/microphone-black-shape.png',
        'microoff': 'img/microphone-off (1).png',
        'discord': 'img/discord.png',
        'telegram': 'img/telegram.png',
        
        'shooter': 'img/free-icon-font-bolt.png',
        'moba': 'img/free-icon-font-flame.png',
        'profi': 'img/free-icon-font-trophy.png',
        
        'yes': 'img/ukraine (1).png',
        'no': 'img/usa-flag.png'
    };

    // Перебираємо збережені фільтри
    Object.values(filters).forEach(value => {
        // Якщо фільтр вибрано і це не "Всі" ("any")
        if (value && value !== 'any' && iconPaths[value]) {
            const circle = document.createElement('div');
            
            // Дизайн кружечка
            circle.style.width = '40px';
            circle.style.height = '40px';
            circle.style.borderRadius = '50%';
            circle.style.border = '1px solid #FF25BB';
            circle.style.display = 'flex';
            circle.style.alignItems = 'center';
            circle.style.justifyContent = 'center';
            circle.style.boxShadow = '0 0 6px #FF25BB';
            //
            circle.style.marginTop = '-15px'

            // Створюємо картинку всередині кружечка
            const img = document.createElement('img');
            img.src = iconPaths[value];
            img.style.width = '20px'; // Розмір іконки всередині кружечка
            img.style.height = '20px';
            img.style.objectFit = 'contain';
            
            // Додаємо картинку в кружечок, а кружечок - на екран
            circle.appendChild(img);
            circlesContainer.appendChild(circle);
        }
    });
}

function renderGamesList(gamesArray) {
        const grid = document.getElementById('media-grid');
        if (!grid) return;
        
        grid.innerHTML = ''; 

        if (gamesArray.length === 0) {
            grid.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; grid-column: 1 / -1; width: 100%; padding: 40px; font-family: \'Geologica\', sans-serif; font-size: 16px;">Гру не знайдено...</div>';
            return;
        }

        gamesArray.forEach(game => {
            const card = document.createElement('div');
            
            // СТИЛЬ САМОЇ КАРТКИ (Контейнер)
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.background = 'rgba(29, 0, 22, 0.4)'; // Темно-прозорий фон
            card.style.border = '1px solid rgba(255, 37, 187, 0.3)'; // Неонова рамка
            card.style.borderRadius = '16px';
            card.style.padding = '15px'; // Відступи всередині картки
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'; // Плавна анімація

            const imgSrc = game.img ? game.img : 'img/default_avatar.png'; 

            // Внутрішній HTML картки (Квадратна картинка + Жирний текст)
            card.innerHTML = `
                <div style="width: 100%; aspect-ratio: 1 / 1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                    <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease;">
                </div>
                <div title="${game.name}" style="color: #fff; font-size: 13px; font-weight: 800; font-family: 'Geologica', sans-serif; text-transform: uppercase; text-align: center; margin-top: 15px; letter-spacing: 0.5px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${game.name}
                </div>
            `;
            
            // КРУТІ ЕФЕКТИ ПРИ НАВЕДЕННІ МИШКИ (Hover)
            const imgEl = card.querySelector('img');
            card.onmouseenter = () => {
                card.style.borderColor = '#FF25BB'; // Рамка стає яскравою
                card.style.boxShadow = '0 0 20px rgba(255, 37, 187, 0.3), 0 10px 20px rgba(0,0,0,0.5)'; // З'являється світіння
                card.style.transform = 'translateY(-5px)'; // Картка підстрибує вгору
                imgEl.style.transform = 'scale(1.05)'; // Картинка трохи наближається
            };
            card.onmouseleave = () => {
                card.style.borderColor = 'rgba(255, 37, 187, 0.3)';
                card.style.boxShadow = 'none';
                card.style.transform = 'translateY(0)';
                imgEl.style.transform = 'scale(1)';
            };

            grid.appendChild(card);
        });
    }

    // === 2. ГОЛОВНА ФУНКЦІЯ ПОШУКУ ===
    window.filterMedia = function() {
        const input = document.getElementById('modal-search');
        if (!input) return;

        const query = input.value.toLowerCase().trim();

        // Перевіряємо чи існує база ігор
        if (typeof myGamesLibrary === 'undefined') {
            console.error("Помилка: База даних myGamesLibrary не знайдена!");
            return;
        }

        let allGames = [];
        myGamesLibrary.forEach(game => {
            allGames.push(game); 
            // Додаємо режими (Roblox)
            if (game.modes && game.modes.length > 0) {
                game.modes.forEach(mode => allGames.push(mode));
            }
        });

        // Фільтруємо
        const filteredGames = allGames.filter(game => 
            game.name.toLowerCase().includes(query)
        );

        renderGamesList(filteredGames);
    };

    // === 3. ЗАПУСК ПРИ ВІДКРИТТІ ===
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (document.getElementById('media-grid')) {
                filterMedia(); 
            }
        }, 200);
    });

// Шукаємо твою ідеальну обгортку
const topFilterBar = document.getElementById('top-game-filter');



window.updateBlogFileName = function(input) {
    const nameDisplay = document.getElementById('blog-image-filename');
    if (input.files && input.files[0]) {
        nameDisplay.textContent = input.files[0].name;
        nameDisplay.style.color = '#fff';
    } else {
        nameDisplay.textContent = 'Вибрати картинку (ляже під колір)';
        nameDisplay.style.color = 'rgba(255, 255, 255, 0.6)';
    }
};
// === 1. Гібридний алгоритм пошуку ===
function getRecommendedUsers(allUsers, myData) {
    let recommendations = [];
    
    allUsers.forEach(user => {
        // Рахуємо збіги
        const sharedPlatforms = user.platforms.filter(p => myData.platforms.includes(p));
        const sharedGames = user.games.filter(g => myData.games.includes(g));

        const totalScore = sharedPlatforms.length + sharedGames.length;

        // Якщо є хоч один збіг, додаємо в кандидати
        if (totalScore > 0) {
            recommendations.push({
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                sharedPlatformsCount: sharedPlatforms.length,
                sharedGamesCount: sharedGames.length,
                totalScore: totalScore // Загальний бал для сортування
            });
        }
    });

    // Сортуємо: зверху ті, з ким найбільше спільних інтересів (ігор + платформ)
    recommendations.sort((a, b) => b.totalScore - a.totalScore);
    return recommendations.slice(0, 3);
}

// === 2. Відмальовка з розумним текстом ===
function renderRecommendations(recommendedUsers) {
    const recsListContainer = document.querySelector('.recs-list');
    if (!recsListContainer) return;
    recsListContainer.innerHTML = '';

    if (recommendedUsers.length === 0) {
        recsListContainer.innerHTML = '<span style="color: gray; font-size: 12px; padding: 10px;">Немає спільних інтересів...</span>';
        return;
    }

    recommendedUsers.forEach(user => {
        // Формуємо красивий текст під ніком
        let details = [];
        
        if (user.sharedGamesCount > 0) {
            let gText = user.sharedGamesCount === 1 ? 'спільна гра' : 'спільні ігри';
            details.push(`${user.sharedGamesCount} ${gText}`);
        }
        
        if (user.sharedPlatformsCount > 0) {
            let pText = user.sharedPlatformsCount === 1 ? 'спільна платформа' : 'спільні платформи';
            details.push(`${user.sharedPlatformsCount} ${pText}`);
        }

        // Об'єднуємо текст через кому
        const finalText = details.join(', ');

        const userCardHTML = `
            <div class="rec-card" data-user-id="${user.id}">
                <img src="${user.avatar}" alt="Avatar">
                <div class="rec-info">
                    <b>${user.name}</b>
                    <span style="font-size: 11px; color: rgba(255,255,255,0.7);">${finalText}</span>
                </div>
                <button class="add-btn" onclick="sendFriendRequest('${user.id}')">+</button>
            </div>
        `;
        recsListContainer.insertAdjacentHTML('beforeend', userCardHTML);
    });
}

// === 3. ГОЛОВНА ФУНКЦІЯ ===
async function initRecommendations() {
    try {
        // Звертаємося до нашого нового файлу за твоїми даними
        const myDataResponse = await fetch('get_my_recs_data.php'); 
        if (!myDataResponse.ok) throw new Error("Помилка завантаження твоїх даних");
        
        const myData = await myDataResponse.json();

        // Отримуємо дані інших
        const otherUsersResponse = await fetch('get_recommendations_data.php');
        const otherUsersData = await otherUsersResponse.json();

        if (otherUsersData.error) {
            console.error(otherUsersData.error);
            return;
        }

        const topMatches = getRecommendedUsers(otherUsersData, myData);
        renderRecommendations(topMatches);

    } catch (error) {
        console.error("Помилка при завантаженні рекомендацій:", error);
    }
}
// Запускаємо, коли сторінка завантажилась
document.addEventListener('DOMContentLoaded', () => {
    initRecommendations();
});

const activeStreamsData = [
    { title: "Pushing to Radiant", streamer: "TenZ", category: "Valorant", viewers: "24.5k", avatar: "img/default_avatar.png", thumb: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600", tags: ["FPS", "English", "Pro"] },
    { title: "ТИХИЙ ХОРОР НА НІЧ", streamer: "GamerUA", category: "Silent Hill", viewers: "1.2k", avatar: "img/default_avatar.png", thumb: "img/silent hill.jpg", tags: ["Українська", "Horror"] },
    { title: "Завод і катки на пуджі", streamer: "Dendi", category: "Dota 2", viewers: "8.4k", avatar: "img/default_avatar.png", thumb: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600", tags: ["MOBA", "Укр"] },
    { title: "Огляд нових ігор / Спілкування", streamer: "PlayUA", category: "Just Chatting", viewers: "3.1k", avatar: "img/default_avatar.png", thumb: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600", tags: ["IRL", "Українська"] }
];

window.renderStreams = async function() {
    const grid = document.getElementById('streams-grid');
    if (!grid) return;
    
    grid.innerHTML = ''; // Очищаем старое

    // 🔴 1. СПРАВЖНІ ЖИВІ СТРІМИ З СЕРВЕРА
    let liveStreams = [];
    try {
        const res = await fetch('streams.php?action=list', { credentials: 'include' });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.streams)) {
            liveStreams = data.streams.map(s => ({
                title: s.title || 'Стрім',
                streamer: s.streamer || 'Streamer',
                category: s.category || 'Just Chatting',
                viewers: String(s.viewers || 1),
                avatar: s.avatar || 'img/default_avatar.png',
                thumb: s.avatar || 'img/default_avatar.png',
                tags: [s.subtitle].filter(Boolean),
                isReal: true,
                userId: s.user_id
            }));
        }
    } catch (e) { console.warn('Стріми: сервер недоступний, показуємо демо'); }

    const allStreams = [...liveStreams, ...activeStreamsData];
    
    allStreams.forEach((stream, idx) => {
        const card = document.createElement('div');
        card.className = 'stream-card post-pop-in';
        card.style.animationDelay = `${Math.min(idx * 70, 500)}ms`;
        card.innerHTML = `
            <div class="stream-thumbnail">
                <div class="stream-live-badge ${stream.isReal ? 'live-real' : ''}">${stream.isReal ? '🔴 LIVE' : 'LIVE'}</div>
                <img src="${stream.thumb}" loading="lazy" onerror="this.src='img/default_avatar.png'">
                <span class="stream-viewers"><span class="red-dot"></span> ${stream.viewers}</span>
            </div>
            <div class="stream-info">
                <img src="${stream.avatar}" class="streamer-avatar" loading="lazy" onerror="this.src='img/default_avatar.png'">
                <div class="stream-text">
                    <h4 class="stream-title">${stream.title}</h4>
                    <span class="streamer-name">${stream.streamer}</span>
                    <span class="stream-category">${stream.category}</span>
                    <div class="stream-tags">
                        ${stream.tags.map(t => `<span class="stream-tag">${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
};

// ==========================================
// 📡 ПУБЛІКАЦІЯ СТРІМУ (GO LIVE / завершення)
// ==========================================
window.isLiveBroadcasting = false;
window.liveHeartbeatTimer = null;

window.toggleLiveBroadcast = async function() {
    const btn = document.getElementById('btn-go-live');
    if (!window.isLiveBroadcasting) {
        // ▶️ ПОЧАТИ ТРАНСЛЯЦІЮ
        const title = document.getElementById('stream-main-title')?.innerText?.trim() || 'Мій стрім';
        const subtitle = document.getElementById('stream-sub-title')?.innerText?.trim() || '';
        try {
            const res = await fetch('streams.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'start',
                    title: title,
                    subtitle: subtitle === 'Введіть опис...' ? '' : subtitle,
                    category: 'Just Chatting',
                    streamer: localStorage.getItem('user_name') || 'Streamer',
                    avatar: localStorage.getItem('user_avatar') || 'img/default_avatar.png'
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Помилка сервера');

            window.isLiveBroadcasting = true;
            if (btn) { btn.classList.add('is-live'); btn.querySelector('.studio-btn-label').innerText = 'В ЕФІРІ'; }

            // 💓 Heartbeat кожні 25 сек, щоб стрім не зникав зі списку
            window.liveHeartbeatTimer = setInterval(() => {
                fetch('streams.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        action: 'heartbeat',
                        title: document.getElementById('stream-main-title')?.innerText?.trim(),
                        subtitle: document.getElementById('stream-sub-title')?.innerText?.trim()
                    })
                }).catch(() => {});
            }, 25000);
        } catch (e) {
            alert('Не вдалося опублікувати стрім: ' + e.message);
        }
    } else {
        // ⏹️ ЗУПИНИТИ ТРАНСЛЯЦІЮ
        await window.stopLiveBroadcast();
        if (btn) { btn.classList.remove('is-live'); btn.querySelector('.studio-btn-label').innerText = 'GO LIVE'; }
    }
};

window.stopLiveBroadcast = async function() {
    if (window.liveHeartbeatTimer) { clearInterval(window.liveHeartbeatTimer); window.liveHeartbeatTimer = null; }
    if (!window.isLiveBroadcasting) return;
    window.isLiveBroadcasting = false;
    try {
        await fetch('streams.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'stop' })
        });
    } catch (e) {}
};
// ==========================================
// 🔴 ФУНКЦИИ СТУДИИ СТРИМА (ФІНАЛЬНА ЧИСТА ВЕРСІЯ)
// ==========================================

window.cameraStream = null;
window.screenStream = null;
window.isEditingStreamInfo = false;
window.cameraUnlocked = false;

window.openStreamStudio = function() {
    const elementsToHide = ['streams-grid', 'streams-header', 'top-game-filter', 'post-filter-toggle-wrapper'];
    elementsToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });

    const rightCol = document.querySelector('.right-column');
    if (rightCol) rightCol.style.setProperty('display', 'none', 'important');

    const studio = document.getElementById('stream-studio-container');
    if (studio) {
        studio.style.setProperty('display', 'flex', 'important');
        studio.style.marginTop = "0px"; 
        studio.style.height = "calc(100vh - 260px)"; 
    }

    const postEditor = document.getElementById('create-post-panel');
    if (postEditor) postEditor.classList.remove('open'); 

    if (typeof window.startCamera === 'function') {
        setTimeout(() => { window.startCamera(); }, 500);
    }
}

window.closeStreamStudio = function() {
    // 📡 Якщо йшла трансляція — знімаємо її з ефіру
    if (typeof window.stopLiveBroadcast === 'function') window.stopLiveBroadcast();
    const liveBtn = document.getElementById('btn-go-live');
    if (liveBtn) { liveBtn.classList.remove('is-live'); const l = liveBtn.querySelector('.studio-btn-label'); if (l) l.innerText = 'GO LIVE'; }

    const studio = document.getElementById('stream-studio-container');
    if (studio) studio.style.setProperty('display', 'none', 'important');
    
    document.getElementById('streams-grid')?.style.setProperty('display', 'grid', 'important');
    document.getElementById('streams-header')?.style.setProperty('display', 'flex', 'important');
    document.getElementById('top-game-filter')?.style.setProperty('display', 'flex', 'important');
    document.querySelector('.right-column')?.style.setProperty('display', 'flex', 'important');

    if (window.screenStream) window.screenStream.getTracks().forEach(t => t.stop());
    if (window.cameraStream) window.cameraStream.getTracks().forEach(t => t.stop());
    
    const screenVid = document.getElementById('screen-video');
    const camVid = document.getElementById('camera-video');
    if (screenVid) screenVid.srcObject = null;
    if (camVid) camVid.srcObject = null;
    
    window.screenStream = null;
    window.cameraStream = null;
}

window.toggleStreamInfoEdit = function() {
    const titleEl = document.getElementById('stream-main-title');
    const subTitleEl = document.getElementById('stream-sub-title');
    const pencilIcon = document.getElementById('icon-edit-pencil');
    const saveIcon = document.getElementById('icon-save-check');
    const editBtn = document.getElementById('btn-edit-stream-info');

    if (!titleEl || !subTitleEl) return;

    if (!window.isEditingStreamInfo) {
        window.isEditingStreamInfo = true;
        titleEl.contentEditable = "true";
        subTitleEl.contentEditable = "true";
        
        if (subTitleEl.style.display === 'none' || subTitleEl.innerText.trim() === '') {
            subTitleEl.style.display = 'block';
            subTitleEl.innerText = 'Введіть опис...';
        }

        const editStyle = "1px dashed rgba(240, 4, 127, 0.6)";
        const editBg = "rgba(255,255,255,0.05)";
        
        titleEl.style.border = editStyle; titleEl.style.background = editBg;
        subTitleEl.style.border = editStyle; subTitleEl.style.background = editBg;

        if (pencilIcon) pencilIcon.style.display = 'none';
        if (saveIcon) saveIcon.style.display = 'block';
        
        editBtn.style.color = "#00ff73";
        editBtn.style.borderColor = "rgba(0, 255, 115, 0.3)";
        editBtn.style.background = "rgba(0, 255, 115, 0.1)";
        titleEl.focus();
    } else {
        window.isEditingStreamInfo = false;
        titleEl.contentEditable = "false";
        subTitleEl.contentEditable = "false";
        
        titleEl.style.border = "1px solid transparent"; titleEl.style.background = "transparent";
        subTitleEl.style.border = "1px solid transparent"; subTitleEl.style.background = "transparent";

        if (pencilIcon) pencilIcon.style.display = 'block';
        if (saveIcon) saveIcon.style.display = 'none';
        
        editBtn.style.color = "#f0047f";
        editBtn.style.borderColor = "rgba(240, 4, 127, 0.3)";
        editBtn.style.background = "rgba(240, 4, 127, 0.1)";

        const cleanSub = subTitleEl.innerText.replace(/\n/g, '').trim();
        if (cleanSub === "" || cleanSub === "Введіть опис...") {
            subTitleEl.style.display = "none";
            subTitleEl.innerText = "";
        }
    }
}
window.cameraUnlocked = false;

// ==========================================
// 1. УВІМКНУТИ КАМЕРУ
// ==========================================
window.startCamera = async function() {
    try {
        window.cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false 
        });
        
        const camVideo = document.querySelector('#stream-studio-container #camera-video');
        if (camVideo) {
            camVideo.srcObject = window.cameraStream;
            camVideo.play().catch(e => console.error(e));
            
            // Забороняємо браузеру вважати відео "картинкою", щоб не було багів при перетягуванні
            camVideo.ondragstart = () => false; 
            
            window.cameraUnlocked = false;
            camVideo.setAttribute('data-state', 'locked');
            camVideo.style.cssText = "position: absolute; top: 0px; left: 0px; width: 100%; height: 100%; z-index: 5; object-fit: cover; border: none; cursor: default; transition: all 0.3s ease;";
        }
    } catch (err) {
        alert("Помилка камери: " + err.message);
    }
};

// ==========================================
// 2. ЗАХОПИТИ ЕКРАН
// ==========================================
window.startScreenShare = async function() {
    try {
        window.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenVideo = document.querySelector('#stream-studio-container #screen-video');
        
        if (screenVideo) {
            screenVideo.style.display = 'block';
            screenVideo.style.opacity = '1';
            screenVideo.srcObject = window.screenStream;
            screenVideo.play().catch(e => console.error(e));
        }

        window.screenStream.getVideoTracks()[0].onended = function () {
            if (screenVideo) screenVideo.srcObject = null;
            window.screenStream = null;
        };
    } catch (err) {
        console.error(err);
    }
};
window.togglePostEditor = function() {
    if (window.currentLudoraPage === 'streams') {
        if (typeof window.openStreamStudio === 'function') window.openStreamStudio();
        return;
    }
    const wrapper = document.getElementById('create-post-panel');
    if (!wrapper) return;
    wrapper.classList.toggle('open');
    if (wrapper.classList.contains('open')) {
        if (typeof updateGroupSelect === 'function') updateGroupSelect();
        const titleInput = document.getElementById('new-post-title');
        if (titleInput) setTimeout(() => titleInput.focus(), 300);

        // ✨ На вкладці ЗАЯВКИ показуємо тумблер режиму та кнопку "Параметри тімейта"
        const onRequests = (window.currentLudoraPage === 'requests');
        const reqModeWrap = document.getElementById('req-mode-toggle-wrapper');
        const btnReqFilters = document.getElementById('btn-toggle-requests-filters');
        if (reqModeWrap) reqModeWrap.style.setProperty('display', onRequests ? 'flex' : 'none', 'important');
        if (btnReqFilters) btnReqFilters.style.setProperty('display', onRequests ? 'inline-flex' : 'none', 'important');
        if (onRequests && typeof window.switchRequestPublishMode === 'function') {
            // Встановлюємо стартовий режим (анкета) і підсвічуємо кнопку
            window.switchRequestPublishMode(window.currentRequestMode || 'anketa');
        }
    } else {
        // Ховаємо панель параметрів при закритті редактора
        const area = document.getElementById('requests-filters-area');
        if (area) area.style.setProperty('display', 'none', 'important');
        const btnReqFilters = document.getElementById('btn-toggle-requests-filters');
        if (btnReqFilters) btnReqFilters.classList.remove('active-btn');
    }
}
window.initDraggableAndResizableCamera = function() {
    const camVideo = document.querySelector('#stream-studio-container #camera-video');
    // Беремо головний контейнер, який точно має розміри в браузері!
    const studioContainer = document.getElementById('stream-studio-container');
    
    if (!camVideo || !studioContainer || camVideo.dataset.editorInited) return;
    camVideo.dataset.editorInited = "true";

    let activeAction = 'none';
    let startX, startY, initialWidth, initialHeight, initialLeft, initialTop;
    const edgeSize = 30; // 30 пікселів для зручного захоплення краю
    const minSize = 150; 

    camVideo.addEventListener('mousemove', (e) => {
        if (!window.cameraUnlocked) return;
        if (activeAction !== 'none') return;

        const rect = camVideo.getBoundingClientRect();
        const isRightEdge = (e.clientX >= rect.right - edgeSize);
        const isBottomEdge = (e.clientY >= rect.bottom - edgeSize);

        if (isRightEdge && isBottomEdge) {
            camVideo.style.cursor = 'nwse-resize';
        } else if (isRightEdge) {
            camVideo.style.cursor = 'ew-resize';
        } else if (isBottomEdge) {
            camVideo.style.cursor = 'ns-resize';
        } else {
            camVideo.style.cursor = 'grab';
        }
    });

    camVideo.addEventListener('mousedown', (e) => {
        if (!window.cameraUnlocked || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = camVideo.getBoundingClientRect();
        const isRightEdge = (e.clientX >= rect.right - edgeSize);
        const isBottomEdge = (e.clientY >= rect.bottom - edgeSize);

        if (isRightEdge && isBottomEdge) {
            activeAction = 'resizing-corner';
        } else if (isRightEdge) {
            activeAction = 'resizing-r';
        } else if (isBottomEdge) {
            activeAction = 'resizing-b';
        } else {
            activeAction = 'dragging';
            camVideo.style.cursor = 'grabbing';
        }

        startX = e.clientX;
        startY = e.clientY;
        initialWidth = camVideo.offsetWidth;
        initialHeight = camVideo.offsetHeight;
        initialLeft = camVideo.offsetLeft;
        initialTop = camVideo.offsetTop;
        
        // Фіксуємо точний піксельний розмір перед початком дії
        camVideo.style.width = initialWidth + 'px';
        camVideo.style.height = initialHeight + 'px';
    });

    document.addEventListener('mousemove', (e) => {
        if (activeAction === 'none' || !window.cameraUnlocked) return;
        e.preventDefault();
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // БЕРЕМО РЕАЛЬНІ РОЗМІРИ СТУДІЇ КОЖНОЇ МИТІ (Вирішує баг з нулем!)
        const parentRect = studioContainer.getBoundingClientRect();
        const parentW = parentRect.width;
        const parentH = parentRect.height;

        if (activeAction === 'dragging') {
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            
            const maxLeft = parentW - camVideo.offsetWidth;
            const maxTop = parentH - camVideo.offsetHeight;
            
            camVideo.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
            camVideo.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
        } else {
            let newWidth = initialWidth;
            let newHeight = initialHeight;

            if (activeAction === 'resizing-r' || activeAction === 'resizing-corner') newWidth += dx;
            if (activeAction === 'resizing-b' || activeAction === 'resizing-corner') newHeight += dy;

            const maxWidth = parentW - initialLeft;
            const maxHeight = parentH - initialTop;

            camVideo.style.width = Math.max(minSize, Math.min(newWidth, maxWidth)) + 'px';
            camVideo.style.height = Math.max(minSize, Math.min(newHeight, maxHeight)) + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        if (activeAction !== 'none') {
            activeAction = 'none';
            if (window.cameraUnlocked) camVideo.style.cursor = 'grab';
        }
    });
};
window.toggleCameraSize = function() {
    const camVideo = document.querySelector('#stream-studio-container #camera-video');
    if (!camVideo) return;

    window.initDraggableAndResizableCamera();
    
    const isLocked = camVideo.getAttribute('data-state') !== 'unlocked';

    if (isLocked) {
        // --- РОЗБЛОКУВАТИ (ТІЛЬКИ ВМИКАЄМО РАМКУ, РОЗМІР 100%) ---
        window.cameraUnlocked = true;
        camVideo.setAttribute('data-state', 'unlocked');
        
        // Знімаємо старі класи на всяк випадок
        camVideo.classList.remove('camera-full');
        camVideo.classList.remove('camera-corner'); 
        
        camVideo.style.transition = 'none';
        
        // ВАЖЛИВО: Залишаємо на весь екран
        camVideo.style.width = '100%';
        camVideo.style.height = '100%';
        camVideo.style.top = '0px';
        camVideo.style.left = '0px';
        
        camVideo.style.border = '4px solid #f0047f';
        camVideo.style.borderRadius = '16px';
        camVideo.style.zIndex = '20';
        camVideo.style.cursor = 'grab';
        camVideo.style.boxSizing = 'border-box';
        
    } else {
        // --- ЗАБЛОКУВАТИ НАЗАД ---
        window.cameraUnlocked = false;
        camVideo.setAttribute('data-state', 'locked');

        camVideo.style.transition = 'all 0.3s ease'; 
        camVideo.style.width = '100%';
        camVideo.style.height = '100%';
        camVideo.style.top = '0px';
        camVideo.style.left = '0px';
        
        camVideo.style.border = 'none';
        camVideo.style.borderRadius = '0px';
        camVideo.style.zIndex = '5';
        camVideo.style.cursor = 'default';
    }
};
// ==========================================
// ✂️ ВИДАЛЕННЯ ФОНУ (MediaPipe Selfie Segmentation)
// ==========================================

window.isBackgroundRemoved = false;
let selfieSegmentation = null;
let bgRemovalAnimationId = null; 

async function initBackgroundRemoval() {
    if (selfieSegmentation) return;
    
    // Завантажуємо нейромережу від Google
    selfieSegmentation = new SelfieSegmentation({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
    }});
    
    selfieSegmentation.setOptions({
        modelSelection: 1, // 1 - для комп'ютерів (краща якість), 0 - для слабких ПК/мобільних
    });
    
    selfieSegmentation.onResults(onSegmentResults);
}

function onSegmentResults(results) {
    let canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Малюємо білий силует людини (маску)
    ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
    
    // 2. Накладаємо оригінальне відео ТІЛЬКИ туди, де є силует
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
    ctx.restore();
}

window.toggleBackgroundRemoval = async function() {
    const camVideo = document.querySelector('#stream-studio-container #camera-video') || document.getElementById('camera-video');
    const btn = document.querySelector('button[onclick="toggleBackgroundRemoval()"]');

    if (!camVideo || !window.cameraStream) {
        alert("📷 Спочатку увімкни камеру, щоб було що вирізати!");
        return;
    }

    window.isBackgroundRemoved = !window.isBackgroundRemoved;

    if (window.isBackgroundRemoved) {
        // --- ВМИКАЄМО ВИРІЗАННЯ ---
        if (btn) {
            btn.style.boxShadow = "0 0 15px #00ff73"; // Підсвічуємо кнопку зеленим
            btn.style.color = "#00ff73";
        }
        
        await initBackgroundRemoval();
        
        // Створюємо приховане полотно для малювання
        let canvas = document.getElementById('bg-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'bg-canvas';
            canvas.width = 1280;
            canvas.height = 720;
            canvas.style.display = 'none';
            document.body.appendChild(canvas);
        }
        
        // Створюємо ПРИХОВАНЕ відео для нейромережі (щоб брати чистий потік з камери)
        let rawVideo = document.getElementById('raw-camera-video');
        if (!rawVideo) {
            rawVideo = document.createElement('video');
            rawVideo.id = 'raw-camera-video';
            rawVideo.autoplay = true;
            rawVideo.playsInline = true;
            rawVideo.muted = true;
            rawVideo.style.display = 'none';
            document.body.appendChild(rawVideo);
        }
        rawVideo.srcObject = window.cameraStream;
await rawVideo.play();

// Ждем, пока видео действительно начнет воспроизводиться, прежде чем резать кадры
rawVideo.onloadeddata = () => {
    processFrame();
};
        // Запускаємо нескінченний цикл обробки кадрів
        const processFrame = async () => {
            if (!window.isBackgroundRemoved) return;
            await selfieSegmentation.send({image: rawVideo});
            bgRemovalAnimationId = requestAnimationFrame(processFrame);
        };
        processFrame();
        
        // Підміняємо відео на екрані на наш прозорий canvas!
        // Підміняємо відео на екрані на наш прозорий canvas!
camVideo.srcObject = canvas.captureStream(30);
camVideo.play(); // <-- Добавь эту строку
        
    } else {
        // --- ВИМИКАЄМО ВИРІЗАННЯ ---
        if (btn) {
            btn.style.boxShadow = "none";
            btn.style.color = ""; // Повертаємо звичайний колір
        }
        if (bgRemovalAnimationId) cancelAnimationFrame(bgRemovalAnimationId);
        
        // Повертаємо оригінальний потік з камери на екран
        camVideo.srcObject = window.cameraStream;
    }
};

// Переменные для отслеживания текущего кошелька
window.currentUserCoins = 0;
// ================================================================
// 💰 СИСТЕМА КОИНОВ И PREMIUM — MySQL Backend (PHP)
// ================================================================

window.giftPrices = {
    'heart': 10,
    'star': 15,
    'fire': 20,
    'like': 5
};

window.currentUserCoins = 0;
window.isPremiumActive = false;

// 1. Загрузка баланса монет из MySQL при старте страницы
function loadUserCoinsFromDB() {
    fetch('get_coins.php', {
        method: 'GET',
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.currentUserCoins = data.coins || 0;
            window.isPremiumActive = data.premium_active || false;
            window.premiumUntil = data.premium_until || null;
            if (!window.premiumPlan) window.premiumPlan = 'month';

            const coinLabel = document.getElementById('top-bar-coins');
            if (coinLabel) coinLabel.textContent = Number(window.currentUserCoins).toLocaleString();

            updatePremiumButtonState(data.premium_active, data.premium_until);
            // Apply blog premium locks
            if (typeof window.applyBlogPremiumLocks === 'function') {
                window.applyBlogPremiumLocks(!!window.isPremiumActive);
            }
        }
    })
    .catch(err => console.error("❌ Ошибка загрузки баланса монет:", err));
}

function updatePremiumButtonState(isActive, premiumUntil) {
    const btn = document.getElementById('premium-open-btn');
    if (!btn) return;
    if (isActive) {
        btn.style.background = 'linear-gradient(135deg, #ffbc00, #ff7c00)';
        btn.style.color = '#fff';
        btn.title = premiumUntil
            ? `Premium до: ${new Date(premiumUntil).toLocaleDateString('ru-RU')}`
            : 'Premium активен';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadUserCoinsFromDB, 1000);
    // Замінюємо emoji-монети на красиву SVG
    try {
        const tbIcon = document.getElementById('top-bar-coin-icon');
        if (tbIcon && window.coinSVG) tbIcon.innerHTML = window.coinSVG(18);
        const rewardIcon = document.querySelector('.coin-icon-large');
        if (rewardIcon && window.coinSVG) rewardIcon.innerHTML = window.coinSVG(70);
    } catch (e) {}
});

window.refreshCoinsDisplay = function(newBalance) {
    window.currentUserCoins = newBalance;
    const coinLabel = document.getElementById('top-bar-coins');
    if (coinLabel) coinLabel.textContent = Number(newBalance).toLocaleString();
};

// 2. Управление модальными окнами
window.closeCoinRewardModal = function() {
    document.getElementById('coin-reward-modal').style.display = 'none';
};

window.openPremiumModal = function() {
    const modalBalance = document.getElementById('premium-modal-coins-balance');
    if (modalBalance) modalBalance.textContent = Number(window.currentUserCoins).toLocaleString();
    document.getElementById('premium-modal').style.display = 'flex';
};

window.closePremiumModal = function() {
    document.getElementById('premium-modal').style.display = 'none';
};

// ==========================================================
// 🪙 МАГАЗИН МОНЕТ (поки що безкоштовно)
// ==========================================================
// 🪙 Красива SVG-монета (золотий градієнт із блиском) — використовується по всьому магазину
window.coinSVG = function(size) {
    size = size || 40;
    const uid = 'c' + Math.random().toString(36).slice(2, 8);
    return `<svg class="sc-coin" width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <defs>
            <linearGradient id="rim_${uid}" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stop-color="#ffe07a"/>
                <stop offset="50%" stop-color="#f5a623"/>
                <stop offset="100%" stop-color="#c9750a"/>
            </linearGradient>
            <radialGradient id="face_${uid}" cx="50%" cy="38%" r="70%">
                <stop offset="0%" stop-color="#fff3c4"/>
                <stop offset="55%" stop-color="#ffce4f"/>
                <stop offset="100%" stop-color="#f3a01e"/>
            </radialGradient>
            <linearGradient id="mono_${uid}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#c9750a"/>
                <stop offset="100%" stop-color="#9a5500"/>
            </linearGradient>
        </defs>
        <!-- зовнішнє кільце -->
        <circle cx="32" cy="32" r="30" fill="url(#rim_${uid})"/>
        <circle cx="32" cy="32" r="30" fill="none" stroke="#ffe9ab" stroke-width="1" stroke-opacity="0.6"/>
        <!-- внутрішній диск -->
        <circle cx="32" cy="32" r="23" fill="url(#face_${uid})" stroke="#d98a12" stroke-width="1.5"/>
        <!-- насічки по краю (декор) -->
        <circle cx="32" cy="32" r="26.5" fill="none" stroke="#b86a06" stroke-width="1.4" stroke-opacity="0.45" stroke-dasharray="1.4 2.6"/>
        <!-- монограма S -->
        <text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="Geologica, Arial, sans-serif" font-size="30" font-weight="800" fill="url(#mono_${uid})">S</text>
        <!-- верхній блік -->
        <ellipse cx="25" cy="20" rx="9" ry="5" fill="#ffffff" opacity="0.5" transform="rotate(-28 25 20)"/>
    </svg>`;
};

window.COIN_PACKS = [
    { amount: 100,   tag: 'Старт' },
    { amount: 500,   tag: '' },
    { amount: 1000,  tag: '', best: true },
    { amount: 5000,  tag: 'Макс' },
];

window.openCoinShop = function() {
    const modal = document.getElementById('coin-shop-modal');
    if (!modal) return;

    const balEl = document.getElementById('coin-shop-balance-val');
    if (balEl) balEl.textContent = Number(window.currentUserCoins || 0).toLocaleString();

    // велика монета в шапці (як корона у преміумі)
    const headIcon = document.getElementById('coin-shop-icon');
    if (headIcon) headIcon.innerHTML = window.coinSVG(36);

    const grid = document.getElementById('coin-shop-grid');
    if (grid) {
        grid.innerHTML = window.COIN_PACKS.map(p => `
            <div class="coin-pack ${p.best ? 'coin-pack-best' : ''}" onclick="window.buyCoins(${p.amount}, this.querySelector('.coin-pack-btn'))">
                ${p.tag ? `<span class="coin-pack-tag">${p.tag}</span>` : ''}
                <div class="coin-pack-top">
                    <div class="coin-pack-coin">${window.coinSVG(38)}</div>
                    <div class="coin-pack-info">
                        <div class="coin-pack-amount">${p.amount.toLocaleString()}</div>
                        <div class="coin-pack-sub">монет</div>
                    </div>
                </div>
                <button class="coin-pack-btn" onclick="event.stopPropagation(); window.buyCoins(${p.amount}, this)">Отримати</button>
            </div>
        `).join('');
    }

    // перезапуск анімації появи
    const box = modal.querySelector('.coin-shop-box');
    if (box) { box.style.animation = 'none'; void box.offsetWidth; box.style.animation = ''; }

    modal.style.display = 'flex';
};

window.closeCoinShop = function() {
    const modal = document.getElementById('coin-shop-modal');
    if (modal) modal.style.display = 'none';
};

// Анімація: монети летять із кнопки покупки до балансу в топ-барі
function animateCoinsToBalance(fromEl, count) {
    const target = document.querySelector('.coins-display-container');
    if (!target || !fromEl) return;

    const startRect = fromEl.getBoundingClientRect();
    const endRect = target.getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;
    const endX = endRect.left + endRect.width / 2;
    const endY = endRect.top + endRect.height / 2;

    const total = Math.min(count, 14);
    for (let i = 0; i < total; i++) {
        const coin = document.createElement('div');
        coin.className = 'flying-coin';
        coin.innerHTML = window.coinSVG ? window.coinSVG(26) : '🪙';
        coin.style.left = startX + 'px';
        coin.style.top = startY + 'px';
        coin.style.transform = 'translate(-50%, -50%) scale(0.6)';
        coin.style.opacity = '0';
        document.body.appendChild(coin);

        const delay = i * 60;
        const jitterX = (Math.random() - 0.5) * 80;
        const jitterY = (Math.random() - 0.5) * 60;

        // старт
        requestAnimationFrame(() => {
            coin.style.transition = 'opacity 0.15s ease';
            setTimeout(() => {
                coin.style.opacity = '1';
                coin.animate([
                    { transform: `translate(-50%, -50%) translate(${jitterX}px, ${jitterY}px) scale(1)`, opacity: 1 },
                    { transform: `translate(-50%, -50%) translate(${(endX - startX) * 0.5}px, ${(endY - startY) * 0.5 - 40}px) scale(1.1)`, opacity: 1, offset: 0.6 },
                    { transform: `translate(-50%, -50%) translate(${endX - startX}px, ${endY - startY}px) scale(0.3)`, opacity: 0 }
                ], { duration: 800, easing: 'cubic-bezier(0.5, 0, 0.75, 0.5)' });

                setTimeout(() => {
                    coin.remove();
                    // пульсація балансу при "приземленні"
                    const coinSpan = document.getElementById('top-bar-coins');
                    if (coinSpan) {
                        coinSpan.classList.remove('coins-pulse');
                        void coinSpan.offsetWidth;
                        coinSpan.classList.add('coins-pulse');
                    }
                }, 780);
            }, delay);
        });
    }
}

window.buyCoins = async function(amount, btnEl) {
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '...'; }

    try {
        const res = await fetch('buy_coins.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ amount })
        });
        const data = await res.json();

        if (data.success) {
            // запускаємо анімацію польоту монет
            animateCoinsToBalance(btnEl, amount >= 1000 ? 14 : 8);

            // оновлюємо баланс трохи із затримкою, щоб збіглося з прильотом
            setTimeout(() => {
                window.refreshCoinsDisplay(data.new_balance);
                const balEl = document.getElementById('coin-shop-balance-val');
                if (balEl) balEl.textContent = Number(data.new_balance).toLocaleString();
                const pmBal = document.getElementById('premium-modal-coins-balance');
                if (pmBal) pmBal.textContent = Number(data.new_balance).toLocaleString();
            }, 700);

            if (btnEl) { btnEl.textContent = '✓ Готово'; }
            setTimeout(() => { if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Отримати'; } }, 1200);
        } else {
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Отримати'; }
            alert('❌ ' + (data.message || 'Помилка'));
        }
    } catch (e) {
        console.error('Помилка покупки монет:', e);
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Отримати'; }
        alert('❌ Помилка зʼєднання.');
    }
};

// 3. Покупка Premium за монеты
window.buyPremiumWithCoins = async function(plan) {
    const prices = { month: 1000, year: 20000 };
    const cost = prices[plan];
    if (!cost) return;

    if (window.currentUserCoins < cost) {
        window.openCoinShop();
        return;
    }

    const label = plan === 'month' ? '1 месяц' : '1 год';
    if (!confirm(`Купить Premium (${label}) за ${cost.toLocaleString()} монет?`)) return;

    try {
        const res = await fetch('buy_premium.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ plan })
        });
        const data = await res.json();

        if (data.success) {
            window.refreshCoinsDisplay(data.new_balance);
            window.isPremiumActive = true;
            updatePremiumButtonState(true, data.premium_until);
            if (typeof window.applyBlogPremiumLocks === 'function') window.applyBlogPremiumLocks(true);

            const modalBalance = document.getElementById('premium-modal-coins-balance');
            if (modalBalance) modalBalance.textContent = Number(data.new_balance).toLocaleString();

            closePremiumModal();
            alert(`✅ ${data.message}\nВаш баланс: ${Number(data.new_balance).toLocaleString()} 🪙`);
        } else {
            alert(`❌ Ошибка: ${data.message}`);
        }
    } catch (e) {
        console.error("Ошибка при покупке Premium:", e);
        alert("❌ Ошибка соединения. Попробуйте ещё раз.");
    }
};

// 4. Покупка подарков к постам за монеты
window.buyGiftForPost = async function(postId, giftType) {
    const cost = window.giftPrices[giftType] || 10;

    if (window.currentUserCoins < cost) {
        alert(`Недостаточно монет! Подарок "${giftType}" стоит ${cost} 🪙\nВаш баланс: ${window.currentUserCoins} 🪙`);
        return false;
    }

    window.refreshCoinsDisplay(window.currentUserCoins - cost);

    try {
        const res = await fetch('buy_premium.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'gift', postId, giftType, cost })
        });
        const data = await res.json();
        if (data.new_balance !== undefined) {
            window.refreshCoinsDisplay(data.new_balance);
        }
        return data.success !== false;
    } catch (e) {
        window.refreshCoinsDisplay(window.currentUserCoins + cost);
        console.error("Ошибка при покупке подарка:", e);
        return false;
    }
};

// ==========================================================
// 👥 ГРУПИ ТА КАНАЛИ v3 — TELEGRAM-STYLE
// Нове: підписники каналів, співвласник, група обговорення,
// клік на плашку ролі, реакції, пікер емодзі/стікерів
// ==========================================================
window.currentGroupChat = null;
window.currentGroupInfo = null;
window.lastGroupMsgId = 0;
window.groupPollTimer = null;
window.creationFlowType = 'group';
window.groupVoiceRecorder = null;
window.groupVoiceChunks = [];
window.groupReactionsMap = {};   // {msgId: [{emoji, cnt, mine}]}
window._myGroupsCache = [];

function escapeGroupHTML(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Текст з кастомними емодзі (:custom1: → картинка), як у Telegram
function renderGroupText(text) {
    let safe = escapeGroupHTML(text);
    Object.entries(window.customEmojis || {}).forEach(([code, url]) => {
        safe = safe.split(escapeGroupHTML(code)).join(
            `<img src="${url}" class="inline-custom-emoji" alt="${escapeGroupHTML(code)}">`
        );
    });
    return safe;
}

function groupApiPost(body) {
    return fetch('groups_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
    }).then(r => r.json());
}

// === 1. СТВОРЕННЯ ===
window.openCreateFlow = function(type) {
    window.creationFlowType = type === 'channel' ? 'channel' : 'group';
    const screen = document.getElementById('chat-creation-screen');
    if (!screen) return;
    const header = document.getElementById('creation-screen-header');
    const title = document.getElementById('creation-screen-title');
    const input = document.getElementById('creation-name-input');
    if (header) header.innerText = window.creationFlowType === 'channel' ? 'Створення каналу' : 'Створення групи';
    if (title) title.innerText = window.creationFlowType === 'channel' ? '📣 Новий канал' : '👥 Нова група';
    if (input) {
        input.value = '';
        input.placeholder = window.creationFlowType === 'channel' ? 'Назва каналу...' : 'Назва групи...';
    }
    const parentBox = screen.parentElement;
    if (parentBox) { parentBox.style.position = 'relative'; parentBox.style.overflow = 'hidden'; }
    screen.style.display = 'flex';
    screen.style.flexDirection = 'column';
    setTimeout(() => input && input.focus(), 100);
    if (input && !input.hasAttribute('data-enter-bound')) {
        input.setAttribute('data-enter-bound', '1');
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') window.submitChatCreation(); });
    }
};

window.closeChatCreation = function() {
    const screen = document.getElementById('chat-creation-screen');
    if (screen) {
        screen.style.display = 'none';
        if (screen.parentElement) screen.parentElement.style.overflow = 'auto';
    }
};

window.submitChatCreation = async function() {
    const input = document.getElementById('creation-name-input');
    const name = input ? input.value.trim() : '';
    if (!name) {
        if (input) { input.style.borderColor = '#ff3358'; setTimeout(() => input.style.borderColor = 'rgba(240, 4, 127, 0.3)', 1200); }
        return;
    }
    try {
        const data = await groupApiPost({ action: 'create', name, type: window.creationFlowType });
        if (!data.success) throw new Error(data.message || 'Помилка створення');
        window.closeChatCreation();
        await window.loadMyGroupChats();
        if (data.group) window.openGroupChat(data.group);
    } catch (e) { alert('Не вдалося створити: ' + e.message); }
};

// === 2. СПИСОК У САЙДБАРІ ===
window.loadMyGroupChats = async function() {
    try {
        const res = await fetch('groups_api.php?action=my_list', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) return;
        window._myGroupsCache = data.groups || [];

        const channelsList = document.getElementById('channels-list');
        const groupsList = document.getElementById('groups-list');
        [channelsList, groupsList].forEach(list => {
            if (!list) return;
            list.querySelectorAll('.group-chat-item').forEach(el => el.remove());
        });

        (data.groups || []).forEach(g => {
            const isChannel = g.type === 'channel';
            const list = isChannel ? channelsList : groupsList;
            if (!list) return;
            const item = document.createElement('div');
            item.className = 'chat-item group-chat-item';
            item.id = `group-item-${g.id}`;
            item.onclick = () => window.openGroupChat(g);
            const lastMsg = g.last_message ? escapeGroupHTML(String(g.last_message).slice(0, 28)) : (isChannel ? `${g.members || 1} підписн.` : `${g.members || 1} учасн.`);
            const avaHTML = g.avatar
                ? `<img src="${escapeGroupHTML(g.avatar)}" class="group-avatar-circle" style="object-fit:cover;" onerror="this.outerHTML='<div class=\\'group-avatar-circle\\'>${isChannel ? '📣' : '👥'}</div>'">`
                : `<div class="group-avatar-circle">${isChannel ? '📣' : '👥'}</div>`;
            item.innerHTML = `
                ${avaHTML}
                <div class="chat-info" style="overflow: hidden;">
                    <span class="chat-name" style="display:block; font-weight:700; color:#eaeaea; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeGroupHTML(g.name)}</span>
                    <span style="display:block; font-size:11px; color:rgba(255,255,255,0.4); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${lastMsg}</span>
                </div>`;
            const createBtn = list.querySelector('.create-chat-btn');
            if (createBtn) list.insertBefore(item, createBtn);
            else list.appendChild(item);
        });
    } catch (e) { console.warn('Групи: не вдалося завантажити список', e); }
};

// === 3. ВІДКРИТТЯ ЧАТУ ===
window.openGroupChat = function(g) {
    window.currentGroupChat = { id: parseInt(g.id), name: g.name, type: g.type, owner_id: parseInt(g.owner_id) };
    window.currentGroupInfo = null;
    window.currentChatUserId = null;
    window.lastGroupMsgId = 0;
    window.groupReactionsMap = {};

    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const postPanel = document.getElementById('create-post-panel');
    if (postPanel) postPanel.style.display = 'none';
    document.querySelectorAll('.chat-item').forEach(item => item.style.background = 'transparent');
    const activeItem = document.getElementById(`group-item-${g.id}`);
    if (activeItem) activeItem.style.background = '#2A1520';

    const chatWin = document.getElementById('chat-window');
    if (!chatWin) return;
    const parentBox = chatWin.parentElement;
    if (parentBox) { parentBox.style.position = 'relative'; parentBox.style.overflow = 'hidden'; }
    chatWin.style.display = 'flex';

    const targetName = document.getElementById('chat-target-name');
    const targetAvatar = document.getElementById('chat-target-avatar');
    if (targetName) {
        targetName.innerHTML = `${escapeGroupHTML(g.name)} <span id="group-header-sub" style="display:block; font-size:11px; font-weight:400; color:rgba(255,255,255,0.45);">${g.type === 'channel' ? 'канал' : 'група'}</span>`;
        targetName.style.cursor = 'pointer';
        targetName.onclick = () => window.openGroupSettings();
    }
    if (targetAvatar) {
        targetAvatar.style.display = '';
        targetAvatar.src = g.avatar || 'img/default_avatar.png';
        targetAvatar.style.cursor = 'pointer';
        targetAvatar.onclick = () => window.openGroupSettings();
    }

    document.querySelectorAll('.chat-header-icons svg').forEach(svg => {
        if (!svg.closest('.group-header-btn')) svg.style.display = 'none'; // не чіпаємо наші кнопки
    });
    window.ensureGroupHeaderButtons();

    // 🛡️ ОХОРОНЕЦЬ ШАПКИ: щосекунди перевіряє, що дзвіночок і шестерня на місці
    // (інші скрипти чату могли їх ховати після відправки повідомлень)
    if (window.groupHeaderGuard) clearInterval(window.groupHeaderGuard);
    window.groupHeaderGuard = setInterval(() => {
        if (!window.currentGroupChat) return;
        document.querySelectorAll('.chat-header-icons svg').forEach(svg => {
            if (!svg.closest('.group-header-btn')) svg.style.display = 'none';
        });
        window.ensureGroupHeaderButtons();
        const info = window.currentGroupInfo;
        const disc = document.getElementById('group-header-discuss');
        if (disc) disc.style.display = (info && info.type === 'channel' && info.linked_group) ? 'flex' : 'none';
    }, 1200);

    const input = document.getElementById('msg-input');
    const sendBtn = document.getElementById('send-btn');
    if (input) {
        input.style.display = 'block';
        input.placeholder = g.type === 'channel' ? 'Опублікувати в каналі...' : 'Написати в групу...';
        input.value = '';
    }
    if (sendBtn) sendBtn.style.display = 'block';

    window.bindGroupInputIcons();
    window.ensureEmojiPickerButton();

    const msgContainer = document.getElementById('chat-messages');
    if (msgContainer) {
        msgContainer.style.background = '#170A11';
        msgContainer.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.35); font-size:13px; padding:30px 0;">Завантаження...</div>`;
    }

    document.querySelectorAll('.reaction-bar, .msg-context-menu').forEach(b => b.remove());
    window.refreshGroupInfo();
    if (window.groupPollTimer) clearInterval(window.groupPollTimer);
    window.fetchGroupMessages(true);
    window.groupPollTimer = setInterval(() => window.fetchGroupMessages(false), 3000);
};

window.refreshGroupInfo = async function() {
    const g = window.currentGroupChat;
    if (!g) return;
    try {
        const data = await groupApiPost({ action: 'get_info', group_id: g.id });
        if (!data.success || !window.currentGroupChat || window.currentGroupChat.id !== g.id) return;
        window.currentGroupInfo = data.group;
        const info = data.group;

        const sub = document.getElementById('group-header-sub');
        if (sub) {
            const word = info.type === 'channel' ? 'підписн.' : 'учасн.';
            sub.innerText = `${info.members} ${word}${info.my_notifications ? '' : ' • 🔕'}`;
        }
        const targetAvatar = document.getElementById('chat-target-avatar');
        if (targetAvatar && info.avatar) targetAvatar.src = info.avatar;

        // 👤 ЧИ Я УЧАСНИК? Якщо ні — замість рядка вводу кнопка вступу (Telegram-style)
        const amMember = !!info.my_role;
        const canWrite = amMember && (info.type !== 'channel' || ['owner', 'coowner', 'moderator'].includes(info.my_role));
        const input = document.getElementById('msg-input');
        const sendBtn = document.getElementById('send-btn');
        if (input) input.style.display = canWrite ? 'block' : 'none';
        if (sendBtn) sendBtn.style.display = canWrite ? 'block' : 'none';
        const emojiBtn = document.getElementById('group-emoji-btn');
        if (emojiBtn) emojiBtn.style.display = canWrite ? 'flex' : 'none';
        const iconsBox2 = document.querySelector('#chat-window .chat-input-icons');
        if (iconsBox2) iconsBox2.style.display = canWrite ? '' : 'none';
        window.updateGroupJoinBar(info, amMember);

        // 💬 Кнопка обговорення для каналу
        const disc = document.getElementById('group-header-discuss');
        if (disc) disc.style.display = (info.type === 'channel' && info.linked_group) ? 'flex' : 'none';
    } catch (e) {}
};

// ➕ КНОПКА ВСТУПУ замість рядка вводу для не-учасників (Telegram-style)
window.updateGroupJoinBar = function(info, amMember) {
    const area = document.querySelector('#chat-window .chat-input-area');
    if (!area) return;
    let bar = document.getElementById('group-join-bar');
    if (amMember) { if (bar) bar.remove(); return; }
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'group-join-bar';
        bar.style.cssText = 'width:100%; display:flex; justify-content:center; padding:4px 0;';
        area.appendChild(bar);
    }
    const isChannel = info.type === 'channel';
    const isPrivate = (info.privacy || 'private') === 'private';
    const btnBase = "width:100%; max-width:520px; padding:14px; border-radius:50px; font-weight:800; font-size:14px; font-family:'Geologica',sans-serif; letter-spacing:0.3px; transition:0.2s;";
    if (isPrivate && info.has_request) {
        bar.innerHTML = `<button disabled style="${btnBase} border:1px solid rgba(240,4,127,0.4); background:rgba(240,4,127,0.12); color:#ff6ab8; cursor:default;">⏳ Заявку надіслано — очікує схвалення власником</button>`;
    } else if (isPrivate) {
        bar.innerHTML = `<button onclick="window.joinFromChatBar(${info.id})" style="${btnBase} border:none; background:linear-gradient(135deg,#f0047f,#c70368); color:#fff; cursor:pointer; box-shadow:0 4px 18px rgba(240,4,127,0.4);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">📨 Відправити заявку на вступ</button>`;
    } else {
        bar.innerHTML = `<button onclick="window.joinFromChatBar(${info.id})" style="${btnBase} border:none; background:linear-gradient(135deg,#f0047f,#c70368); color:#fff; cursor:pointer; box-shadow:0 4px 18px rgba(240,4,127,0.4);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">${isChannel ? '🔔 Підписатися на канал' : '➕ Вступити в групу'}</button>`;
    }
};

window.joinFromChatBar = async function(groupId) {
    const bar = document.getElementById('group-join-bar');
    const data = await groupApiPost({ action: 'request_join', group_id: groupId });
    if (!data.success) { window.showGroupToast('⚠️ ' + (data.message || 'Помилка')); return; }
    if (data.state === 'joined' || data.state === 'member') {
        if (bar) {
            const isCh = window.currentGroupChat && window.currentGroupChat.type === 'channel';
            bar.innerHTML = `<div style="width:100%; max-width:520px; text-align:center; padding:13px; border-radius:50px; background:rgba(0,200,120,0.12); border:1px solid rgba(0,220,130,0.45); color:#5dffb0; font-weight:800; font-size:14px; font-family:'Geologica',sans-serif;">✅ Ви ${isCh ? 'підписалися на канал' : 'вступили в групу'}!</div>`;
            setTimeout(() => { bar.remove(); }, 1800);
        }
        await window.loadMyGroupChats();
        setTimeout(() => { window.refreshGroupInfo(); window.fetchGroupMessages(false); }, 1900);
    } else {
        if (bar) {
            bar.innerHTML = `<button disabled style="width:100%; max-width:520px; padding:14px; border-radius:50px; border:1px solid rgba(240,4,127,0.4); background:rgba(240,4,127,0.12); color:#ff6ab8; font-weight:800; font-size:14px; font-family:'Geologica',sans-serif; cursor:default;">⏳ Заявку надіслано — очікує схвалення власником</button>`;
        }
        window.showGroupToast('📨 Заявку відправлено власнику');
    }
};

window.ensureGroupHeaderButtons = function() {
    const iconsBox = document.querySelector('#chat-window .chat-header-icons');
    if (!iconsBox) return;
    if (!document.getElementById('group-header-discuss')) {
        const disc = document.createElement('div');
        disc.id = 'group-header-discuss';
        disc.className = 'group-header-btn';
        disc.title = 'Обговорення каналу';
        disc.style.display = 'none';
        disc.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
        disc.onclick = () => window.openChannelDiscussion();
        iconsBox.appendChild(disc);
    }
    if (!document.getElementById('group-header-bell')) {
        const bell = document.createElement('div');
        bell.id = 'group-header-bell';
        bell.className = 'group-header-btn';
        bell.title = 'Сповіщення увімк/вимк';
        bell.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
        bell.onclick = () => window.toggleGroupNotifications();
        iconsBox.appendChild(bell);
    }
    if (!document.getElementById('group-header-gear')) {
        const gear = document.createElement('div');
        gear.id = 'group-header-gear';
        gear.className = 'group-header-btn';
        gear.title = 'Налаштування';
        gear.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.66.16 1.18.68 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        gear.onclick = () => window.openGroupSettings();
        iconsBox.appendChild(gear);
    }
    ['group-header-bell', 'group-header-gear'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'flex';
            const svg = el.querySelector('svg');
            if (svg) svg.style.display = ''; // якщо чужий код сховав — повертаємо
        }
    });
    const discBtn = document.getElementById('group-header-discuss');
    if (discBtn) { const svg = discBtn.querySelector('svg'); if (svg) svg.style.display = ''; }
};

// 💬 Відкрити групу обговорення каналу (авто-вступ як у Telegram)
window.openChannelDiscussion = async function() {
    const info = window.currentGroupInfo;
    if (!info || !info.linked_group) return;
    const lg = info.linked_group;
    try {
        await groupApiPost({ action: 'join', group_id: lg.id });
        await window.loadMyGroupChats();
        window.openGroupChat({ id: lg.id, name: lg.name, type: 'group', owner_id: lg.owner_id });
    } catch (e) {}
};

window.toggleGroupNotifications = async function() {
    const info = window.currentGroupInfo;
    const g = window.currentGroupChat;
    if (!g) return;
    const newVal = info ? !info.my_notifications : false;
    try {
        await groupApiPost({ action: 'toggle_notifications', group_id: g.id, enabled: newVal });
        if (window.currentGroupInfo) window.currentGroupInfo.my_notifications = newVal ? 1 : 0;
        const sub = document.getElementById('group-header-sub');
        if (sub && window.currentGroupInfo) {
            const word = g.type === 'channel' ? 'підписн.' : 'учасн.';
            sub.innerText = `${window.currentGroupInfo.members} ${word}${newVal ? '' : ' • 🔕'}`;
        }
        const toggle = document.getElementById('gset-notif-toggle');
        if (toggle) toggle.checked = newVal;
        window.showGroupToast(newVal ? '🔔 Сповіщення увімкнено' : '🔕 Сповіщення вимкнено');
    } catch (e) {}
};

window.showGroupToast = function(text) {
    let toast = document.getElementById('group-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'group-toast';
        document.body.appendChild(toast);
    }
    toast.innerText = text;
    toast.classList.add('visible');
    clearTimeout(window._groupToastT);
    window._groupToastT = setTimeout(() => toast.classList.remove('visible'), 2200);
};

// === 4. ПОВІДОМЛЕННЯ + РЕАКЦІЇ ===
window._lastGroupMsgDate = null;
window._groupRoleTitles = {};

// 📅 "12 червня" — як у Telegram
function fmtGroupDate(iso) {
    const months = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
    const d = new Date(iso.replace(' ', 'T'));
    if (isNaN(d)) return iso.slice(0, 10);
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    const sameDay = (a, b) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    if (sameDay(d, today)) return 'Сьогодні';
    if (sameDay(d, yest)) return 'Вчора';
    let out = `${d.getDate()} ${months[d.getMonth()]}`;
    if (d.getFullYear() !== today.getFullYear()) out += ` ${d.getFullYear()}`;
    return out;
}

function groupEmptyPlaceholderHTML(g) {
    return `<div id="group-empty-placeholder" style="text-align:center; color:rgba(255,255,255,0.35); font-size:13px; padding:30px 0;">${g.type === 'channel' ? 'У каналі поки немає публікацій' : 'Повідомлень поки немає — напишіть першим! 💬'}</div>`;
}

window.fetchGroupMessages = async function(initial) {
    const g = window.currentGroupChat;
    if (!g) return;
    try {
        const res = await fetch(`groups_api.php?action=get_messages&group_id=${g.id}&since_id=${window.lastGroupMsgId}`, { credentials: 'include' });
        const data = await res.json();
        if (!data.success) return;
        if (!window.currentGroupChat || window.currentGroupChat.id !== g.id) return;

        const msgContainer = document.getElementById('chat-messages');
        if (!msgContainer) return;
        if (initial) { msgContainer.innerHTML = ''; window._lastGroupMsgDate = null; }

        if (data.role_titles) window._groupRoleTitles = data.role_titles;

        // ❤️ Карта реакцій
        if (Array.isArray(data.reactions)) {
            window.groupReactionsMap = {};
            data.reactions.forEach(r => {
                const mid = parseInt(r.message_id);
                if (!window.groupReactionsMap[mid]) window.groupReactionsMap[mid] = [];
                window.groupReactionsMap[mid].push({ emoji: r.emoji, cnt: parseInt(r.cnt), mine: !!parseInt(r.mine) });
            });
        }

        if (data.my_id) window._groupMyId = parseInt(data.my_id); // ✅ надійний id із сервера
        const myId = window._groupMyId || parseInt(localStorage.getItem('user_id') || 0);
        const msgs = data.messages || [];
        const wasAtBottom = Math.abs(msgContainer.scrollHeight - msgContainer.scrollTop - msgContainer.clientHeight) <= 80;

        // 🗑 СИНХРОНІЗАЦІЯ ВИДАЛЕНЬ: прибираємо рядки, яких більше немає на сервері
        if (Array.isArray(data.ids) && data.ids.length) {
            const idSet = new Set(data.ids);
            const minId = Math.min(...data.ids);
            msgContainer.querySelectorAll('.msg-row[data-gid]').forEach(row => {
                const gid = parseInt(row.getAttribute('data-gid'));
                if (gid >= minId && !idSet.has(gid)) row.remove();
            });
        } else if (Array.isArray(data.ids) && data.ids.length === 0) {
            msgContainer.querySelectorAll('.msg-row[data-gid]').forEach(row => row.remove());
        }

        // ✏️ СИНХРОНІЗАЦІЯ РЕДАГУВАНЬ
        (data.edited_list || []).forEach(e => {
            const row = msgContainer.querySelector(`.msg-row[data-gid="${e.id}"]`);
            if (!row) return;
            const tb = row.querySelector('.text-bubble');
            if (tb && row.getAttribute('data-msg-raw') !== e.message) {
                row.setAttribute('data-msg-raw', e.message);
                tb.innerHTML = renderGroupText(e.message);
                const timeEl = row.querySelector('.group-msg-time');
                if (timeEl && !timeEl.querySelector('.msg-edited-mark')) {
                    timeEl.insertAdjacentHTML('afterbegin', '<span class="msg-edited-mark">ред. </span>');
                }
            }
        });

        msgs.forEach(m => {
            window.lastGroupMsgId = Math.max(window.lastGroupMsgId, parseInt(m.id));
            if (msgContainer.querySelector(`.msg-row[data-gid="${m.id}"]`)) return;

            // ✨ Плейсхолдер "немає повідомлень" зникає з першим повідомленням
            document.getElementById('group-empty-placeholder')?.remove();

            // 📅 ДАТА-ЧІП при зміні дня (як у Telegram)
            const msgDate = (m.created_at || '').slice(0, 10);
            if (msgDate && msgDate !== window._lastGroupMsgDate) {
                window._lastGroupMsgDate = msgDate;
                if (!msgContainer.querySelector(`.group-date-chip[data-date="${msgDate}"]`)) {
                    msgContainer.insertAdjacentHTML('beforeend', `
                        <div class="msg-date-row" style="display:flex; justify-content:center; width:100%; margin:14px 0 8px;">
                            <div class="group-date-chip" data-date="${msgDate}">${fmtGroupDate(m.created_at)}</div>
                        </div>`);
                }
            }

            if (m.media_type === 'system') {
                msgContainer.insertAdjacentHTML('beforeend', `
                    <div class="msg-row" data-gid="${m.id}" style="display:flex; justify-content:center; width:100%; margin:8px 0;">
                        <div class="group-system-chip msg-anim-in">${escapeGroupHTML(m.message)}</div>
                    </div>`);
                return;
            }

            const isMe = parseInt(m.user_id) === myId;
            const time = (m.created_at || '').slice(11, 16);
            const ava = m.avatar || 'img/default_avatar.png';

            let contentHTML = '';
            let isSticker = false;
            let canEdit = false;
            if (m.media_type === 'image' && m.media_url) {
                contentHTML = `<img src="${escapeGroupHTML(m.media_url)}" class="group-msg-image" loading="lazy" onclick="window.open('${escapeGroupHTML(m.media_url)}', '_blank')">`;
            } else if (m.media_type === 'voice' && m.media_url) {
                contentHTML = `<audio controls preload="none" class="group-msg-voice" src="${escapeGroupHTML(m.media_url)}"></audio>`;
            } else if (m.media_type === 'sticker' && m.media_url) {
                isSticker = true;
                contentHTML = `<img src="${escapeGroupHTML(m.media_url)}" class="group-msg-sticker" loading="lazy">`;
            } else {
                canEdit = true;
                contentHTML = `<span class="text-bubble">${renderGroupText(m.message)}</span>`;
            }

            // ↪️ Позначка пересланого повідомлення
            const fwdLine = m.fwd_from
                ? `<div class="group-msg-fwd">↪ Переслано від <b>${escapeGroupHTML(m.fwd_from)}</b></div>` : '';

            // 🏷️ ПІДПИС РОЛІ праворуч від ніка (як у Telegram у адмінів)
            const roleKey = m.sender_role;
            const roleLabel = (roleKey && roleKey !== 'member' && window._groupRoleTitles[roleKey])
                ? `<span class="group-msg-role">${escapeGroupHTML(window._groupRoleTitles[roleKey])}</span>` : '';

            const senderLine = (!isMe && g.type !== 'channel')
                ? `<div class="group-msg-sender">${escapeGroupHTML(m.username || 'Користувач')}${roleLabel}</div>` : '';

            const editedMark = parseInt(m.edited) ? '<span class="msg-edited-mark">ред. </span>' : '';

            const avatarHTML = `<img src="${escapeGroupHTML(ava)}" class="group-msg-avatar" loading="lazy" onerror="this.src='img/default_avatar.png'" title="${escapeGroupHTML(m.username || '')}">`;

            const isMedia = (m.media_type === 'image' || m.media_type === 'voice');
            const bubbleClass = isSticker ? 'msg-sticker-wrap' : `msg-bubble ${isMe ? 'msg-sent' : 'msg-received'}${isMedia ? ' msg-media-bubble' : ''}`;

            msgContainer.insertAdjacentHTML('beforeend', `
                <div class="msg-row group-msg-row ${isMe ? 'mine' : 'theirs'}" data-gid="${m.id}" data-msg-raw="${escapeGroupHTML(m.media_type === 'text' ? m.message : '')}">
                    ${!isMe ? avatarHTML : ''}
                    <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; max-width:72%;">
                        <div class="${bubbleClass} msg-anim-in group-reactable"
                             oncontextmenu="window.openMsgContextMenu(event, ${m.id}, ${isMe}, ${canEdit})">
                            ${senderLine}
                            ${fwdLine}
                            ${contentHTML}
                            ${isSticker ? '' : `<span class="group-msg-time">${editedMark}${time}</span>`}
                        </div>
                        <div class="group-reactions" id="group-reactions-${m.id}"></div>
                    </div>
                    ${isMe ? avatarHTML : ''}
                </div>`);
        });

        // ✨ Якщо повідомлень не лишилося — повертаємо плейсхолдер
        if (!msgContainer.querySelector('.msg-row[data-gid]') && !document.getElementById('group-empty-placeholder')) {
            msgContainer.querySelectorAll('.msg-date-row').forEach(r => r.remove());
            window._lastGroupMsgDate = null;
            msgContainer.innerHTML = groupEmptyPlaceholderHTML(g);
        }

        window.renderAllReactions();

        if (msgs.length && (initial || wasAtBottom)) {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }
    } catch (e) {}
};

window.renderAllReactions = function() {
    document.querySelectorAll('.group-reactions').forEach(box => {
        const mid = parseInt(box.id.replace('group-reactions-', ''));
        const list = window.groupReactionsMap[mid] || [];
        box.innerHTML = list.map(r => {
            const url = (window.appleEmojis || {})[r.emoji] || (window.customEmojis || {})[r.emoji];
            const face = url ? `<img src="${url}" style="width:15px; height:15px; vertical-align:-3px;">` : escapeGroupHTML(r.emoji);
            return `<span class="reaction-chip ${r.mine ? 'mine' : ''}" onclick="event.stopPropagation(); window.toggleReaction(${mid}, '${escapeGroupHTML(r.emoji)}')">${face} ${r.cnt}</span>`;
        }).join('');
    });
};

// 🖱️ КОНТЕКСТНЕ МЕНЮ (ПКМ): реакції + редагувати + переслати + видалити
// ⚠️ Стилі вшиті інлайн — меню виглядає правильно навіть зі старим CSS у кеші
// 🧹 Закрити меню повідомлення + зняти 3D-фокус і блюр з чату
window.closeMsgCtx = function() {
    document.querySelectorAll('.msg-context-menu').forEach(m => m.remove());
    document.querySelectorAll('.msg-ctx-focused').forEach(r => r.classList.remove('msg-ctx-focused'));
    document.getElementById('chat-messages')?.classList.remove('msg-ctx-focus-mode');
};

window.openMsgContextMenu = function(event, msgId, isMe, canEdit) {
    // 🛡️ Перестраховка: визначаємо права прямо з DOM (раптом інлайн-атрибут застарів)
    const rowRef = document.querySelector(`.msg-row[data-gid="${msgId}"]`);
    if (rowRef) {
        if (rowRef.classList.contains('mine')) isMe = true;
        if (rowRef.querySelector('.text-bubble')) canEdit = true;
    }

    event.preventDefault();
    event.stopPropagation();
    // Прибираємо БУДЬ-ЯКІ старі панелі (включно з легасі .reaction-bar)
    document.querySelectorAll('.reaction-bar, .msg-context-menu, .sticker-picker-window.floating').forEach(b => b.remove());

    const info = window.currentGroupInfo;
    const isAdmin = info && ['owner', 'coowner', 'moderator'].includes(info.my_role);

    const menu = document.createElement('div');
    menu.className = 'msg-context-menu';
    menu.style.cssText = [
        'position:fixed', 'width:232px', 'z-index:999999',
        'background:linear-gradient(180deg,#2a0d1d 0%,#170810 100%)',
        'border:1px solid rgba(240,4,127,0.55)', 'border-radius:14px',
        'box-shadow:0 14px 44px rgba(0,0,0,0.7), 0 0 24px rgba(240,4,127,0.25)',
        'overflow:hidden', 'padding-bottom:4px',
        "font-family:'Geologica',sans-serif"
    ].join(';');
    menu.onclick = (e) => e.stopPropagation();

    // Рядок реакцій: 5 стандартних + 3 кастомні (компактно, один ряд)
    const standard = Object.entries(window.appleEmojis || {});
    const custom = Object.entries(window.customEmojis || {}).slice(0, 3);
    const reactItem = (key, url) => `
        <span onclick="window.toggleReaction(${msgId}, '${escapeGroupHTML(key)}'); window.closeMsgCtx();"
              onmouseover="this.style.transform='scale(1.3)'; this.style.background='rgba(240,4,127,0.3)';"
              onmouseout="this.style.transform='scale(1)'; this.style.background='transparent';"
              style="width:25px; height:25px; display:flex; align-items:center; justify-content:center; cursor:pointer; border-radius:50%; transition:0.15s; flex-shrink:0;">
            <img src="${url}" style="width:17px; height:17px; object-fit:contain;">
        </span>`;
    const reactionsRow = `
        <div style="display:flex; gap:2px; padding:8px 8px 6px; justify-content:center;">
            ${standard.map(([e, u]) => reactItem(e, u)).join('')}
            ${custom.map(([c, u]) => reactItem(c, u)).join('')}
        </div>
        <div style="height:1px; background:rgba(240,4,127,0.25); margin:0 8px 4px;"></div>`;

    const itemStyle = "padding:9px 16px; font-size:13px; font-weight:600; color:#eee; cursor:pointer; transition:background 0.15s;";
    const hov = `onmouseover="this.style.background='rgba(240,4,127,0.18)'" onmouseout="this.style.background='transparent'"`;

    let items = '';
    if (isMe && canEdit) {
        items += `<div style="${itemStyle}" ${hov} onclick="window.startEditGroupMessage(${msgId})">✏️ Редагувати</div>`;
    }
    items += `<div style="${itemStyle}" ${hov} onclick="window.openForwardModal(${msgId})">↪️ Переслати</div>`;
    if (isMe || isAdmin) {
        items += `<div style="${itemStyle} color:#ff4d6d;" onmouseover="this.style.background='rgba(255,0,51,0.18)'" onmouseout="this.style.background='transparent'" onclick="window.deleteGroupMessage(${msgId})">🗑 Видалити</div>`;
    }

    menu.innerHTML = reactionsRow + items;
    document.body.appendChild(menu);

    // ✨ TELEGRAM-ФОКУС: вибране повідомлення спливає в 3D, решта чату блюриться
    const focusRow = document.querySelector(`.msg-row[data-gid="${msgId}"]`);
    if (focusRow) {
        focusRow.classList.add('msg-ctx-focused');
        document.getElementById('chat-messages')?.classList.add('msg-ctx-focus-mode');
    }

    // 📌 ПОЗИЦІЯ: у СВОЇХ повідомлень меню кріпиться ЗНИЗУ ПІД бульбашкою;
    // у чужих — вниз-праворуч від курсора. Без стрибків: міряємо і ставимо один раз.
    menu.style.visibility = 'hidden';
    const mw = menu.offsetWidth || 232;
    const mh = menu.offsetHeight || 180;
    let x, y;
    const bubbleEl = focusRow ? focusRow.querySelector('.msg-bubble, .msg-sticker-wrap') : null;
    if (isMe && bubbleEl) {
        const r = bubbleEl.getBoundingClientRect();
        x = r.right - mw;                                  // вирівнюємо по правому краю бульбашки
        y = r.bottom + 8;                                  // одразу під повідомленням
        if (y + mh > window.innerHeight - 8) y = r.top - mh - 8; // знизу нема місця → над бульбашкою
    } else {
        x = event.clientX + 4;
        y = event.clientY + 4;
        if (x + mw > window.innerWidth - 8) x = event.clientX - mw - 4;
        if (y + mh > window.innerHeight - 8) y = event.clientY - mh - 4;
    }
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.visibility = 'visible';

    setTimeout(() => {
        document.addEventListener('click', function closeCtx(e) {
            if (!menu.contains(e.target)) { window.closeMsgCtx(); document.removeEventListener('click', closeCtx); }
        });
    }, 50);
};

// ✏️ РЕЖИМ РЕДАГУВАННЯ (текст підставляється у поле вводу)
window.editingGroupMsg = null;

window.startEditGroupMessage = function(msgId) {
    window.closeMsgCtx();
    const row = document.querySelector(`.msg-row[data-gid="${msgId}"]`);
    const input = document.getElementById('msg-input');
    if (!row || !input) return;

    const raw = row.getAttribute('data-msg-raw') || row.querySelector('.text-bubble')?.innerText || '';
    window.editingGroupMsg = msgId;
    input.value = raw;
    input.focus();

    // Панелька "Редагування" над полем вводу
    document.getElementById('group-edit-bar')?.remove();
    const inputArea = document.querySelector('#chat-window .chat-input-area');
    if (inputArea) {
        inputArea.insertAdjacentHTML('beforebegin', `
            <div id="group-edit-bar">
                <span>✏️ Редагування повідомлення</span>
                <button onclick="window.cancelEditGroupMessage()">✕ Скасувати</button>
            </div>`);
    }
};

window.cancelEditGroupMessage = function() {
    window.editingGroupMsg = null;
    document.getElementById('group-edit-bar')?.remove();
    const input = document.getElementById('msg-input');
    if (input) input.value = '';
};

// ↪️ ПЕРЕСИЛКА: вибір групи/каналу зі своїх чатів
window.openForwardModal = function(msgId) {
    window.closeMsgCtx();
    let modal = document.getElementById('group-forward-modal');
    if (modal) modal.remove();

    const chats = (window._myGroupsCache || []).filter(x => parseInt(x.id) !== (window.currentGroupChat?.id || 0));
    modal = document.createElement('div');
    modal.id = 'group-forward-modal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(5,0,4,0.7); backdrop-filter:blur(8px); z-index:999999; display:flex; align-items:center; justify-content:center;';
    modal.innerHTML = `
        <div class="ginv-box">
            <div class="gset-header" style="margin-bottom:12px;">
                <span style="font-weight:800; font-size:15px;">↪️ Переслати до...</span>
                <button class="close-chat-x" onclick="document.getElementById('group-forward-modal').remove()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div style="max-height:300px; overflow-y:auto;">
                ${chats.length ? chats.map(c => `
                    <div class="gset-member-row" style="cursor:pointer;" onclick="window.forwardGroupMessage(${msgId}, ${c.id}, this)">
                        <div class="group-avatar-circle">${c.type === 'channel' ? '📣' : '👥'}</div>
                        <span style="flex:1; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeGroupHTML(c.name)}</span>
                        <span style="font-size:11px; color:rgba(255,255,255,0.4);">${c.type === 'channel' ? 'канал' : 'група'}</span>
                    </div>`).join('')
                : '<div style="text-align:center; color:rgba(255,255,255,0.35); padding:20px;">Немає інших чатів для пересилки</div>'}
            </div>
        </div>`;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
};

window.forwardGroupMessage = async function(msgId, toGroupId, rowEl) {
    if (rowEl) { rowEl.style.opacity = '0.5'; rowEl.style.pointerEvents = 'none'; }
    const data = await groupApiPost({
        action: 'forward_message',
        message_id: msgId,
        to_group_id: toGroupId,
        username: localStorage.getItem('user_name') || 'Користувач',
        avatar: localStorage.getItem('user_avatar') || null
    });
    if (!data.success) {
        window.showGroupToast('⚠️ ' + (data.message || 'Не вдалося переслати'));
        if (rowEl) { rowEl.style.opacity = '1'; rowEl.style.pointerEvents = 'auto'; }
        return;
    }
    document.getElementById('group-forward-modal')?.remove();
    window.showGroupToast('↪️ Переслано до «' + (data.to_name || 'чату') + '»');
};

window.deleteGroupMessage = async function(msgId) {
    window.closeMsgCtx();
    const data = await groupApiPost({ action: 'delete_message', message_id: msgId });
    if (!data.success) { window.showGroupToast(data.message || 'Помилка'); return; }
    document.querySelector(`.msg-row[data-gid="${msgId}"]`)?.remove();
    delete window.groupReactionsMap[msgId];
    // Якщо все видалили — плейсхолдер
    const msgContainer = document.getElementById('chat-messages');
    const g = window.currentGroupChat;
    if (msgContainer && g && !msgContainer.querySelector('.msg-row[data-gid]')) {
        msgContainer.querySelectorAll('.msg-date-row').forEach(r => r.remove());
        window._lastGroupMsgDate = null;
        msgContainer.innerHTML = groupEmptyPlaceholderHTML(g);
    }
    window.showGroupToast('🗑 Повідомлення видалено');
};

// ❤️ Реакції тепер відкриваються ЛИШЕ правим кліком (контекстне меню)

window.toggleReaction = async function(msgId, emoji) {
    document.querySelectorAll('.reaction-bar').forEach(b => b.remove());
    try {
        const data = await groupApiPost({ action: 'toggle_reaction', message_id: msgId, emoji });
        if (!data.success) { window.showGroupToast(data.message || 'Помилка'); return; }
        // Миттєве локальне оновлення
        const list = window.groupReactionsMap[msgId] || (window.groupReactionsMap[msgId] = []);
        const ex = list.find(r => r.emoji === emoji);
        if (data.state === 'added') {
            if (ex) { ex.cnt++; ex.mine = true; } else list.push({ emoji, cnt: 1, mine: true });
        } else if (ex) {
            ex.cnt--; ex.mine = false;
            if (ex.cnt <= 0) window.groupReactionsMap[msgId] = list.filter(r => r !== ex);
        }
        window.renderAllReactions();
    } catch (e) {}
};

// === 5. 😊 ПІКЕР ЕМОДЗІ ТА СТІКЕРІВ У РЯДКУ ВВОДУ ===
window.ensureEmojiPickerButton = function() {
    const iconsBox = document.querySelector('#chat-window .chat-input-icons');
    if (!iconsBox || document.getElementById('group-emoji-btn')) {
        const b = document.getElementById('group-emoji-btn');
        if (b) b.style.display = 'flex';
        return;
    }
    const btn = document.createElement('div');
    btn.id = 'group-emoji-btn';
    btn.title = 'Емодзі та стікери';
    btn.style.cssText = 'display:flex; align-items:center; cursor:pointer;';
    btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>`;
    btn.onclick = (e) => { e.stopPropagation(); window.toggleChatEmojiPicker(); };
    iconsBox.insertBefore(btn, iconsBox.firstChild);
};

window.toggleChatEmojiPicker = function() {
    let picker = document.getElementById('chat-emoji-picker');
    if (picker) { picker.remove(); return; }

    const inputArea = document.querySelector('#chat-window .chat-input-area');
    if (!inputArea) return;

    picker = document.createElement('div');
    picker.id = 'chat-emoji-picker';
    picker.onclick = (e) => e.stopPropagation();

    const standard = Object.entries(window.appleEmojis || {});
    const custom = Object.entries(window.customEmojis || {});
    const stickers = window.myCustomStickers || [];

    picker.innerHTML = `
        <div class="cep-tabs">
            <button class="cep-tab active" onclick="window.switchChatPickerTab(this, 'emoji')">😊 ЕМОДЗІ</button>
            <button class="cep-tab" onclick="window.switchChatPickerTab(this, 'stickers')">🎨 СТІКЕРИ</button>
        </div>
        <div class="cep-pane" data-pane="emoji">
            <div class="cep-section-label">STANDARD</div>
            <div class="cep-grid">
                ${standard.map(([emoji, url]) => `
                    <span class="cep-item" onclick="window.insertChatEmoji('${emoji}')"><img src="${url}"></span>
                `).join('')}
            </div>
            <div class="cep-section-label" style="color:#f0047f;">MY PACK</div>
            <div class="cep-grid">
                ${custom.map(([code, url]) => `
                    <span class="cep-item" title="${escapeGroupHTML(code)}" onclick="window.insertChatEmoji('${escapeGroupHTML(code)}')"><img src="${url}"></span>
                `).join('')}
            </div>
        </div>
        <div class="cep-pane" data-pane="stickers" style="display:none;">
            <div class="cep-sticker-grid">
                ${stickers.map(url => `
                    <div class="cep-sticker" onclick="window.sendChatSticker('${escapeGroupHTML(url)}')">
                        <img src="${escapeGroupHTML(url)}" onerror="this.parentElement.style.display='none'">
                    </div>
                `).join('')}
                ${custom.map(([code, url]) => `
                    <div class="cep-sticker" onclick="window.sendChatSticker('${escapeGroupHTML(url)}')">
                        <img src="${escapeGroupHTML(url)}">
                    </div>
                `).join('')}
            </div>
        </div>`;

    inputArea.style.position = 'relative';
    inputArea.appendChild(picker);

    setTimeout(() => {
        document.addEventListener('click', function closePicker(e) {
            const p = document.getElementById('chat-emoji-picker');
            if (p && !p.contains(e.target) && e.target.id !== 'group-emoji-btn') {
                p.remove();
                document.removeEventListener('click', closePicker);
            }
        });
    }, 50);
};

window.switchChatPickerTab = function(btn, pane) {
    document.querySelectorAll('.cep-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.cep-pane').forEach(p => {
        p.style.display = p.getAttribute('data-pane') === pane ? 'block' : 'none';
    });
};

// Емодзі → вставляємо в поле вводу (стандартний — символом, кастомний — кодом :custom1:)
window.insertChatEmoji = function(emojiOrCode) {
    const input = document.getElementById('msg-input');
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    input.value = input.value.slice(0, start) + emojiOrCode + input.value.slice(input.selectionEnd ?? start);
    input.focus();
    const pos = start + emojiOrCode.length;
    try { input.setSelectionRange(pos, pos); } catch (e) {}
};

// Стікер → надсилається ОДРАЗУ, як у Telegram
window.sendChatSticker = async function(url) {
    document.getElementById('chat-emoji-picker')?.remove();
    if (!window.currentGroupChat) {
        window.showGroupToast('🎨 Стікери поки працюють у групах і каналах');
        return;
    }
    try {
        const data = await groupApiPost({
            action: 'send_sticker',
            group_id: window.currentGroupChat.id,
            url: url,
            username: localStorage.getItem('user_name') || 'Користувач',
            avatar: localStorage.getItem('user_avatar') || null
        });
        if (!data.success) { window.showGroupToast(data.message || 'Не вдалося надіслати'); return; }
        window.fetchGroupMessages(false);
    } catch (e) {}
};

// === 6. МЕДІА (фото/голосові) ===
window.bindGroupInputIcons = function() {
    const inputIcons = document.querySelectorAll('.chat-input-icons svg');
    if (inputIcons.length >= 2) {
        inputIcons[0].onclick = () => {
            let fi = document.getElementById('group-photo-input');
            if (!fi) {
                fi = document.createElement('input');
                fi.type = 'file';
                fi.id = 'group-photo-input';
                fi.accept = 'image/*';
                fi.style.display = 'none';
                document.body.appendChild(fi);
            }
            fi.onchange = function() {
                if (this.files && this.files[0]) window.sendGroupMedia(this.files[0], 'image');
                this.value = '';
            };
            fi.click();
        };
        inputIcons[1].onclick = () => window.toggleGroupVoiceRecording(inputIcons[1]);
        if (inputIcons[2]) inputIcons[2].onclick = () => window.showGroupToast('GIF у групах скоро 😉');
    }
};

window.sendGroupMedia = async function(file, type) {
    const g = window.currentGroupChat;
    if (!g || !file) return;
    window.showGroupToast(type === 'voice' ? '🎤 Надсилаємо голосове...' : '📷 Надсилаємо фото...');
    const fd = new FormData();
    fd.append('action', 'send_media');
    fd.append('group_id', g.id);
    fd.append('type', type);
    fd.append('file', file);
    fd.append('username', localStorage.getItem('user_name') || 'Користувач');
    fd.append('avatar', localStorage.getItem('user_avatar') || '');
    try {
        const res = await fetch('groups_api.php', { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        if (!data.success) { alert(data.message || 'Не вдалося надіслати'); return; }
        window.fetchGroupMessages(false);
    } catch (e) { alert('Помилка мережі'); }
};

window.toggleGroupVoiceRecording = async function(micIcon) {
    if (!window.currentGroupChat) return;
    if (window.groupVoiceRecorder && window.groupVoiceRecorder.state === 'recording') {
        window.groupVoiceRecorder.stop();
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
        window.groupVoiceChunks = [];
        window.groupVoiceRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        window.groupVoiceRecorder.ondataavailable = e => { if (e.data.size) window.groupVoiceChunks.push(e.data); };
        window.groupVoiceRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            if (micIcon) micIcon.classList.remove('group-mic-recording');
            const blob = new Blob(window.groupVoiceChunks, { type: 'audio/webm' });
            if (blob.size > 500) {
                const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
                window.sendGroupMedia(file, 'voice');
            }
            window.groupVoiceRecorder = null;
        };
        window.groupVoiceRecorder.start();
        if (micIcon) micIcon.classList.add('group-mic-recording');
        window.showGroupToast('🔴 Запис... натисніть мікрофон ще раз, щоб надіслати');
    } catch (e) { alert('Мікрофон недоступний: ' + e.message); }
};

// === 7. ВІДПРАВКА ТЕКСТУ ===
(function hookGroupSend() {
    const originalSend = window.sendMessage;
    window.sendMessage = async function() {
        if (window.currentGroupChat) {
            const input = document.getElementById('msg-input');
            const text = input ? input.value.trim() : '';
            if (!text) return;
            input.value = '';

            // ✏️ Якщо ми в режимі редагування — оновлюємо існуюче повідомлення
            if (window.editingGroupMsg) {
                const editId = window.editingGroupMsg;
                window.cancelEditGroupMessage();
                try {
                    const ed = await groupApiPost({ action: 'edit_message', message_id: editId, text });
                    if (!ed.success) { alert(ed.message || 'Не вдалося відредагувати'); return; }
                    const row = document.querySelector(`.msg-row[data-gid="${editId}"]`);
                    if (row) {
                        row.setAttribute('data-msg-raw', text);
                        const tb = row.querySelector('.text-bubble');
                        if (tb) tb.innerHTML = renderGroupText(text);
                        const timeEl = row.querySelector('.group-msg-time');
                        if (timeEl && !timeEl.querySelector('.msg-edited-mark')) {
                            timeEl.insertAdjacentHTML('afterbegin', '<span class="msg-edited-mark">ред. </span>');
                        }
                    }
                } catch (e) {}
                return;
            }

            try {
                const data = await groupApiPost({
                    action: 'send_message',
                    group_id: window.currentGroupChat.id,
                    text: text,
                    username: localStorage.getItem('user_name') || 'Користувач',
                    avatar: localStorage.getItem('user_avatar') || null
                });
                if (!data.success) { alert(data.message || 'Не вдалося надіслати'); return; }
                window.fetchGroupMessages(false);
            } catch (e) { console.error(e); }
            return;
        }
        return originalSend.apply(this, arguments);
    };
})();

// === 8. ПАНЕЛЬ НАЛАШТУВАНЬ ===
window.openGroupSettings = async function() {
    const g = window.currentGroupChat;
    if (!g) return;
    await window.refreshGroupInfo();
    const info = window.currentGroupInfo;
    if (!info) return;

    let panel = document.getElementById('group-settings-panel');
    if (panel) panel.remove();

    const chatWin = document.getElementById('chat-window');
    panel = document.createElement('div');
    panel.id = 'group-settings-panel';

    const isOwner = info.my_role === 'owner';
    const isAdmin = ['owner', 'coowner', 'moderator'].includes(info.my_role);
    const isChannel = info.type === 'channel';
    const link = `${location.origin}${location.pathname.replace(/[^\/]*$/, '')}home.html?join=${info.slug || ''}`;
    const entity = isChannel ? 'каналу' : 'групи';

    // 💬 Картка групи обговорення — лише для каналів
    let discussionCard = '';
    if (isChannel) {
        const linked = info.linked_group;
        const myGroups = (window._myGroupsCache || []).filter(x => x.type === 'group');
        discussionCard = `
        <div class="gset-card">
            <label class="gset-label">💬 Група обговорення</label>
            ${linked ? `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="group-avatar-circle">👥</div>
                    <span style="flex:1; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeGroupHTML(linked.name)}</span>
                    <button class="gset-btn-ghost" style="padding:7px 14px; font-size:12px;" onclick="window.openChannelDiscussion()">Відкрити</button>
                    ${isOwner ? `<button class="gset-btn-danger" style="padding:7px 12px; font-size:12px;" onclick="window.setChannelDiscussion(0)">✕</button>` : ''}
                </div>
            ` : (isOwner ? `
                <div style="font-size:12px; color:rgba(255,255,255,0.4); margin-bottom:10px;"></div>
                ${myGroups.length ? `
                    <div style="display:flex; gap:8px;">
                        <select id="gset-discuss-select" class="gset-input" style="flex:1;">
                            ${myGroups.map(x => `<option value="${x.id}">${escapeGroupHTML(x.name)}</option>`).join('')}
                        </select>
                        <button class="gset-btn-primary" style="padding:8px 16px;" onclick="window.setChannelDiscussion(parseInt(document.getElementById('gset-discuss-select').value))">Прив'язати</button>
                    </div>
                ` : `<div style="font-size:13px; color:rgba(255,255,255,0.5);">У вас поки немає груп. Створіть групу — і зможете прив'язати її сюди.</div>`}
            ` : `<div style="font-size:13px; color:rgba(255,255,255,0.5);">Обговорення поки не підключено</div>`)}
        </div>`;
    }

    panel.innerHTML = `
    <div class="gset-header">
        <span style="font-weight:800; font-size:15px; text-transform:uppercase; letter-spacing:0.5px;">Налаштування ${entity}</span>
        <button class="close-chat-x" onclick="document.getElementById('group-settings-panel').remove()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    </div>
    <div class="gset-body">
        <div class="gset-card" style="display:flex; gap:16px; align-items:flex-start;">
            <div class="gset-avatar-wrap" ${isAdmin ? 'onclick="document.getElementById(\'gset-avatar-input\').click()"' : ''} style="${isAdmin ? 'cursor:pointer;' : ''}">
                <img id="gset-avatar-img" src="${escapeGroupHTML(info.avatar || 'img/default_avatar.png')}" onerror="this.src='img/default_avatar.png'">
                ${isAdmin ? '<div class="gset-avatar-cam">📷</div>' : ''}
            </div>
            <input type="file" id="gset-avatar-input" accept="image/*" style="display:none;" onchange="window.uploadGroupAvatar(this)">
            <div style="flex:1; min-width:0;">
                <label class="gset-label">Назва</label>
                <input id="gset-name" class="gset-input" value="${escapeGroupHTML(info.name)}" maxlength="80" ${isAdmin ? '' : 'disabled'}>
                <label class="gset-label" style="margin-top:10px;">Опис</label>
                <textarea id="gset-desc" class="gset-input" rows="2" maxlength="500" placeholder="Про що це..." ${isAdmin ? '' : 'disabled'}>${escapeGroupHTML(info.description || '')}</textarea>
                ${isAdmin ? `<button class="gset-btn-primary" style="margin-top:10px;" onclick="window.saveGroupInfo()">💾 Зберегти</button>` : ''}
            </div>
        </div>

        ${discussionCard}

        <div class="gset-card">
            <label class="gset-label">Посилання-запрошення</label>
            <div style="display:flex; gap:8px; align-items:center;">
                <span style="color:rgba(255,255,255,0.4); font-size:13px;">?join=</span>
                <input id="gset-slug" class="gset-input" style="flex:1;" value="${escapeGroupHTML(info.slug || '')}" maxlength="40" ${isOwner ? '' : 'disabled'}>
                <button class="gset-btn-ghost" onclick="window.copyGroupLink()" title="Скопіювати посилання">📋</button>
                ${isOwner ? `<button class="gset-btn-ghost" onclick="window.saveGroupSlug()" title="Зберегти посилання">💾</button>` : ''}
            </div>
            <div id="gset-link-preview" style="font-size:11px; color:rgba(255,255,255,0.35); margin-top:6px; word-break:break-all;">${escapeGroupHTML(link)}</div>
            ${isOwner ? `<div style="font-size:11px; color:rgba(255,255,255,0.3); margin-top:4px;"></div>` : ''}

            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:16px;">
                <div>
                    <div style="font-weight:700; font-size:14px;">${info.privacy === 'public' ? '🌍 Публічна' : '🔒 Приватна'}</div>
                    <div style="font-size:11px; color:rgba(255,255,255,0.4);">${info.privacy === 'public' ? 'Будь-хто може знайти та приєднатися' : 'Вступ лише за посиланням чи запрошенням'}</div>
                </div>
                ${isOwner ? `<label class="gset-switch"><input type="checkbox" id="gset-privacy-toggle" ${info.privacy === 'public' ? 'checked' : ''} onchange="window.toggleGroupPrivacy(this.checked)"><span class="gset-slider"></span></label>` : ''}
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:14px;">
                <div>
                    <div style="font-weight:700; font-size:14px;">🔔 Сповіщення</div>
                    <div style="font-size:11px; color:rgba(255,255,255,0.4);">Звуки та позначки для цього чату</div>
                </div>
                <label class="gset-switch"><input type="checkbox" id="gset-notif-toggle" ${info.my_notifications ? 'checked' : ''} onchange="window.toggleGroupNotifications()"><span class="gset-slider"></span></label>
            </div>
        </div>

        <div class="gset-card">
            <button class="gset-btn-primary" style="width:100%;" onclick="window.openInviteModal()">➕ Запросити користувача</button>
        </div>

        <div class="gset-tabs">
            <div class="gset-tab active" data-tab="members" onclick="window.switchGroupTab('members', this)">👤 ${isChannel ? 'Підписники' : 'Учасники'}</div>
            <div class="gset-tab" data-tab="media" onclick="window.switchGroupTab('media', this)">🖼 Медіа</div>
            <div class="gset-tab" data-tab="voice" onclick="window.switchGroupTab('voice', this)">🎤 Голосові</div>
            ${isAdmin ? `<div class="gset-tab" data-tab="requests" onclick="window.switchGroupTab('requests', this)">📨 Заявки</div>` : ''}
        </div>
        ${isOwner ? `<div style="font-size:11px; color:rgba(255,255,255,0.35); margin-top:-6px;">💡 Клікни на плашку ролі учасника, щоб змінити роль або перейменувати її</div>` : ''}
        <div id="gset-tab-content" class="gset-card" style="min-height:120px;"></div>

        <div class="gset-card" style="display:flex; gap:10px;">
            ${(!isOwner && info.my_role) ? `<button class="gset-btn-danger" style="flex:1;" onclick="window.leaveGroup()">🚪 ${isChannel ? 'Відписатися' : 'Вийти з групи'}</button>` : ''}
            ${isOwner ? `<button class="gset-btn-danger" style="flex:1;" onclick="window.deleteGroup()">🗑 Видалити ${isChannel ? 'канал' : 'групу'}</button>` : ''}
        </div>
    </div>`;

    chatWin.appendChild(panel);
    window.switchGroupTab('members', panel.querySelector('.gset-tab'));

    const slugInput = document.getElementById('gset-slug');
    if (slugInput) slugInput.addEventListener('input', () => {
        const prev = document.getElementById('gset-link-preview');
        if (prev) prev.innerText = `${location.origin}${location.pathname.replace(/[^\/]*$/, '')}home.html?join=${slugInput.value.trim()}`;
    });
};

window.setChannelDiscussion = async function(groupId) {
    const g = window.currentGroupChat;
    if (!g) return;
    const data = await groupApiPost({ action: 'set_linked_group', group_id: g.id, linked_group_id: groupId });
    if (!data.success) { alert(data.message || 'Помилка'); return; }
    window.showGroupToast(groupId ? '💬 Групу обговорення прив\'язано' : 'Обговорення відв\'язано');
    await window.refreshGroupInfo();
    window.openGroupSettings();
};

window.uploadGroupAvatar = async function(input) {
    const g = window.currentGroupChat;
    if (!g || !input.files || !input.files[0]) return;
    const fd = new FormData();
    fd.append('action', 'upload_avatar');
    fd.append('group_id', g.id);
    fd.append('file', input.files[0]);
    input.value = '';
    try {
        const res = await fetch('groups_api.php', { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        if (!data.success) { alert(data.message || 'Помилка'); return; }
        const img = document.getElementById('gset-avatar-img');
        if (img) img.src = data.avatar + '?t=' + Date.now();
        const headerAva = document.getElementById('chat-target-avatar');
        if (headerAva) headerAva.src = data.avatar + '?t=' + Date.now();
        window.showGroupToast('✅ Аватар оновлено');
        window.loadMyGroupChats();
    } catch (e) { alert('Помилка мережі'); }
};

window.saveGroupInfo = async function() {
    const g = window.currentGroupChat;
    if (!g) return;
    const name = document.getElementById('gset-name')?.value.trim();
    const desc = document.getElementById('gset-desc')?.value.trim();
    const data = await groupApiPost({ action: 'update_info', group_id: g.id, name, description: desc });
    if (!data.success) { alert(data.message || 'Помилка'); return; }
    if (name) {
        window.currentGroupChat.name = name;
        const tn = document.getElementById('chat-target-name');
        if (tn && tn.childNodes[0]) tn.childNodes[0].textContent = name + ' ';
    }
    window.showGroupToast('✅ Збережено');
    window.loadMyGroupChats();
    window.refreshGroupInfo();
};

window.saveGroupSlug = async function() {
    const g = window.currentGroupChat;
    const slug = document.getElementById('gset-slug')?.value.trim();
    if (!g || !slug) return;
    const data = await groupApiPost({ action: 'update_info', group_id: g.id, slug });
    if (!data.success) { alert(data.message || 'Помилка'); return; }
    window.showGroupToast('✅ Посилання оновлено');
    window.refreshGroupInfo();
};

window.copyGroupLink = function() {
    const slug = document.getElementById('gset-slug')?.value.trim() || (window.currentGroupInfo?.slug || '');
    const link = `${location.origin}${location.pathname.replace(/[^\/]*$/, '')}home.html?join=${slug}`;
    const done = () => window.showGroupToast('📋 Посилання скопійовано!');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done).catch(() => { window.prompt('Скопіюйте посилання:', link); });
    } else {
        window.prompt('Скопіюйте посилання:', link);
    }
};

window.toggleGroupPrivacy = async function(isPublic) {
    const g = window.currentGroupChat;
    if (!g) return;
    const data = await groupApiPost({ action: 'update_info', group_id: g.id, privacy: isPublic ? 'public' : 'private' });
    if (!data.success) { alert(data.message || 'Помилка'); return; }
    window.showGroupToast(isPublic ? '🌍 Тепер публічна' : '🔒 Тепер приватна');
    window.openGroupSettings();
};

// === 9. ВКЛАДКИ + КЛІКАБЕЛЬНІ ПЛАШКИ РОЛЕЙ ===
window._gsetTitles = {};

window.switchGroupTab = async function(tab, el) {
    document.querySelectorAll('.gset-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    const box = document.getElementById('gset-tab-content');
    if (!box) return;
    const g = window.currentGroupChat;
    const info = window.currentGroupInfo;
    box.innerHTML = '<div style="text-align:center; color:rgba(255,255,255,0.35); padding:20px;">Завантаження...</div>';

    if (tab === 'members') {
        const data = await groupApiPost({ action: 'get_members', group_id: g.id });
        if (!data.success) { box.innerHTML = 'Помилка'; return; }
        window._gsetTitles = data.role_titles || {};
        const titles = window._gsetTitles;
        const isOwner = info?.my_role === 'owner';
        box.innerHTML = (data.members || []).map(m => {
            const roleLabel = titles[m.role] || m.role;
            const roleClass = m.role === 'owner' ? 'role-owner' : (m.role === 'coowner' ? 'role-coowner' : (m.role === 'moderator' ? 'role-mod' : 'role-member'));
            // ✨ Плашка КЛІКАБЕЛЬНА для власника
            const clickAttr = isOwner ? `onclick="window.openRoleMenu(event, ${m.user_id}, '${m.role}')" style="cursor:pointer;" title="Клікни, щоб змінити"` : '';
            return `
                <div class="gset-member-row">
                    <img src="${escapeGroupHTML(m.avatar_url || 'img/default_avatar.png')}" onerror="this.src='img/default_avatar.png'">
                    <span style="flex:1; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeGroupHTML(m.username || 'Користувач #' + m.user_id)}</span>
                    <span class="gset-role-badge ${roleClass}" ${clickAttr}>${escapeGroupHTML(roleLabel)}${isOwner ? ' ▾' : ''}</span>
                </div>`;
        }).join('') || '<div style="text-align:center; color:rgba(255,255,255,0.35); padding:20px;">Порожньо</div>';

    }

    if (tab === 'requests') {
        const data = await groupApiPost({ action: 'list_requests', group_id: g.id });
        if (!data.success) { box.innerHTML = '<div style="text-align:center; color:#ff6;">Недостатньо прав</div>'; return; }
        const reqs = data.requests || [];
        box.innerHTML = reqs.length
            ? reqs.map(r => `
                <div class="gset-member-row">
                    <img src="${escapeGroupHTML(r.avatar_url || 'img/default_avatar.png')}" onerror="this.src='img/default_avatar.png'">
                    <div style="flex:1; overflow:hidden;">
                        <div style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeGroupHTML(r.username || 'Користувач #' + r.user_id)}</div>
                        <div style="font-size:10px; color:rgba(255,255,255,0.35);">подав(ла) заявку ${escapeGroupHTML((r.created_at || '').slice(0, 16).replace('T', ' '))}</div>
                    </div>
                    <button class="gset-btn-primary" style="padding:7px 14px; font-size:12px;" onclick="window.resolveJoinRequest(${r.user_id}, true)">✓ Прийняти</button>
                    <button class="gset-btn-danger" style="padding:7px 12px; font-size:12px;" onclick="window.resolveJoinRequest(${r.user_id}, false)">✕</button>
                </div>`).join('')
            : '<div style="text-align:center; color:rgba(255,255,255,0.35); padding:20px;">📨 Заявок поки немає</div>';
    }

    if (tab === 'media') {
        const data = await groupApiPost({ action: 'get_media', group_id: g.id, kind: 'image' });
        const items = data.items || [];
        box.innerHTML = items.length
            ? `<div class="gset-media-grid">${items.map(i =>
                `<img src="${escapeGroupHTML(i.media_url)}" loading="lazy" onclick="window.open('${escapeGroupHTML(i.media_url)}', '_blank')">`).join('')}</div>`
            : '<div style="text-align:center; color:rgba(255,255,255,0.35); padding:20px;">🖼 Медіа поки немає</div>';
    }

    if (tab === 'voice') {
        const data = await groupApiPost({ action: 'get_media', group_id: g.id, kind: 'voice' });
        const items = data.items || [];
        box.innerHTML = items.length
            ? items.map(i => `
                <div class="gset-voice-row">
                    <span style="font-size:12px; color:rgba(255,255,255,0.5); min-width:90px;">${escapeGroupHTML(i.username || '')}</span>
                    <audio controls preload="none" src="${escapeGroupHTML(i.media_url)}" style="flex:1; height:34px;"></audio>
                </div>`).join('')
            : '<div style="text-align:center; color:rgba(255,255,255,0.35); padding:20px;">🎤 Голосових поки немає</div>';
    }
};

// ✨ ПОПОВЕР ПРИ КЛІКУ НА ПЛАШКУ: змінити роль + перейменувати плашку
window.openRoleMenu = function(event, userId, currentRole) {
    event.stopPropagation();
    document.querySelectorAll('.role-popover').forEach(p => p.remove());

    const info = window.currentGroupInfo;
    const titles = window._gsetTitles || {};
    const myId = parseInt(localStorage.getItem('user_id') || 0);
    const isSelf = userId === myId;
    const isTargetOwner = currentRole === 'owner';

    const pop = document.createElement('div');
    pop.className = 'role-popover';
    pop.onclick = (e) => e.stopPropagation();

    // Список ролей для призначення (власнику іншого не призначиш)
    let assignHTML = '';
    if (!isTargetOwner && !isSelf) {
        assignHTML = `
            <div class="role-pop-label">Призначити роль</div>
            ${['coowner', 'moderator', 'member'].map(r => `
                <div class="role-pop-item ${r === currentRole ? 'current' : ''}" onclick="window.changeMemberRole(${userId}, '${r}')">
                    ${r === currentRole ? '✓ ' : ''}${escapeGroupHTML(titles[r] || r)}
                </div>
            `).join('')}
            <div class="role-pop-divider"></div>`;
    }

    pop.innerHTML = `
        ${assignHTML}
        <div class="role-pop-label">✏️ Перейменувати плашку «${escapeGroupHTML(titles[currentRole] || currentRole)}»</div>
        <div style="display:flex; gap:6px; padding:4px 8px 8px;">
            <input id="role-rename-input" class="gset-input" style="flex:1; padding:7px 10px; font-size:13px;" value="${escapeGroupHTML(titles[currentRole] || '')}" maxlength="30">
            <button class="gset-btn-primary" style="padding:7px 12px; font-size:12px;" onclick="window.renameRoleTitle('${currentRole}')">💾</button>
        </div>`;

    const badge = event.currentTarget;
    badge.parentElement.style.position = 'relative';
    badge.parentElement.appendChild(pop);

    const inp = pop.querySelector('#role-rename-input');
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') window.renameRoleTitle(currentRole); });

    setTimeout(() => {
        document.addEventListener('click', function closePop(e) {
            if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', closePop); }
        });
    }, 50);
};

window.changeMemberRole = async function(userId, role) {
    const g = window.currentGroupChat;
    document.querySelectorAll('.role-popover').forEach(p => p.remove());
    const data = await groupApiPost({ action: 'set_role', group_id: g.id, user_id: userId, role });
    if (!data.success) { alert(data.message || 'Помилка'); return; }
    window.showGroupToast('✅ Роль змінено');
    window.switchGroupTab('members', document.querySelector('.gset-tab[data-tab="members"]'));
    window.fetchGroupMessages(false);
};

window.renameRoleTitle = async function(roleKey) {
    const g = window.currentGroupChat;
    const val = document.getElementById('role-rename-input')?.value.trim();
    if (!g || !val) return;
    document.querySelectorAll('.role-popover').forEach(p => p.remove());
    const titles = {};
    titles[roleKey] = val;
    const data = await groupApiPost({ action: 'set_role_titles', group_id: g.id, titles });
    if (!data.success) { alert(data.message || 'Помилка'); return; }
    window.showGroupToast(`✅ Плашку перейменовано на «${val}»`);
    window.switchGroupTab('members', document.querySelector('.gset-tab[data-tab="members"]'));
};

// === 10. ІНВАЙТ-МОДАЛКА ===
window.openInviteModal = async function() {
    const g = window.currentGroupChat;
    if (!g) return;
    let modal = document.getElementById('group-invite-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'group-invite-modal';
    modal.innerHTML = `
        <div class="ginv-box">
            <div class="gset-header" style="margin-bottom:12px;">
                <span style="font-weight:800; font-size:15px;">➕ Запросити</span>
                <button class="close-chat-x" onclick="document.getElementById('group-invite-modal').remove()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <button class="gset-btn-ghost" style="width:100%; margin-bottom:14px;" onclick="window.copyGroupLink()">🔗 Скопіювати посилання на ${g.type === 'channel' ? 'канал' : 'групу'}</button>
            <label class="gset-label">Твої друзі</label>
            <div id="ginv-friends-list" style="max-height:280px; overflow-y:auto;">
                <div style="text-align:center; color:rgba(255,255,255,0.35); padding:20px;">Завантаження...</div>
            </div>
        </div>`;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);

    try {
        const res = await fetch('get_mutual_friends.php', { credentials: 'include' });
        const data = await res.json();
        const list = document.getElementById('ginv-friends-list');
        if (!list) return;
        const friends = data.friends || [];
        if (!friends.length) {
            list.innerHTML = '<div style="text-align:center; color:rgba(255,255,255,0.35); padding:20px;">Немає взаємних підписок 🙁<br>Поділись посиланням!</div>';
            return;
        }
        list.innerHTML = friends.map(f => `
            <div class="gset-member-row">
                <img src="${escapeGroupHTML(f.avatar_url || 'img/default_avatar.png')}" onerror="this.src='img/default_avatar.png'">
                <span style="flex:1; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeGroupHTML(f.username)}</span>
                <button class="gset-btn-primary" style="padding:6px 14px; font-size:12px;" id="ginv-btn-${f.id}" onclick="window.inviteFriendToGroup(${f.id})">Запросити</button>
            </div>`).join('');
    } catch (e) {
        const list = document.getElementById('ginv-friends-list');
        if (list) list.innerHTML = '<div style="text-align:center; color:#ff6;">Не вдалося завантажити друзів</div>';
    }
};

window.inviteFriendToGroup = async function(userId) {
    const g = window.currentGroupChat;
    if (!g) return;
    const btn = document.getElementById('ginv-btn-' + userId);
    const data = await groupApiPost({ action: 'invite', group_id: g.id, user_id: userId });
    if (data.success) {
        if (btn) { btn.innerText = '✅ Запрошено'; btn.disabled = true; btn.style.opacity = '0.6'; }
        window.fetchGroupMessages(false);
        window.refreshGroupInfo();
    } else {
        if (btn && data.message === 'Уже в групі') { btn.innerText = 'Уже тут'; btn.disabled = true; btn.style.opacity = '0.6'; }
        else alert(data.message || 'Помилка');
    }
};

// === 11. ВИХІД / ВИДАЛЕННЯ ===
window.leaveGroup = async function() {
    const g = window.currentGroupChat;
    if (!g) return;
    const verb = g.type === 'channel' ? 'Відписатися від' : 'Вийти з';
    if (!confirm(`${verb} "${g.name}"?`)) return;
    const data = await groupApiPost({ action: 'leave', group_id: g.id });
    if (!data.success) { alert(data.message || 'Помилка'); return; }
    document.getElementById('group-settings-panel')?.remove();
    window.closeChat();
    window.loadMyGroupChats();
};

window.deleteGroup = async function() {
    const g = window.currentGroupChat;
    if (!g) return;
    if (!confirm(`Видалити "${g.name}" НАЗАВЖДИ разом з усіма повідомленнями?`)) return;
    const data = await groupApiPost({ action: 'delete', group_id: g.id });
    if (!data.success) { alert(data.message || 'Помилка'); return; }
    document.getElementById('group-settings-panel')?.remove();
    window.closeChat();
    window.loadMyGroupChats();
};

// === 12. ЗАКРИТТЯ ЧАТУ ===
(function hookGroupClose() {
    const originalClose = window.closeChat;
    window.closeChat = function() {
        if (window.groupPollTimer) { clearInterval(window.groupPollTimer); window.groupPollTimer = null; }
        if (window.groupHeaderGuard) { clearInterval(window.groupHeaderGuard); window.groupHeaderGuard = null; }
        if (window.groupVoiceRecorder && window.groupVoiceRecorder.state === 'recording') {
            try { window.groupVoiceRecorder.stop(); } catch (e) {}
        }
        window.currentGroupChat = null;
        window.currentGroupInfo = null;
        window.lastGroupMsgId = 0;
        window.groupReactionsMap = {};
        document.getElementById('group-settings-panel')?.remove();
        document.getElementById('group-invite-modal')?.remove();
        document.getElementById('group-forward-modal')?.remove();
        document.getElementById('chat-emoji-picker')?.remove();
        document.querySelectorAll('.reaction-bar, .role-popover, .msg-context-menu').forEach(b => b.remove());
        window.cancelEditGroupMessage();
        document.querySelectorAll('.chat-header-icons svg').forEach(svg => svg.style.display = '');
        ['group-header-bell', 'group-header-gear', 'group-header-discuss'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const targetAvatar = document.getElementById('chat-target-avatar');
        if (targetAvatar) targetAvatar.style.display = '';
        const input = document.getElementById('msg-input');
        if (input) { input.style.display = 'block'; input.placeholder = 'Напишіть повідомлення...'; }
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) sendBtn.style.display = 'block';
        return originalClose.apply(this, arguments);
    };
})();

// (делегування ПКМ перенесено в головний window-обробник)


// 🧹 Страховки закриття меню: Escape, скрол чату, ПКМ деінде
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.closeMsgCtx && window.closeMsgCtx(); });
document.addEventListener('scroll', (e) => {
    if (e.target && e.target.id === 'chat-messages') window.closeMsgCtx && window.closeMsgCtx();
}, true);

// === 13. ВСТУП ЗА ПОСИЛАННЯМ + ІНІЦІАЛІЗАЦІЯ ===
document.addEventListener('DOMContentLoaded', () => {
    window.loadMyGroupChats();
    setInterval(window.loadMyGroupChats, 30000);

    const params = new URLSearchParams(location.search);
    const joinSlug = params.get('join');
    if (joinSlug) {
        groupApiPost({ action: 'join_by_link', slug: joinSlug }).then(data => {
            history.replaceState(null, '', location.pathname);
            if (data.success && data.private && data.group) {
                // 🔒 Приватний чат: показуємо модалку із заявкою
                window.showGroupPreviewModal(data.group);
                return;
            }
            if (data.success && data.group) {
                window.loadMyGroupChats();
                setTimeout(() => window.openGroupChat(data.group), 600);
                if (!data.already) {
                    window.showGroupToast(data.group.type === 'channel'
                        ? '🔔 Ви підписалися на "' + data.group.name + '"'
                        : '🎉 Ви приєдналися до "' + data.group.name + '"');
                }
            } else if (data.message) {
                window.showGroupToast('⚠️ ' + data.message);
            }
        }).catch(() => {});
    }
});

// ==========================================================
// 🔎 СТОРІНКА ПОШУКУ: РЕАЛЬНІ ТОП-ГРУПИ/КАНАЛИ З БД + ЗАЯВКИ
// ==========================================================

// 🏆 Топ-3 групи та канали за учасниками
window.loadTopDiscover = async function() {
    try {
        const data = await groupApiPost({ action: 'top_discover' });
        if (!data.success) return;

        const fill = (listId, items, isChannel) => {
            const list = document.getElementById(listId);
            if (!list) return;
            if (!items || !items.length) {
                list.innerHTML = `<div style="color: rgba(255,255,255,0.35); font-size: 12px; padding: 10px;">${isChannel ? 'Каналів поки немає — створи перший! 📣' : 'Груп поки немає — створи першу! 👥'}</div>`;
                return;
            }
            list.innerHTML = items.map(g => {
                const word = isChannel ? 'підписників' : 'учасників';
                const lock = (g.privacy || 'private') === 'private' ? ' 🔒' : '';
                const bg = g.avatar
                    ? `background-image: url('${escapeGroupHTML(g.avatar)}');`
                    : `background: linear-gradient(120deg, rgba(240,4,127,0.35), rgba(80,8,50,0.6));`;
                // 🖼️ Іконка аватарки зліва від назви
                const avaIcon = g.avatar
                    ? `<div class="mini-item-avatar" style="background-image: url('${escapeGroupHTML(g.avatar)}');"></div>`
                    : `<div class="mini-item-avatar mini-item-avatar--placeholder">${isChannel ? '📣' : '👥'}</div>`;
                return `
                <div class="mini-item ${isChannel ? 'item-glow-cyan' : 'item-glow-pink'} with-blurred-image" style="cursor:pointer;"
                     onclick='window.openDiscoverItem(${JSON.stringify({id: parseInt(g.id)}).replace(/'/g, "&#39;")})'>
                    ${avaIcon}
                    <div class="item-content-left">
                        <span class="item-main-title">${escapeGroupHTML(g.name)}${lock}</span>
                        <span class="item-subtitle">${g.members || 0} ${word}</span>
                    </div>
                    <div class="item-blurred-bg" style="${bg}"></div>
                </div>`;
            }).join('');
        };

        fill('top-groups-list', data.groups, false);
        fill('top-channels-list', data.channels, true);
    } catch (e) {}
};

// Клік по групі/каналу в топі
window.openDiscoverItem = async function(ref) {
    try {
        const data = await groupApiPost({ action: 'public_info', group_id: ref.id });
        if (!data.success) { window.showGroupToast('⚠️ ' + (data.message || 'Не знайдено')); return; }
        const g = data.group;

        if (g.am_member) {
            // Вже учасник — просто відкриваємо чат
            const dash = document.getElementById('search-dashboard');
            if (dash) dash.style.display = 'none';
            window.openGroupChat(g);
            return;
        }
        // Заходимо в чат-прев'ю: замість рядка вводу — кнопка вступу/заявки
        const dash2 = document.getElementById('search-dashboard');
        if (dash2) dash2.style.display = 'none';
        window.openGroupChat(g);
    } catch (e) {}
};

// 🪪 МОДАЛКА ПРЕВ'Ю: аватар зверху, опис, кнопка заявки/вступу
window.showGroupPreviewModal = function(g) {
    document.getElementById('group-preview-modal')?.remove();
    const isChannel = g.type === 'channel';
    const isPrivate = (g.privacy || 'private') === 'private';
    const word = isChannel ? 'підписників' : 'учасників';
    const entity = isChannel ? 'канал' : 'група';

    const modal = document.createElement('div');
    modal.id = 'group-preview-modal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(5,0,4,0.75); backdrop-filter:blur(10px); z-index:999999; display:flex; align-items:center; justify-content:center;';

    const avaHTML = g.avatar
        ? `<img src="${escapeGroupHTML(g.avatar)}" style="width:96px; height:96px; border-radius:50%; object-fit:cover; border:3px solid rgba(240,4,127,0.6); box-shadow:0 6px 26px rgba(240,4,127,0.4);" onerror="this.outerHTML='<div style=\\'width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;background:linear-gradient(135deg,rgba(240,4,127,0.3),rgba(138,43,226,0.3));border:3px solid rgba(240,4,127,0.6);\\'>${isChannel ? '📣' : '👥'}</div>'">`
        : `<div style="width:96px; height:96px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:40px; background:linear-gradient(135deg,rgba(240,4,127,0.3),rgba(138,43,226,0.3)); border:3px solid rgba(240,4,127,0.6); box-shadow:0 6px 26px rgba(240,4,127,0.35);">${isChannel ? '📣' : '👥'}</div>`;

    let btnHTML;
    if (g.has_request) {
        btnHTML = `<button id="gpv-btn" disabled style="width:100%; padding:13px; border-radius:50px; border:1px solid rgba(240,4,127,0.4); background:rgba(240,4,127,0.12); color:#ff6ab8; font-weight:800; font-size:14px; font-family:'Geologica',sans-serif; cursor:default;">⏳ Заявку надіслано — очікує схвалення</button>`;
    } else if (isPrivate) {
        btnHTML = `<button id="gpv-btn" onclick="window.sendJoinRequest(${g.id})" style="width:100%; padding:13px; border-radius:50px; border:none; background:linear-gradient(135deg,#f0047f,#c70368); color:#fff; font-weight:800; font-size:14px; font-family:'Geologica',sans-serif; cursor:pointer; box-shadow:0 4px 18px rgba(240,4,127,0.4); transition:0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">📨 Відправити заявку</button>`;
    } else {
        btnHTML = `<button id="gpv-btn" onclick="window.sendJoinRequest(${g.id})" style="width:100%; padding:13px; border-radius:50px; border:none; background:linear-gradient(135deg,#f0047f,#c70368); color:#fff; font-weight:800; font-size:14px; font-family:'Geologica',sans-serif; cursor:pointer; box-shadow:0 4px 18px rgba(240,4,127,0.4); transition:0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">${isChannel ? '🔔 Підписатися' : '➕ Приєднатися'}</button>`;
    }

    modal.innerHTML = `
        <div style="width:min(380px,92vw); background:linear-gradient(180deg,#1d0b15 0%,#120710 100%); border:1px solid rgba(240,4,127,0.4); border-radius:20px; padding:26px 22px 22px; color:#fff; text-align:center; box-shadow:0 24px 70px rgba(240,4,127,0.25); position:relative; font-family:'Geologica',sans-serif;">
            <button onclick="document.getElementById('group-preview-modal').remove()" style="position:absolute; top:12px; right:14px; background:none; border:none; color:rgba(255,255,255,0.5); font-size:20px; cursor:pointer; transition:0.2s;" onmouseover="this.style.color='#f0047f'" onmouseout="this.style.color='rgba(255,255,255,0.5)'">✕</button>
            <div style="display:flex; justify-content:center; margin-bottom:14px;">${avaHTML}</div>
            <div style="font-size:19px; font-weight:800; margin-bottom:4px;">${escapeGroupHTML(g.name)}</div>
            <div style="font-size:12px; color:rgba(255,255,255,0.45); margin-bottom:14px;">${isChannel ? '📣 Канал' : '👥 Група'} • ${g.members || 0} ${word}${isPrivate ? ' • 🔒 Приватний' : ''}</div>
            ${g.description ? `<div style="font-size:13.5px; line-height:1.5; color:rgba(255,255,255,0.75); background:rgba(255,255,255,0.04); border:1px solid rgba(240,4,127,0.12); border-radius:12px; padding:12px 14px; margin-bottom:16px; text-align:left;">${escapeGroupHTML(g.description)}</div>` : ''}
            ${isPrivate && !g.has_request ? `<div style="font-size:12px; color:rgba(255,255,255,0.5); margin-bottom:14px;">🔒 Це приватний ${entity}. Надішли заявку — власник розгляне її та схвалить вступ.</div>` : ''}
            ${btnHTML}
        </div>`;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
};

window.sendJoinRequest = async function(groupId) {
    const btn = document.getElementById('gpv-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }
    const data = await groupApiPost({ action: 'request_join', group_id: groupId });
    if (!data.success) { window.showGroupToast('⚠️ ' + (data.message || 'Помилка')); if (btn) { btn.disabled = false; btn.style.opacity = '1'; } return; }

    if (data.state === 'joined' || data.state === 'member') {
        document.getElementById('group-preview-modal')?.remove();
        const dash = document.getElementById('search-dashboard');
        if (dash) dash.style.display = 'none';
        await window.loadMyGroupChats();
        if (data.group) window.openGroupChat(data.group);
        window.showGroupToast('🎉 Ви приєдналися!');
    } else {
        if (btn) {
            btn.innerHTML = '⏳ Заявку надіслано — очікує схвалення';
            btn.style.background = 'rgba(240,4,127,0.12)';
            btn.style.color = '#ff6ab8';
            btn.style.border = '1px solid rgba(240,4,127,0.4)';
            btn.style.boxShadow = 'none';
            btn.style.cursor = 'default';
        }
        window.showGroupToast('📨 Заявку відправлено власнику');
    }
};

// 📋 БЛОК ЗАЯВОК для адмінів — вгорі вкладки "Учасники"
window.renderJoinRequestsBlock = async function(box) {
    const g = window.currentGroupChat;
    const info = window.currentGroupInfo;
    if (!g || !info || !['owner', 'coowner', 'moderator'].includes(info.my_role)) return;
    try {
        const data = await groupApiPost({ action: 'list_requests', group_id: g.id });
        if (!data.success || !(data.requests || []).length) return;
        const html = `
            <div style="border:1px dashed rgba(240,4,127,0.4); border-radius:12px; padding:10px; margin-bottom:12px;">
                <div class="gset-label" style="margin-bottom:8px;">📨 Заявки на вступ (${data.requests.length})</div>
                ${data.requests.map(r => `
                    <div class="gset-member-row">
                        <img src="${escapeGroupHTML(r.avatar_url || 'img/default_avatar.png')}" onerror="this.src='img/default_avatar.png'">
                        <span style="flex:1; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeGroupHTML(r.username || 'Користувач #' + r.user_id)}</span>
                        <button class="gset-btn-primary" style="padding:6px 12px; font-size:12px;" onclick="window.resolveJoinRequest(${r.user_id}, true)">✓</button>
                        <button class="gset-btn-danger" style="padding:6px 12px; font-size:12px;" onclick="window.resolveJoinRequest(${r.user_id}, false)">✕</button>
                    </div>`).join('')}
            </div>`;
        box.insertAdjacentHTML('afterbegin', html);
    } catch (e) {}
};

window.resolveJoinRequest = async function(userId, accept) {
    const g = window.currentGroupChat;
    if (!g) return;
    const data = await groupApiPost({ action: 'resolve_request', group_id: g.id, user_id: userId, accept });
    if (!data.success) { window.showGroupToast('⚠️ ' + (data.message || 'Помилка')); return; }
    window.showGroupToast(accept ? '✅ Заявку прийнято' : '❌ Заявку відхилено');
    const reqTabEl = document.querySelector('.gset-tab[data-tab="requests"]');
    if (reqTabEl) window.switchGroupTab('requests', reqTabEl);
    window.refreshGroupInfo();
    window.fetchGroupMessages(false);
};

// Завантажуємо топи при старті та оновлюємо при відкритті пошуку
document.addEventListener('DOMContentLoaded', () => {
    window.loadTopDiscover();
    const searchInput = document.getElementById('game-search-input');
    if (searchInput) searchInput.addEventListener('focus', () => window.loadTopDiscover());
});
