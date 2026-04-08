# hv-select

Минималистичный кастомный select. Поддерживает одиночный и множественный выбор, поиск по опциям, отображение выбранного в виде чипов и сброс значения. Стили намеренно минимальны — визуальное оформление задаёт проект.

---

## Подключение

```js
import { Select } from './script.js';

Select.definePreset('default', {
  mode: 'single',
  placeholder: 'Выберите страну...',
  clearable: true,
  searchable: true,
});

Select.definePreset('skills', {
  mode: 'multiple',
  placeholder: 'Выберите навыки...',
  chipMode: true,
  delimiter: ',',
});
```

`new` не нужен — синглтон создаётся автоматически при импорте.

---

## Разметка

```html
<div data-select-settings="default">
  <!-- скрытый input — сюда попадают выбранные значения -->
  <input type="hidden" name="country" />

  <!-- видимая часть -->
  <div data-select-trigger>
    <span data-select-label></span>
    <span data-select-clear aria-hidden="true">×</span>
    <span data-select-arrow aria-hidden="true">▾</span>
  </div>

  <!-- дропдаун -->
  <div data-select-dropdown hidden>
    <!-- поиск — показывается при searchable: true -->
    <input data-select-search type="text" placeholder="Поиск..." />

    <ul data-select-list>
      <li data-select-option data-value="ru">Россия</li>
      <li data-select-option data-value="us">США</li>
      <li data-select-option data-value="de" data-disabled>Германия (недоступно)</li>
    </ul>
  </div>
</div>
```

### Значение hidden input

| Режим | Пример значения |
|---|---|
| `single` | `ru` |
| `multiple`, delimiter=`,` | `ru,us,fr` |
| `multiple`, delimiter=`\|` | `ru\|us\|fr` |

Поле диспатчит `change`-событие (с `bubbles: true`) при каждом изменении выбора — удобно слушать снаружи.

### Предзаполнение из разметки

Если задать `value` у скрытого input до инициализации, компонент восстановит выбор:

```html
<input type="hidden" name="country" value="us" />
```

---

## Опции пресета

| Опция | По умолчанию | Описание |
|---|---|---|
| `mode` | `'single'` | `'single'` — один выбор; `'multiple'` — несколько |
| `placeholder` | `'Выберите...'` | Текст при пустом выборе |
| `clearable` | `true` | Показывать кнопку сброса `[data-select-clear]` |
| `searchable` | `false` | Показывать поле поиска `[data-select-search]` |
| `chipMode` | `false` | В `multiple`: показывать выбранное как чипы в триггере |
| `closeOnSelect` | `false` | В `multiple`: закрывать дропдаун после каждого выбора |
| `delimiter` | `','` | Разделитель значений в hidden input для `multiple` |
| `noResultsText` | `'Ничего не найдено'` | Текст когда поиск не дал результатов |
| `openClass` | `'is-open'` | Класс на корне при открытом дропдауне |
| `selectedClass` | `'is-selected'` | Класс на выбранной опции |
| `disabledClass` | `'is-disabled'` | Класс на недоступной опции |

---

## Состояния

На `[data-select-settings]`:
- `is-open` (или `openClass`) — дропдаун открыт
- `hv-select--has-chips` — активен chip-режим с выбранными значениями
- `aria-expanded="true/false"`

На `[data-select-option]`:
- `is-selected` (или `selectedClass`) — опция выбрана
- `is-disabled` (или `disabledClass`) — опция недоступна
- `aria-selected="true/false"`
- `aria-disabled="true"` — на недоступных опциях

На `[data-select-trigger]`:
- `aria-label` — текст выбранного значения (или плейсхолдер)

---

## Публичное API

```js
// Переинициализировать контейнеры с конкретным пресетом
Select._ensure()._reinitByPreset(presetName);

// Подхватить новые [data-select-settings] в DOM
Select._ensure()._rescan(document);

// Получить или задать значение программно
const inst = document.querySelector('[data-select-settings="myPreset"]').__hvSelect__;
// inst.selected — Set со значениями
// inst.input.value — строка для бэкенда
```
