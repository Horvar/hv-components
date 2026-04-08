// src/components/hv-accordion/_hv-accordion.js
// Лёгкий, автономный аккордеон без jQuery.
// Контейнеры помечаются ТОЛЬКО data-accordion-settings="preset {JSON?}".
// Пример: data-accordion-settings="faqPreset {\"singleOpen\":true, \"duration\":240}"
//
// Внутренняя разметка:
// <div data-accordion-settings="...">
//   <div data-accordion-item class="is-unfolded?">
//     <button data-accordion-button>...</button>
//     <div data-accordion-content>...</div>
//   </div>
//   ...
// </div>
//
// Использование (НЕТ вызова new / initAll):
// import { Accordion } from './hv-accordion/_hv-accordion.js';
// Accordion.definePreset('faqPreset',   { singleOpen: true,  duration: 240 });
// Accordion.definePreset('multiPreset', { singleOpen: false, duration: 160 });
//
// Можно объявить пресеты где угодно — контроллер сам создастся и просканирует DOM.

export class Accordion {
  // -------- глобальные пресеты --------
  static _globalPresets = new Map();
  static definePreset(name, conf = {}) {
    if (!name) return;
    this._globalPresets.set(String(name), { ...conf });
    // гарантируем авто-инстанс и перескан после каждого definePreset
    Accordion._ensureSingleton();
    Accordion._inst._scan(true);
  }

  // ====== авто-инстанс ======
  static _inst = null;
  static _ensureSingleton() {
    if (!Accordion._inst) Accordion._inst = new Accordion({ _auto: true });
    return Accordion._inst;
  }

  // ====== конструктор ======
  constructor(opts = {}) {
    // дефолты по умолчанию (если у контейнера нет своих)
    const defaults = {
      singleOpen: false,
      duration: 200,
      debug: false,
      // внутреннее:
      _auto: false,
    };
    this.o = { ...defaults, ...opts };

    // кэш контейнеров
    this._accordions = new Set();

    this._onClick = this._onClick.bind(this);

    // сразу сканируем DOM
    this._scan();

    // один общий делегированный обработчик на документ
    document.addEventListener('click', this._onClick, { passive: false });

    // лёгкий observer на добавление контейнеров (опционально)
    this._mo = new MutationObserver((ml) => {
      let need = false;
      for (const m of ml) {
        if (m.type === 'childList') {
          if ([...m.addedNodes].some((n) => n.nodeType === 1 && n.hasAttribute?.('data-accordion-settings'))) {
            need = true;
            break;
          }
        }
      }
      if (need) this._scan(true);
    });
    try {
      this._mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch {
      /* ignore: observer can fail in some environments */
    }

    if (this.o.debug) console.log('[Accordion] ready');
  }

  // ====== публично ======
  destroy() {
    document.removeEventListener('click', this._onClick, { passive: false });
    try {
      this._mo?.disconnect();
    } catch {
      /* ignore: observer might be absent */
    }
    this._accordions.clear();
  }

  // ====== сканирование и инициализация ======
  _scan(force = false) {
    const nodes = document.querySelectorAll('[data-accordion-settings]');
    nodes.forEach((root) => {
      if (!force && root.__hvAccordionReady__) return;
      root.__hvAccordionReady__ = true;

      const conf = this._readSettings(root);
      root.__hvAccordionConf__ = conf;

      // первичная инициализация каждого item
      const items = root.querySelectorAll('[data-accordion-item]');
      let firstOpenKept = false;

      items.forEach((item) => {
        const btn = item.querySelector('[data-accordion-button]');
        const panel = item.querySelector('[data-accordion-content]');
        if (!btn || !panel) return;

        // ARIA подготовка
        const isOpen = item.classList.contains('is-unfolded');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        btn.setAttribute('aria-controls', panel.id || this._ensureId(panel));
        btn.setAttribute('role', 'button');
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

        // начальное состояние: при singleOpen оставляем открыт только первый
        if (conf.singleOpen) {
          if (isOpen && !firstOpenKept) {
            this._setPanelVisibility(panel, true, 0);
            firstOpenKept = true;
          } else {
            item.classList.remove('is-unfolded');
            this._setPanelVisibility(panel, false, 0);
          }
        } else {
          this._setPanelVisibility(panel, isOpen, 0);
        }
      });

      this._accordions.add(root);
    });
  }

  _readSettings(root) {
    // data-accordion-settings="preset {json}"
    const raw = root.getAttribute('data-accordion-settings') || '';
    const parts = [];
    let buf = '',
      inJson = false,
      brace = 0;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (inJson) {
        buf += ch;
        if (ch === '{') brace++;
        else if (ch === '}') {
          brace--;
          if (brace <= 0) {
            parts.push(buf.trim());
            buf = '';
            inJson = false;
          }
        }
        continue;
      }
      if (ch === '{') {
        if (buf.trim()) {
          parts.push(buf.trim());
          buf = '';
        }
        inJson = true;
        brace = 1;
        buf = '{';
        continue;
      }
      if (/[,\s|]/.test(ch)) {
        if (buf.trim()) {
          parts.push(buf.trim());
          buf = '';
        }
      } else {
        buf += ch;
      }
    }
    if (buf.trim()) parts.push(buf.trim());

    // собираем конфиг: глобальные дефолты → пресеты → JSON
    const base = {
      singleOpen: this.o.singleOpen,
      duration: this.o.duration,
    };
    let conf = { ...base };

    for (const token of parts) {
      if (!token) continue;
      if (token.startsWith('{')) {
        try {
          conf = { ...conf, ...JSON.parse(token) };
        } catch (e) {
          console.warn('[Accordion] bad JSON in data-accordion-settings:', token, e);
        }
      } else {
        const p = Accordion._globalPresets.get(token);
        if (!p) {
          console.warn('[Accordion] unknown preset:', token);
          continue;
        }
        conf = { ...conf, ...p };
      }
    }
    return conf;
  }

