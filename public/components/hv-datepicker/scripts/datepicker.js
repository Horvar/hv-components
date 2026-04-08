// _hv-datepicker.js
// hv-datepicker — inline-датепикер без попапов
// Фишки: пресеты, неделя с понедельника по умолчанию, single/range/multi,
// раздельная навигация ТОЛЬКО стрелками (год/месяц — вертикально),
// ручной ввод через связанный input: красивый ДД.ММ.ГГГГ,
// МАШИННЫЕ ЗНАЧЕНИЯ: в data-dp-* (не конфликтуют с общим масочным data-value).

// ---------- utils (date) ----------
const dSame = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const addMonths = (d, n) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};
const addYears = (d, n) => {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
};
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const truncYMD = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const clamp = (d, min, max) => (min && d < min ? truncYMD(min) : max && d > max ? truncYMD(max) : d);

// сетка 6x7
function getMonthGrid(year, month, weekStartsOn = 1) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const gridStart = addDays(first, -offset);
  const weeks = [];
  let cur = gridStart;
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    weeks.push(row);
  }
  return weeks;
}

// ---------- i18n & formatting ----------
const localeOf = (i18n) => (i18n === 'auto' ? navigator.language || 'en' : i18n);

function weekdayShorts(i18n = 'auto', weekStartsOn = 1) {
  const loc = localeOf(i18n);
  const base = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(2024, 0, i + 1);
    base.push(new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d));
  }
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
  return order.map((i) => base[i]);
}

function monthNames(i18n = 'auto') {
  const loc = localeOf(i18n);
  const arr = [];
  for (let m = 0; m < 12; m++) {
    arr.push(new Intl.DateTimeFormat(loc, { month: 'long' }).format(new Date(2024, m, 1)));
  }
  return arr;
}

function formatDMY(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// Парсинг пользовательского ввода: ISO, DD.MM.YYYY, DD/MM/YYYY, или Date.parse
function parseUserDate(str) {
  if (!str) return null;
  const s = String(str).trim();

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // ISO
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d) ? null : truncYMD(d);
  }
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); // DD.MM.YYYY
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d) ? null : truncYMD(d);
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d) ? null : truncYMD(d);
  }
  const d = new Date(s); // последняя надежда
  return isNaN(d) ? null : truncYMD(d);
}

// ---------- Instance ----------
class DPInstance {
  constructor(root, conf, controller) {
    this.root = root;
    this.c = conf;
    this.ctrl = controller;

    const today = truncYMD(new Date());
    this.view = new Date(today.getFullYear(), today.getMonth(), 1);
    this.focus = new Date(today);

    // single
    this.sel = null;

    // range
    this.rangeA = null;
    this.rangeB = null;

    // multi
    this.multi = new Set(); // ISO-строки

    this.outSelector = (root.getAttribute('data-dp-bind-out') || '').trim() || null;

    this._render();
    this._wire();
    this._bindOutInput();
    this._updateOut();
  }

  // ----- helpers: bounds & nav-state -----
  _yearBounds() {
    const curY = new Date().getFullYear();
    const minY = this.c.min ? this.c.min.getFullYear() : (this.c.yearMin ?? curY - 50);
    const maxY = this.c.max ? this.c.max.getFullYear() : (this.c.yearMax ?? curY + 50);
    return { yearMin: minY, yearMax: maxY };
  }

  _viewBounds() {
    const { yearMin, yearMax } = this._yearBounds();
    const hasMin = !!this.c.min;
    const hasMax = !!this.c.max;
    const vMin = new Date(hasMin ? this.c.min.getFullYear() : yearMin, hasMin ? this.c.min.getMonth() : 0, 1);
    const vMax = new Date(hasMax ? this.c.max.getFullYear() : yearMax, hasMax ? this.c.max.getMonth() : 11, 1);
    return { vMin, vMax };
  }

  _navState() {
    const { vMin, vMax } = this._viewBounds();
    const canPrevMonth = addMonths(this.view, -1) >= vMin;
    const canNextMonth = addMonths(this.view, +1) <= vMax;
    const canPrevYear = addYears(this.view, -1) >= vMin;
    const canNextYear = addYears(this.view, +1) <= vMax;
    return { canPrevMonth, canNextMonth, canPrevYear, canNextYear };
  }

