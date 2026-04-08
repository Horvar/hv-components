// _hv-masks.js
import Inputmask from 'inputmask';

/**
 * Инициализирует маски.
 * - Телефон по: <input type="tel">, [data-type="tel"], [data-mask="phone"]
 * - Кастомная маска по: [data-mask-pattern="+7 (999) 999-99-99"]
 *
 * Для всех полей с маской обновляется data-value с «сырым» значением.
 */
export function initMasks(root = document, { phoneMask = '+7 (999) 999-99-99' } = {}) {
  // --- Телефонные поля ---
  const phoneEls = root.querySelectorAll('input[type="tel"], input[data-type="tel"], input[data-mask="phone"]');

  if (phoneEls.length) {
    const im = new Inputmask({
      mask: phoneMask,
      showMaskOnHover: false,
      showMaskOnFocus: true,
      clearIncomplete: false,
      keepStatic: true,
      greedy: false,
      placeholder: '_',
    });

    im.mask(phoneEls);

    phoneEls.forEach(bindDataValueSync);
  }

  // --- Кастомные паттерны ---
  const patternEls = root.querySelectorAll('input[data-mask-pattern], textarea[data-mask-pattern]');
  patternEls.forEach((el) => {
    const pattern = el.getAttribute('data-mask-pattern');
    if (!pattern) return;
    const im = new Inputmask({
      mask: pattern,
      showMaskOnHover: false,
      showMaskOnFocus: true,
      clearIncomplete: false,
      keepStatic: true,
      greedy: false,
      placeholder: '_',
    });
    im.mask(el);
    bindDataValueSync(el);
  });
}

/**
 * Синхронизирует data-value с реальным "сырым" значением поля.
 */
function bindDataValueSync(el) {
  const update = () => {
    const raw = getUnmasked(el);
    if (raw) el.dataset.value = raw;
    else delete el.dataset.value;
  };
  el.addEventListener('input', update);
  el.addEventListener('blur', update);
  update();
}

/**
 * Возвращает «сырое» значение без форматирования.
 */
export function getUnmasked(el) {
  if (el?.inputmask) {
    return el.inputmask.unmaskedvalue();
  }
  return (el?.value ?? '').replace(/\D+/g, '');
}
