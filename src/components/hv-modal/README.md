# hv-modal

Универсальный контроллер модальных окон с тремя режимами: обычная модалка, dropdown (позиционируется по якорю) и menu (на всю ширину под якорём). Поддерживает пресеты, hover-открытие и focus trap.

---

## Подключение

```js
import { Modaler } from './script.js';

Modaler.definePreset('dialog', {
  overlay: true,
  lockScroll: true,
  focusTrap: true,
  closeOnEsc: true,
  closeOnOutside: true,
});

Modaler.definePreset('drop', {
  mode: 'dropdown',
  overlay: false,
  lockScroll: false,
  flip: true,
  gap: 4,
});

const modaler = new Modaler();
```

---

## Разметка

```html
<!-- Триггер -->
<button data-modal-button="my-modal">Открыть</button>

<!-- Окно -->
<div data-modal-window="my-modal" data-modal-settings="dialog">
  <div class="modal__panel">
    <button data-modal-close>✕</button>
    <!-- контент -->
  </div>
</div>
```

Пресеты и JSON можно комбинировать в `data-modal-settings`:
```html
data-modal-settings="dialog {"autoCloseOnLink":true}"
```

---

## Режимы (`mode`)

| Режим | Поведение |
|---|---|
| `'generic'` | Центрированная модалка, геометрия на CSS |
| `'dropdown'` | Позиционируется под кнопкой-триггером (`position: fixed`) |
| `'menu'` | Прибивается под якорь (`anchor`), может занять весь остаток экрана (`fitRest: true`) |

Режим определяется через `mode` в пресете/JSON или через классы на элементе: `modal--dropdown`, `modal--menu`, `modal--center`.

---

## Hover-открытие

```js
Modaler.definePreset('nav-drop', {
  mode: 'dropdown',
  hoverOpen: true,
  hoverDelay: 100,       // задержка открытия (мс)
  hoverCloseDelay: 150,  // задержка закрытия (мс)
  overlay: false,
  lockScroll: false,
});
```

При `hoverOpen: true` курсор может переходить между триггером, панелью и якорём без закрытия.

---

## Полный список опций

```js
{
  overlay: true,
  closeOnEsc: true,
  closeOnOutside: true,
  lockScroll: true,
  focusTrap: true,
  autoCloseOnLink: false,  // закрыть при клике по ссылке внутри панели
  gap: 0,                  // отступ от якоря (dropdown/menu)
  viewportMargin: 0,       // отступ от края вьюпорта (dropdown)
  flip: false,             // dropdown: перевернуть если нет места снизу
  mode: 'generic',         // 'generic' | 'dropdown' | 'menu'
  anchor: null,            // селектор или Element (для menu)
  fitRest: false,          // menu: занять остаток высоты вьюпорта
  hoverOpen: false,
  hoverDelay: 0,
  hoverCloseDelay: 150,
  zIndexBase: 999,
  debug: false,
}
```

---

## Публичное API

```js
modaler.open(id, anchorEl?)   // открыть по id
modaler.close(reason?)        // закрыть текущую
modaler.toggle(id, anchorEl?) // переключить
modaler.definePreset(name, conf)
modaler.deletePreset(name)

// Статические (глобальные пресеты — общие для всех экземпляров)
Modaler.definePreset(name, conf)
Modaler.deletePreset(name)
Modaler.getPreset(name)
```

---

## События

На элементе `[data-modal-window]`:

```js
el.addEventListener('modal:open', (e) => {
  const { id, mode, conf } = e.detail;
});

el.addEventListener('modal:close', (e) => {
  const { id, reason } = e.detail;
  // reason: 'api' | 'esc' | 'outside' | 'overlay' | 'button' | 'link' | 'toggle' | 'hover'
});
```

---

## Классы-состояния

- `is-active` — на `[data-modal-window]`, кнопке-триггере и якоре при открытии
- `modal--drop-up` — на окне если dropdown перевернулся вверх
- `is-scroll-locked` — на `<html>` при `lockScroll: true`
- `--scrollbar-comp` — CSS-переменная на `<html>` с шириной скроллбара (для компенсации прыжка)
