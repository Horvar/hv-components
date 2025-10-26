# Huder — универсальный хедер (README)

Компактная документация по компоненту **Huder**: режимы позиционирования, поведение на скролле, анимации входа/выхода и компенсация под fixed. Подходит для повторного использования на разных сайтах с минимальной настройкой.

---

## TL;DR: подключение за минуту

**HTML (минимум):**

```html
<header class="huder">
  <div class="huder__wrapper">
    <!-- ваш контент -->
  </div>
</header>

<!-- Необязательный «сентинел»: полоса у верхнего края экрана -->
<div class="screen-top"></div>
```

**JS (инициализация):**

```js
import { Huder } from './huder.js';

const h = new Huder({
  mode: 'fixedAfter', // 'static' | 'fixed' | 'fixedAfter'
  threshold: 'sentinel', // px | 'sentinel' | селектор | Element
  scrollBehavior: 'reveal', // 'none' | 'shrink' | 'reveal'
  fixFx: 'slide', // анимация входа/выхода во fixed
  compensate: 'spacer', // место под fixed
  sentinel: '.screen-top', // что считать верхом экрана (top-offset)
});
```

Готово: хедер зафиксируется после порога и будет прятаться/показываться при прокрутке.

---

## Базовые понятия

- **root** — элемент `.huder`. Внутри создаётся/переиспользуется `.huder__rail` — именно она едет при FX.
- **sentinel** — любой элемент у верхней кромки вьюпорта, его **высота** образует `top-offset`.
- **threshold** — момент включения `fixed` в режиме `fixedAfter`.
- **compensation** — механизм освобождения места под фиксированный хедер: spacer или `padding-top` у контейнера.

---

## Режимы позиционирования (`mode`)

- `'static'` — обычный поток документа (без фиксации).
- `'fixed'` — всегда фиксированный. Можно анимировать первичный вход (`fixFxOnInit`).
- `'fixedAfter'` — становится fixed после порога `threshold`.

**Как задавать `threshold`:**

- Число/строка в px (`200`, `'200px'`) — пиксели **от начала документа**.
- `'sentinel'` _(по умолчанию)_ — порог равен `top-offset` (высоте `sentinel`).
- Селектор/`Element` — порогом считается `bottom` этого элемента в координатах страницы.

**Top-offset:** берётся как высота `sentinel`. Доступен в CSS как `--huder-top-offset` (JS обновляет автоматически).

---

## Поведение на скролле (`scrollBehavior`)

- `'none'` — без интеракции. Можно стартовать «компактным» через `shrinkInitiallyExpanded: false`.
- `'shrink'` — при прокрутке **вниз** сжимается (`is-compact`), **вверх** — расширяется. Пороги: `shrinkShowDelta`, `shrinkHideDelta`.
- `'reveal'` — при прокрутке **вниз** скрывается (`is-hidden`), **вверх** — показывается. Пороги: `revealHideDelta`, `revealShowDelta`.

> Особенность: в `fixedAfter + reveal` вход во fixed происходит **сразу скрытым**, чтобы избежать «вспышки» из‑за наложения трансформов root/rail.

---

## FX при входе/выходе (`fixFx`)

- `'slide'` — анимируется **`.huder__rail`** (въезд/выезд сверху).
- `'none'` — без эффектов.

Тайминги настраиваются переменными CSS (JS проставляет из опций):

- `--huder-fx-enter-dur`, `--huder-fx-leave-dur`, `--huder-fx-easing`.

---

## Компенсация под fixed (`compensate`)

- `'spacer'` _(по умолчанию)_ — после `.huder` вставляется `.huder-spacer` с «замороженной» высотой хедера в момент входа в fixed.
- `'body'` — ставится `padding-top` у `contentContainer` (по умолчанию `'body'`).
- `'none'` — без компенсации (контент окажется под хедером).

---

## Классы-состояния и CSS-контракт

На `.huder`:

- `is-fixed` — включён fixed.
- `is-compact` — компактная высота (использует `--huder-h-compact`).
- `is-hidden` — для `reveal`: хедер уезжает `translateY(-100%)`.
- `is-top` — у самого верха страницы (при `overlayAtTop: true`).
- `huder--fx-slide` — активен слайд-FX (ставит JS).
- `huder--no-anim` — служебный флаг, глушит переходы на один кадр.

Служебные для FX:

- `.huder__rail`
- `fx-enter`, `fx-leave` (на корне)
- `.rail--no-anim` (на рельсе — снять transition на кадр)

