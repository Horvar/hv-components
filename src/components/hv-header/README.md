# hv-header

Хедер с тремя режимами позиционирования, поведением на скролле и анимацией входа/выхода во fixed.

---

## Подключение

```html
<header class="hv-header">
  <div class="hv-header__content">
    <!-- контент -->
  </div>
</header>

<!-- sentinel — полоса у верхней кромки (например, баннер/топбар) -->
<div class="screen-top"></div>
```

```js
import { hvHeader } from './script.js';

const header = new hvHeader({
  mode: 'fixedAfter',
  threshold: 'sentinel',
  scrollBehavior: 'reveal',
  fixFx: 'slide',
  compensate: 'spacer',
  sentinel: '.screen-top',
});
```

---

## Концепции

- **`.hv-header__content`** — внутренняя обёртка (rail). Если её нет в разметке — создаётся автоматически. FX-анимации применяются именно к ней.
- **sentinel** — элемент у верха вьюпорта, чья высота становится `top-offset`. Обновляется через ResizeObserver.
- **threshold** — момент включения `fixed` в режиме `fixedAfter`.
- **compensation** — механизм резервирования места под фиксированный хедер.

---

## Режимы (`mode`)

| Значение | Поведение |
|---|---|
| `'static'` | Обычный поток, фиксации нет |
| `'fixed'` | Всегда fixed |
| `'fixedAfter'` | Fixed после порога `threshold` |

**Форматы `threshold`:**

- Число или строка в px: `200`, `'200px'` — от начала документа
- `'sentinel'` _(по умолчанию)_ — равен высоте sentinel
- Селектор или `Element` — bottom элемента в координатах страницы

---

## Поведение на скролле (`scrollBehavior`)

| Значение | Поведение |
|---|---|
| `'none'` | Без реакции на скролл |
| `'shrink'` | Вниз → `is-compact`, вверх → expand |
| `'reveal'` | Вниз → `is-hidden`, вверх → показать |

Пороги срабатывания — `downDelta` / `upDelta` (единый способ) или legacy-опции `shrink/revealShowDelta`, `shrink/revealHideDelta`.

> В `fixedAfter + reveal` вход во fixed всегда скрытым — чтобы не суммировались трансформы root и rail.

---

## FX при переходе static ↔ fixed (`fixFx`)

- `'slide'` — `.hv-header__content` въезжает/выезжает сверху
- `'fade'` — fade-эффект
- `'none'` — без анимации

Тайминги задаются через CSS-переменные (JS выставляет их из опций):

```css
--hv-header-fx-enter-dur
--hv-header-fx-leave-dur
--hv-header-fx-easing
```

---

## Компенсация (`compensate`)

| Значение | Поведение |
|---|---|
| `'spacer'` _(по умолчанию)_ | Вставляет `.hv-header-spacer` после хедера |
| `'body'` | `padding-top` у `contentContainer` |
| `'none'` | Без компенсации |

Высота замораживается в момент входа во fixed и не меняется при рефлоу.

---

## Классы-состояния

На `.hv-header`:

- `is-fixed` — включён fixed
- `is-compact` — компактный вид
- `is-hidden` — скрыт (reveal-режим)
- `is-top` — у самого верха страницы (при `overlayAtTop: true`)
- `hv-header--fx-slide` / `hv-header--fx-fade` — активный FX (выставляет JS)
- `hv-header--no-anim` — служебный, глушит переходы на один кадр

На `.hv-header__content`:

- `rail--no-anim` — служебный

---

## CSS-переменные

```css
/* Доступны для переопределения */
--hv-header-h-expanded   /* высота в обычном состоянии */
--hv-header-h-compact    /* высота в compact */
--hv-header-tr-move      /* transition для reveal */
--hv-header-tr-height    /* transition для shrink */
--hv-header-ease

/* Выставляются JS-ом, читать/использовать в стилях */
--hv-header-top-offset   /* высота sentinel, на :root */
--hv-header-height       /* текущая высота хедера, на .hv-header */
```

---

## Публичное API

```js
header.setMode(mode)              // 'static' | 'fixed' | 'fixedAfter'
header.setThreshold(th)           // число | '200px' | 'sentinel' | селектор | Element
header.setSentinel(elOrSelector)  // новый sentinel (null — убрать)
header.enable()                   // подписаться на события заново
header.disable()                  // отписаться от всего
header.destroy()                  // снять классы, компенсацию, удалить spacer
```

---

## Полный список опций

```js
new hvHeader({
  root: '.hv-header',
  sentinel: '.screen-top',

  // Позиционирование
  mode: 'static',              // 'static' | 'fixed' | 'fixedAfter'
  threshold: 'sentinel',       // число | '400px' | 'sentinel' | селектор | Element

  // Поведение на скролле
  scrollBehavior: 'none',      // 'none' | 'shrink' | 'reveal'

  // Единые дельты (приоритет над legacy)
  downDelta: null,             // px накопления для срабатывания вниз
  upDelta: null,               // px накопления для срабатывания вверх

  // Legacy-дельты
  shrinkShowDelta: 24,
  shrinkHideDelta: 24,
  shrinkInitiallyExpanded: true,
  revealShowDelta: 24,
  revealHideDelta: 24,
  revealInitiallyHidden: false,

  // FX static ↔ fixed
  fixFx: 'slide',              // 'slide' | 'fade' | 'none'
  fixFxEnterDuration: 220,
  fixFxLeaveDuration: 220,
  fixFxEasing: 'ease',
  fixFxOnInit: true,

  // Компенсация
  compensate: 'spacer',        // 'spacer' | 'body' | 'none'
  contentContainer: 'body',

  overlayAtTop: true,          // добавлять is-top у верха страницы
  debug: false,                // false | true | 2
});
```

---

## Пресеты

**Fixed с reveal:**
```js
new hvHeader({
  mode: 'fixed',
  scrollBehavior: 'reveal',
  fixFx: 'none',
  compensate: 'spacer',
  overlayAtTop: true,
});
```

**Фиксация после hero + slide:**
```js
new hvHeader({
  mode: 'fixedAfter',
  threshold: '#hero',
  scrollBehavior: 'shrink',
  fixFx: 'slide',
  compensate: 'spacer',
});
```

**Статик:**
```js
new hvHeader({
  mode: 'static',
  scrollBehavior: 'none',
});
```

---

## Нюансы

- **Snap-зона:** при `scrollY <= высота хедера` fixed сбрасывается мгновенно без анимаций — убирает дрожь у нуля.
- **`fixedAfter + reveal`:** вход во fixed скрытым, FX на rail при этом не запускается.
- **Компенсация:** высота замораживается при входе во fixed и разблокируется при выходе.
- **`overlayAtTop`:** `is-top` вешается только при `scrollY === 0` — удобно для прозрачного фона.
- **Rail vs root:** FX-слайд катается на `.hv-header__content`, reveal двигает сам `.hv-header` — трансформы независимы.
