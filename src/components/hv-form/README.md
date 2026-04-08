# hv-form

Набор утилит для форм: маски, переключатель пароля, поле загрузки файлов. Каждый модуль независим.

---

## Маски (`scripts/masks.js`)

```js
import { initMasks, getUnmasked } from './scripts/masks.js';

initMasks();                          // весь документ
initMasks(someContainer);             // конкретный контейнер
initMasks(document, { phoneMask: '+380 (99) 999-99-99' }); // кастомная маска телефона
```

**Что обрабатывает:**

| Селектор | Маска |
|---|---|
| `input[type="tel"]`, `[data-type="tel"]`, `[data-mask="phone"]` | Телефон (по умолчанию `+7 (999) 999-99-99`) |
| `[data-mask-pattern="..."]` | Произвольный паттерн Inputmask |

После ввода сырое значение (без форматирования) синхронизируется в `data-value`.

```js
// Получить сырое значение программно
const raw = getUnmasked(inputEl); // только цифры
```

---

## Переключатель пароля (`scripts/password.js`)

```js
import { initPasswordToggles } from './scripts/password.js';

initPasswordToggles();         // весь документ
initPasswordToggles(form);     // конкретный контейнер
```

**Разметка:**

```html
<div class="form__field form-password">
  <input class="form__control" type="password" />
  <!-- кнопка .form-password__toggle создаётся автоматически, если её нет -->
  <button class="form-password__toggle"
    data-show="Показать пароль"
    data-hide="Скрыть пароль">
  </button>
</div>
```

Атрибут `data-password-visible="true/false"` выставляется на враппере `.form__field` — удобно для стилизации иконки через CSS.

---

## Поле загрузки файлов (`scripts/file.js`)

```js
import { initFileFields } from './scripts/file.js';

initFileFields();       // весь документ
initFileFields(form);   // конкретный контейнер
```

**Разметка:**

```html
<div class="form-file"
  data-file-max="5MB"
  data-file-multiple
  data-file-accept="image/*,.pdf"
>
  <div class="form-file__drop">
    Перетащите файлы или <button class="form-file__btn--pick" type="button">выберите</button>
  </div>
  <input type="file" hidden />
  <p class="form-file__status"></p>
  <ul class="form-file__list"></ul>
  <button class="form-file__btn--clear" type="button">Очистить</button>
  <p class="form__error" hidden></p>
</div>
```

| Атрибут | Описание |
|---|---|
| `data-file-max` | Максимальный размер файла: `5MB`, `500KB`, `1GB` |
| `data-file-multiple` | Разрешить несколько файлов |
| `data-file-accept` | MIME-типы или расширения через запятую |

**Классы-состояния:**
- `is-dragover` — файл перетаскивается над зоной
- `is-error` — ошибка (превышен размер)
