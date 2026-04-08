import { Modaler } from '../script.js';

// ---- единый инстанс ----
const inst = (window.__hvModalController__ = window.__hvModalController__ || new Modaler());

// ---- предустановленные пресеты (как в твоём коде) ----
const PREDEFS = {
  dialog: {
    mode: 'generic',
    overlay: true,
    closeOnEsc: true,
    closeOnOutside: true,
    lockScroll: true,
    focusTrap: true,
    autoCloseOnLink: false,
    viewportMargin: 12,
  },
  'dropdown-common': {
    mode: 'dropdown',
    overlay: false,
    closeOnEsc: true,
    closeOnOutside: true,
    lockScroll: false,
    focusTrap: false,
    autoCloseOnLink: true,
    gap: 8,
    viewportMargin: 8,
  },
  'dropdown-flip': {
    mode: 'dropdown',
    overlay: false,
    closeOnEsc: true,
    closeOnOutside: true,
    lockScroll: false,
    focusTrap: false,
    autoCloseOnLink: false,
    gap: 8,
    viewportMargin: 8,
    flip: true,
  },
  menu: {
    mode: 'menu',
    overlay: true,
    closeOnEsc: true,
    closeOnOutside: true,
    lockScroll: true,
    focusTrap: true,
    autoCloseOnLink: true,
    anchor: '.hv-header',
  },
  'menu-fit': {
    mode: 'menu',
    overlay: true,
    closeOnEsc: true,
    closeOnOutside: true,
    lockScroll: true,
    focusTrap: true,
    autoCloseOnLink: true,
    anchor: '.hv-header',
    fitRest: true,
  },
};
Object.entries(PREDEFS).forEach(([name, conf]) => {
  Modaler.definePreset(name, conf);
  inst.definePreset(name, conf);
});

// ---- playground логика ----
const form = document.getElementById('hvModalPlay');
const $ = (n) => form.elements[n];
const btnApply = form.querySelector('[data-action="apply"]');
const btnOpen = form.querySelector('[data-action="open"]');
const btnDownload = form.querySelector('[data-action="downloadBase"]');
const btnCopy = form.querySelector('[data-action="copy"]');
const btnMarkup = form.querySelector('[data-action="copyMarkup"]');
const btnReadme = form.querySelector('[data-action="downloadReadme"]');

const bool = (el) => el.checked === true;
const num = (el, def = 0) => {
  const n = Number(el.value);
  return Number.isFinite(n) ? n : def;
};
const str = (el) => (el.value || '').trim();

function blink(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
  }, 900);
}
function setDisabled(el, on) {
  el.disabled = !!on;
  (el.closest('label') || el).style.opacity = on ? 0.5 : 1;
}
function enforceInterlocks() {
  const mode = $('mode').value;
  setDisabled($('flip'), mode !== 'dropdown');
  setDisabled($('anchor'), mode !== 'menu');
  setDisabled($('fitRest'), mode !== 'menu');
}
function fillFormFromConf(conf) {
  $('mode').value = conf.mode || 'generic';
  $('overlay').checked = !!conf.overlay;
  $('closeOnEsc').checked = !!conf.closeOnEsc;
  $('closeOnOutside').checked = !!conf.closeOnOutside;
  $('lockScroll').checked = !!conf.lockScroll;
  $('focusTrap').checked = !!conf.focusTrap;
  $('autoCloseOnLink').checked = !!conf.autoCloseOnLink;
  $('gap').value = conf.gap ?? 8;
  $('viewportMargin').value = conf.viewportMargin ?? 8;
  $('flip').checked = !!conf.flip;
  $('anchor').value = conf.anchor || '';
  $('fitRest').checked = !!conf.fitRest;
  enforceInterlocks();
}
function readPreset() {
  const mode = $('mode').value;
  const conf = {
    mode,
    overlay: bool($('overlay')),
    closeOnEsc: bool($('closeOnEsc')),
    closeOnOutside: bool($('closeOnOutside')),
    lockScroll: bool($('lockScroll')),
    focusTrap: bool($('focusTrap')),
    autoCloseOnLink: bool($('autoCloseOnLink')),
    gap: num($('gap'), 8),
    viewportMargin: num($('viewportMargin'), 8),
  };
  if (mode === 'dropdown') conf.flip = bool($('flip'));
  if (mode === 'menu') {
    const a = str($('anchor'));
    if (a) conf.anchor = a;
    if (bool($('fitRest'))) conf.fitRest = true;
  }
  return { name: str($('presetName')) || '__play', debug: $('debug').value === 'true', conf };
}
function buildDefineCode(p) {
  const { name, conf } = p;
  const order = [
    'mode',
    'overlay',
    'closeOnEsc',
    'closeOnOutside',
    'lockScroll',
    'focusTrap',
    'autoCloseOnLink',
    'gap',
    'viewportMargin',
    'flip',
    'anchor',
    'fitRest',
  ];
  const ordered = {};
  order.forEach((k) => {
    if (conf[k] !== undefined) ordered[k] = conf[k];
  });
  const ser = (v) =>
    typeof v === 'string'
      ? `'${v.replace(/'/g, "\\'")}'`
      : typeof v === 'boolean' || Number.isFinite(v)
        ? String(v)
        : v == null
          ? 'null'
          : JSON.stringify(v);
  const lines = Object.entries(ordered)
    .map(([k, v]) => `  ${k}: ${ser(v)},`)
    .join('\n');
  return `Modaler.definePreset('${name}', {\n${lines}\n});`;
}
function applyToDemo(preset = null) {
  const p = preset || readPreset();
  Modaler.definePreset(p.name, p.conf);
  inst.definePreset(p.name, p.conf);
  inst.o.debug = p.debug;
  inst._scan?.(); // перечитать конфиги
  inst.close?.(); // закрыть, если открыто
  // blink не трогаем здесь — пусть мигает только по явной кнопке «Применить»
}

