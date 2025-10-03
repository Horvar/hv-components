// modaler.js — универсальный контроллер модалок с пресетами
// Связка: [data-modal-button="<id>"] ↔ [data-modal-window="<id>"]
// Режимы: 'generic' | 'dropdown' | 'menu'
//
// Конфигурация одним атрибутом:
//   data-modal-settings="preset1 preset2 {\"autoCloseOnLink\":true}"
//
// Поля (пресеты/JSON/частично data-*):
//   overlay, closeOnEsc, closeOnOutside, lockScroll, focusTrap,
//   autoCloseOnLink, gap, viewportMargin, mode('generic'|'dropdown'|'menu'),
//   flip(true|false) — для dropdown,
//   anchor (selector|Element) — для menu,
//   fitRest (bool) — для menu; если true и есть anchor, панель занимает остаток экрана.
//
// Доп. поведение:
//   • Кнопка-триггер и anchor получают класс `is-active` на время открытия.

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
      gap: 0,
      viewportMargin: 0,
      flip: false, // dropdown: авто-флип по вертикали
      zIndexBase: 999,
      debug: false,
      presets: null,
      respectGutter: true, // не компенсировать полосу, если на html задан scrollbar-gutter: stable
    };
    this.o = { ...defaults, ...opts };

    this._presets = new Map();
    Modaler._globalPresets.forEach((v, k) => this._presets.set(k, { ...v }));
    if (this.o.presets && typeof this.o.presets === 'object') {
      Object.entries(this.o.presets).forEach(([k, v]) => this._presets.set(String(k), { ...v }));
    }

    this._overlay = null;
    this._open = null; // { id, el, panel, conf, mode, anchorEl, triggerEl, restoreEl, linkHandler, vvBound }
    this._modals = new Map();

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
  open(id, anchorFromBtn = null) {
    const rec = this._modals.get(id);
    if (!rec) return console.warn('[Modaler] modal not found:', id);

    // уже открыта — обновим геометрию
    if (this._open && this._open.id === id) {
      if (rec.mode === 'dropdown') {
        this._open.anchorEl = anchorFromBtn || this._open.anchorEl || null;
        this._positionDropdown(rec, this._open.anchorEl);
      }
      if (rec.mode === 'menu') this._positionMenu(this._open);
      return;
    }

    if (this._open) this.close();

    const { el, panel, conf, mode } = rec;
    const restoreEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // resolve anchor для menu (отдельно от fitRest)
    let menuAnchorEl = null;
    if (mode === 'menu') {
      menuAnchorEl = this._resolveEl(conf.anchor) || this._resolveEl(el.dataset.modalAnchor) || null;
    }

    // Оверлей
    this._activateOverlay(!!conf.overlay);

    // ARIA + класс
    el.classList.add('is-active');
    el.setAttribute('aria-hidden', 'false');

    // Геометрия
    if (mode === 'dropdown') this._positionDropdown(rec, anchorFromBtn);
    if (mode === 'menu') this._positionMenu({ ...rec, anchorEl: menuAnchorEl });

    // Лок скролла
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
        if (this._open) this._open.restoreEl = null;
        setTimeout(() => this.close('link'), 0);
      };
      panel.addEventListener('click', linkHandler);
    }

    // Активность на триггере
    if (anchorFromBtn?.getAttribute) {
      anchorFromBtn.setAttribute('aria-expanded', 'true');
      anchorFromBtn.setAttribute('aria-controls', id);
      anchorFromBtn.classList?.add('is-active');
    }

    // Активность на якоре меню (если есть)
    if (menuAnchorEl?.classList) menuAnchorEl.classList.add('is-active');

    // visualViewport для fitRest
    let vvBound = null;
    if (mode === 'menu' && conf.fitRest === true && menuAnchorEl) {
      vvBound = () => this._onResizeScroll();
      if (window.visualViewport) {
        visualViewport.addEventListener('resize', vvBound, { passive: true });
        visualViewport.addEventListener('scroll', vvBound, { passive: true });
      }
    }

    this._open = {
      id,
      el,
      panel,
      conf,
      mode,
      anchorEl: mode === 'dropdown' ? anchorFromBtn || null : menuAnchorEl || null,
      triggerEl: anchorFromBtn || null,
      restoreEl,
      linkHandler,
      vvBound,
    };

    el.dispatchEvent(new CustomEvent('modal:open', { detail: { id, mode, conf } }));
    if (this.o.debug) console.log('[Modaler] open:', id, { mode, conf });
  }

  close(reason = 'api') {
    if (!this._open) return;
    const { id, el, conf, restoreEl, panel, linkHandler, triggerEl, mode, anchorEl, vvBound } = this._open;

    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keydown', this._trapHandler, true);
    if (linkHandler) panel.removeEventListener('click', linkHandler);

    // снять vv слушатели
    if (vvBound && window.visualViewport) {
      visualViewport.removeEventListener('resize', vvBound);
      visualViewport.removeEventListener('scroll', vvBound);
    }

    el.classList.remove('is-active');
    el.setAttribute('aria-hidden', 'true');

    this._activateOverlay(false);
    if (conf.lockScroll) this._lockScroll(false);

    // деактивируем триггер
    if (triggerEl?.getAttribute) triggerEl.setAttribute('aria-expanded', 'false');
    triggerEl?.classList?.remove('is-active');

    // деактивируем якорь
    anchorEl?.classList?.remove('is-active');

    // осторожный возврат фокуса
    let shouldRestore = !!restoreEl && !(mode === 'dropdown' && (reason === 'outside' || reason === 'overlay'));
    if (shouldRestore && restoreEl.focus) {
      try {
        restoreEl.focus({ preventScroll: true });
      } catch {
        restoreEl.focus();
      }
    }

    el.dispatchEvent(new CustomEvent('modal:close', { detail: { id, reason } }));
    this._open = null;
    if (this.o.debug) console.log('[Modaler] close:', id, { reason });
  }

  toggle(id, anchorEl = null) {
    if (this._open && this._open.id === id) this.close('toggle');
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
        flip: this._maybeBool(el.dataset.modalFlip),
        anchor: el.dataset.modalAnchor, // селектор якоря (опционально)
        fitRest: this._maybeBool(el.dataset.modalFitRest), // можно и data-атрибутом, если надо
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
        flip: this.o.flip,
        mode: undefined,
        anchor: undefined,
        fitRest: undefined,
      };

      const conf = this._merge(base, fromSettings, fallbackFromData);

      // режим
      let mode = conf.mode;
      if (!['generic', 'dropdown', 'menu'].includes(mode)) {
        mode = el.classList.contains('modal--dropdown')
          ? 'dropdown'
          : el.classList.contains('modal--menu')
            ? 'menu'
            : el.classList.contains('modal--center')
              ? 'generic'
              : 'generic';
      }

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
      if (this._open && this._open.conf.closeOnOutside) this.close('overlay');
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
      this.close('button');
      return;
    }
    if (this._open && this._open.conf.closeOnOutside) {
      const inside = e.target.closest('[data-modal-window]');
      if (!inside) {
        this.close('outside');
        return;
      }
    }
  }

  _onKeyDown(e) {
    if (e.key === 'Escape' && this._open && this._open.conf.closeOnEsc) {
      e.preventDefault();
      this.close('esc');
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
    if (this._open.mode === 'menu') this._positionMenu(this._open);
    // 'generic' — стилями
  }

  // ---------- Геометрия ----------
  _positionDropdown(rec, anchorEl) {
    const { el, panel, conf } = rec;
    if (!anchorEl) return;

    const vm = conf.viewportMargin ?? this.o.viewportMargin;
    const gap = conf.gap ?? this.o.gap;
    const flip = conf.flip ?? this.o.flip;

    const wasHidden = !el.classList.contains('is-active');
    if (wasHidden) {
      el.style.visibility = 'hidden';
      el.classList.add('is-active');
    }

    const ar = anchorEl.getBoundingClientRect();
    const ph = panel.offsetHeight;
    const pw = panel.offsetWidth;

    let top = ar.bottom + gap;
    let placeUp = false;

    if (flip) {
      if (top + ph + vm > window.innerHeight) {
        const upTop = ar.top - gap - ph;
        if (upTop >= vm) {
          top = upTop;
          placeUp = true;
        } else {
          top = Math.max(vm, Math.min(top, window.innerHeight - vm - ph));
        }
      }
    } else {
      top = ar.bottom + gap; // без клампа — едем за якорем
      placeUp = false;
    }

    let left = ar.left;
    if (left + pw + vm > window.innerWidth) left = Math.max(vm, window.innerWidth - vm - pw);
    if (left < vm) left = vm;

    panel.style.position = 'fixed';
    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';

    el.classList.toggle('modal--drop-up', !!placeUp);

    if (wasHidden) {
      el.classList.remove('is-active');
      el.style.visibility = '';
    }
  }

  // menu: ставим top под якорь; fitRest — по желанию
  _positionMenu(rec) {
    const { el, panel, conf } = rec;
    const anchorEl = rec.anchorEl || this._resolveEl(conf.anchor) || this._resolveEl(el.dataset.modalAnchor);
    if (!anchorEl) {
      // без якоря — всё на CSS, чистим inline-геометрию
      panel.style.position = '';
      panel.style.top = '';
      panel.style.left = '';
      panel.style.right = '';
      if (!conf.fitRest) {
        panel.style.height = '';
        panel.style.maxHeight = '';
        panel.style.overflow = '';
      }
      return;
    }

    const gap = conf.gap ?? this.o.gap;
    const r = anchorEl.getBoundingClientRect();

    // Всегда ставим под якорь
    panel.style.position = 'fixed';
    panel.style.left = '0';
    panel.style.right = '0';
    panel.style.top = `${Math.round(r.bottom + gap)}px`;
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';

    if (conf.fitRest === true) {
      // Заполняем остаток визуального вьюпорта (для мобильных со всякими панелями)
      const vvH = (window.visualViewport && Math.max(0, Math.round(visualViewport.height))) || window.innerHeight;
      const top = Math.round(r.bottom + gap);
      const height = Math.max(0, vvH - top);
      panel.style.height = `${height}px`;
      panel.style.maxHeight = 'none';
      panel.style.overflow = 'auto';
    } else {
      // размер — на усмотрение CSS
      panel.style.height = '';
      panel.style.maxHeight = '';
      panel.style.overflow = '';
    }
  }

  // ---------- Хелперы ----------
  _resolveEl(input) {
    if (!input) return null;
    if (typeof input === 'string') return document.querySelector(input);
    if (input instanceof Element) return input;
    return null;
  }

  _lockScroll(on) {
    const body = document.body;
    const root = document.documentElement;

    if (on) {
      if (body.dataset._modalLock) return;

      // 1) ширина полосы
      let sw = window.innerWidth - root.clientWidth;

      // 2) если есть gutter — компенсация не нужна
      if (this.o.respectGutter) {
        try {
          const cs = getComputedStyle(root);
          if ((cs.scrollbarGutter || '').includes('stable')) sw = 0;
        } catch {
          void 0;
        }
      }

      if (sw > 0) body.style.paddingRight = `${sw}px`;
      if (sw > 0) root.style.setProperty('--scrollbar-comp', `${sw}px`);
      else root.style.removeProperty('--scrollbar-comp');

      root.classList.add('is-scroll-locked');
      body.style.overflow = 'hidden';
      body.dataset._modalLock = '1';
    } else {
      delete body.dataset._modalLock;
      body.style.overflow = '';
      body.style.paddingRight = '';

      root.style.removeProperty('--scrollbar-comp');
      root.classList.remove('is-scroll-locked');
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
