/**
 * SYNCORA — Система навчання нових користувачів
 * tutorial.js (updated)
 */

// ─────────────────────────────────────────────
// КОНФІГ КРОКІВ ТУТОРІАЛУ (merged step 1+2, removed step 2)
// ─────────────────────────────────────────────
const TUTORIAL_STEPS = [
  {
    id: 'search',
    targetId: 'top-game-filter',
    title: '🎮 Пошук гравців',
    description: 'Тут ти знайдеш інших гравців! Шукай їх за нікнеймом, а значок фільтрів допоможе відібрати людей за віком, стилем гри, жанром та мовою. Ігри, що ти додав у профіль, одразу покращують підбір партнерів!',
    icon: '🔍',
    position: 'bottom',
    arrowSide: 'top',
  },
  {
    id: 'create-post',
    targetId: 'add-post-btn',
    title: '✏️ Публікація',
    description: 'Натисни цю кнопку, щоб створити пост — ділись думками, шукай команду або оголошуй стрім!',
    icon: '📝',
    position: 'right',
    arrowSide: 'left',
  },
  {
    id: 'feed',
    targetId: 'btn-feed',
    title: '📰 Стрічка',
    description: 'СТРІЧКА — це головна сторінка з постами інших гравців. Знайди того, з ким хочеш пограти!',
    icon: '🏠',
    position: 'right',
    arrowSide: 'left',
  },
  {
    id: 'streams',
    targetId: 'btn-streams',
    title: '📡 Стріми',
    description: 'У розділі СТРІМИ ти можеш дивитись і самостійно транслювати свій геймплей напряму в SYNCORA.',
    icon: '🎥',
    position: 'right',
    arrowSide: 'left',
  },
  {
    id: 'blog',
    targetId: 'btn-blog',
    title: '📖 Блог',
    description: 'БЛОГ — місце для довгих статей, гайдів і думок. Заведи власний блог і стань впізнаваним у спільноті!',
    icon: '✍️',
    position: 'right',
    arrowSide: 'left',
  },
];

// ─────────────────────────────────────────────
// QUIZ — ПИТАННЯ ДЛЯ ОНБОРДИНГУ
// ─────────────────────────────────────────────
const QUIZ_STEPS = [
  {
    id: 'age',
    question: 'Скільки тобі років?',
    subtitle: 'Ми підберемо людей того ж вікового діапазону',
    icon: '🎂',
    type: 'single',
    options: [
      { label: '12–16 років',  value: '12-16',  emoji: '🧒' },
      { label: '16–18 років',  value: '16-18',  emoji: '🧑' },
      { label: '18+ років',    value: '18+',    emoji: '🧑‍💻' },
    ],
    saveKey: 'age',
  },
  {
    id: 'comm_style',
    question: 'Як ти спілкуєшся під час гри?',
    subtitle: 'Це вплине на підбір команди',
    icon: '🎙️',
    type: 'single',
    options: [
      { label: 'З мікрофоном',      value: 'micro',     emoji: '🎤' },
      { label: 'Без мікрофона',     value: 'microoff',  emoji: '🔇' },
      { label: 'Через Discord',     value: 'discord',   emoji: '💬' },
      { label: 'Через Telegram',    value: 'telegram',  emoji: '📱' },
    ],
    saveKey: 'comm_style',
  },
  {
    id: 'skill_level',
    question: 'Твій стиль гри?',
    subtitle: 'Знайди людей зі схожим рівнем',
    icon: '⚔️',
    type: 'single',
    options: [
      { label: 'Шутери',            value: 'shooter',  emoji: '🔫' },
      { label: 'MOBA / стратегії',  value: 'moba',     emoji: '🗺️' },
      { label: 'Профі / рейтинг',  value: 'profi',    emoji: '🏆' },
      { label: 'Казуальні ігри',   value: 'casual',   emoji: '🎈' },
    ],
    saveKey: 'skill_level',
  },
  {
    id: 'language',
    question: 'Якою мовою спілкуєшся?',
    subtitle: 'Щоб знаходити людей, які тебе розуміють',
    icon: '🌍',
    type: 'single',
    options: [
      { label: 'Українська',  value: 'yes',  emoji: '🇺🇦' },
      { label: 'English',     value: 'no',   emoji: '🇺🇸' },
    ],
    saveKey: 'language',
  },
  {
    id: 'games',
    question: 'В які ігри ти граєш?',
    subtitle: 'Обери одну або кілька (можна пропустити)',
    icon: '🎮',
    type: 'multi',
    options: [
      { label: 'Roblox',          value: 'Roblox',          emoji: '🟥' },
      { label: 'Valorant',        value: 'Valorant',        emoji: '⚡' },
      { label: 'Minecraft',       value: 'Minecraft',       emoji: '⛏️' },
      { label: 'CS2',             value: 'CS2',             emoji: '🔫' },
      { label: 'Fortnite',        value: 'Fortnite',        emoji: '🏗️' },
      { label: 'League of Legends', value: 'League of Legends', emoji: '🌟' },
      { label: 'Dota 2',          value: 'Dota 2',          emoji: '🧙' },
      { label: 'Among Us',        value: 'Among Us',        emoji: '🚀' },
    ],
    saveKey: 'games',
    allowSkip: true,
  },
];

