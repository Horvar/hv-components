# hv-accordion

Лёгкий аккордеон без зависимостей. Работает через делегирование — один обработчик на весь документ. Подхватывает динамически добавленные контейнеры через MutationObserver.

---

## Подключение

```js
import { Accordion } from './script.js';

Accordion.definePreset('faq', { singleOpen: true, duration: 240 });
Accordion.definePreset('multi', { singleOpen: false, duration: 160 });
```

`new` не нужен — синглтон создаётся автоматически при первом `definePreset` или при импорте.

---

## Разметка

```html
<div data-accordion-settings="faq">
  <div data-accordion-item class="is-unfolded">
    <button data-accordion-button>Вопрос 1</button>
    <div data-accordion-content>Ответ 1</div>
  </div>
  <div data-accordion-item>
    <button data-accordion-button>Вопрос 2</button>
    <div data-accordion-content>Ответ 2</div>
  </div>
</div>
```

- `class="is-unfolded"` на `[data-accordion-item]` — открыт по умолчанию.
- Можно передать JSON прямо в атрибуте: `data-accordion-settings="faq {\"duration\":300}"`.

---

## Опции пресета

| Опция | По умолчанию | Описание |
|---|---|---|
| `singleOpen` | `false` | Только один item открыт одновременно |
| `duration` | `200` | Длительность анимации в мс |

---

## Состояния

На `[data-accordion-item]`:
- `is-unfolded` — элемент открыт

На `[data-accordion-button]`:
- `aria-expanded` — `true` / `false`

На `[data-accordion-content]`:
- `aria-hidden` — `true` / `false`

---

## Публичное API

```js
// Пересканировать DOM вручную (если контейнеры добавлены без MutationObserver)
Accordion._inst._scan(true);

// Уничтожить (снять слушатели)
Accordion._inst.destroy();
```
