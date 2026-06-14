/* responsive.js — адаптація десктоп-макета під планшети й телефони.
 *
 * Десктоп (>=1200px): нічого не чіпаємо.
 * Планшет (769–1199px): масштабуємо фіксоване "полотно" (~1820px) вниз через
 *   viewport-width, щоб усе вмістилось, зберігаючи піксельні позиції 1:1.
 * Телефон (<=768px): справжній мобільний layout — клас .is-mobile на <html>,
 *   стилі в responsive.css (одна колонка + нижня панель навігації).
 *
 * Скрипт стоїть у <head> і виконується до першого рендеру.
 */
(function () {
  'use strict';

  var CANVAS_WIDTH = 1820;   // ширина дизайнерського полотна
  var DESKTOP_MIN = 1200;    // >= цього — десктоп
  var PHONE_MAX = 768;       // <= цього — телефон (мобільний layout)

  function getViewportMeta() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    return meta;
  }

  function applyViewport() {
    var meta = getViewportMeta();
    var screenW = (window.screen && window.screen.width) ? window.screen.width : window.innerWidth;
    var w = Math.min(screenW, window.innerWidth || screenW);
    var html = document.documentElement;

    if (w <= PHONE_MAX) {
      // Телефон → справжній мобільний CSS, без масштабування.
      // Сторінка може вимкнути мобільний layout (window.NO_MOBILE_LAYOUT = true) —
      // тоді на телефоні теж масштабуємо полотно (як планшет).
      if (window.NO_MOBILE_LAYOUT) {
        var sc = w / CANVAS_WIDTH;
        meta.setAttribute(
          'content',
          'width=' + CANVAS_WIDTH +
          ', initial-scale=' + sc.toFixed(4) +
          ', minimum-scale=' + sc.toFixed(4) +
          ', maximum-scale=5.0, user-scalable=yes'
        );
        html.classList.add('is-compact');
        html.classList.remove('is-mobile');
      } else {
        meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
        html.classList.add('is-mobile');
        html.classList.remove('is-compact');
      }
    } else if (w < DESKTOP_MIN) {
      // Планшет → масштабуємо фіксоване полотно.
      var scale = w / CANVAS_WIDTH;
      meta.setAttribute(
        'content',
        'width=' + CANVAS_WIDTH +
        ', initial-scale=' + scale.toFixed(4) +
        ', minimum-scale=' + scale.toFixed(4) +
        ', maximum-scale=5.0, user-scalable=yes'
      );
      html.classList.add('is-compact');
      html.classList.remove('is-mobile');
    } else {
      // Десктоп.
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0');
      html.classList.remove('is-compact');
      html.classList.remove('is-mobile');
    }
  }

  applyViewport();

  // Будуємо нижню панель навігації для телефона (один раз, після завантаження DOM).
  function buildMobileNav() {
    if (document.getElementById('mobile-tabbar')) return; // вже є

    var bar = document.createElement('nav');
    bar.id = 'mobile-tabbar';
    bar.setAttribute('aria-label', 'Навігація');

    // [id вкладки, підпис, SVG-іконка]
    var tabs = [
      ['feed', 'Стрічка', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'],
      ['requests', 'Заявки', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'],
      ['blog', 'Блог', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'],
      ['streams', 'Стріми', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>']
    ];

    tabs.forEach(function (t) {
      var btn = document.createElement('button');
      btn.className = 'mtab';
      btn.id = 'mtab-' + t[0];
      btn.type = 'button';
      btn.innerHTML = t[2] + '<span>' + t[1] + '</span>';
      btn.addEventListener('click', function () {
        if (typeof window.setLudoraPage === 'function') {
          window.setLudoraPage(t[0]);
        } else if (typeof window.switchTab === 'function') {
          window.switchTab(t[0]);
        }
        setActiveMobileTab(t[0]);
      });
      bar.appendChild(btn);
    });

    document.body.appendChild(bar);

    // Плаваюча кнопка "Додати пост" (FAB).
    var fab = document.createElement('button');
    fab.id = 'mobile-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Додати пост');
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    fab.addEventListener('click', function () {
      if (typeof window.togglePostEditor === 'function') window.togglePostEditor();
    });
    document.body.appendChild(fab);

    // Початкова активна вкладка.
    var current = document.body.getAttribute('data-active-tab') || 'feed';
    setActiveMobileTab(current);
  }

  function setActiveMobileTab(tab) {
    var btns = document.querySelectorAll('#mobile-tabbar .mtab');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    var active = document.getElementById('mtab-' + tab);
    if (active) active.classList.add('active');
    // FAB ховаємо на вкладках, де "додати пост" не має сенсу.
    var fab = document.getElementById('mobile-fab');
    if (fab) fab.style.display = (tab === 'streams') ? 'none' : 'flex';
  }
  window.setActiveMobileTab = setActiveMobileTab;

  function init() {
    // Нижню панель будуємо лише там, де є вкладки (home) і не вимкнено layout.
    if (!window.NO_MOBILE_LAYOUT && document.getElementById('btn-feed')) {
      buildMobileNav();
      var body = document.body;
      if (window.MutationObserver) {
        var mo = new window.MutationObserver(function () {
          var t = body.getAttribute('data-active-tab');
          if (t) setActiveMobileTab(t);
        });
        mo.observe(body, { attributes: true, attributeFilter: ['data-active-tab'] });
      }
      observeFullscreenOverlays();
    }
  }

  // Слідкуємо за відкриттям чату/дзвінка/студії — щоб надійно ховати
  // нижню панель і FAB (через клас .overlay-open на <body>), без крихких :has().
  function observeFullscreenOverlays() {
    var ids = ['chat-window', 'chat-creation-screen', 'stream-studio-overlay', 'telegram-call-screen'];
    var nodes = [];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) nodes.push(el);
    });
    if (!nodes.length || !window.MutationObserver) return;

    function recompute() {
      var open = nodes.some(function (el) {
        var disp = (el.style && el.style.display) || '';
        var visible = disp && disp !== 'none';
        var active = el.classList && el.classList.contains('active');
        return visible || active;
      });
      document.body.classList.toggle('overlay-open', open);
    }

    var mo = new window.MutationObserver(recompute);
    nodes.forEach(function (el) {
      mo.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    });
    recompute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var t;
  function debounced() { clearTimeout(t); t = setTimeout(applyViewport, 150); }
  window.addEventListener('orientationchange', debounced);
  window.addEventListener('resize', debounced);
})();