// ─────────────────────────────────────────────
// HELPERS — localStorage + DB
// ─────────────────────────────────────────────

// 🛡️ Безпечні обгортки: Tracking Prevention може блокувати localStorage
// (саме це видно в консолі: "Tracking Prevention blocked access to storage").
// Без try/catch будь-який виклик кидає помилку і ламає весь tutorial.js.
function safeGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); } catch (e) {}
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

function tutorialDone()     { return safeGet('syncora_tutorial_done') === '1'; }

// Зберігаємо в БД і ПЕРЕВІРЯЄМО відповідь сервера.
// Раніше: fetch().catch(()=>{}) — якщо сесія злетіла і сервер повернув
// success:false, ми цього не бачили → при наступному вході туторіал вискакував знову.
async function markTutorialDone() {
  safeSet('syncora_tutorial_done', '1');
  try {
    const res = await fetch('set_tutorial_done.php', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (!data.success) {
      console.warn('[Tutorial] Сервер не зберіг tutorial_done:', data.reason || data.message);
    }
    return !!data.success;
  } catch (e) {
    console.warn('[Tutorial] Не вдалося зберегти tutorial_done у БД:', e);
    return false;
  }
}
function quizDone()         { return safeGet('syncora_quiz_done') === '1'; }
function markQuizDone()     {
  safeSet('syncora_quiz_done', '1');
  // Дублюємо в БД, щоб квіз не вискакував повторно на іншому пристрої / після чистки localStorage
  fetch('set_quiz_done.php', { method: 'POST', credentials: 'include' }).catch(() => {});
}

// Check tutorial status from DB (for new sessions / different devices)
// 🛡️ Кешуємо результат, щоб не робити два однакові запити при завантаженні
// (раніше maybeShowWelcomeAndStart і checkAndStartTutorial фетчили двічі).
let _tutorialDBCache = null;
async function checkTutorialFromDB(force = false) {
  if (_tutorialDBCache !== null && !force) return _tutorialDBCache;
  try {
    const res = await fetch('get_tutorial_status.php', { credentials: 'include' });
    const data = await res.json();
    if (data.success && data.quiz_done) {
      safeSet('syncora_quiz_done', '1');
    }
    if (data.success && data.tutorial_done) {
      safeSet('syncora_tutorial_done', '1');
      _tutorialDBCache = true;
      return true;
    }
    // Якщо сесії немає або БД тимчасово впала — це НЕ означає "туторіал не пройдено",
    // просто не можемо перевірити. Не чіпаємо локальний прапорець і НЕ показуємо туторіал.
    if (data.reason === 'no_session' || data.reason === 'db_error') {
      _tutorialDBCache = tutorialDone();
      return _tutorialDBCache;
    }
    if (data.success && data.quiz_done) {
      safeSet('syncora_quiz_done', '1');
    }
  } catch (e) {
    console.error('[Tutorial] checkTutorialFromDB error:', e);
    // Мережа впала — довіряємо локальному прапорцю, щоб не показувати повторно
    _tutorialDBCache = tutorialDone();
    return _tutorialDBCache;
  }
  _tutorialDBCache = false;
  return false;
}

function getTargetEl(step) {
  let el = step.targetId ? document.getElementById(step.targetId) : null;
  if (!el && step.fallbackSelector) el = document.querySelector(step.fallbackSelector);
  return el;
}

// ─────────────────────────────────────────────
// INJECT CSS
// ─────────────────────────────────────────────
(function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* ══════════ WELCOME SCREEN ══════════ */
    #syncora-welcome-screen {
      position: fixed; inset: 0;
      background: #000;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 16px;
      font-family: 'Geologica', sans-serif;
      animation: sw-fadein 0.6s ease forwards;
    }
    @keyframes sw-fadein {
      from { opacity: 0; } to { opacity: 1; }
    }
    @keyframes sw-fadeout {
      from { opacity: 1; } to { opacity: 0; }
    }
    .sw-logo {
      width: 80px;
      opacity: 0;
      animation: sw-logo-in 0.8s 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
      filter: drop-shadow(0 0 24px rgba(240,4,127,0.7));
    }
    @keyframes sw-logo-in {
      from { opacity: 0; transform: scale(0.7) translateY(20px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .sw-greeting {
      font-size: 22px; font-weight: 800;
      color: rgba(255,255,255,0);
      animation: sw-text-in 0.7s 0.8s ease forwards;
      letter-spacing: 0.01em;
      text-align: center;
    }
    .sw-greeting span { color: #f0047f; }
    @keyframes sw-text-in {
      from { opacity: 0; transform: translateY(10px); color: rgba(255,255,255,0); }
      to   { opacity: 1; transform: translateY(0);    color: rgba(255,255,255,1); }
    }
    .sw-sub {
      font-size: 14px;
      color: rgba(255,255,255,0);
      animation: sw-sub-in 0.6s 1.2s ease forwards;
      text-align: center;
    }
    @keyframes sw-sub-in {
      from { opacity: 0; } to { color: rgba(255,255,255,0.4); opacity: 1; }
    }

    /* ══════════ TUTORIAL OVERLAY ══════════ */
    #syncora-tutorial-overlay {
      position: fixed; inset: 0;
      background: transparent;
      pointer-events: none;
      z-index: 99990;
      font-family: 'Geologica', sans-serif;
    }

    #syncora-spotlight {
      position: fixed;
      border-radius: 16px;
      box-shadow:
        0 0 0 6px rgba(240, 4, 127, 0.55),
        0 0 0 9999px rgba(10, 0, 8, 0.78);
      pointer-events: none;
      z-index: 99991;
      transition: all 0.45s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .syt-tooltip {
      position: fixed;
      z-index: 99995;
      width: 310px;
      background: rgba(16, 4, 13, 0.92);
      border: 1px solid rgba(240, 4, 127, 0.45);
      border-radius: 20px;
      padding: 22px 20px 18px;
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.04),
        0 8px 32px rgba(0,0,0,0.7),
        0 0 60px rgba(240,4,127,0.12);
      pointer-events: all;
      animation: syt-enter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    @keyframes syt-enter {
      from { opacity: 0; transform: scale(0.88) translateY(10px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .syt-tooltip::before {
      content: '';
      position: absolute;
      width: 14px; height: 14px;
      background: rgba(16, 4, 13, 0.92);
      border: 1px solid rgba(240, 4, 127, 0.45);
      transform: rotate(45deg);
    }
    .syt-tooltip.arrow-top::before    { top: -8px;    left: 28px; border-bottom: none; border-right: none; }
    .syt-tooltip.arrow-bottom::before { bottom: -8px; left: 28px; border-top: none; border-left: none; }
    .syt-tooltip.arrow-left::before   { left: -8px;   top: 28px;  border-top: none; border-right: none; }
    .syt-tooltip.arrow-right::before  { right: -8px;  top: 28px;  border-bottom: none; border-left: none; }

    .syt-icon {
      font-size: 32px; display: block; margin-bottom: 10px;
      animation: syt-bounce 2.5s ease-in-out infinite;
    }
    @keyframes syt-bounce {
      0%,100% { transform: translateY(0); }
      50%      { transform: translateY(-5px); }
    }
    .syt-title {
      font-size: 15px; font-weight: 700; color: #fff;
      margin-bottom: 8px; letter-spacing: 0.01em;
    }
    .syt-desc {
      font-size: 13px; font-weight: 400;
      color: rgba(255,255,255,0.72);
      line-height: 1.55; margin-bottom: 18px;
    }
    .syt-footer {
      display: flex; align-items: center; justify-content: space-between;
    }
    .syt-dots { display: flex; gap: 6px; align-items: center; }
    .syt-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: rgba(240,4,127,0.3); transition: all 0.3s;
    }
    .syt-dot.active {
      background: #f0047f; width: 20px; border-radius: 4px;
      box-shadow: 0 0 8px rgba(240,4,127,0.7);
    }
    .syt-btn-skip {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,0.35); font-size: 12px;
      font-family: 'Geologica', sans-serif;
      padding: 4px 8px; border-radius: 6px; transition: color 0.2s;
    }
    .syt-btn-skip:hover { color: rgba(255,255,255,0.7); }
    .syt-btn-next {
      background: linear-gradient(135deg, #f0047f, #c7005a);
      border: none; cursor: pointer; color: #fff;
      font-size: 13px; font-weight: 700;
      font-family: 'Geologica', sans-serif;
      padding: 9px 22px; border-radius: 12px;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 16px rgba(240,4,127,0.4);
      display: flex; align-items: center; gap: 7px;
    }
    .syt-btn-next:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(240,4,127,0.6); }
    .syt-btn-next svg { width:14px; height:14px; }

    /* ══════════ QUIZ MODAL ══════════ */
    #syncora-quiz-backdrop {
      position: fixed; inset: 0;
      background: rgba(10, 0, 8, 0.88);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      z-index: 99998;
      display: flex; align-items: center; justify-content: center;
      animation: sqb-in 0.4s ease forwards;
      font-family: 'Geologica', sans-serif;
    }
    @keyframes sqb-in { from { opacity: 0; } to { opacity: 1; } }

    #syncora-quiz-card {
      position: relative; width: min(480px, 92vw);
      background: rgba(16, 4, 13, 0.95);
      border: 1px solid rgba(240, 4, 127, 0.35);
      border-radius: 28px; padding: 36px 32px 28px;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.8), 0 0 80px rgba(240,4,127,0.1);
      animation: sqc-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      overflow: hidden;
    }
    #syncora-quiz-card::before {
      content: ''; position: absolute;
      width: 200px; height: 200px; background: #f0047f;
      border-radius: 50%; filter: blur(90px); opacity: 0.08;
      top: -60px; right: -40px; pointer-events: none;
    }
    @keyframes sqc-in {
      from { opacity: 0; transform: scale(0.9) translateY(20px); }
      to   { opacity: 1; transform: scale(1)   translateY(0); }
    }

    .sqz-progress-bar-wrap {
      height: 3px; border-radius: 2px;
      background: rgba(255,255,255,0.08);
      margin-bottom: 28px; overflow: hidden;
    }
    .sqz-progress-bar {
      height: 100%; border-radius: 2px;
      background: linear-gradient(90deg, #f0047f, #ff70c2);
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 8px rgba(240,4,127,0.6);
    }
    .sqz-icon { font-size: 42px; display: block; margin-bottom: 14px; }
    .sqz-question { font-size: 21px; font-weight: 700; color: #fff; margin-bottom: 6px; line-height: 1.25; }
    .sqz-subtitle { font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 24px; line-height: 1.4; }
    .sqz-options {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 10px; margin-bottom: 28px;
    }
    .sqz-option {
      display: flex; align-items: center; gap: 10px;
      padding: 13px 16px; border-radius: 14px;
      border: 1.5px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.04);
      cursor: pointer; transition: all 0.2s ease;
      font-size: 14px; font-weight: 600;
      color: rgba(255,255,255,0.75); user-select: none;
    }
    .sqz-option:hover {
      border-color: rgba(240,4,127,0.5);
      background: rgba(240,4,127,0.08); color: #fff; transform: translateY(-1px);
    }
    .sqz-option.selected {
      border-color: #f0047f; background: rgba(240,4,127,0.14); color: #fff;
      box-shadow: 0 0 18px rgba(240,4,127,0.2), inset 0 0 0 1px rgba(240,4,127,0.3);
    }
    .sqz-option .sqz-emoji { font-size: 20px; }
    .sqz-footer { display: flex; align-items: center; justify-content: space-between; }
    .sqz-step-label { font-size: 12px; color: rgba(255,255,255,0.3); font-weight: 600; letter-spacing: 0.05em; }
    .sqz-btn-wrap { display: flex; gap: 10px; }
    .sqz-btn { border: none; cursor: pointer; font-family: 'Geologica', sans-serif; font-weight: 700; font-size: 13px; border-radius: 12px; padding: 10px 22px; transition: all 0.18s ease; }
    .sqz-btn-skip { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.45); }
    .sqz-btn-skip:hover { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); }
    .sqz-btn-next {
      background: linear-gradient(135deg, #f0047f, #c7005a); color: #fff;
      box-shadow: 0 4px 16px rgba(240,4,127,0.4);
      display: flex; align-items: center; gap: 8px;
    }
    .sqz-btn-next:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(240,4,127,0.55); }
    .sqz-btn-next:disabled { opacity: 0.4; transform: none; cursor: not-allowed; box-shadow: none; }

    #syncora-quiz-prompt {
      position: fixed; inset: 0;
      background: rgba(10, 0, 8, 0.88);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      z-index: 99998;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Geologica', sans-serif;
      animation: sqb-in 0.4s ease forwards;
    }
    #syncora-quiz-prompt-card {
      width: min(440px, 92vw);
      background: rgba(16, 4, 13, 0.96);
      border: 1px solid rgba(240, 4, 127, 0.35);
      border-radius: 28px; padding: 40px 32px 32px;
      text-align: center;
      box-shadow: 0 24px 64px rgba(0,0,0,0.8), 0 0 80px rgba(240,4,127,0.1);
      position: relative; overflow: hidden;
      animation: sqc-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    #syncora-quiz-prompt-card::before {
      content: ''; position: absolute;
      width: 250px; height: 250px; background: #f0047f;
      border-radius: 50%; filter: blur(110px); opacity: 0.1;
      bottom: -80px; left: -60px; pointer-events: none;
    }
    .sqp-emoji { font-size: 52px; display: block; margin-bottom: 18px; animation: syt-bounce 2.5s ease-in-out infinite; }
    .sqp-title { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 10px; }
    .sqp-desc { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 32px; max-width: 360px; margin-left: auto; margin-right: auto; }
    .sqp-desc b { color: #f0047f; }
    .sqp-buttons { display: flex; flex-direction: column; gap: 12px; }
    .sqp-btn-yes {
      background: linear-gradient(135deg, #f0047f, #c7005a);
      color: #fff; font-weight: 700; font-size: 15px;
      border: none; border-radius: 16px; padding: 15px 28px;
      cursor: pointer; font-family: 'Geologica', sans-serif;
      box-shadow: 0 6px 22px rgba(240,4,127,0.45);
      transition: all 0.2s ease;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .sqp-btn-yes:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(240,4,127,0.6); }
    .sqp-btn-no {
      background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.45); font-weight: 600; font-size: 14px;
      border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 13px 28px;
      cursor: pointer; font-family: 'Geologica', sans-serif; transition: all 0.2s ease;
    }
    .sqp-btn-no:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }

    .sqz-final { text-align: center; padding: 12px 0; }
    .sqz-final-emoji { font-size: 56px; display: block; margin-bottom: 18px; }
    .sqz-final-title { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 10px; }
    .sqz-final-desc { font-size: 14px; color: rgba(255,255,255,0.55); line-height: 1.6; margin-bottom: 28px; }
    .sqz-final-desc b { color: #f0047f; }
    .sqz-btn-done {
      background: linear-gradient(135deg, #f0047f, #c7005a); color: #fff;
      font-weight: 700; font-size: 15px; border: none; border-radius: 16px; padding: 14px 36px;
      cursor: pointer; font-family: 'Geologica', sans-serif;
      box-shadow: 0 6px 22px rgba(240,4,127,0.45); transition: all 0.2s ease;
    }
    .sqz-btn-done:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(240,4,127,0.6); }
  `;
  document.head.appendChild(style);
})();

// ─────────────────────────────────────────────
// WELCOME SCREEN (after login/register)
// ─────────────────────────────────────────────
function showWelcomeScreen(username, callback) {
  const screen = document.createElement('div');
  screen.id = 'syncora-welcome-screen';

  const logoSrc = document.querySelector('.header-logo')?.src || 'img/logo.png';

  screen.innerHTML = `
    <img class="sw-logo" src="${logoSrc}" alt="Syncora">
    <div class="sw-greeting">Ласкаво просимо до SYNCORA,<br><span>@${username}</span>!</div>
    <div class="sw-sub">Твій ігровий простір вже чекає тебе ✨</div>
  `;
  document.body.appendChild(screen);

  // After 2.5s — fade out and call callback
  setTimeout(() => {
    screen.style.animation = 'sw-fadeout 0.7s ease forwards';
    setTimeout(() => {
      screen.remove();
      if (typeof callback === 'function') callback();
    }, 700);
  }, 2500);
}

// ─────────────────────────────────────────────
// TUTORIAL ENGINE
// ─────────────────────────────────────────────
let currentStep = 0;
let tutorialOverlay = null;
let spotlight = null;
let tooltip = null;

function buildTutorialDOM() {
  tutorialOverlay = document.createElement('div');
  tutorialOverlay.id = 'syncora-tutorial-overlay';

  spotlight = document.createElement('div');
  spotlight.id = 'syncora-spotlight';

  document.body.appendChild(tutorialOverlay);
  document.body.appendChild(spotlight);
}

function positionSpotlight(el) {
  const r = el.getBoundingClientRect();
  const pad = 10;
  spotlight.style.left   = (r.left   - pad) + 'px';
  spotlight.style.top    = (r.top    - pad) + 'px';
  spotlight.style.width  = (r.width  + pad*2) + 'px';
  spotlight.style.height = (r.height + pad*2) + 'px';
}

function positionTooltip(el, step) {
  if (tooltip) tooltip.remove();

  tooltip = document.createElement('div');
  tooltip.className = `syt-tooltip arrow-${step.arrowSide}`;

  tooltip.innerHTML = `
    <span class="syt-icon">${step.icon}</span>
    <div class="syt-title">${step.title}</div>
    <div class="syt-desc">${step.description}</div>
    <div class="syt-footer">
      <div class="syt-dots">${TUTORIAL_STEPS.map((_, i) => `<div class="syt-dot${i === currentStep ? ' active' : ''}"></div>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:center;">
        <button class="syt-btn-skip" onclick="skipTutorial()">Пропустити</button>
        <button class="syt-btn-next" onclick="nextTutorialStep()">
          ${currentStep === TUTORIAL_STEPS.length - 1 ? 'Завершити' : 'Далі'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(tooltip);

  const r = el.getBoundingClientRect();
  const tw = 310, th = tooltip.offsetHeight || 160;
  const margin = 20;
  let left, top;

  if (step.position === 'bottom') {
    left = r.left + r.width / 2 - tw / 2;
    top  = r.bottom + margin;
  } else if (step.position === 'top') {
    left = r.left + r.width / 2 - tw / 2;
    top  = r.top - th - margin;
  } else if (step.position === 'right') {
    left = r.right + margin;
    top  = r.top + r.height / 2 - th / 2;
  } else {
    left = r.left - tw - margin;
    top  = r.top + r.height / 2 - th / 2;
  }

  left = Math.max(12, Math.min(left, window.innerWidth  - tw - 12));
  top  = Math.max(12, Math.min(top,  window.innerHeight - th - 12));

  tooltip.style.left = left + 'px';
  tooltip.style.top  = top  + 'px';
}

function isElementVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  return true;
}

function showTutorialStep(index) {
  const step = TUTORIAL_STEPS[index];
  const el = getTargetEl(step);

  if (!el || !isElementVisible(el)) {
    console.warn(`[Tutorial] Step "${step.id}" — element not visible/found, skipping. targetId: ${step.targetId}`);
    if (index < TUTORIAL_STEPS.length - 1) {
      currentStep++;
      showTutorialStep(currentStep);
    } else {
      finishTutorial();
    }
    return;
  }

  console.log(`[Tutorial] Showing step ${index}: "${step.title}"`);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    positionSpotlight(el);
    positionTooltip(el, step);
  }, 350);
}

window.nextTutorialStep = function () {
  if (currentStep < TUTORIAL_STEPS.length - 1) {
    currentStep++;
    showTutorialStep(currentStep);
  } else {
    finishTutorial();
  }
};

window.skipTutorial = function () {
  finishTutorial();
};

function cleanupTutorialDOM() {
  if (spotlight)       { spotlight.remove();       spotlight = null; }
  if (tooltip)         { tooltip.remove();         tooltip = null; }
  if (tutorialOverlay) { tutorialOverlay.remove(); tutorialOverlay = null; }
  // Also remove any lingering tutorial-related elements
  document.querySelectorAll('.syt-tooltip, #syncora-spotlight, #syncora-tutorial-overlay').forEach(el => el.remove());
}

function finishTutorial() {
  markTutorialDone();
  cleanupTutorialDOM();

  if (!quizDone()) {
    setTimeout(showQuizPrompt, 400);
  }
}

function startTutorial() {
  cleanupTutorialDOM(); // Clean before starting
  buildTutorialDOM();
  currentStep = 0;
  showTutorialStep(0);
}

// ─────────────────────────────────────────────
// QUIZ PROMPT (after tutorial)
// ─────────────────────────────────────────────
function showQuizPrompt() {
  const backdrop = document.createElement('div');
  backdrop.id = 'syncora-quiz-prompt';
  backdrop.innerHTML = `
    <div id="syncora-quiz-prompt-card">
      <span class="sqp-emoji">🎯</span>
      <div class="sqp-title">Пройди швидкий тест!</div>
      <div class="sqp-desc">
        Відповідай на питання — і SYNCORA <b>автоматично налаштує</b> фільтри
        та вибір ігор під тебе. Займе лише <b>хвилину</b>!
      </div>
      <div class="sqp-buttons">
        <button class="sqp-btn-yes" onclick="startQuiz()">🚀 Пройти тест</button>
        <button class="sqp-btn-no" onclick="declineQuiz()">Може пізніше</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
}

window.declineQuiz = function () {
  markQuizDone();
  const el = document.getElementById('syncora-quiz-prompt');
  if (el) el.remove();

  // Выдаем 100 коинсов при пропуске
  if (typeof window.triggerTutorialReward === 'function') {
      window.triggerTutorialReward();
  }
};

// ─────────────────────────────────────────────
// QUIZ ENGINE
// ─────────────────────────────────────────────
let quizAnswers = {};
let quizStep = 0;
let quizBackdrop = null;
let quizCard = null;

window.startQuiz = function () {
  const prompt = document.getElementById('syncora-quiz-prompt');
  if (prompt) prompt.remove();
  quizAnswers = {};
  quizStep = 0;
  renderQuiz();
};

function renderQuiz() {
  if (quizBackdrop) quizBackdrop.remove();
  quizBackdrop = document.createElement('div');
  quizBackdrop.id = 'syncora-quiz-backdrop';
  quizCard = document.createElement('div');
  quizCard.id = 'syncora-quiz-card';
  quizBackdrop.appendChild(quizCard);
  document.body.appendChild(quizBackdrop);
  renderQuizStep();
}

function renderQuizStep() {
  const step = QUIZ_STEPS[quizStep];
  const pct  = Math.round(((quizStep) / QUIZ_STEPS.length) * 100);
  const selected = quizAnswers[step.id] || (step.type === 'multi' ? [] : null);
  const isMulti  = step.type === 'multi';

  quizCard.innerHTML = `
    <div class="sqz-progress-bar-wrap">
      <div class="sqz-progress-bar" style="width:${pct}%"></div>
    </div>
    <span class="sqz-icon">${step.icon}</span>
    <div class="sqz-question">${step.question}</div>
    <div class="sqz-subtitle">${step.subtitle}</div>
    <div class="sqz-options">
      ${step.options.map(opt => `
        <div class="sqz-option${isMulti ? (selected.includes(opt.value) ? ' selected' : '') : (selected === opt.value ? ' selected' : '')}"
          data-value="${opt.value}"
          onclick="quizSelectOption(this, '${step.id}', '${opt.value}', ${isMulti})">
          <span class="sqz-emoji">${opt.emoji}</span>
          <span>${opt.label}</span>
        </div>
      `).join('')}
    </div>
    <div class="sqz-footer">
      <span class="sqz-step-label">${quizStep + 1} / ${QUIZ_STEPS.length}</span>
      <div class="sqz-btn-wrap">
        ${step.allowSkip ? `<button class="sqz-btn sqz-btn-skip" onclick="quizSkipStep()">Пропустити</button>` : ''}
        <button class="sqz-btn sqz-btn-next"
          id="sqz-next-btn"
          ${(!isMulti && !selected) ? 'disabled' : ''}
          onclick="quizNextStep()">
          ${quizStep === QUIZ_STEPS.length - 1 ? 'Готово ✓' : 'Далі →'}
        </button>
      </div>
    </div>
  `;
}

window.quizSelectOption = function (el, stepId, value, isMulti) {
  if (isMulti) {
    let arr = quizAnswers[stepId] || [];
    if (arr.includes(value)) {
      arr = arr.filter(v => v !== value);
      el.classList.remove('selected');
    } else {
      arr.push(value);
      el.classList.add('selected');
    }
    quizAnswers[stepId] = arr;
  } else {
    quizAnswers[stepId] = value;
    document.querySelectorAll('#syncora-quiz-card .sqz-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    const btn = document.getElementById('sqz-next-btn');
    if (btn) btn.disabled = false;
  }
};

window.quizSkipStep = function () { quizNextStep(true); };

window.quizNextStep = function (skip = false) {
  if (!skip) {
    const step = QUIZ_STEPS[quizStep];
    const val = quizAnswers[step.id];
    if (!val || (Array.isArray(val) && val.length === 0 && !step.allowSkip)) return;
  }
  if (quizStep < QUIZ_STEPS.length - 1) {
    quizStep++;
    quizCard.style.transition = 'opacity 0.2s, transform 0.2s';
    quizCard.style.opacity = '0';
    quizCard.style.transform = 'scale(0.96)';
    setTimeout(() => {
      quizCard.style.opacity = '';
      quizCard.style.transform = '';
      quizCard.style.transition = '';
      renderQuizStep();
    }, 220);
  } else {
    saveQuizAndFinish();
  }
};

async function saveQuizAndFinish() {
  markQuizDone();
  quizCard.innerHTML = `
    <div class="sqz-final">
      <span class="sqz-final-emoji">⚡</span>
      <div class="sqz-final-title">Зберігаємо...</div>
      <div class="sqz-final-desc">Налаштовуємо SYNCORA під тебе</div>
    </div>
  `;

  const { games, age, comm_style, skill_level, language } = quizAnswers;
  try {
    const filterPayload = {
      age:         age         || 'any',
      comm_style:  comm_style  || 'any',
      skill_level: skill_level || 'any',
      language:    language    || 'any',
    };
    await fetch('save_filters.php', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filterPayload),
    });
    if (games && games.length) {
      await Promise.all(games.map(gameName =>
        fetch('save_user_game.php', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', game_name: gameName }),
        })
      ));
    }
    quizCard.innerHTML = `
      <div class="sqz-final">
        <span class="sqz-final-emoji">🎉</span>
        <div class="sqz-final-title">Все готово!</div>
        <div class="sqz-final-desc">
          SYNCORA налаштовано під тебе.<br>
          <b>Фільтри та ігри</b> збережено автоматично!
        </div>
        <button class="sqz-btn-done" onclick="closeQuiz()">Почати 🚀</button>
      </div>
    `;
    if (typeof loadUserFilters === 'function') setTimeout(loadUserFilters, 800);
    if (typeof loadUserGamesUI === 'function') setTimeout(loadUserGamesUI, 800);
  } catch (e) {
    quizCard.innerHTML = `
      <div class="sqz-final">
        <span class="sqz-final-emoji">✅</span>
        <div class="sqz-final-title">Готово!</div>
        <div class="sqz-final-desc">Налаштування збережено локально.</div>
        <button class="sqz-btn-done" onclick="closeQuiz()">Почати</button>
      </div>
    `;
  }
}

