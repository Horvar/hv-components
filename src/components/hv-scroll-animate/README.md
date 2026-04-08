# hv-scroll-animate

Анимации по скроллу на базе IntersectionObserver. Поддерживает группы элементов со stagger, адаптивные брейкпоинты и нарезку текста на строки.

---

## Подключение

```js
import { ScrollAnimate } from './script.js';

ScrollAnimate.definePreset('fade', {
  once: true,
  threshold: 0.15,
  delay: 0,
  activeClass: 'is-animated',
});

ScrollAnimate.definePreset('stagger-list', {
  once: true,
  threshold: 0.1,
  stagger: 80,
  activeClass: 'is-animated',
});
```

`new` не нужен — синглтон создаётся автоматически при импорте.

---

## Разметка

**Одиночный элемент** — `is-animated` ставится на сам контейнер:

```html
<div data-scroll-animate="fade">
  <!-- контент -->
</div>
```

**Группа со stagger** — `is-animated` ставится на контейнер, затем поочерёдно на каждый `[data-scroll-item]`:

```html
<ul data-scroll-animate="stagger-list">
  <li data-scroll-item>Item 1</li>
  <li data-scroll-item>Item 2</li>
  <li data-scroll-item>Item 3</li>
</ul>
```

**JSON поверх пресета:**

```html
<div data-scroll-animate='fade {"once":false,"threshold":0.3}'>...</div>
```

---

## Нарезка текста на строки (`splitLines`)

Режим `splitLines` разбивает текст на визуальные строки и анимирует каждую строку отдельно.

```js
ScrollAnimate.definePreset('lines', {
  splitLines: true,
  splitSelector: '[data-scroll-text]', // по умолчанию
  stagger: 100,
  once: true,
});
```

```html
<p data-scroll-animate="lines">
  <span data-scroll-text>Текст, который будет разбит на строки и анимирован</span>
</p>
```

При `resize` строки пересчитываются автоматически.

---

## Опции пресета

```js
{
  once: true,              // анимировать только один раз
  threshold: 0.2,          // доля видимости для срабатывания (0–1)
  rootMargin: '0px',       // отступ для IntersectionObserver
  delay: 0,                // задержка перед стартом (мс)
  stagger: 0,              // задержка между элементами группы (мс)
  activeClass: 'is-animated',

  // Адаптивные брейкпоинты (переопределяют любую опцию)
  breakpoints: {
    mobile: { stagger: 0 },     // < 768px
    tablet: { stagger: 60 },    // 768–1199px
    desktop: { stagger: 100 },  // ≥ 1200px
  },

  // Нарезка текста
  splitLines: false,
  splitSelector: '[data-scroll-text]',

  debug: false,
}
```

---

## Поведение

- Элементы, которые уже **выше** вьюпорта при инициализации, активируются мгновенно (без stagger).
- При `once: false` класс снимается когда элемент уходит **ниже** вьюпорта (прокрутка вверх).
- При смене брейкпоинта состояния сбрасываются и инициализируются заново.

---

## Публичное API

```js
ScrollAnimate.definePreset(name, conf)  // зарегистрировать пресет + ресканировать DOM
ScrollAnimate._inst.destroy()            // снять все observer'ы и слушатели
```
