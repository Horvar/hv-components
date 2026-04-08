# hv-tabs

Минималистичный контроллер табов. Поддерживает click и hover-триггер, на тач-устройствах hover автоматически деградирует до click.

---

## Подключение

```js
import { Tabs } from './script.js';

Tabs.definePreset('default', {
  trigger: 'click',
});

Tabs.definePreset('nav', {
  trigger: 'hover',
});
```

`new` не нужен — синглтон создаётся автоматически при импорте.

---

## Разметка

```html
<div data-tabs-settings="default">
  <div data-tablist>
    <button data-tab-button data-tab="info" class="is-selected">Описание</button>
    <button data-tab-button data-tab="specs">Характеристики</button>
    <button data-tab-button data-tab="reviews">Отзывы</button>
  </div>

  <div data-tab-panel data-tab="info" class="is-visible">...</div>
  <div data-tab-panel data-tab="specs">...</div>
  <div data-tab-panel data-tab="reviews">...</div>
</div>
```

- `class="is-selected"` на кнопке — активный таб по умолчанию из разметки.
- Если нет `is-selected` — активируется первый (или последний, если `initial: 'last'`).

---

## Опции пресета

| Опция | По умолчанию | Описание |
|---|---|---|
| `trigger` | `'click'` | `'click'` или `'hover'` |
| `initial` | `'first'` | `'first'` или `'last'` |
| `buttonActiveClass` | `'is-selected'` | Класс активной кнопки |
| `panelActiveClass` | `'is-visible'` | Класс активной панели |

---

## Состояния

На `[data-tab-button]`:
- `is-selected` (или `buttonActiveClass`) — активная кнопка
- `aria-selected="true/false"`
- `tabindex="0"` (активная) / `tabindex="-1"` (остальные)

На `[data-tab-panel]`:
- `is-visible` (или `panelActiveClass`) — активная панель
- `aria-hidden="true/false"`

---

## Публичное API

```js
// Переинициализировать контейнеры с конкретным пресетом (автоматически при definePreset)
Tabs._ensure()._reinitByPreset(presetName);
```
