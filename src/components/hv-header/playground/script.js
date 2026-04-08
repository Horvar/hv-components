import { hvHeader } from '../script.js';

// ---------- helpers ----------
const $id = (id) => document.getElementById(id);
const form = $id('hvHeaderPlay');

const qs = (name) => form.elements[name];
const num = (el, def = 0) => {
  const n = Number((el?.value ?? '').trim());
  return Number.isFinite(n) ? n : def;
};
const blink = (btn, ok = '✓ Done') => {
  const old = btn.textContent;
  btn.textContent = ok;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
  }, 900);
};
const setDisabled = (el, on, why = '') => {
  el.disabled = !!on;
  const label = el.closest('label') || el.parentElement;
  if (!label) return;
  const base = label.getAttribute('data-base-title') ?? label.getAttribute('title') ?? '';
  if (!label.hasAttribute('data-base-title')) label.setAttribute('data-base-title', base);
  label.title = on && why ? `${base} — (не используется: ${why})` : base;
};
const serialize = (v) =>
  typeof v === 'string'
    ? `'${v.replace(/'/g, "\\'")}'`
    : typeof v === 'boolean' || Number.isFinite(v)
      ? String(v)
      : 'null';

// ---------- fields ----------
const els = {
  mode: qs('mode'),
  threshold: qs('threshold'),
  scrollBehavior: qs('scrollBehavior'),
  downDelta: qs('downDelta'),
  upDelta: qs('upDelta'),
  fixFx: qs('fixFx'),
  fixFxEnterDuration: qs('fixFxEnterDuration'),
  fixFxLeaveDuration: qs('fixFxLeaveDuration'),
  fixFxEasing: qs('fixFxEasing'),
  fixFxOnInit: qs('fixFxOnInit'),
  overlayAtTop: qs('overlayAtTop'),
  debug: qs('debug'),
};

// ---------- read form ----------
const readOptions = () => ({
  root: '.hv-header',
  mode: els.mode.value,
  threshold: num(els.threshold, 0),
  scrollBehavior: els.scrollBehavior.value,
  downDelta: num(els.downDelta, 24),
  upDelta: num(els.upDelta, 24),
  fixFx: els.fixFx.value,
  fixFxEnterDuration: num(els.fixFxEnterDuration, 220),
  fixFxLeaveDuration: num(els.fixFxLeaveDuration, 220),
  fixFxEasing: (els.fixFxEasing.value || 'ease').trim(),
  fixFxOnInit: els.fixFxOnInit.checked,
  overlayAtTop: els.overlayAtTop.checked,
  debug: els.debug.checked,
});

// ---------- interlocks ----------
function enforceInterlocks() {
  const mode = els.mode.value;
  const beh = els.scrollBehavior.value;
  const inStatic = mode === 'static';
  const inFixed = mode === 'fixed';
  const inFA = mode === 'fixedAfter';

  setDisabled(els.threshold, !inFA, inStatic ? 'mode=static' : inFixed ? 'mode=fixed' : '');

  setDisabled(els.scrollBehavior, inStatic, 'mode=static');

  const deltasOff = inStatic || beh === 'none';
  setDisabled(els.downDelta, deltasOff, inStatic ? 'mode=static' : 'behavior=none');
  setDisabled(els.upDelta, deltasOff, inStatic ? 'mode=static' : 'behavior=none');

  const fxNone = els.fixFx.value === 'none';
  setDisabled(els.fixFxOnInit, !inFixed, inStatic ? 'mode=static' : inFA ? 'mode=fixedAfter' : '');

  if (inStatic) {
    setDisabled(els.fixFx, true, 'mode=static');
    setDisabled(els.fixFxEnterDuration, true, 'mode=static');
    setDisabled(els.fixFxLeaveDuration, true, 'mode=static');
    setDisabled(els.fixFxEasing, true, 'mode=static');
  } else if (inFixed) {
    const off = !els.fixFxOnInit.checked;
    setDisabled(els.fixFx, off, 'fixFxOnInit=false');
    setDisabled(els.fixFxEnterDuration, off || fxNone, off ? 'fixFxOnInit=false' : fxNone ? 'fixFx=none' : '');
    setDisabled(els.fixFxLeaveDuration, off || fxNone, off ? 'fixFxOnInit=false' : fxNone ? 'fixFx=none' : '');
    setDisabled(els.fixFxEasing, off || fxNone, off ? 'fixFxOnInit=false' : fxNone ? 'fixFx=none' : '');
  } else {
    // fixedAfter: входной FX не нужен при reveal (вход скрытый)
    const enterOff = beh === 'reveal';
    setDisabled(els.fixFx, false, '');
    setDisabled(
      els.fixFxEnterDuration,
      enterOff || fxNone,
      enterOff ? 'reveal: вход скрытый' : fxNone ? 'fixFx=none' : ''
    );
    setDisabled(els.fixFxLeaveDuration, fxNone, fxNone ? 'fixFx=none' : '');
    setDisabled(els.fixFxEasing, fxNone, fxNone ? 'fixFx=none' : '');
  }

  setDisabled(els.overlayAtTop, inStatic, 'mode=static');
}