window.closeQuiz = function () {
  if (quizBackdrop) {
    quizBackdrop.style.animation = 'sqb-in 0.3s ease reverse forwards';
    setTimeout(() => { 
        if (quizBackdrop) quizBackdrop.remove(); 
        quizBackdrop = null; 
    }, 320);
  }

  // Выдаем 100 коинсов после успешного прохождения
  if (typeof window.triggerTutorialReward === 'function') {
      window.triggerTutorialReward();
  }
};

// ─────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────
async function checkAndStartTutorial() {
  const dbDone = await checkTutorialFromDB();

  if (dbDone) {
    // Уже пройдено — тільки перевіряємо квіз
    if (!quizDone()) setTimeout(showQuizPrompt, 1200);
    return;
  }

  // 🛡️ ГОЛОВНИЙ ФІКС повторного показу:
  // Якщо локально позначено "пройдено", але БД каже "ні" —
  // значить, минулого разу запис у БД не вдався (злетіла сесія тощо).
  // НЕ показуємо туторіал знову, а ДОСИЛАЄМО прапорець у БД.
  if (tutorialDone()) {
    console.log('[Tutorial] Локально пройдено, синхронізую з БД...');
    markTutorialDone(); // повторна спроба зберегти в БД
    if (!quizDone()) setTimeout(showQuizPrompt, 1200);
    return;
  }

  console.log('[Tutorial] Starting...');
  startTutorial();
}