  // ====== клики (делегирование) ======
  _onClick(e) {
    const btn = e.target.closest?.('[data-accordion-button]');
    if (!btn) return;

    const item = btn.closest('[data-accordion-item]');
    const root = btn.closest('[data-accordion-settings]');
    if (!item || !root) return;

    const panel = item.querySelector('[data-accordion-content]');
    if (!panel) return;

    const conf = root.__hvAccordionConf__ || this._readSettings(root);
    const isOpen = item.classList.contains('is-unfolded');

    if (conf.singleOpen) {
      if (isOpen) {
        // закрываем текущий
        item.classList.remove('is-unfolded');
        btn.setAttribute('aria-expanded', 'false');
        panel.setAttribute('aria-hidden', 'true');
        this._setPanelVisibility(panel, false, conf.duration);
      } else {
        // закрыть всё в контейнере
        root.querySelectorAll('[data-accordion-item].is-unfolded').forEach((openItem) => {
          openItem.classList.remove('is-unfolded');
          const b = openItem.querySelector('[data-accordion-button]');
          const p = openItem.querySelector('[data-accordion-content]');
          if (b) b.setAttribute('aria-expanded', 'false');
          if (p) {
            p.setAttribute('aria-hidden', 'true');
            this._setPanelVisibility(p, false, conf.duration);
          }
        });
        // открыть текущий
        item.classList.add('is-unfolded');
        btn.setAttribute('aria-expanded', 'true');
        panel.setAttribute('aria-hidden', 'false');
        this._setPanelVisibility(panel, true, conf.duration);
      }
    } else {
      // независимый тоггл
      item.classList.toggle('is-unfolded');
      const nowOpen = item.classList.contains('is-unfolded');
      btn.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
      panel.setAttribute('aria-hidden', nowOpen ? 'false' : 'true');
      this._setPanelVisibility(panel, nowOpen, conf.duration);
    }

    // предотвращаем случайные текст-селекты/проскроллы как у <a>
    e.preventDefault();
  }

  // ====== анимация сворачивания/разворачивания ======
  _setPanelVisibility(panel, show, durationMs = 200) {
    // на всякий: убираем предыдущие inline-transition
    panel.style.overflow = 'hidden';
    panel.style.willChange = 'height';

    const startH = panel.offsetHeight; // текущая высота (может быть 0)
    panel.style.display = 'block'; // чтобы посчитать scrollHeight
    const targetH = show ? panel.scrollHeight : 0;

    if (durationMs <= 0) {
      panel.style.height = show ? '' : '0px';
      panel.style.overflow = show ? '' : 'hidden';
      panel.style.willChange = '';
      if (!show) panel.style.display = ''; // позволим CSS скрыть, если надо
      return;
    }

    // стартовая высота
    panel.style.height = `${startH}px`;

    // принудительный reflow

    panel.offsetHeight;

    panel.style.transition = `height ${durationMs}ms ease`;
    panel.style.height = `${targetH}px`;

    const clear = () => {
      panel.style.transition = '';
      panel.style.willChange = '';
      panel.style.overflow = show ? '' : 'hidden';
      if (show) {
        panel.style.height = '';
      } else {
        panel.style.height = '0px';
        // не трогаем display — пусть остаётся block, чтобы не прыгал layout при быстрых кликах
      }
      panel.removeEventListener('transitionend', onEnd);
      panel.removeEventListener('transitioncancel', onEnd);
    };
    const onEnd = () => clear();

    panel.addEventListener('transitionend', onEnd);
    panel.addEventListener('transitioncancel', onEnd);
  }

  _ensureId(el) {
    if (el.id) return el.id;
    const id = 'acc-' + Math.random().toString(36).slice(2, 9);
    el.id = id;
    return id;
  }
}

// ---- авто-инициализация при импорте ----
Accordion._ensureSingleton();