  _updateNavDisabled() {
    if (!this._el) return;
    const { canPrevMonth, canNextMonth, canPrevYear, canNextYear } = this._navState();
    this._el.btnMPrev.disabled = !canPrevMonth;
    this._el.btnMNext.disabled = !canNextMonth;
    this._el.btnYPrev.disabled = !canPrevYear;
    this._el.btnYNext.disabled = !canNextYear;
    this._el.labelYear.textContent = String(this.view.getFullYear());
    this._el.labelMonth.textContent = monthNames(this.c.i18n)[this.view.getMonth()];
  }

  // ----- render -----
  _render() {
    this.root.classList.add('hv-datepicker');
    this.root.setAttribute('role', 'group');
    this.root.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'hv-dp__head';

    // Ряд 1: ГОД
    const barYear = document.createElement('div');
    barYear.className = 'hv-dp__bar hv-dp__bar--year';

    const btnYPrev = document.createElement('button');
    btnYPrev.type = 'button';
    btnYPrev.className = 'hv-dp__nav hv-dp__nav--yprev';
    btnYPrev.setAttribute('aria-label', 'Prev year');
    btnYPrev.textContent = '«';

    const labelYear = document.createElement('div');
    labelYear.className = 'hv-dp__label hv-dp__label--year';
    labelYear.setAttribute('aria-live', 'polite');
    labelYear.textContent = String(this.view.getFullYear());

    const btnYNext = document.createElement('button');
    btnYNext.type = 'button';
    btnYNext.className = 'hv-dp__nav hv-dp__nav--ynext';
    btnYNext.setAttribute('aria-label', 'Next year');
    btnYNext.textContent = '»';

    barYear.append(btnYPrev, labelYear, btnYNext);

    // Ряд 2: МЕСЯЦ
    const barMonth = document.createElement('div');
    barMonth.className = 'hv-dp__bar hv-dp__bar--month';

    const btnMPrev = document.createElement('button');
    btnMPrev.type = 'button';
    btnMPrev.className = 'hv-dp__nav hv-dp__nav--mprev';
    btnMPrev.setAttribute('aria-label', 'Prev month');
    btnMPrev.textContent = '‹';

    const labelMonth = document.createElement('div');
    labelMonth.className = 'hv-dp__label hv-dp__label--month';
    labelMonth.setAttribute('aria-live', 'polite');
    labelMonth.textContent = monthNames(this.c.i18n)[this.view.getMonth()];

    const btnMNext = document.createElement('button');
    btnMNext.type = 'button';
    btnMNext.className = 'hv-dp__nav hv-dp__nav--mnext';
    btnMNext.setAttribute('aria-label', 'Next month');
    btnMNext.textContent = '›';

    barMonth.append(btnMPrev, labelMonth, btnMNext);

    const headWrap = document.createElement('div');
    headWrap.className = 'hv-dp__title';
    headWrap.append(barYear, barMonth);
    head.append(headWrap);

    // таблица
    const table = document.createElement('div');
    table.className = 'hv-dp__table';

    // заголовки дней
    const rowHead = document.createElement('div');
    rowHead.className = 'hv-dp__row hv-dp__row--head';
    rowHead.setAttribute('role', 'row');
    weekdayShorts(this.c.i18n, this.c.weekStartsOn).forEach((n) => {
      const c = document.createElement('div');
      c.className = 'hv-dp__cell hv-dp__cell--wh';
      c.setAttribute('role', 'columnheader');
      c.textContent = n;
      rowHead.appendChild(c);
    });

    // сетка дней
    const rowsFrag = document.createDocumentFragment();
    this._cells = [];
    const weeks = getMonthGrid(this.view.getFullYear(), this.view.getMonth(), this.c.weekStartsOn);
    weeks.forEach((week) => {
      const row = document.createElement('div');
      row.className = 'hv-dp__row';
      row.setAttribute('role', 'row');
      week.forEach((day) => {
        const inMonth = day.getMonth() === this.view.getMonth();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hv-dp__cell' + (inMonth ? '' : ' is-out');
        btn.setAttribute('role', 'gridcell');
        btn.dataset.iso = dISO(day);
        btn.textContent = String(day.getDate());

        const today = truncYMD(new Date());
        if (dSame(today, day)) btn.classList.add('is-today');

        const isDis = this._isDisabled(day);
        btn.setAttribute('aria-disabled', String(isDis));
        if (isDis) btn.classList.add('is-disabled');

        const isSel = this._isSelected(day);
        btn.setAttribute('aria-selected', String(isSel));
        if (isSel) btn.classList.add('is-selected');
        if (this._inRange(day)) btn.classList.add('is-in-range');

        btn.tabIndex = dSame(this.focus, day) ? 0 : -1;

        row.appendChild(btn);
        this._cells.push(btn);
      });
      rowsFrag.appendChild(row);
    });

    table.append(rowHead, rowsFrag);

    this.root.append(head, table);

    this._el = {
      head,
      table,
      btnYPrev,
      btnYNext,
      btnMPrev,
      btnMNext,
      labelYear,
      labelMonth,
    };

    this._updateNavDisabled();
  }

