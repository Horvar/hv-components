// hv-header.js — режимы: 'static' | 'fixed' | 'fixedAfter'
// Взаимоисключающее поведение на скролл: scrollBehavior = 'none' | 'shrink' | 'reveal'
// Slide static↔fixed делает .hv-header__content; reveal/shrink — классы на .hv-header

export class hvHeader {
  constructor(opts = {}) {
    const defaults = {
      root: '.hv-header',

      // Позиционирование
      mode: 'static', // 'static' | 'fixed' | 'fixedAfter'
      threshold: 'sentinel', // number | '400' | '400px' | 'sentinel' | selector | Element
      sentinel: '.screen-top',

      // Взаимоисключающее поведение на скролле
      scrollBehavior: 'none', // 'none' | 'shrink' | 'reveal'

      // Универсальные дельты (приоритет над legacy). null = не заданы
      // ВНИЗ: shrink→compact, reveal→hide; ВВЕРХ: shrink→expand, reveal→show
      downDelta: null,
      upDelta: null,

      // LEGACY дельты (для обратной совместимости конфигов)
      // shrink (вниз -> compact, вверх -> expanded)
      shrinkShowDelta: 24,
      shrinkHideDelta: 24,
      shrinkInitiallyExpanded: true,

      // reveal (вниз -> hide, вверх -> show)
      revealShowDelta: 24,
      revealHideDelta: 24,
      revealInitiallyHidden: false, // (для режима fixed; в fixedAfter игнорируется — см. _updateState)

      // FX static↔fixed (анимирует .hv-header__content)
      fixFx: 'slide', // 'slide' | 'fade' | 'none'
      fixFxEnterDuration: 220,
      fixFxLeaveDuration: 220,
      fixFxEasing: 'ease',
      fixFxOnInit: true, // анимировать первичный вход при mode:'fixed'

      // Компенсация под fixed
      compensate: 'spacer', // 'spacer' | 'body' | 'none'
      contentContainer: 'body',

      // Визуалка у самого верха
      overlayAtTop: true,

      debug: false,
    };
    this.o = { ...defaults, ...opts };

    // Узлы
    this.root = typeof this.o.root === 'string' ? document.querySelector(this.o.root) : this.o.root;
    if (!this.root) {
      console.warn('[Header] root not found:', this.o.root);
      return;
    }

    // Внутренняя обёртка (rail) — если нет, создадим и перенесём детей внутрь
    this.rail = this.root.querySelector(':scope > .hv-header__content');
    if (!this.rail) {
      this.rail = document.createElement('div');
      this.rail.className = 'hv-header__content';
      while (this.root.firstChild) this.rail.appendChild(this.root.firstChild);
      this.root.appendChild(this.rail);
    }

    this.sentinel = this._resolveEl(this.o.sentinel);

    // Компенсация
    this.compensate = this.o.compensate;
    this.contentContainer = this._resolveEl(this.o.contentContainer) || document.body;
    this._spacer = null;
    if (this.compensate === 'spacer') {
      this._spacer = document.createElement('div');
      this._spacer.className = 'hv-header-spacer';
      this._spacer.style.height = '0px';
      this.root.insertAdjacentElement('afterend', this._spacer);
    }

    // Состояния
    this.topOffset = 0;
    this.thresholdPx = 0;
    this.headerHeight = 0;

    this._enabled = true;
    this._ticking = false;
    this._fxBusy = false;

    // Скролл-направление
    this._lastScrollY = window.scrollY;
    this._dir = 0; // -1 вверх, +1 вниз, 0 — нет движения
    this._acc = 0;

    // fixedAfter
    this._fixedEngaged = false;

    // Флаги классов
    this._isCompact = false;
    this._isHidden = false;

    // Компенсация (замок)
    this._compLocked = false;
    this._compHeight = 0;

    // Observers
    this._headerRO = null;
    this._sentinelRO = null;

    // Bind
    this._onScroll = this._onScroll.bind(this);
    this._onResize = this._onResize.bind(this);

    // CSS FX хуки
    this._initFxCssHooks();

    // Запуск
    this._observe();
    this._recalcAll();
    this._updateState(true);

    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });

    if (this.o.debug) console.log('[Header] init', this.o);
  }

  // ---------- Публичное API ----------
  setMode(mode) {
    const prev = this.o.mode;
    this.o.mode = mode;
    const isFixed = this.root.classList.contains('is-fixed');

    if (prev !== 'fixed' && mode === 'fixed' && !isFixed) {
      this._enterFixed({
        withFx: this.o.fixFxOnInit && this.o.fixFx !== 'none',
        startCompact: this._wantStartCompact(),
        startHidden: false,
      });
    } else if (prev === 'fixed' && mode !== 'fixed' && isFixed) {
      this._leaveFixed({ withFx: this.o.fixFx !== 'none' });
    } else {
      this._recalcAll();
      this._updateState(true);
    }
  }
  setThreshold(th) {
    this.o.threshold = th;
    this._recalcThreshold();
    this._updateState();
  }
  setSentinel(elOrSelectorOrNull) {
    if (this._sentinelRO) {
      this._sentinelRO.disconnect();
      this._sentinelRO = null;
    }
    this.sentinel = this._resolveEl(elOrSelectorOrNull);
    this._recalcTopOffset();
    this._recalcThreshold();
    this._updateState();
  }
  enable() {
    if (this._enabled) return;
    this._enabled = true;
    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });
    this._observe();
    this._recalcAll();
    this._updateState(true);
  }
  disable() {
    if (!this._enabled) return;
    this._enabled = false;
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
    this._unobserve();
  }
  destroy() {
    this.disable();
    this.root.classList.remove(
      'is-fixed',
      'is-compact',
      'is-hidden',
      'is-top',
      'hv-header--fx-slide',
      'hv-header--fx-fade',
      'fx-enter',
      'fx-leave',
      'hv-header--no-anim'
    );
    this.rail.classList.remove('rail--no-anim');
    if (this.compensate === 'body' && this.contentContainer) this.contentContainer.style.paddingTop = '';
    if (this._spacer) {
      this._spacer.remove();
      this._spacer = null;
    }
    document.documentElement.style.removeProperty('--hv-header-top-offset');
    this.root.style.removeProperty('--hv-header-height');
    this.root.style.removeProperty('--hv-header-fx-enter-dur');
    this.root.style.removeProperty('--hv-header-fx-leave-dur');
    this.root.style.removeProperty('--hv-header-fx-easing');
    this._compLocked = false;
    this._compHeight = 0;
    this._fxBusy = false;
  }

  // ---------- Внутрянка ----------
  _initFxCssHooks() {
    // очистим возможные прежние классы
    this.root.classList.remove('hv-header--fx-slide', 'hv-header--fx-fade');

    if (this.o.fixFx === 'slide') this.root.classList.add('hv-header--fx-slide');
    if (this.o.fixFx === 'fade') this.root.classList.add('hv-header--fx-fade');

    this.root.style.setProperty('--hv-header-fx-enter-dur', `${this.o.fixFxEnterDuration}ms`);
    this.root.style.setProperty('--hv-header-fx-leave-dur', `${this.o.fixFxLeaveDuration}ms`);
    this.root.style.setProperty('--hv-header-fx-easing', this.o.fixFxEasing);
  }

  _observe() {
    if ('ResizeObserver' in window) {
      this._headerRO = new ResizeObserver(() => this._recalcHeaderHeight());
      this._headerRO.observe(this.root);
    }
    if (this.sentinel && 'ResizeObserver' in window) {
      this._sentinelRO = new ResizeObserver(() => {
        this._recalcTopOffset();
        this._recalcThreshold();
        this._updateState();
      });
      this._sentinelRO.observe(this.sentinel);
    }
  }
  _unobserve() {
    if (this._headerRO) {
      this._headerRO.disconnect();
      this._headerRO = null;
    }
    if (this._sentinelRO) {
      this._sentinelRO.disconnect();
      this._sentinelRO = null;
    }
  }

  _onResize() {
    this._recalcAll();
    this._updateState(true);
  }
  _onScroll() {
    if (!this._ticking) {
      this._ticking = true;
      requestAnimationFrame(() => {
        this._updateState();
        this._ticking = false;
      });
    }
  }

  _recalcAll() {
    this._recalcTopOffset();
    this._recalcHeaderHeight();
    this._recalcThreshold();
  }

  _recalcTopOffset() {
    const offset = this.sentinel ? Math.max(0, Math.round(this.sentinel.getBoundingClientRect().height)) : 0;
    this.topOffset = offset;
    document.documentElement.style.setProperty('--hv-header-top-offset', `${offset}px`);
    if (this.o.debug) console.log('[Header] topOffset =', offset);
  }

  _recalcHeaderHeight() {
    const h = Math.max(0, Math.round(this.root.getBoundingClientRect().height));
    this.headerHeight = h;
    this.root.style.setProperty('--hv-header-height', `${h}px`);
    if (this.compensate === 'body' && this.root.classList.contains('is-fixed') && !this._compLocked) {
      this._applyCompensation(h);
    }
  }

  _recalcThreshold() {
    this.thresholdPx = this._resolveThresholdPx(this.o.threshold);
    if (this.o.debug) console.log('[Header] thresholdPx =', this.thresholdPx);
  }

  _resolveEl(input) {
    if (!input) return null;
    if (typeof input === 'string') return document.querySelector(input);
    if (input instanceof Element) return input;
    return null;
  }

  _resolveThresholdPx(th) {
    if (typeof th === 'number' && isFinite(th)) return Math.max(0, th);
    if (typeof th === 'string') {
      const s = th.trim();
      const m = s.match(/^(\d+(?:\.\d+)?)(px)?$/i);
      if (m) return Math.max(0, Number(m[1]));
      if (s === 'sentinel') return Math.max(1, this.topOffset);
      const el = this._resolveEl(s);
      if (el) {
        const rect = el.getBoundingClientRect();
        return Math.max(0, Math.round(rect.bottom + window.scrollY));
      }
      return 0;
    }
    const el = this._resolveEl(th);
    if (el) {
      const rect = el.getBoundingClientRect();
      return Math.max(0, Math.round(rect.bottom + window.scrollY));
    }
    return 0;
  }

  _applyCompensation(px) {
    if (this.compensate === 'none') return;
    const h = this._compLocked ? this._compHeight : Math.max(0, Math.round(px || 0));
    if (this.compensate === 'body') {
      if (this.contentContainer) this.contentContainer.style.paddingTop = h > 0 ? `${h}px` : '';
      return;
    }
    if (this.compensate === 'spacer' && this._spacer) {
      this._spacer.style.height = h > 0 ? `${h}px` : '0px';
    }
  }

  // Базовая «высота компенсатора»: что считать границей снапа
  _getBaseHeaderHeight() {
    // порядок приоритета: зафиксированная высота компенсации -> текущая высота -> фактическая высота spacer
    const spacerH = this.compensate === 'spacer' && this._spacer ? this._spacer.offsetHeight : 0;
    return Math.max(this._compHeight || 0, this.headerHeight || 0, spacerH || 0);
  }

  // Находимся ли в зоне мгновенного снятия fixed: начало страницы + базовая высота
  _inSnapZone() {
    const base = this._getBaseHeaderHeight();
    // небольшой люфт на пиксель, чтобы не дрожало на нуле
    return window.scrollY <= base + 1;
  }

  // Мгновенно сбросить всё к "обычному" статическому состоянию (без анимаций)
  _instantResetToStatic() {
    // Глушим переходы на кадр и любые FX
    this.root.classList.add('hv-header--no-anim');
    this.rail.classList.add('rail--no-anim');

    // Снимаем все классы состояния/FX
    this.root.classList.remove('is-fixed', 'is-hidden', 'is-compact', 'is-top', 'fx-enter', 'fx-leave');
    this._isHidden = false;
    this._isCompact = false;
    this._fixedEngaged = false;

    // Отпускаем компенсацию
    this._compLocked = false;
    this._compHeight = 0;
    this._applyCompensation(0);

    // Сброс занять сразу (reflow), затем вернуть возможность анимаций
    // force reflow
    this.root.offsetHeight;
    this.root.classList.remove('hv-header--no-anim');
    this.rail.classList.remove('rail--no-anim');

    // Разрешаем апдейты
    this._fxBusy = false;
  }

  // хотим ли входить во fixed уже компактным?
  _wantStartCompact() {
    if (this.o.scrollBehavior === 'shrink') return true; // ожидаем вход на даунскролле
    if (this.o.scrollBehavior === 'none') return !this.o.shrinkInitiallyExpanded;
    return false; // reveal: оставим крупным
  }

  // ---------- Машина состояний ----------
  _updateState() {
    // Если прямо сейчас идёт FX, но мы внезапно в зоне снапа — жёстко обрываем и сбрасываем всё
    if (this._fxBusy) {
      if (this.o.mode !== 'fixed' && this.root.classList.contains('is-fixed') && this._inSnapZone()) {
        this._instantResetToStatic();
      }
      if (this._fxBusy) return; // если не сбросили — выходим
    }

    const logicalY = window.scrollY + this.topOffset;

    // направление/накопление
    const dy = window.scrollY - this._lastScrollY;
    const dir = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    if (dir !== 0) {
      if (dir !== this._dir) {
        this._dir = dir;
        this._acc = 0;
      }
      this._acc += Math.abs(dy);
    }
    this._lastScrollY = window.scrollY;

    // Если мы не в режиме "всегда fixed" и заехали в зону снапа — мгновенно снять fixed
    if (this.o.mode !== 'fixed' && this.root.classList.contains('is-fixed') && this._inSnapZone()) {
      this._instantResetToStatic();
      return;
    }

    // static
    if (this.o.mode === 'static') {
      if (this.root.classList.contains('is-fixed')) this._leaveFixed({ withFx: this.o.fixFx !== 'none' });
      this._setCompact(false);
      this._setHidden(false);
      this.root.classList.remove('is-top');
      this._fixedEngaged = false;
      return;
    }

    // fixed
    if (this.o.mode === 'fixed') {
      if (!this.root.classList.contains('is-fixed')) {
        this._enterFixed({
          withFx: this.o.fixFxOnInit && this.o.fixFx !== 'none',
          startCompact: this._wantStartCompact(),
          startHidden: false,
        });
      }
      this._applyScrollBehavior();
      this._toggleTopClass();
      return;
    }

    // fixedAfter
    const shouldFix = logicalY >= this.thresholdPx;

    if (shouldFix && !this._fixedEngaged) {
      this._fixedEngaged = true;

      // >>> При reveal ВСЕГДА заходим во fixed скрытыми, чтобы не было "вспышки"
      const startHidden = this.o.scrollBehavior === 'reveal' ? true : false;

      // если стартуем скрытыми — входной slide/fade FX не нужен
      const withFx = this.o.fixFx !== 'none' && !startHidden;

      this._enterFixed({
        withFx,
        startCompact: this._wantStartCompact(),
        startHidden,
      });

      // сбросим направление/накопление после входа
      this._acc = 0;
      this._dir = 0;
    } else if (!shouldFix && this._fixedEngaged) {
      this._fixedEngaged = false;

      // Если в момент выхода оказались в зоне снапа — жёстко без анимаций
      if (this._inSnapZone()) {
        this._instantResetToStatic();
      } else {
        this._leaveFixed({ withFx: this.o.fixFx !== 'none' });
        this._setCompact(false);
        this._setHidden(false);
        this.root.classList.remove('is-top');
      }
    } else if (!shouldFix) {
      if (this.root.classList.contains('is-fixed')) {
        if (this._inSnapZone()) {
          this._instantResetToStatic();
        } else {
          this._leaveFixed({ withFx: this.o.fixFx !== 'none' });
        }
      }
      this._setCompact(false);
      this._setHidden(false);
      this.root.classList.remove('is-top');
    }

    if (this.root.classList.contains('is-fixed')) {
      this._applyScrollBehavior();
      this._toggleTopClass();
    }
  }

  // Универсальные геттеры порогов
  _getDownDelta() {
    if (Number.isFinite(this.o.downDelta)) return this.o.downDelta;
    return this.o.scrollBehavior === 'shrink'
      ? this.o.shrinkShowDelta // вниз -> compact
      : this.o.revealHideDelta; // вниз -> hide
  }
  _getUpDelta() {
    if (Number.isFinite(this.o.upDelta)) return this.o.upDelta;
    return this.o.scrollBehavior === 'shrink'
      ? this.o.shrinkHideDelta // вверх -> expand
      : this.o.revealShowDelta; // вверх -> show
  }

  _applyScrollBehavior() {
    switch (this.o.scrollBehavior) {
      case 'none':
        this._setCompact(!this.o.shrinkInitiallyExpanded);
        this._setHidden(false);
        break;

      case 'shrink': {
        // ВНИЗ -> compact ON, ВВЕРХ -> compact OFF
        const down = this._getDownDelta();
        const up = this._getUpDelta();

        if (this._dir === 1 && this._acc >= down) {
          this._setCompact(true);
          this._acc = 0;
        } else if (this._dir === -1 && this._acc >= up) {
          this._setCompact(false);
          this._acc = 0;
        }
        this._setHidden(false);
        break;
      }

      case 'reveal': {
        // ВНИЗ -> hide, ВВЕРХ -> show
        const down = this._getDownDelta();
        const up = this._getUpDelta();

        if (this._dir === 1 && this._acc >= down) {
          this._setHidden(true);
          this._acc = 0;
        } else if (this._dir === -1 && this._acc >= up) {
          this._setHidden(false);
          this._acc = 0;
        }
        break;
      }
    }
  }

  _toggleTopClass() {
    if (!this.o.overlayAtTop) return;
    if (window.scrollY <= 0) this.root.classList.add('is-top');
    else this.root.classList.remove('is-top');
  }

  // ---------- Переходы fixed/static (анимирует RAIL) ----------
  _enterFixed({ withFx = false, startCompact = false, startHidden = false } = {}) {
    if (this.root.classList.contains('is-fixed')) return;

    // 1) заморозить компенсацию на текущей высоте
    const h0 = Math.max(0, Math.round(this.root.getBoundingClientRect().height));
    this._compLocked = true;
    this._compHeight = h0;
    this._applyCompensation(h0);

    // 2) если входим скрытыми — на 1 кадр глушим анимации root,
    //    чтобы при добавлении is-fixed не было "вспышки"
    if (startHidden) this.root.classList.add('hv-header--no-anim');

    // 3) стартовые классы
    this._setCompact(!!startCompact);
    this._setHidden(!!startHidden);

    // 4) включить fixed
    this.root.classList.add('is-fixed');

    // 5) если глушили — вернуть анимации после reflow
    if (startHidden) {
      // force reflow
      this.root.offsetHeight;
      this.root.classList.remove('hv-header--no-anim');
    }

    // 6) если стартуем скрыто — входной FX не нужен
    if (startHidden || !withFx || this.o.fixFx === 'none') return;

    // 7) стандартный входной FX через rail
    this.rail.classList.add('rail--no-anim');
    this.root.classList.add('fx-enter');
    // force reflow
    this.rail.offsetHeight;

    this._fxBusy = true;
    requestAnimationFrame(() => {
      this.rail.classList.remove('rail--no-anim');
      requestAnimationFrame(() => {
        this.root.classList.remove('fx-enter');
        setTimeout(() => {
          this._fxBusy = false;
        }, this.o.fixFxEnterDuration + 50);
      });
    });
  }

  _leaveFixed({ withFx = false } = {}) {
    if (!this.root.classList.contains('is-fixed')) return;

    // Если reveal-режим и сейчас скрыт — на миг показать БЕЗ анимации root,
    // чтобы не суммировались transform'ы root и rail при fx-leave.
    if (this.o.scrollBehavior === 'reveal' && this._isHidden) {
      this.root.classList.add('hv-header--no-anim');
      this._setHidden(false);
      // force reflow
      this.root.offsetHeight;
      this.root.classList.remove('hv-header--no-anim');
    }

    if (!withFx || this.o.fixFx === 'none') {
      this._unsetFixed();
      this._setHidden(false);
      return;
    }

    // 1) rail уезжает вверх (-100%)
    this._fxBusy = true;
    this.root.classList.add('fx-leave');

    const onEnd = () => {
      cleanup();
      // 2) снять fixed и очистить скрытие без анимаций
      this.rail.classList.add('rail--no-anim');
      this.root.classList.remove('fx-leave');
      this._unsetFixed();
      this._setHidden(false);
      // force reflow
      this.rail.offsetHeight;
      requestAnimationFrame(() => {
        this.rail.classList.remove('rail--no-anim');
        this._fxBusy = false;
      });
    };

    const cleanup = () => {
      clearTimeout(fallback);
      this.rail.removeEventListener('transitionend', onEnd);
    };

    this.rail.addEventListener('transitionend', onEnd);
    const fallback = setTimeout(onEnd, this.o.fixFxLeaveDuration + 80);
  }

  _unsetFixed() {
    this.root.classList.remove('is-fixed');
    this._compLocked = false;
    this._compHeight = 0;
    this._applyCompensation(0);
  }

  // ---------- Классы ----------
  _setCompact(on) {
    if (on) {
      if (!this._isCompact) {
        this.root.classList.add('is-compact');
        this._isCompact = true;
      }
    } else {
      if (this._isCompact) {
        this.root.classList.remove('is-compact');
        this._isCompact = false;
      }
    }
  }
  _setHidden(on) {
    if (on) {
      if (!this._isHidden) {
        this.root.classList.add('is-hidden');
        this._isHidden = true;
      }
    } else {
      if (this._isHidden) {
        this.root.classList.remove('is-hidden');
        this._isHidden = false;
      }
    }
  }
}