// Show welcome screen then run tutorial.
// Welcome screen only shows for brand-new registrations.
// Falls back gracefully if sessionStorage is blocked (Tracking Prevention).
function maybeShowWelcomeAndStart() {
  const username = safeGet('user_name') || 'Гравець';

  // Try to read sessionStorage (may be blocked by Tracking Prevention)
  let isNewRegistration = false;
  try {
    isNewRegistration = sessionStorage.getItem('syncora_new_login') === '1';
    if (isNewRegistration) sessionStorage.removeItem('syncora_new_login');
  } catch (e) {
    isNewRegistration = false;
  }

  if (isNewRegistration) {
    // Brand new registration: show welcome screen then tutorial
    showWelcomeScreen(username, checkAndStartTutorial);
    return;
  }

  // Returning user: один запит до БД (результат кешується),
  // далі checkAndStartTutorial використає кеш — без подвійного фетчу.
  checkTutorialFromDB().then(dbDone => {
    if (dbDone || tutorialDone()) {
      if (dbDone === false && tutorialDone()) markTutorialDone(); // досилаємо в БД
      if (!quizDone()) setTimeout(showQuizPrompt, 1200);
    } else {
      showWelcomeScreen(username, checkAndStartTutorial);
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const isLoggedIn = safeGet('user_name') || document.cookie.includes('PHPSESSID');
  if (!isLoggedIn) {
    // Wait for page to render avatar before starting
    setTimeout(() => {
      const avatar = document.getElementById('top-bar-avatar');
      if (avatar) maybeShowWelcomeAndStart();
    }, 2000);
    return;
  }
  maybeShowWelcomeAndStart();
});

window.triggerTutorialReward = function() {
    console.log("🪙 Функция triggerTutorialReward успешно вызвана!");

    fetch('add_tutorial_coins.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            if (data.already_rewarded) {
                console.log("ℹ️ Награда за туториал уже была получена ранее.");
                return;
            }
            console.log(`✅ Коины начислены в БД! +${data.added} | Баланс: ${data.new_balance}`);

            // Обновляем счётчик в топ-баре
            const topBarCoins = document.getElementById('top-bar-coins');
            if (topBarCoins) topBarCoins.textContent = Number(data.new_balance).toLocaleString();

            // Обновляем глобальную переменную
            window.currentUserCoins = data.new_balance;

            // Показываем модальное окно награды
            const rewardModal = document.getElementById('coin-reward-modal');
            if (rewardModal) rewardModal.style.display = 'flex';

            // Анимация монет
            createPremiumCoinExplosion();
        } else {
            console.warn("⚠️ Предупреждение от бэкенда:", data.message);
        }
    })
    .catch(err => console.error("❌ Ошибка при начислении коинов:", err));
};

