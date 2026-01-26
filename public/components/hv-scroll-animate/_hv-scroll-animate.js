export class ScrollAnimate {
  // -------- глобальные пресеты --------
  static _globalPresets = new Map();
  static definePreset(name, conf = {}) {
    if (!name) return;
    this._globalPresets.set(String(name), { ...conf });
    // гарантируем авто-инстанс и перескан после каждого definePreset
    ScrollAnimate._ensureSingleton();
    ScrollAnimate._inst._scan(true);
  }

  // ====== авто-инстанс ======
  static _inst = null;
  static _ensureSingleton() {
    if (!ScrollAnimate._inst) ScrollAnimate._inst = new ScrollAnimate({ _auto: true });
    return ScrollAnimate._inst;
  }

  // ====== конструктор ======
  constructor(opts = {}) {
    const defaults = {
      once: true,
      threshold: 0.2,
      rootMargin: '0px',
      activeClass: 'is-animated',
      delay: 0,
      stagger: 0,
      direction: 'both', // 'up' | 'down' | 'both'
      breakpoints: null,
      debug: false,
      _auto: false,
    };
    this.o = { ...defaults, ...opts };

    // кэш элементов
    this._elements = new Map(); // element -> config
    this._observers = new Map(); // element -> IntersectionObserver

    // текущий breakpoint
    this._currentBreakpoint = null;
    this._breakpointOrder = ['mobile', 'tablet', 'desktop'];

    // для отслеживания направления скролла
    this._lastScrollY = window.pageYOffset || document.documentElement.scrollTop;

    // сканируем DOM
    this._scan();

    // отслеживаем изменение размера окна (для breakpoints)
    this._onResize = this._debounce(() => this._handleResize(), 150);
    window.addEventListener('resize', this._onResize);

    // лёгкий observer на добавление новых элементов
    this._mo = new MutationObserver((ml) => {
      let need = false;
      for (const m of ml) {
        if (m.type === 'childList') {
          if ([...m.addedNodes].some((n) => n.nodeType === 1 && n.hasAttribute?.('data-scroll-animate'))) {
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
      /* ignore */
    }

    if (this.o.debug) console.log('[ScrollAnimate] ready');
  }

  // ====== публично ======
  destroy() {
    window.removeEventListener('resize', this._onResize);
    try {
      this._mo?.disconnect();
    } catch {
      /* ignore */
    }
    this._observers.forEach((obs) => obs.disconnect());
    this._observers.clear();
    this._elements.clear();
  }

  // ====== сканирование и инициализация ======
  _scan(force = false) {
    const nodes = document.querySelectorAll('[data-scroll-animate]');
    nodes.forEach((root) => {
      if (!force && root.__hvScrollAnimateReady__) return;
      root.__hvScrollAnimateReady__ = true;

      const conf = this._readSettings(root);

      // определяем, это контейнер с группой или одиночный элемент
      const items = root.querySelectorAll('[data-scroll-item]');

      if (items.length > 0) {
        // группа элементов — отслеживаем только родителя, сохраняем ссылки на детей
        const groupConf = { ...conf, _isGroup: true, _items: Array.from(items) };
        this._elements.set(root, groupConf);
        this._observeElement(root, groupConf);
      } else {
        // одиночный элемент
        this._elements.set(root, conf);
        this._observeElement(root, conf);
      }
    });
  }

  _readSettings(root) {
    const raw = root.getAttribute('data-scroll-animate') || '';
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
      once: this.o.once,
      threshold: this.o.threshold,
      rootMargin: this.o.rootMargin,
      activeClass: this.o.activeClass,
      delay: this.o.delay,
      stagger: this.o.stagger,
      direction: this.o.direction,
      breakpoints: this.o.breakpoints,
      debug: this.o.debug,
    };
    let conf = { ...base };

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

    // применяем breakpoint, если есть
    const bpConf = this._getBreakpointConfig(conf.breakpoints);
    if (bpConf) {
      conf = { ...conf, ...bpConf };
    }

    return conf;
  }

  // ====== breakpoints ======
  _getBreakpointConfig(breakpoints) {
    if (!breakpoints) return null;

    const width = window.innerWidth;
    let bp = 'desktop'; // default

    if (width < 768) bp = 'mobile';
    else if (width < 1024) bp = 'tablet';

    this._currentBreakpoint = bp;
    return breakpoints[bp] || null;
  }

  _handleResize() {
    const oldBp = this._currentBreakpoint;
    const width = window.innerWidth;
    let newBp = 'desktop';

    if (width < 768) newBp = 'mobile';
    else if (width < 1024) newBp = 'tablet';

    if (oldBp !== newBp) {
      // breakpoint изменился - пересканируем все элементы
      this._observers.forEach((obs) => obs.disconnect());
      this._observers.clear();
      this._elements.clear();

      // сбрасываем флаги готовности
      document.querySelectorAll('[data-scroll-animate]').forEach((el) => {
        el.__hvScrollAnimateReady__ = false;
      });

      this._scan(true);
      if (this.o.debug) console.log('[ScrollAnimate] breakpoint changed:', oldBp, '->', newBp);
    }
  }

  // ====== IntersectionObserver ======
  _observeElement(el, conf) {
    const options = {
      threshold: conf.threshold,
      rootMargin: conf.rootMargin,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // проверяем направление скролла
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollDirection = currentScrollY > this._lastScrollY ? 'down' : 'up';
        this._lastScrollY = currentScrollY;

        if (conf.direction !== 'both' && conf.direction !== scrollDirection) {
          return;
        }

        if (entry.isIntersecting) {
          // элемент вошёл в viewport
          const isAlreadyActivated = conf._isGroup
            ? el.__hvScrollAnimateGroupActivated__
            : el.classList.contains(conf.activeClass);

          if (!isAlreadyActivated) {
            this._activateElement(el, conf);
          }
        } else {
          // элемент вышел из viewport
          if (!conf.once) {
            const isActive = conf._isGroup
              ? el.__hvScrollAnimateGroupActivated__
              : el.classList.contains(conf.activeClass);

            if (isActive) {
              this._deactivateElement(el, conf);
            }
          }
        }
      });
    }, options);

    observer.observe(el);
    this._observers.set(el, observer);
  }

  _activateElement(el, conf) {
    if (conf._isGroup) {
      // это группа — анимируем родителя + детей по очереди
      const baseDelay = conf.delay || 0;

      if (conf.debug) {
        console.log('[ScrollAnimate] activating group:', el, 'items:', conf._items.length);
      }

      // добавляем класс родителю сразу (с учётом базовой задержки)
      if (baseDelay > 0) {
        setTimeout(() => {
          el.classList.add(conf.activeClass);
        }, baseDelay);
      } else {
        el.classList.add(conf.activeClass);
      }

      // анимируем детей с stagger
      conf._items.forEach((item, idx) => {
        const staggerDelay = idx * (conf.stagger || 0);
        const totalDelay = baseDelay + staggerDelay;

        if (totalDelay > 0) {
          setTimeout(() => {
            item.classList.add(conf.activeClass);
          }, totalDelay);
        } else {
          item.classList.add(conf.activeClass);
        }
      });

      // отмечаем группу как активированную
      el.__hvScrollAnimateGroupActivated__ = true;

      // если once: true, отключаем observer
      if (conf.once) {
        const obs = this._observers.get(el);
        if (obs) {
          obs.unobserve(el);
          this._observers.delete(el);
        }
      }
    } else {
      // одиночный элемент
      const totalDelay = conf.delay || 0;

      if (conf.debug) {
        console.log('[ScrollAnimate] activating:', el, 'delay:', totalDelay);
      }

      if (totalDelay > 0) {
        setTimeout(() => {
          el.classList.add(conf.activeClass);

          if (conf.once) {
            const obs = this._observers.get(el);
            if (obs) {
              obs.unobserve(el);
              this._observers.delete(el);
            }
          }
        }, totalDelay);
      } else {
        el.classList.add(conf.activeClass);

        if (conf.once) {
          const obs = this._observers.get(el);
          if (obs) {
            obs.unobserve(el);
            this._observers.delete(el);
          }
        }
      }
    }
  }

  _deactivateElement(el, conf) {
    if (conf.debug) {
      console.log('[ScrollAnimate] deactivating:', el);
    }

    if (conf._isGroup) {
      // удаляем класс с родителя и всех детей
      el.classList.remove(conf.activeClass);
      conf._items.forEach((item) => {
        item.classList.remove(conf.activeClass);
      });
      el.__hvScrollAnimateGroupActivated__ = false;
    } else {
      el.classList.remove(conf.activeClass);
    }
  }

  // ====== утилиты ======
  _debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }
}

// ---- авто-инициализация при импорте ----
ScrollAnimate._ensureSingleton();
