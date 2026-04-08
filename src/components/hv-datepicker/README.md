# hv-datepicker

Inline-датепикер без попапов. Три режима выбора: single, range, multi. Поддерживает ручной ввод через связанный инпут, локализацию через `Intl` и ограничение диапазона дат.

---

## Подключение

```js
import { DatePicker } from './scripts/datepicker.js';

DatePicker.definePreset('default', {
  mode: 'single',
  weekStartsOn: 1,
  i18n: 'auto',
});
```

---

## Разметка

```html
<!-- Контейнер датепикера -->
<div data-datepicker data-datepicker-settings="default" data-dp-bind-out="#date-input"></div>

<!-- Связанный инпут (необязателен) -->
<input id="date-input" type="text" data-mask="date" />
```

Атрибут `data-dp-bind-out` — CSS-селектор инпута, в который пишется значение. После выбора даты JS пишет красивое значение (`ДД.ММ.ГГГГ`) в `value` и машинные данные в `data-dp-*`.

---

## Машинные значения на инпуте

| Атрибут | Режим | Содержимое |
|---|---|---|
| `data-dp-value` | `single` | ISO-дата: `2025-04-08` |
| `data-dp-start` | `range` | ISO начала диапазона |
| `data-dp-end` | `range` | ISO конца диапазона |
| `data-dp-values` | `multi` | ISO через запятую |

Не конфликтуют с масочным `data-value`.

---

## Опции пресета

```js
DatePicker.definePreset('booking', {
  mode: 'range',          // 'single' | 'range' | 'multi'
  weekStartsOn: 1,        // 0 = воскресенье, 1 = понедельник
  min: new Date('2025-01-01'),
  max: new Date('2026-12-31'),
  isDateAllowed: (date) => date.getDay() !== 0, // функция для кастомных ограничений
  i18n: 'ru-RU',          // локаль или 'auto' (navigator.language)
  yearMin: null,          // ограничение навигации по годам
  yearMax: null,
});
```

---

## Клавиатура

| Клавиша | Действие |
|---|---|
| `←` `→` `↑` `↓` | Перемещение фокуса по дням |
| `PageUp` / `PageDown` | Пред./след. месяц |
| `Home` / `End` | Начало / конец недели |
| `Enter` / `Space` | Выбрать дату |

---

## CSS-классы на ячейках

- `is-today` — сегодняшняя дата
- `is-selected` — выбранная дата (или края диапазона)
- `is-in-range` — дата внутри диапазона
- `is-out` — дата вне текущего месяца
- `is-disabled` — недоступная дата

---

## Маски для дат (`scripts/masks.js`)

Отдельный слой — работает независимо от датепикера.

```js
import { initDateMasks } from './scripts/masks.js';
initDateMasks(); // или initDateMasks(someContainer)
```

| Атрибут | Маска |
|---|---|
| `data-mask="date"` | `99.99.9999` |
| `data-mask="date-range"` | `99.99.9999 – 99.99.9999` |
| `data-mask="date-multi"` | без маски (свободный ввод) |

Сырое значение (только цифры) пишется в `data-value`.

---

## Публичное API

```js
DatePicker.definePreset(name, conf) // зарегистрировать пресет и просканировать DOM
DatePicker.scan(root?)              // просканировать вручную (по умолчанию — document)
```
