// src/components/hv-tabs/_hv-tabs.js
// минимальный, автономный таб-контроллер с пресетами и ресканом
// Разметка:
// <div data-tabs-settings="myPreset">
//   <div data-tablist>
//     <button data-tab-button data-tab="t1" class="is-selected">Tab 1</button>
//     <button data-tab-button data-tab="t2">Tab 2</button>
//   </div>
//   <div data-tab-panel data-tab="t1" class="is-visible">Panel 1</div>
//   <div data-tab-panel data-tab="t2">Panel 2</div>
// </div>
//
// API:
// Tabs.definePreset('name', { trigger:'click'|'hover', initial:'first'|'last' });
// // при изменении пресета — все контейнеры с data-tabs-settings="name" аккуратно переинициализируются.
//
// Поведение панелей:
// - НЕ используем hidden.
// - Активная панель получает класс panelActiveClass (по умолчанию 'is-visible')
// - Неактивные панели — без этого класса.
//
// Важно: для доступности мы оставляем aria-hidden, role, aria-selected и т.д.

export class Tabs {
  // ---------- статическое ----------
  static _instance = null;
  static _presets = Object.create(null);

  static _ensure(opts = {}) {
    if (!Tabs._instance) Tabs._instance = new Tabs(opts);
    return Tabs._instance;
  }

  static definePreset(name, conf) {
    if (!name) return;
    Tabs._presets[name] = { ...conf };
    Tabs._ensure()._reinitByPreset(name);
  }

  // ---------- конструктор ----------
  constructor(opts = {}) {
    this.o = {
      debug: false,
      ...opts,
    };
    this._containers = new Set(); // Set<HTMLElement>
    this._mmHoverFine = (typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)')) || {
      matches: true,
    };

    this._boundResize = this._onResize.bind(this);