// Вспомогательная функция для генерации частиц монет
function createPremiumCoinExplosion() {
    const coinCount = 18; // Количество монеток во взрыве
    const container = document.body;

    // Динамически добавляем стили для неонового свечения, если их еще нет
    if (!document.getElementById('neon-coin-styles')) {
        const style = document.createElement('style');
        style.id = 'neon-coin-styles';
        style.innerHTML = `
            @keyframes coinExplode {
                0% {
                    transform: translate(-50%, -50%) scale(0);
                    opacity: 0;
                }
                15% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1.3) translate(var(--mx), var(--my));
                }
                45% {
                    transform: translate(-50%, -50%) scale(1) translate(var(--mx), var(--my));
                    opacity: 1;
                }
                100% {
                    transform: translate(-50%, -50%) scale(0.7) translate(var(--tx), var(--ty));
                    opacity: 0;
                }
            }
            .syncora-neon-coin {
                position: fixed;
                top: 50%;
                left: 50%;
                width: 32px;
                height: 32px;
                background: radial-gradient(circle, #ffe600 30%, #f0047f 100%);
                border: 2px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 0 12px #f0047f, 0 0 25px #ffe600, inset 0 0 4px rgba(255,255,255,0.8);
                z-index: 100000;
                pointer-events: none;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Geologica', sans-serif;
                font-weight: 800;
                color: #ffffff;
                font-size: 15px;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            }
        `;
        document.head.appendChild(style);
    }

    // Генерируем монетки вокруг центра экрана
    for (let i = 0; i < coinCount; i++) {
        const coin = document.createElement('div');
        coin.className = 'syncora-neon-coin';
        coin.innerText = '₪'; // Красивый футуристичный знак коина (можно заменить на $ или 🪙)

        // Вычисляем случайный радиус взрыва (куда монетка отлетит сначала)
        const angle = Math.random() * Math.PI * 2;
        const distance = 90 + Math.random() * 110;
        const mx = Math.cos(angle) * distance + 'px';
        const my = Math.sin(angle) * distance + 'px';

        // Куда монетка полетит в финале (улетает наверх к профилю/шапке)
        const tx = (Math.cos(angle) * distance * 0.4) + 'px';
        const ty = '-85vh'; // Наверх за пределы экрана

        coin.style.setProperty('--mx', mx);
        coin.style.setProperty('--my', my);
        coin.style.setProperty('--tx', tx);
        coin.style.setProperty('--ty', ty);

        // Добавляем случайную задержку анимации для реалистичности рассыпчатости
        coin.style.animation = `coinExplode 1.6s cubic-bezier(0.25, 1, 0.5, 1) forwards`;
        coin.style.animationDelay = (Math.random() * 0.25) + 's';

        container.appendChild(coin);

        // Чистим DOM после завершения анимации
        setTimeout(() => {
            coin.remove();
        }, 2000);
    }
}