  _wire() {
    const { btnYPrev, btnYNext, btnMPrev, btnMNext } = this._el;

    // клики навигации
    btnMPrev.addEventListener('click', () => this._navMonth(-1));
    btnMNext.addEventListener('click', () => this._navMonth(+1));
    btnYPrev.addEventListener('click', () => this._navYear(-1));
    btnYNext.addEventListener('click', () => this._navYear(+1));

    // клики по дням (делегирование)
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('.hv-dp__cell[role="gridcell"]');
      if (!b || !this.root.contains(b)) return;
      if (b.getAttribute('aria-disabled') === 'true') return;
      const date = new Date(b.dataset.iso);
      this._select(date);
    });

    // клавиатура
    this.root.addEventListener('keydown', (e) => {
      const k = e.key;
      let handled = true;
      if (k === 'ArrowLeft') this._moveFocus(-1);
      else if (k === 'ArrowRight') this._moveFocus(+1);
      else if (k === 'ArrowUp') this._moveFocus(-7);
      else if (k === 'ArrowDown') this._moveFocus(+7);
      else if (k === 'PageUp') this._jump('month', -1);
      else if (k === 'PageDown') this._jump('month', +1);
      else if (k === 'Home') this._home();
      else if (k === 'End') this._end();
      else if (k === 'Enter' || k === ' ') this._select(this.focus);
      else handled = false;

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  _bindOutInput() {
    if (!this.outSelector) return;
    const out = document.querySelector(this.outSelector);
    if (!out || out._hvDpBound) return;
    out._hvDpBound = true;

    // Разрешаем ввод руками
    out.removeAttribute('readonly');
    out.setAttribute('inputmode', 'numeric');
    out.setAttribute('autocomplete', 'off');

    const apply = () => this._applyFromInput(String(out.value || ''));

    out.addEventListener('change', apply);
    out.addEventListener('blur', apply);
    out.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        apply();
        out.blur();
      }
    });
  }

  // ----- behavior: навигация -----
  _navMonth(d) {
    const { vMin, vMax } = this._viewBounds();
    const candidate = addMonths(this.view, d);
    if (candidate < vMin || candidate > vMax) {
      this._updateNavDisabled();
      return;
    }
    this.view = new Date(candidate.getFullYear(), candidate.getMonth(), 1);
    const first = startOfMonth(this.view);
    const last = endOfMonth(this.view);
    this.focus = clamp(this.focus, first, last);
    this._rerender();
  }

  _navYear(d) {
    const { vMin, vMax } = this._viewBounds();
    const candidate = addYears(this.view, d);
    if (candidate < vMin || candidate > vMax) {
      this._updateNavDisabled();
      return;
    }
    this.view = new Date(candidate.getFullYear(), candidate.getMonth(), 1);
    const first = startOfMonth(this.view);
    const last = endOfMonth(this.view);
    this.focus = clamp(this.focus, first, last);
    this._rerender();
  }

  _moveFocus(deltaDays) {
    const next = addDays(this.focus, deltaDays);
    const { vMin, vMax } = this._viewBounds();
    const nextView = new Date(next.getFullYear(), next.getMonth(), 1);
    if (nextView < vMin || nextView > vMax) return;

    if (next.getMonth() !== this.view.getMonth() || next.getFullYear() !== this.view.getFullYear()) {
      this.view = new Date(next.getFullYear(), next.getMonth(), 1);
    }
    this.focus = next;
    this._rerender();
    this._focusVisible();
  }

  _jump(unit, sign) {
    if (unit === 'month') {
      const { vMin, vMax } = this._viewBounds();
      const nextView = addMonths(this.view, sign);
      if (nextView < vMin || nextView > vMax) return;
      this.view = nextView;
      this.focus = clamp(addMonths(this.focus, sign), startOfMonth(this.view), endOfMonth(this.view));
      this._rerender();
      this._focusVisible();
    }
  }

  _home() {
    const ws = this.c.weekStartsOn ?? 1;
    const day = (this.focus.getDay() - ws + 7) % 7;
    this._moveFocus(-day);
  }

  _end() {
    const ws = this.c.weekStartsOn ?? 1;
    const day = (this.focus.getDay() - ws + 7) % 7;
    this._moveFocus(6 - day);
  }

  // ----- доступность даты -----
  _isDisabled(d) {
    const { min, max, isDateAllowed } = this.c;
    const td = truncYMD(d);
    if (min && td < truncYMD(min)) return true;
    if (max && td > truncYMD(max)) return true;
    if (typeof isDateAllowed === 'function' && !isDateAllowed(td)) return true;
    return false;
  }

  _isSelected(d) {
    if (this.c.mode === 'single') return !!this.sel && dSame(d, this.sel);

    if (this.c.mode === 'range') {
      if (this.rangeA && !this.rangeB) return dSame(d, this.rangeA);
      if (this.rangeA && this.rangeB) return dSame(d, this.rangeA) || dSame(d, this.rangeB);
      return false;
    }

    if (this.c.mode === 'multi') {
      return this.multi.has(dISO(d));
    }

    return false;
  }

  _inRange(d) {
    if (this.c.mode !== 'range') return false;
    if (this.rangeA && this.rangeB) {
      const a = this.rangeA < this.rangeB ? this.rangeA : this.rangeB;
      const b = this.rangeA < this.rangeB ? this.rangeB : this.rangeA;
      const x = truncYMD(d);
      return x >= a && x <= b;
    }
    return false;
  }

  // ----- выбор кликом -----
  _select(date) {
    const td = truncYMD(date);
    if (this._isDisabled(td)) return;

    if (this.c.mode === 'single') {
      this.sel = td;
      this.focus = td;
    } else if (this.c.mode === 'range') {
      if (!this.rangeA || (this.rangeA && this.rangeB)) {
        this.rangeA = td;
        this.rangeB = null;
        this.focus = td;
      } else {
        this.rangeB = td;
        this.focus = td;
      }
    } else if (this.c.mode === 'multi') {
      const iso = dISO(td);
      if (this.multi.has(iso)) this.multi.delete(iso);
      else this.multi.add(iso);
      this.focus = td;
    }

    this._rerender();
    this._updateOut();
  }

  // ----- применение ввода из инпута -----
  _applyFromInput(raw) {
    const text = raw.trim();
    if (!text) {
      if (this.c.mode === 'single') {
        this.sel = null;
      }
      if (this.c.mode === 'range') {
        this.rangeA = this.rangeB = null;
      }
      if (this.c.mode === 'multi') {
        this.multi.clear();
      }
      this._updateOut();
      return;
    }

    if (this.c.mode === 'single') {
      const d = parseUserDate(text);
      if (!d || this._isDisabled(d)) return;
      this.sel = d;
      this.focus = d;
      this.view = new Date(d.getFullYear(), d.getMonth(), 1);
      this._rerender();
      this._updateOut();
      return;
    }

    if (this.c.mode === 'range') {
      const parts = text
        .split(/\s*(?:-|–|—|\.{2,})\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length === 1) {
        const a = parseUserDate(parts[0]);
        if (!a || this._isDisabled(a)) return;
        this.rangeA = a;
        this.rangeB = null;
        this.focus = a;
        this.view = new Date(a.getFullYear(), a.getMonth(), 1);
      } else if (parts.length >= 2) {
        const a = parseUserDate(parts[0]);
        const b = parseUserDate(parts[1]);
        if (!a || !b) return;
        if (this._isDisabled(a) || this._isDisabled(b)) return;
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        this.rangeA = lo;
        this.rangeB = hi;
        this.focus = hi;
        this.view = new Date(hi.getFullYear(), hi.getMonth(), 1);
      }
      this._rerender();
      this._updateOut();
      return;
    }

    if (this.c.mode === 'multi') {
      const items = text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const acc = [];
      for (const it of items) {
        const d = parseUserDate(it);
        if (!d || this._isDisabled(d)) continue;
        acc.push(dISO(d));
      }
      if (acc.length === 0) return;
      this.multi = new Set(acc);
      const last = acc.sort().at(-1);
      const d = new Date(last);
      this.focus = d;
      this.view = new Date(d.getFullYear(), d.getMonth(), 1);
      this._rerender();
      this._updateOut();
      return;
    }
  }

  // ----- перерендер и вывод -----
  _rerender() {
    const keepFocusISO = dISO(this.focus);
    this._render();
    this._wire();
    this._updateNavDisabled();

    const cell = this.root.querySelector(`.hv-dp__cell[data-iso='${keepFocusISO}']`);
    if (cell) cell.focus({ preventScroll: true });
  }

  _focusVisible() {
    const iso = dISO(this.focus);
    const cell = this.root.querySelector(`.hv-dp__cell[data-iso='${iso}']`);
    if (cell) cell.focus({ preventScroll: true });
  }

  _updateOut() {
    if (!this.outSelector) return;
    const out = document.querySelector(this.outSelector);
    if (!out) return;

    // Пишем только красивое значение и НЕ трогаем масочный data-value
    // Машинные значения — в data-dp-*
    const setDP = (map) => {
      // очистим предыдущие dp-ключи
      for (const a of Array.from(out.attributes)) {
        if (a.name.startsWith('data-dp-')) out.removeAttribute(a.name);
      }
      for (const [k, v] of Object.entries(map)) {
        if (v == null || v === '') continue;
        out.setAttribute(`data-dp-${k}`, String(v));
      }
      out.removeAttribute('aria-invalid');
    };

    if (this.c.mode === 'single') {
      if (!this.sel) {
        out.value = '';
        setDP({});
        return;
      }
      out.value = formatDMY(this.sel);
      setDP({ value: dISO(this.sel) });
      return;
    }

    if (this.c.mode === 'range') {
      const a = this.rangeA,
        b = this.rangeB;
      if (a && b) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        out.value = `${formatDMY(lo)} — ${formatDMY(hi)}`;
        setDP({ start: dISO(lo), end: dISO(hi) });
      } else if (a || b) {
        const one = a || b;
        out.value = formatDMY(one);
        setDP({ start: dISO(one) });
      } else {
        out.value = '';
        setDP({});
      }
      return;
    }

    if (this.c.mode === 'multi') {
      if (this.multi.size === 0) {
        out.value = '';
        setDP({});
        return;
      }
      const listISO = Array.from(this.multi).sort();
      const listPretty = listISO.map((s) => formatDMY(new Date(s)));
      out.value = listPretty.join(', ');
      setDP({ values: listISO.join(',') }); // компактно; при желании можно JSON
      return;
    }
  }
}