**Полезные CSS‑переменные:**

- Размеры: `--huder-h-expanded`, `--huder-h-compact`.
- Транзишны: `--huder-tr-move`, `--huder-tr-height`, `--huder-ease`.
- Отступ сверху: `--huder-top-offset`.

---

## Публичное API

```js
h.setMode(mode); // 'static' | 'fixed' | 'fixedAfter'
h.setThreshold(th); // число | '123px' | 'sentinel' | селектор | Element
h.setSentinel(elOrSelector); // новый sentinel (null — убрать)
h.enable(); // подписаться на события/обсерверы заново
h.disable(); // отписаться от всего
h.destroy(); // снять классы/компенсацию, удалить spacer, почистить хуки
```

**Когда вызывать:**

- Поменялась компоновка сверху → `setSentinel(...)` или `setThreshold(...)`.
- Переключаете пресеты на лету → `setMode(...)`.
- Уходите со страницы/вью → `disable()`, при возврате → `enable()`.

---

## Готовые пресеты

### 1) «Классический» fixed-хедер с reveal

```js
new Huder({
  mode: 'fixed',
  scrollBehavior: 'reveal',
  revealShowDelta: 24,
  revealHideDelta: 24,
  fixFx: 'none',
  compensate: 'spacer',
  overlayAtTop: true,
});
```

### 2) Фиксация после геро‑блока + мягкий slide‑въезд

```js
new Huder({
  mode: 'fixedAfter',
  threshold: '#hero', // или 'sentinel'
  scrollBehavior: 'shrink',
  fixFx: 'slide',
  fixFxEnterDuration: 220,
  fixFxLeaveDuration: 220,
  compensate: 'spacer',
});
```

### 3) Статик без фиксации (редко нужно)

```js
new Huder({
  mode: 'static',
  scrollBehavior: 'none',
});
```

---

## Тонкости и грабли

1. **Snap‑зона у верха:** в пределах базовой высоты хедера компонент жёстко сбрасывается в `static` **без анимаций**, что убирает дрожь на нуле.
2. **`fixedAfter + reveal`:** вход во fixed — **скрытым**, чтобы не суммировать transform у root и rail.
3. **Заморозка компенсации:** высота spacer/body‑padding фиксируется при входе в fixed и не скачет при рефлоу/ресайзе пока активен fixed.
4. **`overlayAtTop`:** если `true`, на самом верху добавляется `is-top` — удобно делать прозрачный фон только там.
5. **Rail vs root:** FX катается на `.huder__rail`, а `reveal` двигает сам root — эти трансформы независимы.

---

## Опции (полный список)

```js
{
  // Корень и базовые элементы
  root: '.huder',
  sentinel: '.screen-top',

  // Позиционирование
  mode: 'static',                // 'static' | 'fixed' | 'fixedAfter'
  threshold: 'sentinel',         // число | '400' | '400px' | 'sentinel' | селектор | Element

  // Поведение на скролле
  scrollBehavior: 'none',        // 'none' | 'shrink' | 'reveal'
  shrinkShowDelta: 24,
  shrinkHideDelta: 24,
  shrinkInitiallyExpanded: true,
  revealShowDelta: 24,
  revealHideDelta: 24,
  revealInitiallyHidden: false,  // (в fixedAfter игнорируется — вход скрытым всегда)

  // FX static↔fixed (анимирует .huder__rail)
  fixFx: 'slide',                // 'slide' | 'none'
  fixFxEnterDuration: 220,
  fixFxLeaveDuration: 220,
  fixFxEasing: 'ease',
  fixFxOnInit: true,             // анимировать первичный вход при mode:'fixed'

  // Компенсация под fixed
  compensate: 'spacer',          // 'spacer' | 'body' | 'none'
  contentContainer: 'body',

  // Визуалка у самого верха
  overlayAtTop: true,

  // Отладка
  debug: false,
}
```

---

## Кастомизация высот и внешнего вида

```css
:root {
  --huder-h-expanded: 88px;
  --huder-h-compact: 52px;
  --huder-tr-move: 0.22s;
  --huder-tr-height: 0.18s;
  --huder-ease: ease;
}

/* Пример стилей для состояний */
.huder.is-top {
  background: transparent;
}
.huder.is-fixed {
  backdrop-filter: saturate(120%) blur(8px);
}
.huder.is-compact .logo {
  scale: 0.9;
}
```