    this._rescan(document);
    window.addEventListener('resize', this._boundResize, { passive: true });
  }

  // ---------- служебные ----------
  _log(...a) {
    if (this.o.debug) console.log('[hv-tabs]', ...a);
  }

  _onResize() {
    // под возможные доработки (адаптив, перенос line-wrap и т.д.)
    // сейчас ничего не делаем
  }

  _getConfFor(root) {
    const presetName = root.getAttribute('data-tabs-settings') || '';
    const preset = Tabs._presets[presetName] || {};
    const defaults = {
      trigger: 'click', // 'click' | 'hover'
      initial: 'first', // 'first' | 'last'
      panelActiveClass: 'is-visible',
      buttonActiveClass: 'is-selected',
    };
    const conf = { ...defaults, ...preset };

    // hover на десктопе, но на таче превращаем в click
    const effectiveTrigger = conf.trigger === 'hover' && this._mmHoverFine.matches ? 'hover' : 'click';

    return { presetName, ...conf, trigger: effectiveTrigger };
  }

  _rescan(root = document) {
    const all = root.querySelectorAll('[data-tabs-settings]');
    const keep = new Set();
    all.forEach((el) => {
      if (!el.__hvTabs__) this._setupContainer(el);
      keep.add(el);
    });
    // снести то, чего больше нет в DOM
    this._containers.forEach((c) => {
      if (!keep.has(c)) {
        this._teardownContainer(c);
        this._containers.delete(c);
      }
    });
  }

  _reinitByPreset(presetName) {
    this._containers.forEach((root) => {
      if ((root.getAttribute('data-tabs-settings') || '') !== presetName) return;

      let keepId = null;
      if (root.__hvTabs__?.items?.length) {
        const idx = root.__hvTabs__.index ?? 0;
        keepId = root.__hvTabs__.items[idx]?.id || null;
      }

      this._teardownContainer(root);
      this._setupContainer(root);

      if (keepId && root.__hvTabs__) {
        const i = root.__hvTabs__.items.findIndex((it) => it.id === keepId);
        if (i >= 0) this._activate(root, i);
      }
    });
  }

  _setupContainer(root) {
    const conf = this._getConfFor(root);

    // собрать кнопки и панели
    const btns = Array.from(root.querySelectorAll('[data-tab-button]'));
    const panels = Array.from(root.querySelectorAll('[data-tab-panel]'));

    // собрать items по совпадению data-tab
    const items = [];
    btns.forEach((b) => {
      const id = b.getAttribute('data-tab');
      if (!id) return;
      const panel = panels.find((p) => p.getAttribute('data-tab') === id) || null;
      items.push({ id, btn: b, panel });
    });

    // «активный» из разметки, иначе по initial
    let index = items.findIndex((it) => it.btn.classList.contains(conf.buttonActiveClass));
    if (index < 0) {
      index = conf.initial === 'last' ? items.length - 1 : 0;
      index = Math.max(0, Math.min(index, items.length - 1));
    }

    // роль/ARIA (немного базовой доступности — без фанатизма)
    const tablist = root.querySelector('[data-tablist]');
    if (tablist) tablist.setAttribute('role', 'tablist');

    items.forEach((it, i) => {
      const { btn, panel, id } = it;

      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === index ? 'true' : 'false');
      btn.setAttribute('tabindex', i === index ? '0' : '-1');

      // aria-controls — только если панель есть
      if (panel) {
        const panelId = `panel-${id}`;
        btn.setAttribute('aria-controls', panelId);

        panel.setAttribute('role', 'tabpanel');
        panel.id = panelId;
        // связка в обратную сторону (полезно для скринридеров)
        if (!btn.id) btn.id = `tab-${id}`;
        panel.setAttribute('aria-labelledby', btn.id);
      } else {
        btn.removeAttribute('aria-controls');
      }
    });

    // поставить слушатели
    const unsub = [];

    const onClick = (e, i) => {
      e.preventDefault();
      this._activate(root, i);
    };
    const onEnter = (i) => () => {
      if (conf.trigger !== 'hover') return;
      this._activate(root, i);
    };

    items.forEach((it, i) => {
      const { btn } = it;

      const hClick = (e) => onClick(e, i);
      btn.addEventListener('click', hClick);
      unsub.push(() => btn.removeEventListener('click', hClick));

      if (conf.trigger === 'hover') {
        const hEnter = onEnter(i);
        btn.addEventListener('mouseenter', hEnter);
        unsub.push(() => btn.removeEventListener('mouseenter', hEnter));
      }
    });

    // первичная активация
    this._applyActiveState(items, index, conf);

    // сохранить инстанс
    root.__hvTabs__ = {
      conf,
      items,
      index,
      unsub,
    };
    this._containers.add(root);
    this._log('init', root, conf);
  }

  _teardownContainer(root) {
    const inst = root.__hvTabs__;
    if (!inst) return;
    inst.unsub?.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    root.__hvTabs__ = null;
  }

  _activate(root, nextIndex) {
    const inst = root.__hvTabs__;
    if (!inst) return;
    const { items, conf } = inst;

    const n = Math.max(0, Math.min(nextIndex, items.length - 1));
    if (n === inst.index) return;

    this._applyActiveState(items, n, conf);
    inst.index = n;
    this._log('activate', items[n]?.id);
  }

  _applyActiveState(items, activeIndex, conf) {
    items.forEach((it, i) => {
      const on = i === activeIndex;

      // кнопка
      it.btn.classList.toggle(conf.buttonActiveClass, on);
      it.btn.setAttribute('aria-selected', on ? 'true' : 'false');
      it.btn.setAttribute('tabindex', on ? '0' : '-1');

      // панель (класс вместо hidden)
      if (it.panel) {
        it.panel.classList.toggle(conf.panelActiveClass, on);
        it.panel.setAttribute('aria-hidden', on ? 'false' : 'true');
      }
    });
  }
}

// автозапуск по импорту (как и в других компонентах)
Tabs._ensure();
