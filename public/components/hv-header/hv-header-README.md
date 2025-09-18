# hv-header — фиксируемый хедер (README)

> Сделано в 2 слоях: **Часть 1 — короткое описание**, **Часть 2 — внутрянка по необходимости**.

---

## Часть 1. Короткое описание

### Что это
Повторно используемый хедер, который может быть **статичным**, **всегда fixed**, или **становиться fixed после порога**. Умеет:
- `shrink`: сжиматься вниз / раскрываться вверх;
- `reveal`: прятаться вниз / появляться вверх;
- аккуратно **компенсировать место** под fixed (spacer или padding у контейнера);
- анимировать вход/выход в fixed через `.hv-header__content` (**slide/fade**).

### Подключение за минуту

**HTML:**
```html
<header class="hv-header">
  <div class="hv-header__content">
    <!-- ваш контент -->
  </div>
</header>

<!-- Необязательный "сентинел" у верхней кромки экрана -->
<div class="screen-top"></div>
```

**JS:**
```js
import { hvHeader } from './hv-header.js';

new hvHeader({
  mode: 'fixedAfter',        // 'static' | 'fixed' | 'fixedAfter'
  threshold: 'sentinel',     // px | 'sentinel' | селектор | Element
  sentinel: '.screen-top',   // верх экрана (его высота -> top-offset)
  scrollBehavior: 'reveal',  // 'none' | 'shrink' | 'reveal'
  downDelta: 24,             // ↓: shrink→compact / reveal→hide
  upDelta: 24,               // ↑: shrink→expand / reveal→show
  fixFx: 'slide',            // 'slide' | 'fade' | 'none' (анимируется .hv-header__content)
  compensate: 'spacer',      // 'spacer' | 'body' | 'none'
  overlayAtTop: true,        // добавить .is-top на самом верху страницы
  debug: false               // false | true(=1) | 2
});
```

**CSS-переменные (по желанию):**
```css
:root {
  --hv-header-top-offset: 0px;      /* JS сам проставит по sentinel */
  --hv-header-h-expanded: 100px;
  --hv-header-h-compact: 56px;
  --hv-header-tr-move: .22s;
  --hv-header-tr-height: .18s;
  --hv-header-ease: ease;
  --hv-header-fx-enter-dur: 220ms;
  --hv-header-fx-leave-dur: 220ms;
  --hv-header-fx-easing: ease;
}
```

### Главные опции

- **mode** — режим: `'static'` | `'fixed'` | `'fixedAfter'`
- **threshold** — порог для `fixedAfter`:
  - число/`'Npx'` — абсолютные пиксели страницы;
  - `'sentinel'` — равен высоте `sentinel` (top-offset);
  - селектор/`Element` — берётся `bottom` элемента.
- **sentinel** — элемент у верхней кромки (его высота → `--hv-header-top-offset`).
- **scrollBehavior** — `'none'` / `'shrink'` / `'reveal'`.
  - **downDelta**/**upDelta** — универсальные пороги (px). Если `null`, используются legacy:
    - *shrink*: `shrinkShowDelta` (↓), `shrinkHideDelta` (↑), `shrinkInitiallyExpanded`
    - *reveal*: `revealHideDelta` (↓), `revealShowDelta` (↑), `revealInitiallyHidden`
- **fixFx** — эффект входа/выхода fixed: `'slide'` | `'fade'` | `'none'` (+ `fixFxEnterDuration`, `fixFxLeaveDuration`, `fixFxEasing`, `fixFxOnInit`).
- **compensate** — `'spacer'` (вставит `.hv-header-spacer`), `'body'` (добавит `padding-top` контейнеру), `'none'`.
- **overlayAtTop** — добавляет класс `.is-top` в самом верху страницы.
- **debug** — `false` | `true`(=1) | `2` (подробный лог).

### Публичное API
```js
const h = new hvHeader(opts);
h.setMode('fixedAfter');
h.setThreshold('#hero');
h.setSentinel('.screen-top');
h.enable();   // подписаться на события/обсерверы
h.disable();  // отписаться (например, при скрытии вью)
h.destroy();  // убрать классы/спейсер/переменные, отписаться
```

### Два готовых пресета

**A. Новостник (всегда fixed + reveal):**
```js
new hvHeader({
  mode: 'fixed',
  scrollBehavior: 'reveal',
  fixFx: 'none',
  compensate: 'spacer',
  overlayAtTop: true,
});
```

**B. Лендинг (fixed после hero + slide + shrink):**
```js
new hvHeader({
  mode: 'fixedAfter',
  threshold: '#hero',     // 'sentinel' или значение
  scrollBehavior: 'shrink',
  fixFx: 'slide',
  compensate: 'spacer',
});
```

---

## Часть 2. Внутрянка

- **Корень:** `.hv-header`. Внутри — `.hv-header__content`. Если его нет, скрипт создаст и перенесёт детей внутрь.
- **Состояния на корне:** `is-fixed`, `is-compact`, `is-hidden`, `is-top`, служебные `hv-header--no-anim`, `fx-enter`, `fx-leave`, а также `hv-header--fx-slide/hv-header--fx-fade` для выбора FX.
- **Компенсация:**
  - `spacer` — соседний `.hv-header-spacer` с «замороженной» высотой на момент входа в fixed;
  - `body` — `padding-top` у `contentContainer`.
- **Snap-зона у верха:** если `scrollY` ≤ базовой высоты (учитывает spacer/lock), хедер **мгновенно** сбрасывается в `static` без анимаций → нет дрожи на нуле.
- **fixedAfter + reveal:** вход во fixed происходит **сразу скрытым** и на кадр глушатся анимации root (`hv-header--no-anim`), чтобы исключить «вспышку».
- **Универсальные пороги:** если `downDelta`/`upDelta` заданы — они перекрывают legacy пороги; иначе берутся `shrink*`/`reveal*` параметры.
- **Debug:** `debug:true/2` печатает снапшоты и изменения ключевых величин (`topOffset`, `thresholdPx`, и т.д.).