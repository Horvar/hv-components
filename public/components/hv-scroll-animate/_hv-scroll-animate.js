// src/scripts/_hv-scroll-animate.js
// Автономная система анимаций по скроллу (IntersectionObserver), без jQuery.
//
// Контейнеры помечаются ТОЛЬКО:
//   data-scroll-animate="preset {JSON?}"
// Пример:
//   data-scroll-animate="__saList {\"once\":false,\"threshold\":0.2,\"stagger\":250}"
//
// Если внутри контейнера есть элементы [data-scroll-item] — это "группа":
//   - активируется контейнер -> элементы получают activeClass строго по DOM-порядку
//   - delay применяется к старту группы, stagger — между элементами
//
// NEW: splitLines (многострочный текст с переносами)
//   - Если включено splitLines:true, система ищет внутри root элемент по splitSelector
//     (по умолчанию: [data-scroll-text]) и режет его на визуальные строки.
//   - Каждая строка превращается в item (data-scroll-item), и дальше применяется
//     существующий stagger (строго по порядку строк).
//   - На resize строки могут пересчитываться (см. _scheduleResplitAll()).
//
// Если [data-scroll-item] нет — activeClass ставится на сам контейнер.
//
// Использование (НЕТ new/initAll):
// import { ScrollAnimate } from '../scripts/_hv-scroll-animate.js';
// ScrollAnimate.definePreset('__saList', { once:false, threshold:0.2, stagger:250, activeClass:'is-animated', debug:true, splitLines:true });
//
// Пример HTML:
// <p data-scroll-animate='__saList {"splitLines":true,"stagger":120}'>
//   <span data-scroll-text>We are artists, designers, producers ...</span>
// </p>

export class ScrollAnimate {
  // -------- глобальные пресеты --------
  static _globalPresets = new Map();
  static definePreset(name, conf = {}) {
    if (!name) return;
    this._globalPresets.set(String(name), { ...conf });
    ScrollAnimate._ensureSingleton();
    ScrollAnimate._inst._rescan(true);
  }

  // ====== авто-инстанс ======
  static _inst = null;
  static _ensureSingleton() {
    if (!ScrollAnimate._inst) ScrollAnimate._inst = new ScrollAnimate({ _auto: true });
    return ScrollAnimate._inst;
  }

