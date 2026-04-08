// === hv-form playground logic ===
const form = document.getElementById('hvFormPlay');
const btnDownload = form.querySelector('[data-action="downloadBase"]');
const btnReadme = form.querySelector('[data-action="downloadReadme"]');
const btnCopy = form.querySelector('[data-action="copyMarkup"]');

function blink(btn, okText) {
  const old = btn.textContent;
  btn.textContent = okText;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
  }, 900);
}

// ---- скачивание базовых файлов ----
function downloadBase() {
  const files = [
    ['/components/hv-form/scripts/file.js', 'file.js'],
    ['/components/hv-form/scripts/masks.js', 'masks.js'],
    ['/components/hv-form/scripts/password.js', 'password.js'],
    ['/components/hv-form/style.scss', 'style.scss'],
  ];
  for (const [url, name] of files) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  blink(btnDownload, '✓ Downloaded');
}

// ---- скачать README (ищем по нескольким вариантам путей) ----
async function downloadReadme() {
  const filename = 'hv-form-README.md';
  const candidates = [
    './hv-form-README.md',
    '../hv-form-README.md',
    '../docs/hv-form-README.md',
    '/components/hv-form/hv-form-README.md',
  ];
  let text = '# hv-form\n\nДокументация пока не найдена.';
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        text = await res.text();
        break;
      }
      // eslint-disable-next-line no-empty
    } catch {}
  }
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
  blink(btnReadme, '✓ Saved');
}

// ---- копирование базовой разметки формы ----
async function copyMarkup() {
  const markup = `<!-- wrapper -->
<div class="form">
  <!-- может быть <div class=\\"form__body\\"> или <form class=\\"form__body\\"> -->
  <form class="form__body" action="#" method="post" novalidate>

    <!-- Поле текст -->
    <label class="form__field">
      <span class="form__field-title">Текст</span>
      <span class="form__field-tip">Обычный текст без ограничений</span>
      <input class="form__control" type="text" placeholder="Плейсхолдер для текста" />
      <span class="form__error">Текст ошибки</span>
    </label>

    <!-- Поле пароль (+ кнопка показать/скрыть) -->
    <label class="form__field form-pass" data-pass-visible="false">
      <span class="form__field-title">Пароль</span>
      <span class="form__field-tip">Кнопка справа показывает/скрывает символы</span>
      <input class="form__control form-pass__control" type="password" placeholder="Пароль" />
      <button class="form-pass__toggle" type="button" aria-label="Показать/скрыть пароль">
        <svg class="form-pass__icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <use class="is-off" href="#i-eye"></use>
          <use class="is-on"  href="#i-eye-off"></use>
        </svg>
      </button>
      <span class="form__error">Текст ошибки</span>
    </label>

    <!-- Телефоны (любая из трёх масок) -->
    <label class="form__field">
      <span class="form__field-title">Телефон</span>
      <input class="form__control" type="tel" placeholder="+7 (___) ___-__-__">
      <span class="form__error">Текст ошибки</span>
    </label>

    <!-- Кастомная маска -->
    <label class="form__field">
      <span class="form__field-title">Код</span>
      <input class="form__control" type="text" data-mask-pattern="99-999" placeholder="12-345">
      <span class="form__error">Текст ошибки</span>
    </label>

    <!-- Почта -->
    <label class="form__field">
      <span class="form__field-title">Почта</span>
      <input class="form__control" type="email" placeholder="name@domain.tld">
      <span class="form__error">Текст ошибки</span>
    </label>

    <!-- Textarea -->
    <label class="form__field">
      <span class="form__field-title">Комментарий</span>
      <textarea class="form__control" placeholder="Ваш комментарий"></textarea>
      <span class="form__error">Текст ошибки</span>
    </label>

    <!-- Файлы (drag&drop) -->
    <div class="form__field form-file"
         data-file-max="5MB"
         data-file-accept=".png,.jpg,.pdf"
         data-file-multiple="true">
      <span class="form__field-title">Файлы</span>
      <input class="form-file__input" type="file" hidden accept=".png,.jpg,.pdf" multiple />
      <div class="form-file__drop" tabindex="0" role="button" aria-label="Перетащите файлы или нажмите для выбора">
        Зона для перетаскивания
      </div>
      <div class="form-file__status">Файлы не выбраны</div>
      <ul class="form-file__list" aria-live="polite"></ul>
      <div class="form-file__actions">
        <button type="button" class="form-file__btn form-file__btn--pick">Выбрать</button>
        <button type="button" class="form-file__btn form-file__btn--clear" disabled>Очистить</button>
      </div>
      <span class="form__error" hidden>Превышен допустимый размер файла</span>
    </div>

    <!-- Чекбокс согласия -->
    <label class="form__check form-check">
      <span class="form-check__wrapper">
        <input class="form-check__input" type="checkbox">
        <svg class="form-check__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <use href="#i-check-off"></use>
          <use href="#i-check-on"></use>
        </svg>
        <span class="form-check__text">Согласен с условиями обработки данных</span>
      </span>
      <span class="form__error">Необходимо согласие</span>
    </label>

    <!-- Сабмиты (любой из вариантов с одинаковым классом) -->
    <button class="form__submit" type="submit">Отправить</button>

  </form>
</div>`;
  try {
    await navigator.clipboard.writeText(markup);
    blink(btnCopy, '✓ Copied');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = markup;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    blink(btnCopy, '✓ Copied');
  }
}

// bindings
btnDownload.addEventListener('click', downloadBase);
btnReadme.addEventListener('click', downloadReadme);
btnCopy.addEventListener('click', copyMarkup);
