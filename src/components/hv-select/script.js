// src/components/hv-select/script.js
// Минималистичный кастомный select с пресетами и поддержкой single/multiple.
//
// Разметка:
// <div data-select-settings="myPreset">
//   <input type="hidden" name="my-field" />
//   <div data-select-trigger>
//     <span data-select-label></span>
//     <span data-select-clear aria-hidden="true">×</span>
//     <span data-select-arrow aria-hidden="true">▾</span>
//   </div>
//   <div data-select-dropdown hidden>
//     <input data-select-search type="text" placeholder="Поиск..." />
//     <ul data-select-list>
//       <li data-select-option data-value="1">Опция 1</li>
//       <li data-select-option data-value="2">Опция 2</li>
//       <li data-select-option data-value="3" data-disabled>Недоступно</li>
//     </ul>
//   </div>
// </div>
//
// Скрытый input:
//   single:   value="red"
//   multiple: value="red,blue,green"  (разделитель задаётся через delimiter)
//
// API:
//   Select.definePreset('name', { mode, placeholder, ... });

export class Select {
  // ---------- статическое ----------
  static _instance = null;
  static _presets = Object.create(null);

  static _ensure(opts = {}) {
    if (!Select._instance) Select._instance = new Select(opts);
    return Select._instance;
  }

  static definePreset(name, conf) {
    if (!name) return;
    Select._presets[name] = { ...conf };
    Select._ensure()._reinitByPreset(name);
  }