  constructor(opts = {}) {
    const defaults = {
      // публичные дефолты:
      once: true,
      threshold: 0.2,
      rootMargin: '0px',
      delay: 0,
      stagger: 0,
      activeClass: 'is-animated',
      breakpoints: null, // { mobile:{...}, tablet:{...}, desktop:{...} }
      debug: false,

      // NEW: splitLines
      splitLines: false,
      splitSelector: '[data-scroll-text]',

      // внутреннее:
      _auto: false,
    };

    this.o = { ...defaults, ...opts };

    // состояние
    this._nodes = new Set(); // контейнеры
    this._ioPool = new Map();
    this._mo = null;

    this._lastScrollY = window.scrollY || 0;
    this._scrollDir = 'down'; // 'down' | 'up'

    this._onScroll = this._onScroll.bind(this);
    this._onResize = this._onResize.bind(this);

    this._bp = this._getBreakpoint();

    // rAF для гарантированной проверки reset при скролле вверх
    this._rafResetCheck = 0;

    // rAF для пересчёта splitLines при resize
    this._rafResplit = 0;

    this._buildObserverPool();
    this._scan();

    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });

    this._mo = new MutationObserver((ml) => {
      let need = false;
      for (const m of ml) {
        if (m.type !== 'childList') continue;
        for (const n of m.addedNodes) {
          if (n?.nodeType !== 1) continue;
          if (n.hasAttribute?.('data-scroll-animate') || n.querySelector?.('[data-scroll-animate]')) {
            need = true;
            break;
          }
        }
        if (need) break;
      }
      if (need) this._scan(true);
    });

    try {
      this._mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch {
      /* ignore */
    }

    this._dlog('ready', { breakpoint: this._bp });
  }

  // ====== публично ======
  destroy() {
    for (const [, io] of this._ioPool) {
      try {
        io.disconnect();
      } catch {
        /* ignore */
      }
    }
    this._ioPool.clear();

    try {
      this._mo?.disconnect();
    } catch {
      /* ignore */
    }

    if (this._rafResetCheck) cancelAnimationFrame(this._rafResetCheck);
    if (this._rafResplit) cancelAnimationFrame(this._rafResplit);

    window.removeEventListener('scroll', this._onScroll, { passive: true });
    window.removeEventListener('resize', this._onResize, { passive: true });

    for (const root of this._nodes) this._cleanupRoot(root);
    this._nodes.clear();
  }

  // ====== скролл/резайз ======
  _onScroll() {
    const y = window.scrollY || 0;
    this._scrollDir = y < this._lastScrollY ? 'up' : 'down';
    this._lastScrollY = y;

    // IntersectionObserver не обязан присылать события в нужный момент
    // (особенно на границах/быстрых скроллах), поэтому сброс дожимаем сами.
    if (this._scrollDir === 'up') this._scheduleScrollUpResetCheck();
  }

  _onResize() {
    const next = this._getBreakpoint();
    if (next !== this._bp) {
      const prev = this._bp;
      this._bp = next;
      this._dlog('breakpoint-change', { from: prev, to: next });

      // важное ТЗ: при смене брейкпоинта
      // - пересчитать
      // - сбросить старые состояния
      // - применить новые правила
      this._resetAll('breakpoint-change');
      this._buildObserverPool(); // потому что rootMargin/threshold могли поменяться
      this._scan(true);
    }

    // NEW: пересобираем line-split на resize (переносы меняются от ширины)
    this._scheduleResplitAll();
  }

  _scheduleResplitAll() {
    if (this._rafResplit) cancelAnimationFrame(this._rafResplit);
    this._rafResplit = requestAnimationFrame(() => {
      this._rafResplit = 0;

      for (const root of this._nodes) {
        const st = root.__hvSaState__;
        if (!st?.conf?.splitLines) continue;

        // пересобираем кэш группы (это сделает restore + split заново)
        this._prepareGroupCache(root, st, { forceSplit: true });

        // если уже активировали — оставляем как есть (классы на новых строках нужно восстановить)
        // Для простоты: если root в active/done, активируем группу сразу.
        if (st.active || st.done) {
          const items = st.items.length ? st.items : [...root.querySelectorAll('[data-scroll-item]')];
          // добавляем activeClass на контейнер
          root.classList.add(st.conf.activeClass);
          items.forEach((el) => el.classList.add(st.conf.activeClass));
        }
      }
    });
  }

  // ====== гарантированный reset при скролле вверх ======
  _scheduleScrollUpResetCheck() {
    if (this._rafResetCheck) return;
    this._rafResetCheck = requestAnimationFrame(() => {
      this._rafResetCheck = 0;
      this._resetIfBelowViewportOnScrollUp();
    });
  }

  _resetIfBelowViewportOnScrollUp() {
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;

    for (const root of this._nodes) {
      const st = root.__hvSaState__;
      if (!st) continue;

      const conf = st.conf;
      if (!conf || conf.once) continue;

      // трогаем только то, что уже запускалось/активно
      if (!st.active && !st.done && !st.pending) continue;

      const rect = root.getBoundingClientRect();

      // "выше элемента" => элемент ушёл ниже экрана
      if (rect.top >= vh) {
        this._resetRoot(root, 'scroll-up-below-viewport');
      }
    }
  }

  // ====== observer pool ======
  _buildObserverPool() {
    // полностью пересобираем пул
    for (const [, io] of this._ioPool) {
      try {
        io.disconnect();
      } catch {
        /* ignore */
      }
    }
    this._ioPool.clear();

    // помечаем, что нужно заново observe
    for (const root of this._nodes) {
      const st = root.__hvSaState__;
      if (st) st._observedKey = null;
    }
  }

  _getObserverFor(conf) {
    const threshold = typeof conf.threshold === 'number' ? conf.threshold : this.o.threshold;
    const rootMargin = conf.rootMargin ?? this.o.rootMargin;
    const key = `${threshold}__${rootMargin}`;

    if (this._ioPool.has(key)) return { io: this._ioPool.get(key), key };

    const io = new IntersectionObserver((entries) => this._onIntersect(entries), { threshold, rootMargin });

    this._ioPool.set(key, io);
    return { io, key };
  }

  _onIntersect(entries) {
    for (const entry of entries) {
      const root = entry.target;
      const st = root.__hvSaState__;
      if (!st) continue;

      const conf = st.conf;

      // если once и уже выполнено — игнор
      if (conf.once && st.done) {
        this._dlog('ignored-once-done', this._ctx(root, entry));
        continue;
      }

      // если уже активен/в ожидании — игнор
      if (st.active || st.pending) {
        this._dlog('ignored-active-or-pending', this._ctx(root, entry));
        continue;
      }

      // вошёл во viewport
      if (entry.isIntersecting) {
        this._scheduleActivate(root, entry, 'intersecting');
        continue;
      }

      // вышел из viewport
      // Проверяем направление: если скроллим вверх и элемент уходит НИЖЕ viewport
      if (this._scrollDir === 'up') {
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;
        const rect = entry.boundingClientRect || root.getBoundingClientRect();
        const top = rect.top;

        // "ушёл ниже экрана" — верхняя граница >= viewportHeight
        if (top >= vh) {
          this._resetRoot(root, 'left-below-viewport-while-scroll-up');
        } else {
          this._dlog('no-reset-not-below-viewport', { ...this._ctx(root, entry), top, vh });
        }
      } else {
        // скроллим вниз: элемент ушёл ВЫШЕ viewport
        const rect = entry.boundingClientRect || root.getBoundingClientRect();
        if (rect.bottom < 0) {
          this._resetRoot(root, 'left-above-viewport-while-scroll-down');
        } else {
          this._dlog('no-reset-not-above-viewport', { ...this._ctx(root, entry), bottom: rect.bottom });
        }
      }
    }
  }

  // ====== сканирование ======
  _rescan(force = false) {
    this._scan(force);
  }

  _scan(force = false) {
    const nodes = document.querySelectorAll('[data-scroll-animate]');

    nodes.forEach((root) => {
      if (!force && root.__hvSaReady__) return;

      root.__hvSaReady__ = true;

      const conf = this._readSettings(root);
      const st = this._ensureState(root, conf);

      // кэш группы
      this._prepareGroupCache(root, st, { forceSplit: force });

      this._nodes.add(root);

      // Проверка: если элемент выше viewport, сразу активируем
      const rect = root.getBoundingClientRect();

      // Элемент полностью выше viewport (уже прокрутили мимо него)
      if (rect.bottom < 0) {
        this._activateRootImmediately(root, 'already-above-viewport');
        this._dlog('scan-root-activated-immediately', { root: this._name(root), conf, reason: 'above-viewport' });
      }

      // Всегда подключаем к IO (для возможности сброса при once:false)
      const { io, key } = this._getObserverFor(conf);

      if (st._observedKey !== key) {
        // если ранее наблюдали другим observer'ом — снимем
        if (st._observedKey && this._ioPool.has(st._observedKey)) {
          try {
            this._ioPool.get(st._observedKey).unobserve(root);
          } catch {
            /* ignore */
          }
        }
        io.observe(root);
        st._observedKey = key;
      }

      if (rect.bottom >= 0) {
        this._dlog('scan-root', { root: this._name(root), conf });
      }
    });
  }

  _ensureState(root, conf) {
    const prev = root.__hvSaState__;
    const st = prev || {
      conf: null,
      active: false,
      done: false,
      timers: new Set(),
      pending: false,
      _observedKey: null,

      // кэш группы:
      isGroup: false,
      items: [],
    };

    st.conf = conf;
    root.__hvSaState__ = st;
    return st;
  }

  _prepareGroupCache(root, st, { forceSplit = false } = {}) {
    // NEW: режим нарезки текста на строки (делаем items = строки)
    if (st.conf?.splitLines) {
      const ok = this._ensureLineSplitGroup(root, st, { force: forceSplit });
      if (ok) return;
    }

    // обычный режим: [data-scroll-item]
    const items = [...root.querySelectorAll('[data-scroll-item]')];
    st.isGroup = items.length > 0;
    st.items = items;
  }

  _ensureLineSplitGroup(root, st, { force = false } = {}) {
    const sel = st.conf?.splitSelector || '[data-scroll-text]';
    const target = root.querySelector(sel);
    if (!target) return false;

    // проверяем, что элемент видим и имеет размеры
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn('[ScrollAnimate] splitLines: target has no dimensions, skipping', target);
      return false;
    }

    // если уже резали и не force — просто переиспользуем существующие data-scroll-item
    if (!force && target.__hvSaSplitDone__) {
      const existing = [...target.querySelectorAll('[data-scroll-item]')];
      if (existing.length) {
        st.isGroup = true;
        st.items = existing;
        return true;
      }
    }

    // сохраняем оригинал 1 раз (важно: именно HTML, чтобы не терять <br>, <strong>, &nbsp; и т.д.)
    if (target.__hvSaSplitOriginal__ == null) {
      target.__hvSaSplitOriginal__ = target.innerHTML;
    }

    // восстанавливаем оригинал перед пересборкой
    this._restoreSplitTarget(target);

    // 1) оборачиваем слова в <span class="sa-word">...</span>, НЕ ломая разметку
    //    (работает с <strong>, <em>, <a>, &nbsp;, спец-символами; <br> оставляем как есть)
    this._wrapWordsPreserveHtml(target);

    const wordEls = [...target.querySelectorAll('.sa-word')];
    if (!wordEls.length) return false;

    // 2) группируем слова по "визуальным" строкам через offsetTop
    // Используем более умный алгоритм: вычисляем line-height и группируем по нему
    const computedStyle = window.getComputedStyle(target);
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2;

    // Допуск: 30% от line-height (чтобы учесть subpixel rendering и разные базовые линии)
    const tolerance = lineHeight * 0.3;

    const lines = [];
    let cur = [];
    let baselineTop = null;

    for (const w of wordEls) {
      const top = w.offsetTop;

      // Первое слово или слово на той же строке (в пределах допуска)
      if (baselineTop === null || Math.abs(top - baselineTop) < tolerance) {
        cur.push(w);
        // Устанавливаем baseline как первое слово в строке
        if (baselineTop === null) {
          baselineTop = top;
        }
      } else {
        // Новая строка
        if (cur.length) lines.push(cur);
        cur = [w];
        baselineTop = top;
      }
    }
    if (cur.length) lines.push(cur);

    // 3) заворачиваем КАЖДУЮ строку в .sa-line (item)
    //    Делаем это С КОНЦА, чтобы не поломать ссылки на ноды.
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const first = line[0];
      const last = line[line.length - 1];

      const range = document.createRange();
      range.setStartBefore(first);
      range.setEndAfter(last);

      const frag = range.extractContents();

      const lineEl = document.createElement('span');
      lineEl.className = 'sa-line';
      lineEl.setAttribute('data-scroll-item', '');
      // Запрещаем перенос внутри строки
      lineEl.style.display = 'inline-flex';

      const inner = document.createElement('span');
      inner.className = 'sa-line__inner';
      inner.appendChild(frag);

      lineEl.appendChild(inner);
      range.insertNode(lineEl);

      // подчистим мусорные пустые текст-ноды вокруг (не критично, но делает DOM аккуратнее)
      lineEl.parentNode?.normalize?.();
    }

    // подчистим пустые элементы, которые могли остаться после Range-split (редко, но бывает)
    this._cleanupEmptyInline(target);

    target.__hvSaSplitDone__ = true;

    st.isGroup = true;
    st.items = [...target.querySelectorAll('[data-scroll-item]')];

    return st.items.length > 0;
  }

  _wrapWordsPreserveHtml(target) {
    // Оборачиваем слова внутри text nodes, сохраняя HTML-структуру.
    // Разделители пробелов не "нормализуем" насильно — оставляем как в исходнике,
    // включая NBSP (\u00A0) и переносы (\u2028). Это лечит странные переносы.

    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // игнорим пустые и те, что внутри уже созданных системных оболочек
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('.sa-line, .sa-word')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) textNodes.push(n);

    for (const node of textNodes) {
      const s = node.nodeValue;
      if (!s) continue;

      // Токенизируем на "слова", "пробелы" и "дефисы".
      // Дефис тоже считаем разделителем, чтобы "Интернет-магазины" правильно переносилось
      // NBSP (\u00A0) считаем пробелом, но браузер сам не будет на нём переносить.
      const parts = s.split(/(\s+|-)/);
      const frag = document.createDocumentFragment();

      for (const part of parts) {
        if (!part) continue;

        // пробелы / переносы
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          continue;
        }

        // дефис - тоже оборачиваем в .sa-word чтобы анимировался
        if (part === '-') {
          const w = document.createElement('span');
          w.className = 'sa-word';
          w.textContent = part;
          frag.appendChild(w);
          continue;
        }

        // слово
        const w = document.createElement('span');
        w.className = 'sa-word';
        w.textContent = part;
        frag.appendChild(w);
      }

      node.parentNode?.replaceChild(frag, node);
    }
  }

  _cleanupEmptyInline(root) {
    // Удаляем пустые теги, которые могли остаться после extract/insert.
    // Не трогаем <br>.
    const els = [...root.querySelectorAll('*')];
    for (const el of els) {
      if (el.tagName === 'BR') continue;
      if (
        el.classList.contains('sa-line') ||
        el.classList.contains('sa-line__inner') ||
        el.classList.contains('sa-word')
      )
        continue;

      // пустой, без текста и без элементов
      if (!el.textContent?.trim() && el.children.length === 0) {
        el.remove();
      }
    }
  }

  _restoreSplitTarget(target) {
    if (!target) return;

    // если у нас сохранён оригинал — откатываем
    if (target.__hvSaSplitOriginal__ != null) {
      target.innerHTML = target.__hvSaSplitOriginal__;
    }

    // убираем флаг "уже резали" (иначе на force мы не пересоберём)
    delete target.__hvSaSplitDone__;
  }

  _cleanupRoot(root) {
    const st = root.__hvSaState__;
    if (!st) return;

    for (const t of st.timers) clearTimeout(t);
    st.timers.clear();

    // отписка observer'а
    if (st._observedKey && this._ioPool.has(st._observedKey)) {
      try {
        this._ioPool.get(st._observedKey).unobserve(root);
      } catch {
        /* ignore */
      }
    }

    delete root.__hvSaState__;
    delete root.__hvSaReady__;
  }

  _readSettings(root) {
    const raw = root.getAttribute('data-scroll-animate') || '';
    if (!raw.trim()) return { ...this.o };

    // парсим пресеты и JSON
    const parts = [];
    let buf = '';
    let inJson = false;
    let brace = 0;

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

    // базовые дефолты
    let conf = {
      once: this.o.once,
      threshold: this.o.threshold,
      rootMargin: this.o.rootMargin,
      delay: this.o.delay,
      stagger: this.o.stagger,
      activeClass: this.o.activeClass,
      breakpoints: this.o.breakpoints,
      debug: this.o.debug,

      // NEW
      splitLines: this.o.splitLines,
      splitSelector: this.o.splitSelector,
    };

    // пресеты + JSON
    for (const token of parts) {
      if (!token) continue;

      if (token.startsWith('{')) {
        try {
          conf = { ...conf, ...JSON.parse(token) };
        } catch (e) {
          console.warn('[ScrollAnimate] bad JSON in data-scroll-animate:', token, e);
        }
      } else {
        const p = ScrollAnimate._globalPresets.get(token);
        if (!p) {
          console.warn('[ScrollAnimate] unknown preset:', token);
          continue;
        }
        conf = { ...conf, ...p };
      }
    }

    // брейкпоинты поверх всего
    conf = this._applyBreakpointOverrides(conf);

    // нормализация типов
    conf.threshold = this._clamp01(Number(conf.threshold));
    conf.delay = Math.max(0, Number(conf.delay) || 0);
    conf.stagger = Math.max(0, Number(conf.stagger) || 0);
    conf.once = Boolean(conf.once);
    conf.activeClass = String(conf.activeClass || 'is-animated');
    conf.rootMargin = String(conf.rootMargin ?? '0px');
    conf.debug = Boolean(conf.debug);

    // NEW
    conf.splitLines = Boolean(conf.splitLines);
    conf.splitSelector = String(conf.splitSelector || '[data-scroll-text]');

    return conf;
  }

  _applyBreakpointOverrides(conf) {
    const bp = this._bp || this._getBreakpoint();
    const bps = conf.breakpoints;

    if (!bps || typeof bps !== 'object') return conf;
    const patch = bps[bp];
    if (!patch || typeof patch !== 'object') return conf;

    return { ...conf, ...patch };
  }

  _getBreakpoint() {
    const w = window.innerWidth || document.documentElement.clientWidth || 0;
    if (w < 768) return 'mobile';
    if (w < 1200) return 'tablet';
    return 'desktop';
  }

  _clamp01(n) {
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  // ====== activate / reset ======
  _scheduleActivate(root, entry, reason) {
    const st = root.__hvSaState__;
    if (!st) return;
    const conf = st.conf;

    // отменяем предыдущие ожидания
    this._clearTimers(st);

    st.pending = true;

    const t = setTimeout(() => {
      // если за delay случился reset/перескан и т.п. — не стартуем
      if (!root.__hvSaState__ || root.__hvSaState__ !== st) return;
      if (!st.pending) return;

      st.pending = false;
      this._activateRoot(root, reason, entry);
    }, conf.delay);

    st.timers.add(t);

    this._dlog('scheduled', { ...this._ctx(root, entry), reason, delay: conf.delay });
  }

  _activateRoot(root, reason, entry) {
    const st = root.__hvSaState__;
    if (!st) return;
    const conf = st.conf;

    // группа
    if (st.isGroup) {
      const items = st.items.length ? st.items : [...root.querySelectorAll('[data-scroll-item]')];
      st.items = items;

      // добавляем activeClass на сам контейнер
      root.classList.add(conf.activeClass);

      // детерминированно по DOM, строго i=0..n-1
      items.forEach((el, i) => {
        const tt = setTimeout(() => {
          // если в процессе нас сбросили — не продолжаем
          const stNow = root.__hvSaState__;
          if (!stNow || stNow !== st) return;
          if (!stNow.active && i !== 0) return;

          el.classList.add(conf.activeClass);
          this._dlog('item-activated', { root: this._name(root), itemIndex: i, item: this._name(el) });
        }, conf.stagger * i);

        st.timers.add(tt);
      });

      st.active = true;
      st.done = true;
      this._dlog('activated-group', { ...this._ctx(root, entry), reason, stagger: conf.stagger, count: items.length });
      return;
    }

    // одиночный элемент
    root.classList.add(conf.activeClass);
    st.active = true;
    st.done = true;
    this._dlog('activated-single', { ...this._ctx(root, entry), reason });
  }

  _activateRootImmediately(root, reason) {
    const st = root.__hvSaState__;
    if (!st) return;
    const conf = st.conf;

    // группа - активируем все элементы сразу без stagger
    if (st.isGroup) {
      const items = st.items.length ? st.items : [...root.querySelectorAll('[data-scroll-item]')];
      st.items = items;

      // добавляем activeClass на сам контейнер
      root.classList.add(conf.activeClass);

      items.forEach((el) => {
        el.classList.add(conf.activeClass);
      });

      st.active = true;
      st.done = true;
      this._dlog('activated-group-immediately', { root: this._name(root), reason, count: items.length });
      return;
    }

    // одиночный элемент
    root.classList.add(conf.activeClass);
    st.active = true;
    st.done = true;
    this._dlog('activated-single-immediately', { root: this._name(root), reason });
  }

  _resetRoot(root, reason) {
    const st = root.__hvSaState__;
    if (!st) return;
    const conf = st.conf;

    if (conf.once) {
      this._dlog('reset-blocked-once', { root: this._name(root), reason });
      return;
    }

    this._clearTimers(st);

    st.pending = false;
    st.active = false;
    st.done = false;

    if (st.isGroup) {
      const items = st.items.length ? st.items : [...root.querySelectorAll('[data-scroll-item]')];
      items.forEach((el) => el.classList.remove(conf.activeClass));
      // также удаляем activeClass с самого контейнера
      root.classList.remove(conf.activeClass);
      this._dlog('reset-group', { root: this._name(root), reason, count: items.length });
    } else {
      root.classList.remove(conf.activeClass);
      this._dlog('reset-single', { root: this._name(root), reason });
    }
  }

  _resetAll(reason) {
    for (const root of this._nodes) this._resetRoot(root, reason);
  }

  _clearTimers(st) {
    for (const t of st.timers) clearTimeout(t);
    st.timers.clear();
  }

  // ====== debug ======
  _dlog(type, payload = {}) {
    const dbg = payload?.conf?.debug ?? this.o.debug;
    if (!dbg) return;

    console.log(`[ScrollAnimate] ${type}`, payload);
  }

  _ctx(root, entry) {
    const st = root.__hvSaState__;
    const rect = entry?.boundingClientRect || root.getBoundingClientRect();
    return {
      root: this._name(root),
      conf: st?.conf,
      isIntersecting: entry?.isIntersecting,
      ratio: entry?.intersectionRatio,
      scrollDir: this._scrollDir,
      rect: {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
      },
    };
  }

  _name(el) {
    if (!el || el.nodeType !== 1) return String(el);
    const id = el.id ? `#${el.id}` : '';
    const cls =
      el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  }
}

// ---- авто-инициализация при импорте ----
ScrollAnimate._ensureSingleton();
