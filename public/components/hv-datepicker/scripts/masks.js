// _hv-date-masks.js
// Независимый слой масок для полей дат. Работает поверх любых инпутов,
// ничего не знает о датепикере и НЕ трогает data-dp-*.
// Пишет свой raw в data-value (совместимо с вашим общим масочным контрактом).

import Inputmask from 'inputmask';

/**
 * Маски для дат:
 * - single: [data-mask="date"]        => "99.99.9999"
 * - range:  [data-mask="date-range"]  => "99.99.9999 - 99.99.9999"
 * - multi:  [data-mask="date-multi"]  => без маски (оставляем свободный ввод)
 *
 * Все элементы синхронизируют data-value "сырым" значением:
 * - single: "DDMMYYYY"
 * - range:  "DDMMYYYYDDMMYYYY" (две группы подряд; разделители убраны)
 * - multi:  все цифры без разделителей (могут подрядиться) — это просто util,
 *           источник истины для multi остаётся парсер в датепикере.
 */
export function initDateMasks(root = document) {
  const singles = root.querySelectorAll('input[data-mask="date"]');
  const ranges = root.querySelectorAll('input[data-mask="date-range"]');
  const multis = root.querySelectorAll('input[data-mask="date-multi"]');

  if (singles.length) {
    const im = new Inputmask({
      mask: '99.99.9999',
      showMaskOnHover: false,
      showMaskOnFocus: true,
      clearIncomplete: false,
      keepStatic: true,
      greedy: false,
      placeholder: '_',
    });
    im.mask(singles);
    singles.forEach(bindDataValueSync);
  }

  if (ranges.length) {
    const im = new Inputmask({
      mask: '99.99.9999 – 99.99.9999',
      showMaskOnHover: false,
      showMaskOnFocus: true,
      clearIncomplete: false,
      keepStatic: true,
      greedy: false,
      placeholder: '_',
    });
    im.mask(ranges);
    ranges.forEach(bindDataValueSync);
  }

  // multi — без маски (список дат через запятую), но синхронизируем raw
  multis.forEach(bindDataValueSync);
}

/** Синхронизирует data-value с «сырым» значением поля (цифры без форматирования). */
function bindDataValueSync(el) {
  const update = () => {
    const raw = getUnmasked(el);
    if (raw) el.dataset.value = raw;
    else el.removeAttribute('data-value');
  };
  el.addEventListener('input', update);
  el.addEventListener('blur', update);
  update();
}

/** Возвращает «сырое» значение без форматирования. */
export function getUnmasked(el) {
  if (el?.inputmask) {
    return el.inputmask.unmaskedvalue();
  }
  return (el?.value ?? '').replace(/\D+/g, '');
}