  // ---------- конструктор ----------
  constructor(opts = {}) {
    this.o = { debug: false, ...opts };
    this._containers = new Set();

    // глобальные обработчики — закрытие по клику снаружи и ESC
    this._boundDocClick = this._onDocumentClick.bind(this);
    this._boundDocKey = this._onDocumentKey.bind(this);
    document.addEventListener('click', this._boundDocClick, true);
    document.addEventListener('keydown', this._boundDocKey);

    this._rescan(document);

    // авто-подхват динамически добавленных контейнеров
    this._observer = new MutationObserver((mutations) => {
      const hasNew = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (n) =>
            n.nodeType === 1 && (n.matches?.('[data-select-settings]') || n.querySelector?.('[data-select-settings]'))
        )
      );
      if (hasNew) this._rescan(document);
    });
    this._observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---------- служебные ----------
  _log(...a) {
    if (this.o.debug) console.log('[hv-select]', ...a);
  }

  _getConf(root) {
    const presetName = root.getAttribute('data-select-settings') || '';
    const preset = Select._presets[presetName] || {};
    return {
      // режим выбора
      mode: 'single', // 'single' | 'multiple'
      // плейсхолдер, когда ничего не выбрано
      placeholder: 'Выберите...',
      // закрывать дропдаун после выбора (в single всегда true)
      closeOnSelect: false,
      // показывать кнопку сброса выбора
      clearable: true,
      // поле поиска внутри дропдауна
      searchable: false,
      // в multiple-режиме показывать выбранные значения как чипы
      chipMode: false,
      // разделитель для hidden input в multiple-режиме
      delimiter: ',',
      // CSS-классы состояний
      openClass: 'is-open',
      selectedClass: 'is-selected',
      disabledClass: 'is-disabled',
      // текст при отсутствии результатов поиска
      noResultsText: 'Ничего не найдено',
      ...preset,
      presetName,
    };
  }

  _rescan(root = document) {
    const all = root.querySelectorAll('[data-select-settings]');
    const keep = new Set();
    all.forEach((el) => {
      if (!el.__hvSelect__) this._setupContainer(el);
      keep.add(el);
    });
    // удаляем контейнеры, которых больше нет в DOM
    this._containers.forEach((c) => {
      if (!keep.has(c)) {
        this._teardownContainer(c);
        this._containers.delete(c);
      }
    });
  }

  _reinitByPreset(name) {
    this._containers.forEach((root) => {
      if ((root.getAttribute('data-select-settings') || '') !== name) return;
      // сохраняем текущий выбор перед переинициализацией
      const prev = root.__hvSelect__?.selected ? new Set(root.__hvSelect__.selected) : new Set();
      this._teardownContainer(root);
      this._setupContainer(root);
      // восстанавливаем выбор
      if (prev.size && root.__hvSelect__) {
        prev.forEach((v) => this._selectValue(root, v, false));
        this._updateLabel(root);
        this._updateInput(root);
      }
    });
  }

  // ---------- инициализация контейнера ----------
  _setupContainer(root) {
    const conf = this._getConf(root);

    const input = root.querySelector('input[type="hidden"]');
    const trigger = root.querySelector('[data-select-trigger]');
    const labelEl = root.querySelector('[data-select-label]');
    const clearEl = root.querySelector('[data-select-clear]');
    const dropdown = root.querySelector('[data-select-dropdown]');
    const search = root.querySelector('[data-select-search]');
    const list = root.querySelector('[data-select-list]');

    if (!trigger || !dropdown || !list) {
      this._log('skip — нет обязательных элементов', root);
      return;
    }

    const options = Array.from(list.querySelectorAll('[data-select-option]')).map((el) => ({
      el,
      value: el.getAttribute('data-value') ?? el.textContent.trim(),
      label: el.textContent.trim(),
      disabled: el.hasAttribute('data-disabled'),
    }));

    // ARIA
    root.setAttribute('role', 'combobox');
    root.setAttribute('aria-haspopup', 'listbox');
    root.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('tabindex', '0');
    list.setAttribute('role', 'listbox');
    if (conf.mode === 'multiple') list.setAttribute('aria-multiselectable', 'true');
    options.forEach((opt) => {
      opt.el.setAttribute('role', 'option');
      opt.el.setAttribute('aria-selected', 'false');
      if (opt.disabled) {
        opt.el.setAttribute('aria-disabled', 'true');
        opt.el.classList.add(conf.disabledClass);
      }
    });

    // поиск — показываем/скрываем согласно настройке
    if (search) search.hidden = !conf.searchable;

    // кнопка сброса — скрыта пока нет выбора
    if (clearEl) clearEl.hidden = true;

    const inst = {
      conf,
      input,
      trigger,
      labelEl,
      clearEl,
      dropdown,
      search,
      list,
      options,
      selected: new Set(),
      unsub: [],
    };
    root.__hvSelect__ = inst;
    this._containers.add(root);

    // --- события ---
    const onTriggerClick = (e) => {
      e.stopPropagation();
      this._toggle(root);
    };
    const onTriggerKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._toggle(root);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!root.classList.contains(conf.openClass)) this._open(root);
      }
    };
    trigger.addEventListener('click', onTriggerClick);
    trigger.addEventListener('keydown', onTriggerKey);
    inst.unsub.push(
      () => trigger.removeEventListener('click', onTriggerClick),
      () => trigger.removeEventListener('keydown', onTriggerKey)
    );

    if (clearEl) {
      const onClear = (e) => {
        e.stopPropagation();
        this._clearAll(root);
      };
      clearEl.addEventListener('click', onClear);
      inst.unsub.push(() => clearEl.removeEventListener('click', onClear));
    }

    options.forEach((opt) => {
      if (opt.disabled) return;
      const onOptClick = (e) => {
        e.stopPropagation();
        this._toggleOption(root, opt);
      };
      opt.el.addEventListener('click', onOptClick);
      inst.unsub.push(() => opt.el.removeEventListener('click', onOptClick));
    });

    if (search) {
      const onSearch = () => this._filterOptions(root, search.value);
      search.addEventListener('input', onSearch);
      inst.unsub.push(() => search.removeEventListener('input', onSearch));
    }

    // восстановить значение из hidden input при старте (удобно при SSR/prefill)
    if (input?.value) {
      const vals = input.value
        .split(conf.delimiter)
        .map((v) => v.trim())
        .filter(Boolean);
      vals.forEach((v) => this._selectValue(root, v, false));
      this._updateLabel(root);
      this._updateInput(root);
    } else {
      this._updateLabel(root); // выставить плейсхолдер
    }

    this._log('init', root, conf);
  }

  _teardownContainer(root) {
    const inst = root.__hvSelect__;
    if (!inst) return;
    inst.unsub?.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    this._close(root, true);
    root.removeAttribute('role');
    root.removeAttribute('aria-haspopup');
    root.removeAttribute('aria-expanded');
    root.__hvSelect__ = null;
    // не удаляем из _containers здесь — этим занимается _rescan
  }

  // ---------- open / close ----------
  _open(root) {
    const inst = root.__hvSelect__;
    if (!inst) return;
    const { conf, dropdown, search } = inst;

    // закрыть остальные открытые
    this._containers.forEach((c) => {
      if (c !== root && c.classList.contains(c.__hvSelect__?.conf?.openClass)) this._close(c);
    });

    root.classList.add(conf.openClass);
    root.setAttribute('aria-expanded', 'true');
    dropdown.hidden = false;

    if (conf.searchable && search) {
      search.value = '';
      this._filterOptions(root, '');
      setTimeout(() => search.focus(), 0);
    }

    this._log('open', root);
  }

  _close(root, silent = false) {
    const inst = root.__hvSelect__;
    if (!inst) return;
    const { conf, dropdown } = inst;
    root.classList.remove(conf.openClass);
    root.setAttribute('aria-expanded', 'false');
    dropdown.hidden = true;
    if (!silent) this._log('close', root);
  }

  _toggle(root) {
    const inst = root.__hvSelect__;
    if (!inst) return;
    root.classList.contains(inst.conf.openClass) ? this._close(root) : this._open(root);
  }

  // ---------- выбор ----------
  _toggleOption(root, opt) {
    const inst = root.__hvSelect__;
    if (!inst) return;
    const { conf } = inst;

    if (conf.mode === 'single') {
      // снять все, выбрать текущий
      inst.selected.clear();
      inst.options.forEach((o) => {
        o.el.classList.remove(conf.selectedClass);
        o.el.setAttribute('aria-selected', 'false');
      });
      this._selectValue(root, opt.value, false);
      this._close(root); // single всегда закрывается
    } else {
      // multiple: переключаем
      if (inst.selected.has(opt.value)) {
        inst.selected.delete(opt.value);
        opt.el.classList.remove(conf.selectedClass);
        opt.el.setAttribute('aria-selected', 'false');
      } else {
        this._selectValue(root, opt.value, false);
      }
      if (conf.closeOnSelect) this._close(root);
    }

    this._updateLabel(root);
    this._updateInput(root);
  }

  _selectValue(root, value, update = true) {
    const inst = root.__hvSelect__;
    if (!inst) return;
    const { conf } = inst;

    const opt = inst.options.find((o) => o.value === value);
    if (!opt || opt.disabled) return;

    if (conf.mode === 'single') {
      inst.selected.clear();
      inst.options.forEach((o) => {
        o.el.classList.remove(conf.selectedClass);
        o.el.setAttribute('aria-selected', 'false');
      });
    }

    inst.selected.add(value);
    opt.el.classList.add(conf.selectedClass);
    opt.el.setAttribute('aria-selected', 'true');

    if (update) {
      this._updateLabel(root);
      this._updateInput(root);
    }
  }

  _clearAll(root) {
    const inst = root.__hvSelect__;
    if (!inst) return;
    const { conf } = inst;
    inst.selected.clear();
    inst.options.forEach((o) => {
      o.el.classList.remove(conf.selectedClass);
      o.el.setAttribute('aria-selected', 'false');
    });
    this._updateLabel(root);
    this._updateInput(root);
    this._log('clear', root);
  }

  // ---------- отображение ----------
  _updateLabel(root) {
    const inst = root.__hvSelect__;
    if (!inst) return;
    const { conf, labelEl, clearEl, trigger } = inst;

    if (!inst.selected.size) {
      if (labelEl) labelEl.textContent = conf.placeholder;
      if (clearEl) clearEl.hidden = true;
      trigger.setAttribute('aria-label', conf.placeholder);
      root.classList.remove('hv-select--has-chips');
      return;
    }

    if (conf.chipMode && conf.mode === 'multiple') {
      root.classList.add('hv-select--has-chips');
      if (labelEl) {
        labelEl.innerHTML = '';
        inst.selected.forEach((v) => {
          const opt = inst.options.find((o) => o.value === v);
          if (!opt) return;
          const chip = document.createElement('span');
          chip.className = 'hv-select__chip';
          const chipText = document.createElement('span');
          chipText.textContent = opt.label;
          const rm = document.createElement('button');
          rm.type = 'button';
          rm.className = 'hv-select__chip-remove';
          rm.setAttribute('aria-label', `Убрать ${opt.label}`);
          rm.textContent = '×';
          rm.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleOption(root, opt);
          });
          chip.appendChild(chipText);
          chip.appendChild(rm);
          labelEl.appendChild(chip);
        });
      }
    } else {
      root.classList.remove('hv-select--has-chips');
      const text = Array.from(inst.selected)
        .map((v) => inst.options.find((o) => o.value === v)?.label)
        .filter(Boolean)
        .join(', ');
      if (labelEl) labelEl.textContent = text;
      trigger.setAttribute('aria-label', text);
    }

    if (clearEl) clearEl.hidden = !conf.clearable;
  }

  _updateInput(root) {
    const inst = root.__hvSelect__;
    if (!inst) return;
    const { conf, input } = inst;
    if (!input) return;
    input.value = Array.from(inst.selected).join(conf.delimiter);
    // диспатч change — позволяет внешнему коду реагировать на изменение
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  _filterOptions(root, query) {
    const inst = root.__hvSelect__;
    if (!inst) return;
    const q = query.trim().toLowerCase();
    let visible = 0;
    inst.options.forEach((opt) => {
      const match = !q || opt.label.toLowerCase().includes(q);
      opt.el.hidden = !match;
      if (match) visible++;
    });
    // «Ничего не найдено»
    let noResults = inst.list.querySelector('.hv-select__no-results');
    if (!visible && q) {
      if (!noResults) {
        noResults = document.createElement('li');
        noResults.className = 'hv-select__no-results';
        inst.list.appendChild(noResults);
      }
      noResults.textContent = inst.conf.noResultsText;
    } else if (noResults) {
      noResults.remove();
    }
  }

  // ---------- глобальные события ----------
  _onDocumentClick(e) {
    this._containers.forEach((root) => {
      if (!root.classList.contains(root.__hvSelect__?.conf?.openClass)) return;
      if (!root.contains(e.target)) this._close(root);
    });
  }

  _onDocumentKey(e) {
    if (e.key !== 'Escape') return;
    this._containers.forEach((root) => {
      if (root.classList.contains(root.__hvSelect__?.conf?.openClass)) this._close(root);
    });
  }
}

// автозапуск по импорту
Select._ensure();