// ---------- header demo singleton ----------
let header = window.__hvHeaderDemo__;
if (!header) {
  header = new hvHeader({ root: '.hv-header', mode: 'fixedAfter', threshold: 500, scrollBehavior: 'reveal' });
  window.__hvHeaderDemo__ = header;
}

// ---------- actions ----------
function applyToDemo() {
  const o = readOptions();

  // мягкое обновление без пересоздания
  header.setMode(o.mode);
  header.setThreshold(o.threshold);

  header.o.scrollBehavior = o.scrollBehavior;
  header.o.downDelta = o.downDelta;
  header.o.upDelta = o.upDelta;

  header.o.fixFx = o.fixFx;
  header.o.fixFxEnterDuration = o.fixFxEnterDuration;
  header.o.fixFxLeaveDuration = o.fixFxLeaveDuration;
  header.o.fixFxEasing = o.fixFxEasing;
  header.o.fixFxOnInit = o.fixFxOnInit;
  header._initFxCssHooks();

  header.o.overlayAtTop = o.overlayAtTop;
  header.o.debug = o.debug;

  header._recalcAll();
  header._updateState(true);

  enforceInterlocks();
  blink(form.querySelector('[data-action="apply"]'), '✓ Применено');
}

function downloadBase() {
  const files = [
    ['/components/hv-header/script.js', 'script.js'],
    ['/components/hv-header/style.scss', 'style.scss'],
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
  blink(form.querySelector('[data-action="downloadBase"]'), '✓ Downloaded');
}

async function copyInit() {
  const o = readOptions();
  const obj = {
    root: '.hv-header',
    mode: o.mode,
    ...(o.mode === 'fixedAfter' ? { threshold: o.threshold } : {}),
    scrollBehavior: o.scrollBehavior,
    ...(o.scrollBehavior !== 'none' ? { downDelta: o.downDelta, upDelta: o.upDelta } : {}),
    fixFx: o.fixFx,
    fixFxEnterDuration: o.fixFxEnterDuration,
    fixFxLeaveDuration: o.fixFxLeaveDuration,
    fixFxEasing: o.fixFxEasing,
    ...(o.mode === 'fixed' ? { fixFxOnInit: o.fixFxOnInit } : {}),
    overlayAtTop: o.overlayAtTop,
    debug: o.debug,
  };
  const lines = Object.entries(obj)
    .map(([k, v]) => `  ${k}: ${serialize(v)},`)
    .join('\n');
  const code = `import { hvHeader } from './script.js';

new hvHeader({
${lines}
});`;
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
  blink(form.querySelector('[data-action="copyInit"]'), '✓ Copied');
}

async function copyMarkup() {
  const tpl = `<header class="hv-header">
  <div class="hv-header__content">
    <!-- content -->
  </div>
</header>`;
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
  blink(form.querySelector('[data-action="copyMarkup"]'), '✓ Copied');
}

async function downloadReadme() {
  const candidates = [
    './hv-header-README.md',
    '../hv-header-README.md',
    '../docs/hv-header-README.md',
    '/components/hv-header/hv-header-README.md',
  ];
  let text = '# hv-header\n\nREADME не найден рядом с демо.';
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
  a.download = 'hv-header-README.md';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
  blink(form.querySelector('[data-action="downloadReadme"]'), '✓ Saved');
}

// ---------- wire ----------
form.addEventListener('change', (e) => {
  applyToDemo();
  if (['mode', 'scrollBehavior', 'fixFx', 'fixFxOnInit'].includes(e.target.name)) enforceInterlocks();
});
form.addEventListener('input', (e) => {
  if (
    ['threshold', 'downDelta', 'upDelta', 'fixFxEnterDuration', 'fixFxLeaveDuration', 'fixFxEasing'].includes(
      e.target.name
    )
  ) {
    applyToDemo();
  }
  if (['mode', 'scrollBehavior', 'fixFx', 'fixFxOnInit'].includes(e.target.name)) enforceInterlocks();
});

form.querySelector('[data-action="apply"]').addEventListener('click', applyToDemo);
form.querySelector('[data-action="downloadBase"]').addEventListener('click', downloadBase);
form.querySelector('[data-action="copyInit"]').addEventListener('click', copyInit);
form.querySelector('[data-action="copyMarkup"]').addEventListener('click', copyMarkup);
form.querySelector('[data-action="downloadReadme"]').addEventListener('click', downloadReadme);

// старт
enforceInterlocks();
// первичное применение (с текущими значениями формы)
applyToDemo();
