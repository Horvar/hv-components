// modaler.js — универсальный контроллер модалок с пресетами
// Связка: [data-modal-button="<id>"] ↔ [data-modal-window="<id>"]
// Режимы: 'generic' | 'dropdown' | 'menu'
//
// - 'generic' : позиционирование и анимации целиком в CSS (бывш. 'center')
// - 'dropdown': «под кнопкой», JS считает позицию во вьюпорте (с авто-флипом вверх)
// - 'menu'    : панель под хедером; геометрия — стилями
//
// Конфигурация одним атрибутом:
//   data-modal-settings="preset1 preset2 {\"autoCloseOnLink\":true}"
//
// Поддерживаемые поля настроек (пресеты/JSON/data-*):
//   overlay, closeOnEsc, closeOnOutside, lockScroll, focusTrap,
//   autoCloseOnLink, gap, viewportMargin, mode('generic'|'dropdown'|'menu')
//
// Доп. поведение:
//   • У кнопки-триггера на время открытия ставится класс `is-active`.

export class Modaler {
  // ---------- Глобальные пресеты ----------
  static _globalPresets = new Map();
  static definePreset(name, conf = {}) {
    if (name) this._globalPresets.set(String(name), { ...conf });
  }
  static deletePreset(name) {
    this._globalPresets.delete(String(name));
  }
  static getPreset(name) {
    return this._globalPresets.get(String(name));
  }

  constructor(opts = {}) {
    const defaults = {
      overlay: true,
      closeOnEsc: true,
      closeOnOutside: true,
      lockScroll: true,
      focusTrap: true,
      autoCloseOnLink: false,
      gap: 8,
      viewportMargin: 8,
      zIndexBase: 999,
      debug: false,
      presets: null,
    };
    this.o = { ...defaults, ...opts };

    this._presets = new Map();
    Modaler._globalPresets.forEach((v, k) => this._presets.set(k, { ...v }));
    if (this.o.presets && typeof this.o.presets === 'object') {
      Object.entries(this.o.presets).forEach(([k, v]) => this._presets.set(String(k), { ...v }));
    }

    this._overlay = null;
    this._open = null; // { id, el, panel, conf, mode, anchorEl, triggerEl, restoreEl, linkHandler }
    this._modals = new Map(); // id -> record

    this._onDocumentClick = this._onDocumentClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onResizeScroll = this._onResizeScroll.bind(this);
    this._trapHandler = this._trapHandler.bind(this);

    this._scan();
    this._ensureOverlay();

    document.addEventListener('click', this._onDocumentClick, { passive: true });
    window.addEventListener('resize', this._onResizeScroll, { passive: true });
    window.addEventListener('scroll', this._onResizeScroll, { passive: true });
  }

