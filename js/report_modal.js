/* ============================================================
   report_modal.js — гарне модальне вікно для скарг
   Експортує: window.openReportModal(options) -> Promise
   Повертає { reasonCode, reasonText } при підтвердженні,
   або null, якщо користувач закрив вікно / скасував.
   ============================================================ */
(function () {
    'use strict';

    if (window.openReportModal) return; // не дублюємо

    // Повний каталог причин. Поле `for` визначає, для яких типів об'єктів
    // показувати причину: 'post' | 'comment' | 'account' | 'all'.
    const ALL_REASONS = [
        { code: 'spam',            title: 'Спам або реклама',            desc: 'Небажані повідомлення, реклама, посилання',     icon: '📢', for: 'all' },
        { code: 'harassment',      title: 'Образи / цькування',          desc: 'Приниження, переслідування, булінг',            icon: '😡', for: 'all' },
        { code: 'hate',            title: 'Мова ворожнечі',              desc: 'Ненависть за ознакою раси, статі, релігії',     icon: '🚫', for: 'all' },
        { code: 'nudity',          title: 'Відвертий контент 18+',       desc: 'Оголеність, порнографія, сексуальний контент',  icon: '🔞', for: 'all' },
        { code: 'violence',        title: 'Насильство або погрози',      desc: 'Заклики до насильства, жорстокість, погрози',   icon: '⚠️', for: 'all' },
        { code: 'self_harm',       title: 'Самоушкодження / суїцид',     desc: 'Заклики до самоушкодження або суїциду',         icon: '🆘', for: 'all' },
        { code: 'scam',            title: 'Шахрайство / обман',          desc: 'Фішинг, шахрайські схеми, фейкові розіграші',   icon: '🎣', for: 'all' },
        { code: 'drugs',           title: 'Наркотики / зброя',           desc: 'Продаж чи реклама заборонених речовин або зброї', icon: '💊', for: 'all' },
        { code: 'illegal',         title: 'Незаконний контент',          desc: 'Порушення закону, небезпечна діяльність',       icon: '⛔', for: 'all' },
        { code: 'csam',            title: 'Контент із дітьми',           desc: 'Експлуатація або сексуалізація неповнолітніх',  icon: '🧒', for: 'all' },
        { code: 'copyright',       title: 'Порушення авторських прав',   desc: 'Крадіжка чужого контенту, плагіат',             icon: '©️', for: 'post' },
        { code: 'misinformation',  title: 'Дезінформація / фейк',        desc: 'Неправдива інформація, маніпуляції',            icon: '📰', for: 'post' },
        { code: 'impersonation',   title: 'Видавання себе за іншого',    desc: 'Фальшивий акаунт, крадіжка особистості',        icon: '🎭', for: 'account' },
        { code: 'fake_account',    title: 'Фейковий / бот-акаунт',       desc: 'Несправжній профіль, автоматизований бот',      icon: '🤖', for: 'account' },
        { code: 'underage',        title: 'Неповнолітній користувач',    desc: 'Користувачу, ймовірно, менше 13 років',         icon: '👶', for: 'account' },
        { code: 'privacy',         title: 'Порушення приватності',       desc: 'Оприлюднення особистих даних без згоди',        icon: '🔐', for: 'all' },
        { code: 'other',           title: 'Інше',                        desc: 'Інша причина — опишіть нижче',                  icon: '✏️', for: 'all' }
    ];

    function reasonsFor(targetType) {
        const t = (targetType === 'post' || targetType === 'comment' || targetType === 'account') ? targetType : null;
        const list = ALL_REASONS.filter(r => r.for === 'all' || (t && r.for === t));
        // 'other' завжди останній
        list.sort((a, b) => (a.code === 'other') - (b.code === 'other'));
        return list;
    }

    // ── один раз додаємо стилі
    function injectStyles() {
        if (document.getElementById('report-modal-styles')) return;
        const css = `
        .rm-overlay{
            position:fixed; inset:0; z-index:100000;
            display:flex; align-items:center; justify-content:center;
            background:radial-gradient(circle at 50% 30%, rgba(80,0,45,.62), rgba(8,0,6,.82));
            backdrop-filter:blur(7px); -webkit-backdrop-filter:blur(7px);
            opacity:0; transition:opacity .22s ease;
            padding:20px;
        }
        .rm-overlay.rm-show{opacity:1;}
        .rm-modal{
            width:100%; max-width:440px; max-height:90vh; overflow:hidden;
            display:flex; flex-direction:column;
            background:linear-gradient(160deg,#34001f 0%,#220019 55%,#1a0013 100%);
            border:1px solid rgba(255,37,187,.55);
            border-radius:22px;
            box-shadow:0 0 0 1px rgba(255,37,187,.18), 0 24px 70px rgba(0,0,0,.7), 0 0 60px rgba(240,4,127,.4);
            transform:translateY(18px) scale(.97);
            transition:transform .26s cubic-bezier(.2,.9,.3,1.2);
            font-family:inherit; color:#f3e6ee;
        }
        .rm-overlay.rm-show .rm-modal{transform:translateY(0) scale(1);}
        .rm-head{
            display:flex; align-items:center; gap:12px;
            padding:20px 22px 14px;
            border-bottom:1px solid rgba(240,4,127,.28);
            background:linear-gradient(180deg,rgba(240,4,127,.10),rgba(240,4,127,0));
            flex-shrink:0;
        }
        .rm-head .rm-flag{
            font-size:24px; line-height:1;
            filter:drop-shadow(0 0 10px rgba(255,37,187,.85));
        }
        .rm-head h3{
            margin:0; font-size:18px; font-weight:700; letter-spacing:.3px;
            background:linear-gradient(90deg,#FF25BB,#f0047f);
            -webkit-background-clip:text; background-clip:text;
            -webkit-text-fill-color:transparent;
            text-shadow:0 0 18px rgba(255,37,187,.35);
        }
        .rm-head .rm-sub{margin:2px 0 0; font-size:12px; color:#e0a8c8;}
        .rm-close{
            margin-left:auto; background:none; border:none; cursor:pointer;
            color:#c79bb4; font-size:22px; line-height:1; padding:4px 8px;
            border-radius:8px; transition:.15s;
        }
        .rm-close:hover{color:#fff; background:rgba(240,4,127,.22);}
        .rm-body{padding:14px 18px 4px; overflow-y:auto; flex:1 1 auto; min-height:0;}
        .rm-body::-webkit-scrollbar{width:8px;}
        .rm-body::-webkit-scrollbar-track{background:transparent;}
        .rm-body::-webkit-scrollbar-thumb{
            background:linear-gradient(180deg,#FF25BB,#f0047f);
            border-radius:8px; border:2px solid transparent; background-clip:padding-box;
        }
        .rm-body{scrollbar-width:thin; scrollbar-color:#f0047f transparent;}
        .rm-reason{
            display:flex; align-items:center; gap:12px;
            padding:11px 13px; margin-bottom:8px;
            border:1px solid rgba(240,4,127,.18);
            border-radius:13px; cursor:pointer;
            background:rgba(255,255,255,.02);
            transition:.16s ease;
        }
        .rm-reason:hover{border-color:rgba(255,37,187,.55); background:rgba(240,4,127,.10);}
        .rm-reason.rm-active{
            border-color:#FF25BB;
            background:rgba(240,4,127,.18);
            box-shadow:0 0 0 1px rgba(255,37,187,.4), 0 0 18px rgba(240,4,127,.25);
        }
        .rm-reason .rm-icon{font-size:20px; line-height:1; width:26px; text-align:center;}
        .rm-reason .rm-text{flex:1; min-width:0;}
        .rm-reason .rm-title{font-size:14px; font-weight:600; color:#fbeaf3;}
        .rm-reason .rm-desc{font-size:11.5px; color:#b483a0; margin-top:1px;}
        .rm-reason .rm-radio{
            width:18px; height:18px; border-radius:50%;
            border:2px solid rgba(240,4,127,.5);
            flex-shrink:0; position:relative; transition:.15s;
        }
        .rm-reason.rm-active .rm-radio{border-color:#FF25BB;}
        .rm-reason.rm-active .rm-radio::after{
            content:''; position:absolute; inset:3px; border-radius:50%;
            background:linear-gradient(135deg,#FF25BB,#f0047f);
        }
        .rm-textarea-wrap{padding:6px 18px 4px; flex-shrink:0;}
        .rm-textarea-wrap label{
            display:block; font-size:12px; color:#c79bb4; margin:6px 0 6px;
        }
        .rm-textarea{
            width:100%; box-sizing:border-box; resize:vertical;
            min-height:54px; max-height:140px;
            padding:11px 13px; border-radius:12px;
            background:rgba(0,0,0,.28);
            border:1px solid rgba(240,4,127,.25);
            color:#fbeaf3; font-family:inherit; font-size:13px; line-height:1.45;
            transition:.15s; outline:none;
        }
        .rm-textarea::placeholder{color:#8d6680;}
        .rm-textarea:focus{border-color:#FF25BB; box-shadow:0 0 0 3px rgba(240,4,127,.18);}
        .rm-counter{text-align:right; font-size:11px; color:#8d6680; margin-top:4px;}
        .rm-actions{
            display:flex; gap:10px; padding:14px 18px 20px; flex-shrink:0;
            border-top:1px solid rgba(240,4,127,.18);
        }
        .rm-btn{
            flex:1; padding:12px 16px; border-radius:12px;
            font-size:14px; font-weight:700; cursor:pointer;
            border:none; font-family:inherit; transition:.16s; letter-spacing:.3px;
        }
        .rm-btn-cancel{
            background:rgba(255,255,255,.06); color:#d9b9ca;
            border:1px solid rgba(255,255,255,.10);
        }
        .rm-btn-cancel:hover{background:rgba(255,255,255,.12); color:#fff;}
        .rm-btn-submit{
            background:linear-gradient(135deg,#FF25BB,#f0047f);
            color:#fff; box-shadow:0 6px 18px rgba(240,4,127,.45);
        }
        .rm-btn-submit:hover{filter:brightness(1.08); box-shadow:0 8px 24px rgba(240,4,127,.6);}
        .rm-btn-submit:disabled{opacity:.5; cursor:not-allowed; filter:none; box-shadow:none;}
        @media (max-width:480px){
            .rm-modal{max-width:100%;}
            .rm-reason .rm-desc{display:none;}
        }`;
        const st = document.createElement('style');
        st.id = 'report-modal-styles';
        st.textContent = css;
        document.head.appendChild(st);
    }

    /**
     * Відкриває модальне вікно скарги.
     * @param {Object} options
     * @param {string} [options.targetLabel] — на що скарга (напр. "пост", "@username")
     * @param {string} [options.targetType]  — 'post' | 'comment' | 'account' (фільтрує причини)
     * @returns {Promise<{reasonCode:string, reasonText:string}|null>}
     */
    window.openReportModal = function (options) {
        options = options || {};
        injectStyles();

        const REASONS = reasonsFor(options.targetType);

        return new Promise((resolve) => {
            let selected = null;

            const overlay = document.createElement('div');
            overlay.className = 'rm-overlay';

            const subText = options.targetLabel
                ? 'Скарга на: ' + options.targetLabel
                : 'Оберіть причину скарги';

            overlay.innerHTML = `
                <div class="rm-modal" role="dialog" aria-modal="true" aria-label="Скарга">
                    <div class="rm-head">
                        <span class="rm-flag">🚩</span>
                        <div>
                            <h3>Поскаржитися</h3>
                            <p class="rm-sub">${escapeHtml(subText)}</p>
                        </div>
                        <button class="rm-close" type="button" aria-label="Закрити">&times;</button>
                    </div>
                    <div class="rm-body">
                        ${REASONS.map(r => `
                            <div class="rm-reason" data-code="${r.code}">
                                <span class="rm-icon">${r.icon}</span>
                                <div class="rm-text">
                                    <div class="rm-title">${r.title}</div>
                                    <div class="rm-desc">${r.desc}</div>
                                </div>
                                <span class="rm-radio"></span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="rm-textarea-wrap">
                        <label>Деталі (необов'язково)</label>
                        <textarea class="rm-textarea" maxlength="1000"
                            placeholder="Опишіть, що саме порушено…"></textarea>
                        <div class="rm-counter"><span class="rm-count">0</span>/1000</div>
                    </div>
                    <div class="rm-actions">
                        <button class="rm-btn rm-btn-cancel" type="button">Скасувати</button>
                        <button class="rm-btn rm-btn-submit" type="button" disabled>Надіслати скаргу</button>
                    </div>
                </div>`;

            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('rm-show'));

            const reasonEls = overlay.querySelectorAll('.rm-reason');
            const submitBtn = overlay.querySelector('.rm-btn-submit');
            const cancelBtn = overlay.querySelector('.rm-btn-cancel');
            const closeBtn  = overlay.querySelector('.rm-close');
            const textarea  = overlay.querySelector('.rm-textarea');
            const counter   = overlay.querySelector('.rm-count');

            reasonEls.forEach(el => {
                el.addEventListener('click', () => {
                    reasonEls.forEach(e => e.classList.remove('rm-active'));
                    el.classList.add('rm-active');
                    selected = el.getAttribute('data-code');
                    submitBtn.disabled = false;
                });
            });

            textarea.addEventListener('input', () => {
                counter.textContent = textarea.value.length;
            });

            function close(result) {
                overlay.classList.remove('rm-show');
                setTimeout(() => {
                    overlay.remove();
                    document.removeEventListener('keydown', onKey);
                    resolve(result);
                }, 220);
            }

            function onKey(e) {
                if (e.key === 'Escape') close(null);
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && selected) {
                    close({ reasonCode: selected, reasonText: textarea.value.trim() });
                }
            }

            submitBtn.addEventListener('click', () => {
                if (!selected) return;
                close({ reasonCode: selected, reasonText: textarea.value.trim() });
            });
            cancelBtn.addEventListener('click', () => close(null));
            closeBtn.addEventListener('click', () => close(null));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
            document.addEventListener('keydown', onKey);
        });
    };

    /**
     * Гарне тост-повідомлення (заміна alert після надсилання).
     */
    window.showReportToast = function (message, ok) {
        injectStyles();
        const t = document.createElement('div');
        t.textContent = message;
        t.style.cssText = `
            position:fixed; left:50%; bottom:32px; transform:translateX(-50%) translateY(20px);
            z-index:100001; max-width:90%; padding:13px 22px; border-radius:14px;
            font-family:inherit; font-size:14px; font-weight:600; color:#fff;
            background:${ok ? 'linear-gradient(135deg,#FF25BB,#f0047f)' : 'linear-gradient(135deg,#b0356a,#7a1f44)'};
            box-shadow:0 10px 30px rgba(0,0,0,.5), 0 0 24px rgba(240,4,127,.4);
            opacity:0; transition:.28s ease; text-align:center;`;
        document.body.appendChild(t);
        requestAnimationFrame(() => {
            t.style.opacity = '1';
            t.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            t.style.opacity = '0';
            t.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => t.remove(), 300);
        }, 3200);
    };

    function escapeHtml(s) {
        return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
})();