function openDemo() {
  // 1) всегда сначала применяем текущие настройки
  const p = readPreset();
  applyToDemo(p);

  // 2) после ТЕКУЩЕГО клика открываем демо — чтобы обработчик "outside click" не хлопнул её сразу
  const demoId = '__demo';
  const triggerBtn = document.querySelector('[data-modal-button="__demo"]');
  const mode = p.conf.mode;

  inst._scan?.();
  setTimeout(() => {
    inst.open(demoId, mode === 'dropdown' ? triggerBtn : null);
  }, 0);
}

function quickDemo(name) {
  const conf = PREDEFS[name];
  if (!conf) return;

  // подставим конфиг в форму (для прозрачности)
  $('presetName').value = '__play';
  fillFormFromConf(conf);

  // применим и ОТКРОЕМ следующим тиком (по той же причине)
  applyToDemo({ name: '__play', conf, debug: false });
  const triggerBtn = document.querySelector('[data-modal-button="__demo"]');
  inst._scan?.();
  setTimeout(() => {
    inst.open('__demo', conf.mode === 'dropdown' ? triggerBtn : null);
  }, 0);
}
function buildMarkup(p) {
  const { name } = p;
  return `<button data-modal-button="${name}">Открыть</button>

<div data-modal-window="${name}" data-modal-settings="${name}">
  <!-- контент модалки -->
</div>`;
}

function downloadBase() {
  const files = [
    ['/components/hv-modal/script.js', 'script.js'],
    ['/components/hv-modal/style.scss', 'style.scss'],
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

async function copyMarkup() {
  const tpl = buildMarkup(readPreset());
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
  blink(btnMarkup, '✓ Copied');
}

async function downloadReadme() {
  const candidates = [
    './hv-modal-README.md',
    '../hv-modal-README.md',
    '../docs/hv-modal-README.md',
    '/components/hv-modal/hv-modal-README.md',
  ];
  let text = '# hv-modal\n\nREADME не найден рядом с демо.';
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
  a.download = 'hv-modal-README.md';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
  blink(btnReadme, '✓ Saved');
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
  blink(btnCopy, '✓ Скопировано');
}

// события
form.addEventListener('change', enforceInterlocks);
form.addEventListener('input', enforceInterlocks);
btnApply.addEventListener('click', () => applyToDemo());
btnOpen.addEventListener('click', openDemo);
btnDownload.addEventListener('click', downloadBase);
btnCopy.addEventListener('click', copyPreset);
btnMarkup.addEventListener('click', copyMarkup);
btnReadme.addEventListener('click', downloadReadme);
form.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => quickDemo(b.dataset.quick)));

// init
enforceInterlocks();
