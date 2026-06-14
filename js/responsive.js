/* responsive.js — адаптація фіксованого десктоп-макета під планшети й телефони.
 *
 * Сторінки (home.html, profile.html) побудовані на фіксованому "полотні"
 * шириною ~1788px з абсолютним позиціонуванням. Переписати кожну координату
 * під flex/grid — величезний ризик зламати верстку. Тому застосовуємо
 * перевірений підхід: на вузьких екранах динамічно задаємо ширину viewport,
 * і браузер сам масштабує всю сторінку, зберігаючи піксельні позиції 1:1.
 *
 * Десктоп (>=1200px) — нічого не чіпаємо, рендер як був.
 * Планшет/телефон — viewport=ширина_полотна, щоб усе вмістилось і
 * масштабувалось пропорційно (з підтримкою зуму користувачем).
 */
(function () {
  'use strict';

  // Ширина, під яку спроєктований макет (найправіший елемент ~1788px + поля).
  var CANVAS_WIDTH = 1820;
  // Нижче цієї ширини вікна вмикаємо масштабування полотна.
  var BREAKPOINT = 1200;

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
    // Реальна ширина пристрою в CSS-пікселях (без урахування поточного зуму сторінки).
    var screenW = window.screen && window.screen.width ? window.screen.width : window.innerWidth;
    // Орієнтуємось на найменшу зі сторони екрана vs innerWidth, щоб коректно
    // ловити і портрет, і ландшафт.
    var w = Math.min(screenW, window.innerWidth || screenW);

    if (w >= BREAKPOINT) {
      // Десктоп — стандартний адаптивний viewport.
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0');
      document.documentElement.classList.remove('is-compact');
    } else {
      // Планшет/телефон — фіксуємо ширину полотна, браузер масштабує все вниз.
      // initial-scale рахуємо так, щоб полотно точно вписалось у ширину екрана.
      var scale = w / CANVAS_WIDTH;
      meta.setAttribute(
        'content',
        'width=' + CANVAS_WIDTH +
        ', initial-scale=' + scale.toFixed(4) +
        ', minimum-scale=' + scale.toFixed(4) +
        ', maximum-scale=5.0, user-scalable=yes'
      );
      document.documentElement.classList.add('is-compact');
    }
  }

  applyViewport();

  // Перераховуємо при зміні орієнтації / ресайзі.
  var t;
  function debounced() {
    clearTimeout(t);
    t = setTimeout(applyViewport, 150);
  }
  window.addEventListener('orientationchange', debounced);
  window.addEventListener('resize', debounced);
})();