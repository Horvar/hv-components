export function initPasswordToggles(root = document) {
  const fields = root.querySelectorAll('.form__field');

  fields.forEach((field) => {
    const input = field.querySelector('.form__control[type="password"]') || null;
    if (!input) return;

    // контейнер (для data-password-visible)
    const wrap = field.classList.contains('form-password') ? field : field;

    // ищем кастомную кнопку; если нет — создаём
    let btn = field.querySelector('.form-password__toggle');
    let created = false;

    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'form-password__toggle';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Показать пароль');
      btn.textContent = 'Показать'; // минимальный текст, если иконок нет
      field.appendChild(btn);
      created = true;
    }

    // начальное состояние
    const setState = (visible) => {
      wrap.setAttribute('data-password-visible', visible ? 'true' : 'false');
      btn.setAttribute('aria-pressed', visible ? 'true' : 'false');

      // aria-label из data-атрибутов кнопки, если заданы
      const showLabel = btn.getAttribute('data-show') || 'Показать пароль';
      const hideLabel = btn.getAttribute('data-hide') || 'Скрыть пароль';
      btn.setAttribute('aria-label', visible ? hideLabel : showLabel);
    };

    setState(false);

    // переключатель
    const toggle = () => {
      // запомним позицию каретки
      const start = input.selectionStart;
      const end = input.selectionEnd;

      const toVisible = input.type === 'password';
      input.setAttribute('type', toVisible ? 'text' : 'password');
      setState(toVisible);

      // вернуть фокус и каретку
      input.focus({ preventScroll: true });
      try {
        input.setSelectionRange(start, end);
      } catch {
        /* ignore: observer can fail in some environments */
      }
    };

    // клики/клавиатура
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // не снимать фокус с input
    btn.addEventListener('click', toggle);
    btn.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    });

    // синхронизируем disabled
    const syncDisabled = () => {
      if (input.disabled) {
        btn.setAttribute('disabled', 'true');
      } else {
        btn.removeAttribute('disabled');
      }
    };
    syncDisabled();

    // если кнопку сгенерили, добавим простую иконку по умолчанию (не обязательно)
    if (created && !btn.querySelector('svg')) {
      // минимальный вид без спрайта
      btn.innerHTML = '<span aria-hidden="true">👁️</span>';
    }
  });
}
