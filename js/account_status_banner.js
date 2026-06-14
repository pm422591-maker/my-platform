/* account_status_banner.js
   Показує користувачу банер, якщо його акаунт обмежено або заблоковано,
   та список повідомлень від адміністрації (попередження тощо).
   Підключати на сторінках після логіну: <script src="js/account_status_banner.js"></script> */
(function () {
  'use strict';

  function el(tag, css, html) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html;
    return e;
  }

  async function check() {
    let data;
    try {
      const r = await fetch('get_admin_messages.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });
      data = await r.json();
    } catch (e) { return; }
    if (!data || !data.success) return;

    const status = (data.account && data.account.status) || 'active';

    // ── Банер обмеження / бану ────────────────────────────────────
    if (status === 'banned' || status === 'restricted') {
      const banned = status === 'banned';
      const accent = banned ? '#ff4d6d' : '#ffb020';
      const bg     = banned ? 'rgba(255,77,109,.12)' : 'rgba(255,176,32,.12)';
      let text;
      if (banned) {
        text = 'Ваш обліковий запис заблоковано за порушення правил сайту.';
        if (data.account.ban_reason) text += ' Причина: ' + data.account.ban_reason;
      } else {
        text = 'Ваш обліковий запис тимчасово обмежено.';
        if (data.account.restricted_until) {
          const until = new Date(data.account.restricted_until.replace(' ', 'T'));
          if (!isNaN(until)) text += ' До: ' + until.toLocaleString('uk-UA') + '.';
        }
        text += ' Частина функцій може бути недоступною.';
      }

      const bar = el('div',
        `position:sticky;top:0;z-index:9999;background:${bg};border-bottom:2px solid ${accent};` +
        `color:#fff;padding:12px 18px;font-family:'Inter',system-ui,sans-serif;font-size:14px;` +
        `display:flex;align-items:center;gap:12px;backdrop-filter:blur(6px);`);
      bar.appendChild(el('span',
        `flex-shrink:0;width:26px;height:26px;border-radius:50%;background:${accent};color:#1D1115;` +
        `display:flex;align-items:center;justify-content:center;font-weight:800;`, banned ? '⛔' : '⚠'));
      bar.appendChild(el('span', 'flex:1;', text));
      document.body.insertBefore(bar, document.body.firstChild);
    }

    // ── Спливаюче вікно з непрочитаними повідомленнями адміністрації ─
    const unreadMsgs = (data.messages || []).filter(m => !m.is_read);
    if (unreadMsgs.length) {
      showMessageModal(unreadMsgs[0]); // показуємо найновіше
    }
  }

  function showMessageModal(m) {
    const overlay = el('div',
      'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100000;display:flex;' +
      'align-items:center;justify-content:center;padding:20px;font-family:Inter,system-ui,sans-serif;');
    const box = el('div',
      'background:#26161d;border:1px solid #3d2530;border-radius:16px;max-width:440px;width:100%;' +
      'padding:24px;color:#f6e9f1;box-shadow:0 20px 60px rgba(0,0,0,.5);');
    box.appendChild(el('div',
      'font-weight:800;font-size:17px;margin-bottom:6px;color:#FF25BB;',
      escapeHtml(m.subject || 'Повідомлення від адміністрації')));
    box.appendChild(el('div',
      'font-size:12px;color:#b78aa0;margin-bottom:14px;',
      new Date((m.created_at || '').replace(' ', 'T')).toLocaleString('uk-UA')));
    box.appendChild(el('div',
      'font-size:14px;line-height:1.6;white-space:pre-wrap;background:#2f1b24;border:1px solid #3d2530;' +
      'border-radius:10px;padding:14px;margin-bottom:18px;max-height:300px;overflow:auto;',
      escapeHtml(m.body || '')));
    const btn = el('button',
      'background:linear-gradient(135deg,#F70087,#FF25BB);color:#fff;border:none;border-radius:10px;' +
      'padding:11px 16px;font-weight:700;width:100%;cursor:pointer;font-size:15px;',
      'Зрозуміло');
    btn.onclick = async () => {
      overlay.remove();
      try {
        await fetch('get_admin_messages.php', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'mark_read', message_id: m.id })
        });
      } catch (e) {}
    };
    box.appendChild(btn);
    overlay.appendChild(box);
    overlay.addEventListener('click', e => { if (e.target === overlay) btn.onclick(); });
    document.body.appendChild(overlay);
  }

  function escapeHtml(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  } else {
    check();
  }
})();