// ---------- Controller ----------
class DatePickerController {
  constructor() {
    this.presets = new Map();
    this.instances = new WeakMap();
    this.o = { debug: false };
  }
  definePreset(name, conf) {
    const c = Object.assign(
      {
        mode: 'single', // 'single' | 'range' | 'multi'
        weekStartsOn: 1,
        min: null,
        max: null,
        isDateAllowed: null,
        closeOnSelect: true,
        i18n: 'auto',
        yearMin: null, // ограничение навигации стрелками
        yearMax: null,
      },
      conf || {}
    );
    this.presets.set(name, c);
    this.scan();
  }
  scan(root = document) {
    const nodes = root.querySelectorAll('[data-datepicker][data-datepicker-settings]');
    nodes.forEach((node) => {
      if (this.instances.has(node)) return;
      const name = node.getAttribute('data-datepicker-settings');
      const conf = this.presets.get(name);
      if (!conf) return;
      const inst = new DPInstance(node, conf, this);
      this.instances.set(node, inst);
    });
  }
}

// ---------- Public API ----------
export const DatePicker = {
  _ctrl: null,
  _ensure() {
    return this._ctrl || (this._ctrl = new DatePickerController());
  },
  definePreset(name, conf) {
    this._ensure().definePreset(name, conf);
  },
  scan(root) {
    this._ensure().scan(root);
  },
};