  // ---------- Публичное API ----------
  open(id, anchorEl = null) {
    const rec = this._modals.get(id);
    if (!rec) return console.warn('[Modaler] modal not found:', id);

    // уже открыта — обновим якорь
    if (this._open && this._open.id === id) {
      this._open.anchorEl = anchorEl || this._open.anchorEl || null;
      if (rec.mode === 'dropdown') this._positionDropdown(rec, this._open.anchorEl);
      return;
    }

    // закроем чужую
    if (this._open) this.close();

    const { el, panel, conf, mode } = rec;
    const restoreEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Оверлей
    this._activateOverlay(!!conf.overlay);

    // ARIA + класс
    el.classList.add('is-active');
    el.setAttribute('aria-hidden', 'false');

    // Позиционирование (только для dropdown)
    if (mode === 'dropdown') this._positionDropdown(rec, anchorEl);

    // Скролл-лок
    if (conf.lockScroll) this._lockScroll(true);

    // Фокус/ловушка
    if (conf.focusTrap) setTimeout(() => this._focusFirst(panel), 0);

    // Слушатели
    if (conf.closeOnEsc) document.addEventListener('keydown', this._onKeyDown);
    if (conf.focusTrap) document.addEventListener('keydown', this._trapHandler, true);

    // Автозакрытие по ссылке
    let linkHandler = null;
    if (conf.autoCloseOnLink) {
      linkHandler = (e) => {
        const a = e.target.closest('a[href]');
        if (!a) return;
        if (a.hasAttribute('data-modal-keep-open')) return;
        if (e.defaultPrevented) return;
        if (e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (this._open) this._open.restoreEl = null; // не возвращаем фокус в триггер
        setTimeout(() => this.close(), 0);
      };
      panel.addEventListener('click', linkHandler);
    }

    // Активность на триггере
    if (anchorEl?.getAttribute) {
      anchorEl.setAttribute('aria-expanded', 'true');
      anchorEl.setAttribute('aria-controls', id);
      if (anchorEl.classList) anchorEl.classList.add('is-active');
    }

    this._open = {
      id,
      el,
      panel,
      conf,
      mode,
      anchorEl: anchorEl || null,
      triggerEl: anchorEl || null,
      restoreEl,
      linkHandler,
    };

    el.dispatchEvent(new CustomEvent('modal:open', { detail: { id, mode, conf } }));
    if (this.o.debug) console.log('[Modaler] open:', id, { mode, conf });
  }

  close() {
    if (!this._open) return;
    const { id, el, conf, restoreEl, panel, linkHandler, triggerEl } = this._open;

    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keydown', this._trapHandler, true);
    if (linkHandler) panel.removeEventListener('click', linkHandler);

    el.classList.remove('is-active');
    el.setAttribute('aria-hidden', 'true');

    this._activateOverlay(false);

    if (conf.lockScroll) this._lockScroll(false);

    // деактивируем триггер
    if (triggerEl?.getAttribute) triggerEl.setAttribute('aria-expanded', 'false');
    if (triggerEl?.classList) triggerEl.classList.remove('is-active');

    if (restoreEl && restoreEl.focus) restoreEl.focus();

    el.dispatchEvent(new CustomEvent('modal:close', { detail: { id } }));
    this._open = null;
    if (this.o.debug) console.log('[Modaler] close:', id);
  }

  toggle(id, anchorEl = null) {
    if (this._open && this._open.id === id) this.close();
    else this.open(id, anchorEl);
  }

  definePreset(name, conf = {}) {
    this._presets.set(String(name), { ...conf });
  }
  deletePreset(name) {
    this._presets.delete(name);
  }

  // ---------- Инициализация ----------
  _scan() {
    document.querySelectorAll('[data-modal-window]').forEach((el) => {
      const id = el.getAttribute('data-modal-window');
      if (!id) return;

      const panel = el.querySelector('.modal__panel') || el;

      const fromSettings = this._parseSettings(el);
      const fallbackFromData = {
        overlay: this._maybeBool(el.dataset.modalOverlay),
        closeOnEsc: this._maybeBool(el.dataset.modalCloseOnEsc),
        closeOnOutside: this._maybeBool(el.dataset.modalCloseOnOutside),
        lockScroll: this._maybeBool(el.dataset.modalLockScroll),
        focusTrap: this._maybeBool(el.dataset.modalFocusTrap),
        autoCloseOnLink: this._maybeBool(el.dataset.modalAutoCloseOnLink),
        mode: el.dataset.modalMode,
      };

      const base = {
        overlay: this.o.overlay,
        closeOnEsc: this.o.closeOnEsc,
        closeOnOutside: this.o.closeOnOutside,
        lockScroll: this.o.lockScroll,
        focusTrap: this.o.focusTrap,
        autoCloseOnLink: this.o.autoCloseOnLink,
        gap: this.o.gap,
        viewportMargin: this.o.viewportMargin,
        mode: undefined,
      };

      const conf = this._merge(base, fromSettings, fallbackFromData);

      // Определим режим
      let mode = conf.mode;
      if (!['generic', 'dropdown', 'menu'].includes(mode)) {
        mode = el.classList.contains('modal--dropdown')
          ? 'dropdown'
          : el.classList.contains('modal--menu')
            ? 'menu'
            : el.classList.contains('modal--center')
              ? 'generic' // backward-compat
              : 'generic';
      }

      // Классы режима
      el.classList.toggle('modal--generic', mode === 'generic');
      el.classList.toggle('modal--dropdown', mode === 'dropdown');
      el.classList.toggle('modal--menu', mode === 'menu');

      el.setAttribute('aria-hidden', 'true');
      this._modals.set(id, { id, el, panel, conf, mode });
    });
  }

  _ensureOverlay() {
    if (this._overlay) return;
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.setAttribute('aria-hidden', 'true');
    ov.style.zIndex = String(this.o.zIndexBase);
    ov.addEventListener('click', () => {
      if (this._open && this._open.conf.closeOnOutside) this.close();
    });
    document.body.appendChild(ov);
    this._overlay = ov;
  }

  // ---------- Обработчики ----------
  _onDocumentClick(e) {
    const btn = e.target.closest('[data-modal-button]');
    if (btn) {
      const id = btn.getAttribute('data-modal-button');
      this.toggle(id, btn);
      return;
    }
    if (e.target.closest('[data-modal-close]')) {
      this.close();
      return;
    }
    if (this._open && this._open.conf.closeOnOutside) {
      const inside = e.target.closest('[data-modal-window]');
      if (!inside) this.close();
    }
  }

  _onKeyDown(e) {
    if (e.key === 'Escape' && this._open && this._open.conf.closeOnEsc) {
      e.preventDefault();
      this.close();
    }
  }

  _trapHandler(e) {
    if (!this._open || !this._open.conf.focusTrap || e.key !== 'Tab') return;
    const focusables = this._focusables(this._open.panel);
    if (!focusables.length) return;
    const first = focusables[0],
      last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
      return;
    }
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
      return;
    }
  }

  _onResizeScroll() {
    if (!this._open) return;
    if (this._open.mode === 'dropdown') this._positionDropdown(this._open, this._open.anchorEl);
    // 'menu' и 'generic' — позиционируются стилями
  }

  // ---------- Геометрия ----------
  _positionDropdown(rec, anchorEl) {
    const { el, panel, conf } = rec;
    if (!anchorEl) return;

    const vm = conf.viewportMargin ?? this.o.viewportMargin;
    const gap = conf.gap ?? this.o.gap;

    // временно показать для измерений, если скрыт
    const wasHidden = !el.classList.contains('is-active');
    if (wasHidden) {
      el.style.visibility = 'hidden';
      el.classList.add('is-active');
    }

    const ar = anchorEl.getBoundingClientRect();
    const ph = panel.offsetHeight;
    const pw = panel.offsetWidth;

    // Y: вниз с флипом вверх
    let top = ar.bottom + gap;
    let placeUp = false;
    if (top + ph + vm > window.innerHeight) {
      const upTop = ar.top - gap - ph;
      if (upTop >= vm) {
        top = upTop;
        placeUp = true;
      } else {
        top = Math.max(vm, Math.min(top, window.innerHeight - vm - ph));
      }
    }

    // X: от левого края якоря, но внутри вьюпорта
    let left = ar.left;
    if (left + pw + vm > window.innerWidth) left = Math.max(vm, window.innerWidth - vm - pw);
    if (left < vm) left = vm;

    panel.style.position = 'fixed';
    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';

    el.classList.toggle('modal--drop-up', placeUp);

    if (wasHidden) {
      el.classList.remove('is-active');
      el.style.visibility = '';
    }
  }

  // ---------- Хелперы ----------
  _lockScroll(on) {
    const body = document.body;
    if (on) {
      if (body.dataset._modalLock) return;
      const sw = window.innerWidth - document.documentElement.clientWidth;
      if (sw > 0) body.style.paddingRight = `${sw}px`;
      body.style.overflow = 'hidden';
      body.dataset._modalLock = '1';
    } else {
      delete body.dataset._modalLock;
      body.style.overflow = '';
      body.style.paddingRight = '';
    }
  }

  _activateOverlay(on) {
    if (!this._overlay) return;
    if (on) {
      this._overlay.classList.add('is-active');
      this._overlay.setAttribute('aria-hidden', 'false');
    } else {
      this._overlay.classList.remove('is-active');
      this._overlay.setAttribute('aria-hidden', 'true');
    }
  }

  _focusFirst(root) {
    const target = root.querySelector('[data-autofocus]') || this._focusables(root)[0] || root;
    if (target?.focus) target.focus();
  }

  _focusables(root) {
    return Array.from(
      root.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
  }

  _maybeBool(val) {
    if (val == null) return undefined;
    const s = String(val).toLowerCase();
    if (s === 'true' || s === '1' || s === '') return true;
    if (s === 'false' || s === '0') return false;
    return undefined;
  }

  _merge(...objs) {
    const out = {};
    for (const obj of objs) {
      if (!obj || typeof obj !== 'object') continue;
      for (const k of Object.keys(obj)) if (obj[k] !== undefined) out[k] = obj[k];
    }
    return out;
  }

  _parseSettings(el) {
    const raw = el.getAttribute('data-modal-settings');
    if (!raw) return {};
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
      } else buf += ch;
    }
    if (buf.trim()) parts.push(buf.trim());

    let conf = {};
    for (const token of parts) {
      if (!token) continue;
      if (token.startsWith('{')) {
        try {
          conf = this._merge(conf, JSON.parse(token));
        } catch (e) {
          console.warn('[Modaler] bad JSON in data-modal-settings:', token, e);
        }
      } else {
        const preset = this._presets.get(token);
        if (!preset) {
          console.warn('[Modaler] unknown preset:', token);
          continue;
        }
        conf = this._merge(conf, preset);
      }
    }
    return conf;
  }
}
