import { Accordion } from '../script.js';
import { hvHeader } from '../../hv-header/script.js';

// Пример твоих глобальных пресетов (необязательно для playground-а):
Accordion.definePreset('faqPreset', { singleOpen: true, duration: 240 });
Accordion.definePreset('multiPreset', { singleOpen: false, duration: 160 });

new hvHeader({
  root: '.hv-header',
  mode: 'fixedAfter',
  threshold: 500,
  scrollBehavior: 'shrink',
  downDelta: 24,
  upDelta: 24,
  fixFx: 'slide',
  fixFxEnterDuration: 220,
  fixFxLeaveDuration: 220,
  fixFxEasing: 'ease',
  overlayAtTop: true,
  debug: false,
});

// -------- playground logic --------
const form = document.getElementById('hvAccPlay');
const $ = (n) => form.elements[n];

const els = {
  presetName: $('presetName'),
  debug: $('debug'),
  singleOpen: $('singleOpen'),
  duration: $('duration'),
};

const btns = {
  apply: form.querySelector('[data-action="apply"]'),
  downloadBase: form.querySelector('[data-action="downloadBase"]'),
  copyPreset: form.querySelector('[data-action="copyPreset"]'),
  copyMarkup: form.querySelector('[data-action="copyMarkup"]'),
  readme: form.querySelector('[data-action="downloadReadme"]'),
};

// utils
const bool = (el) => el.checked === true;
const num = (el, def = 0) => {
  const n = Number(el.value);
  return Number.isFinite(n) ? n : def;
};
const str = (el) => (el.value || '').trim();
const blink = (btn, text = '✓ Done') => {
  const old = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
  }, 900);
};
const serialize = (v) =>
  typeof v === 'string'
    ? `'${v.replace(/'/g, "\\'")}'`
    : typeof v === 'boolean' || Number.isFinite(v)
      ? String(v)
      : 'null';

function readPreset() {
  return {
    name: str(els.presetName) || '__accPlay',
    debug: els.debug.value === 'true',
    conf: {
      singleOpen: bool(els.singleOpen),
      duration: num(els.duration, 200),
    },
  };
}

function buildDefineCode(p) {
  const { name, conf } = p;
  const order = ['singleOpen', 'duration'];
  const ordered = {};
  order.forEach((k) => {
    if (conf[k] !== undefined) ordered[k] = conf[k];
  });
  const lines = Object.entries(ordered)
    .map(([k, v]) => `  ${k}: ${serialize(v)},`)
    .join('\n');
  return `Accordion.definePreset('${name}', {\n${lines}\n});`;
}

function buildMarkup(name) {
  return `<div data-accordion-settings="${name}">
  <div data-accordion-item class="is-unfolded">
    <button data-accordion-button>Вопрос</button>
    <div data-accordion-content>Ответ</div>
  </div>
</div>`;
}

// actions
function applyToDemo() {
  const p = readPreset();
  // включим глобальный debug (если контроллер уже создан)
  try {
    Accordion._ensureSingleton().o.debug = p.debug;
    // eslint-disable-next-line no-empty
  } catch {}
  // запишем/перезапишем пресет (внутри Accordion — авто-рескан контейнеров)
  Accordion.definePreset(p.name, p.conf);
  blink(btns.apply, '✓ Применено');
}

function downloadBase() {
  const files = [['/components/hv-accordion/script.js', 'script.js']];
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
  blink(btns.downloadBase, '✓ Downloaded');
}

async function copyPreset() {
  const code = buildDefineCode(readPreset());
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
  blink(btns.copyPreset, '✓ Copied');
}

async function copyMarkup() {
  const { name } = readPreset();
  const tpl = buildMarkup(name);
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
  blink(btns.copyMarkup, '✓ Copied');
}

async function downloadReadme() {
  const candidates = [
    './hv-accordion-README.md',
    '../hv-accordion-README.md',
    '../docs/hv-accordion-README.md',
    '/components/hv-accordion/hv-accordion-README.md',
  ];
  let text = '# hv-accordion\n\nREADME не найден рядом с демо.';
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
  a.download = 'hv-accordion-README.md';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
  blink(btns.readme, '✓ Saved');
}

// wire
btns.apply.addEventListener('click', applyToDemo);
btns.downloadBase.addEventListener('click', downloadBase);
btns.copyPreset.addEventListener('click', copyPreset);
btns.copyMarkup.addEventListener('click', copyMarkup);
btns.readme.addEventListener('click', downloadReadme);

// live-apply on change/input (приятная мелочь)
form.addEventListener('change', applyToDemo);
form.addEventListener('input', (e) => {
  if (['duration', 'presetName', 'singleOpen'].includes(e.target.name)) applyToDemo();
});

// first apply (с текущими значениями)
applyToDemo();
