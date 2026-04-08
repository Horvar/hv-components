import { DatePicker } from '../scripts/datepicker.js';
import { initDateMasks } from '../scripts/masks.js';

// пресеты объявляем ДО scan()
DatePicker.definePreset('dpSingle', {
  mode: 'single',
  weekStartsOn: 1,
  i18n: 'auto',
});

DatePicker.definePreset('dpRange', {
  mode: 'range',
  weekStartsOn: 1,
  i18n: 'auto',
  yearMin: new Date().getFullYear() - 10,
  yearMax: new Date().getFullYear() + 10,
});

DatePicker.definePreset('dpMulti', {
  mode: 'multi',
  weekStartsOn: 1,
  i18n: 'auto',
});

// сначала маски (чтобы инпуты были готовы), затем сканим датепикеры
initDateMasks(document);
DatePicker._ensure().scan();

// -------- playground logic --------
const form = document.getElementById('hvDpPlay');
if (!form) throw new Error('hvDpPlay not found');

const $ = (n) => form.elements[n];
const btnDownload = form.querySelector('[data-action="downloadBase"]');
const btnCopyPreset = form.querySelector('[data-action="copyPreset"]');
const btnCopyMarkup = form.querySelector('[data-action="copyMarkup"]');
const btnReadme = form.querySelector('[data-action="downloadReadme"]');

const str = (el) => (el.value || '').trim();
const num = (el) => Number(el.value);

function blink(btn, text = '✓ Done') {
  const old = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
  }, 900);
}

function readOpts() {
  return {
    name: str($('presetName')) || 'dpSingle',
    mode: $('mode').value,
    weekStartsOn: num($('weekStartsOn')),
    i18n: $('i18n').value,
  };
}

function buildDefineCode(opts) {
  const { name, mode, weekStartsOn, i18n } = opts;
  return `DatePicker.definePreset('${name}', {\n  mode: '${mode}',\n  weekStartsOn: ${weekStartsOn},\n  i18n: '${i18n}',\n});`;
}

function buildMarkup(opts) {
  const { name, mode } = opts;
  const maskMap = { single: 'date', range: 'date-range', multi: 'date-multi' };
  const mask = maskMap[mode] || 'date';
  const bindAttr = `data-bind="${name}Out"`;
  return `<div class="demo-field">
  <input ${bindAttr} data-mask="${mask}" type="text" value="" />
</div>
<div data-datepicker
     data-datepicker-settings="${name}"
     data-dp-bind-out="[${bindAttr}]"></div>`;
}

function downloadBase() {
  const files = [
    ['/components/hv-datepicker/scripts/datepicker.js', 'datepicker.js'],
    ['/components/hv-datepicker/scripts/masks.js', 'masks.js'],
    ['/components/hv-datepicker/style.scss', 'style.scss'],
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

async function copyPreset() {
  const code = buildDefineCode(readOpts());
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  blink(btnCopyPreset, '✓ Copied');
}

async function copyMarkup() {
  const tpl = buildMarkup(readOpts());
  try {
    await navigator.clipboard.writeText(tpl);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = tpl;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  blink(btnCopyMarkup, '✓ Copied');
}

async function downloadReadme() {
  const candidates = [
    './hv-datepicker-README.md',
    '../hv-datepicker-README.md',
    '../docs/hv-datepicker-README.md',
    '/components/hv-datepicker/hv-datepicker-README.md',
  ];
  let text = '# hv-datepicker\n\nREADME не найден рядом с демо.';
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
  a.download = 'hv-datepicker-README.md';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
  blink(btnReadme, '✓ Saved');
}

// wire
btnDownload.addEventListener('click', downloadBase);
btnCopyPreset.addEventListener('click', copyPreset);
btnCopyMarkup.addEventListener('click', copyMarkup);
btnReadme.addEventListener('click', downloadReadme);
