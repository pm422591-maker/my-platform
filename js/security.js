// security.js — логіка вкладки "Безпека": зміна пароля, 2FA (4-значний PIN), сесії.

// ── Утиліти модалок ─────────────────────────────────────────
function openSecModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}
function closeSecModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

// Закриття по кліку на фон
document.addEventListener('click', function (e) {
  if (e.target.classList && e.target.classList.contains('sec-modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ── ЗМІНА ПАРОЛЯ ────────────────────────────────────────────
function openPasswordModal() {
  document.getElementById('sec-new-password').value = '';
  document.getElementById('sec-new-password2').value = '';
  setSecMsg('sec-password-msg', '', '');
  const btn = document.getElementById('sec-password-submit');
  btn.disabled = false;
  btn.textContent = 'Надіслати лист підтвердження';
  openSecModal('sec-password-modal');
}

async function requestPasswordChange() {
  const p1 = document.getElementById('sec-new-password').value;
  const p2 = document.getElementById('sec-new-password2').value;

  if (p1.length < 6) { return setSecMsg('sec-password-msg', 'Пароль має містити щонайменше 6 символів.', 'error'); }
  if (p1 !== p2)     { return setSecMsg('sec-password-msg', 'Паролі не співпадають.', 'error'); }

  const btn = document.getElementById('sec-password-submit');
  btn.disabled = true;
  btn.textContent = 'Надсилаємо...';

  try {
    const res = await fetch('request_password_change.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: p1 })
    });
    const data = await res.json();
    if (data.success) {
      setSecMsg('sec-password-msg', data.message, 'ok');
      btn.textContent = 'Лист надіслано ✓';
    } else {
      setSecMsg('sec-password-msg', data.message || 'Помилка.', 'error');
      btn.disabled = false;
      btn.textContent = 'Надіслати лист підтвердження';
    }
  } catch (err) {
    setSecMsg('sec-password-msg', 'Помилка зв\'язку з сервером.', 'error');
    btn.disabled = false;
    btn.textContent = 'Надіслати лист підтвердження';
  }
}

// ── 2FA (4-значний PIN) ─────────────────────────────────────
let twoFaEnabled = false;

function toggle2FA() {
  if (twoFaEnabled) {
    // Вимикаємо
    if (!confirm('Вимкнути двофакторну автентифікацію?')) return;
    fetch('set_2fa.php', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable' })
    }).then(r => r.json()).then(data => {
      if (data.success) { update2FAUi(false); }
      else alert(data.message || 'Помилка');
    });
  } else {
    // Вмикаємо — відкриваємо модалку з PIN
    document.querySelectorAll('.sec-pin-box').forEach(b => b.value = '');
    setSecMsg('sec-2fa-msg', '', '');
    openSecModal('sec-2fa-modal');
    setTimeout(() => { const f = document.querySelector('.sec-pin-box'); if (f) f.focus(); }, 100);
  }
}

// Автоперехід між полями PIN
document.addEventListener('input', function (e) {
  if (!e.target.classList.contains('sec-pin-box')) return;
  e.target.value = e.target.value.replace(/\D/g, '');
  if (e.target.value) {
    const next = e.target.nextElementSibling;
    if (next && next.classList.contains('sec-pin-box')) next.focus();
  }
});
document.addEventListener('keydown', function (e) {
  if (!e.target.classList.contains('sec-pin-box')) return;
  if (e.key === 'Backspace' && !e.target.value) {
    const prev = e.target.previousElementSibling;
    if (prev && prev.classList.contains('sec-pin-box')) prev.focus();
  }
});

async function confirm2FA() {
  const boxes = document.querySelectorAll('.sec-pin-box');
  const pin = Array.from(boxes).map(b => b.value).join('');
  if (!/^\d{4}$/.test(pin)) {
    return setSecMsg('sec-2fa-msg', 'Введи рівно 4 цифри.', 'error');
  }
  const btn = document.getElementById('sec-2fa-submit');
  btn.disabled = true;
  try {
    const res = await fetch('set_2fa.php', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enable', pin })
    });
    const data = await res.json();
    if (data.success) {
      update2FAUi(true);
      closeSecModal('sec-2fa-modal');
    } else {
      setSecMsg('sec-2fa-msg', data.message || 'Помилка.', 'error');
      btn.disabled = false;
    }
  } catch (err) {
    setSecMsg('sec-2fa-msg', 'Помилка зв\'язку.', 'error');
    btn.disabled = false;
  }
}

function update2FAUi(enabled) {
  twoFaEnabled = enabled;
  const dot = document.getElementById('sm-2fa-dot');
  const status = document.getElementById('sm-2fa-status');
  const btn = document.getElementById('sm-2fa-btn');
  if (enabled) {
    dot.className = 'sm-sec-dot on';
    status.textContent = 'Увімкнено';
    status.style.color = '#50ff8c';
    btn.textContent = 'Вимкнути 2FA';
  } else {
    dot.className = 'sm-sec-dot off';
    status.textContent = 'Вимкнено';
    status.style.color = 'rgba(255,255,255,0.3)';
    btn.textContent = 'Увімкнути 2FA';
  }
}

// ── СЕСІЇ ───────────────────────────────────────────────────
let currentDetailSessionId = null;

async function loadSessions() {
  const list = document.getElementById('sm-sessions-list');
  if (!list) return;
  try {
    const res = await fetch('get_sessions.php', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) {
      list.innerHTML = `<div class="sm-field"><div class="sm-field-hint">${data.message || 'Помилка завантаження.'}</div></div>`;
      return;
    }

    update2FAUi(data.two_factor_enabled === true);

    if (!data.sessions.length) {
      list.innerHTML = `<div class="sm-field"><div class="sm-field-hint">Немає активних сесій.</div></div>`;
      return;
    }

    list.innerHTML = data.sessions.map(s => {
      const title = `${escapeHtml(s.os)} · ${escapeHtml(s.browser)}`;
      const hint = s.is_current ? 'Поточна сесія' : escapeHtml(s.location);
      const right = s.is_current
        ? `<span class="sm-session-current-badge">Зараз</span>`
        : `<div class="sm-sec-status"><div class="sm-sec-dot on"></div></div>`;
      return `
        <div class="sm-field sm-session-row" onclick="openSessionDetails(${s.id})">
          <div class="sm-field-label-wrap">
            <div class="sm-field-label">${title}</div>
            <div class="sm-field-hint">${hint}</div>
          </div>
          ${right}
        </div>`;
    }).join('');

    // зберігаємо дані для деталей
    window._secSessions = {};
    data.sessions.forEach(s => { window._secSessions[s.id] = s; });

  } catch (err) {
    list.innerHTML = `<div class="sm-field"><div class="sm-field-hint">Помилка зв'язку.</div></div>`;
  }
}

function openSessionDetails(id) {
  const s = (window._secSessions || {})[id];
  if (!s) return;
  currentDetailSessionId = id;

  const fmt = (d) => d ? new Date(d.replace(' ', 'T')).toLocaleString('uk-UA') : '—';

  document.getElementById('sec-session-details').innerHTML = `
    <div class="sec-detail-row"><span class="sec-detail-key">Пристрій</span><span class="sec-detail-val">${escapeHtml(s.os)} · ${escapeHtml(s.browser)}</span></div>
    <div class="sec-detail-row"><span class="sec-detail-key">Місто</span><span class="sec-detail-val">${escapeHtml(s.city)}</span></div>
    <div class="sec-detail-row"><span class="sec-detail-key">Країна</span><span class="sec-detail-val">${escapeHtml(s.country || '—')}</span></div>
    <div class="sec-detail-row"><span class="sec-detail-key">IP-адреса</span><span class="sec-detail-val">${escapeHtml(s.ip)}</span></div>
    <div class="sec-detail-row"><span class="sec-detail-key">Перший вхід</span><span class="sec-detail-val">${fmt(s.created_at)}</span></div>
    <div class="sec-detail-row"><span class="sec-detail-key">Активність</span><span class="sec-detail-val">${fmt(s.last_active)}</span></div>
  `;

  const delBtn = document.getElementById('sec-session-delete');
  if (s.is_current) {
    delBtn.style.display = 'none';
  } else {
    delBtn.style.display = 'block';
    delBtn.disabled = false;
    delBtn.textContent = 'Завершити сесію';
  }
  openSecModal('sec-session-modal');
}

async function deleteCurrentDetailSession() {
  if (!currentDetailSessionId) return;
  const btn = document.getElementById('sec-session-delete');
  btn.disabled = true;
  btn.textContent = 'Завершуємо...';
  try {
    const res = await fetch('delete_session.php', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: currentDetailSessionId })
    });
    const data = await res.json();
    if (data.success) {
      closeSecModal('sec-session-modal');
      loadSessions();
    } else {
      alert(data.message || 'Помилка');
      btn.disabled = false;
      btn.textContent = 'Завершити сесію';
    }
  } catch (err) {
    alert('Помилка зв\'язку');
    btn.disabled = false;
    btn.textContent = 'Завершити сесію';
  }
}

// ── Допоміжні ───────────────────────────────────────────────
function setSecMsg(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'sec-modal-msg' + (cls ? ' ' + cls : '');
}
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Завантажуємо сесії, коли відкривають вкладку "Безпека"
document.addEventListener('DOMContentLoaded', function () {
  // Якщо вкладка безпеки вже видима — вантажимо одразу
  loadSessions();

  // І перезавантажуємо при перемиканні на вкладку (хук на наявну smSwitchTab)
  if (typeof window.smSwitchTab === 'function') {
    const orig = window.smSwitchTab;
    window.smSwitchTab = function (el, tab) {
      orig.apply(this, arguments);
      if (tab === 'security') loadSessions();
    };
  }
});