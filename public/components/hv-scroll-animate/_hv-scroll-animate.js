// src/scripts/_hv-scroll-animate.js
export class ScrollAnimate {
  static _globalPresets = new Map();
  static definePreset(name, conf = {}) {
    if (!name) return;
    this._globalPresets.set(String(name), { ...conf });
    ScrollAnimate._ensureSingleton();
    ScrollAnimate._inst._scan(true);
  }

  static _inst = null;
  static _ensureSingleton() {
    if (!ScrollAnimate._inst) ScrollAnimate._inst = new ScrollAnimate({ _auto: true });
    return ScrollAnimate._inst;
  }

  constructor(opts = {}) {
    const defaults = {
      once: true,
      threshold: 0.2,
      rootMargin: '0px',
      activeClass: 'is-animated',
      delay: 0,
      stagger: 0,
      direction: 'both',
      breakpoints: null,
      debug: false,
      _auto: false,
    };
    this.o = { ...defaults, ...opts };

    this._elements = new Map();
    this._observers = new Map();
    this._currentBreakpoint = null;

    this._scan();

    this._onResize = this._debounce(() => this._handleResize(), 150);
    window.addEventListener('resize', this._onResize);

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
      // Игнорируем ошибки observe
    }

    if (this.o.debug) console.log('[ScrollAnimate] ready');
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    try {
      this._mo?.disconnect();
    } catch {
      // Игнорируем ошибки disconnect
    }
    this._observers.forEach((obs) => obs.disconnect());
    this._observers.clear();
    this._elements.clear();
  }

  _scan(force = false) {
    const nodes = document.querySelectorAll('[data-scroll-animate]');
    nodes.forEach((root) => {
      if (!force && root.__hvScrollAnimateReady__) return;
      root.__hvScrollAnimateReady__ = true;

      const conf = this._readSettings(root);
      const items = root.querySelectorAll('[data-scroll-item]');

      if (items.length > 0) {
        const groupConf = { ...conf, _isGroup: true, _items: Array.from(items) };
        this._elements.set(root, groupConf);
        this._observeElement(root, groupConf);
      } else {
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
          console.warn('[ScrollAnimate] bad JSON:', token, e);
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

    const bpConf = this._getBreakpointConfig(conf.breakpoints);
    if (bpConf) {
      conf = { ...conf, ...bpConf };
    }

    return conf;
  }

  _getBreakpointConfig(breakpoints) {
    if (!breakpoints) return null;
    const width = window.innerWidth;
    let bp = 'desktop';
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
      this._observers.forEach((obs) => obs.disconnect());
      this._observers.clear();
      this._elements.clear();
      document.querySelectorAll('[data-scroll-animate]').forEach((el) => {
        el.__hvScrollAnimateReady__ = false;
      });
      this._scan(true);
      if (this.o.debug) console.log('[ScrollAnimate] breakpoint changed:', oldBp, '->', newBp);
    }
  }

  _observeElement(el, conf) {
    const options = {
      threshold: [0, conf.threshold],
      rootMargin: conf.rootMargin,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const rect = entry.boundingClientRect;
        const vh = window.innerHeight;

        // Зона триггера для АКТИВАЦИИ
        const triggerZoneTop = rect.top + rect.height * conf.threshold;
        const isViewportBelowTrigger = vh > triggerZoneTop;

        // Границы элемента для ДЕАКТИВАЦИИ
        const isViewportAboveElement = vh < rect.top;

        if (conf.debug) {
          console.log('[ScrollAnimate]', {
            el,
            isViewportBelowTrigger,
            isViewportAboveElement,
            triggerZoneTop,
            'rect.top': rect.top,
            'rect.bottom': rect.bottom,
            viewportBottom: vh,
          });
        }

        // ЕСЛИ VIEWPORT ВЫШЕ ЭЛЕМЕНТА - УДАЛИТЬ ВСЕ НАХУЙ
        if (isViewportAboveElement) {
          if (conf.debug) {
            console.log('[ScrollAnimate] ❌ VIEWPORT ABOVE - CLEARING EVERYTHING');
          }
          this._clearElement(el, conf);
          return;
        }

        // ЕСЛИ VIEWPORT НИЖЕ ТРИГГЕРА - АКТИВИРОВАТЬ
        if (isViewportBelowTrigger) {
          const isAlreadyActivated = conf._isGroup
            ? el.__hvScrollAnimateGroupActivated__ || false
            : el.classList.contains(conf.activeClass);

          if (!isAlreadyActivated) {
            if (conf.debug) {
              console.log('[ScrollAnimate] ✅ VIEWPORT BELOW TRIGGER - ACTIVATING');
            }
            this._activateElement(el, conf);
          }
        }
      });
    }, options);

    observer.observe(el);
    this._observers.set(el, observer);
  }

  _clearElement(el, conf) {
    // Отменить ВСЕ таймеры
    if (el.__hvScrollAnimateTimers__) {
      el.__hvScrollAnimateTimers__.forEach((timer) => clearTimeout(timer));
      el.__hvScrollAnimateTimers__ = [];
    }
    if (el.__hvScrollAnimateTimer__) {
      clearTimeout(el.__hvScrollAnimateTimer__);
      el.__hvScrollAnimateTimer__ = null;
    }

    // Удалить ВСЕ классы
    if (conf._isGroup) {
      el.classList.remove(conf.activeClass);
      conf._items.forEach((item) => item.classList.remove(conf.activeClass));
      el.__hvScrollAnimateGroupActivated__ = false;
    } else {
      el.classList.remove(conf.activeClass);
    }
  }

  _activateElement(el, conf) {
    // СНАЧАЛА ОТМЕНЯЕМ ВСЕ ПРЕДЫДУЩИЕ ТАЙМЕРЫ
    if (el.__hvScrollAnimateTimers__) {
      el.__hvScrollAnimateTimers__.forEach((timer) => clearTimeout(timer));
      el.__hvScrollAnimateTimers__ = [];
    }
    if (el.__hvScrollAnimateTimer__) {
      clearTimeout(el.__hvScrollAnimateTimer__);
      el.__hvScrollAnimateTimer__ = null;
    }

    if (conf._isGroup) {
      const baseDelay = conf.delay || 0;
      const stagger = conf.stagger || 0;

      if (conf.debug) {
        console.log('[ScrollAnimate] ✅ ACTIVATING GROUP:', el);
      }

      el.__hvScrollAnimateTimers__ = [];

      if (baseDelay > 0) {
        const timer = setTimeout(() => el.classList.add(conf.activeClass), baseDelay);
        el.__hvScrollAnimateTimers__.push(timer);
      } else {
        el.classList.add(conf.activeClass);
      }

      conf._items.forEach((item, idx) => {
        const staggerDelay = idx * stagger;
        const totalDelay = baseDelay + staggerDelay;

        const timer = setTimeout(() => item.classList.add(conf.activeClass), Math.max(1, totalDelay));
        el.__hvScrollAnimateTimers__.push(timer);
      });

      el.__hvScrollAnimateGroupActivated__ = true;

      if (conf.once) {
        const obs = this._observers.get(el);
        if (obs) {
          obs.unobserve(el);
          this._observers.delete(el);
        }
      }
    } else {
      const totalDelay = conf.delay || 0;

      if (conf.debug) {
        console.log('[ScrollAnimate] ✅ ACTIVATING:', el);
      }

      if (totalDelay > 0) {
        el.__hvScrollAnimateTimer__ = setTimeout(() => {
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

  _debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }
}

ScrollAnimate._ensureSingleton();
