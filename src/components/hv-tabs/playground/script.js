import { Tabs } from '../script.js';

// playground
const form = document.getElementById('hvTabsPlay');
const $ = (n) => form.elements[n];
const btn = {
  apply: form.querySelector('[data-action="apply"]'),
  download: form.querySelector('[data-action="downloadBase"]'),
  copyPreset: form.querySelector('[data-action="copyPreset"]'),
  copyMarkup: form.querySelector('[data-action="copyMarkup"]'),
  readme: form.querySelector('[data-action="downloadReadme"]'),
};
const blink = (el, text = '✓ Done') => {
  const old = el.textContent;
  el.textContent = text;
  el.disabled = true;
  setTimeout(() => {
    el.textContent = old;
    el.disabled = false;
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
    name: ($('presetName').value || '__tabsPlay').trim(),
    debug: $('debug').value === 'true',
    conf: {
      trigger: $('trigger').value, // 'click' | 'hover' (на тач станет 'click')
      initial: $('initial').value, // 'first' | 'last'
    },
  };
}

function applyToDemo() {
  const p = readPreset();
  Tabs.definePreset(p.name, p.conf);
  // глобальный debug у контроллера сейчас не используется, оставим крючок:
  Tabs._ensure().o.debug = p.debug;
  blink(btn.apply, '✓ Применено');
}

function buildDefineCode(p) {
  const order = ['trigger', 'initial'];
  const ordered = {};
  order.forEach((k) => {
    if (p.conf[k] !== undefined) ordered[k] = p.conf[k];
  });
  const lines = Object.entries(ordered)
    .map(([k, v]) => `  ${k}: ${serialize(v)},`)
    .join('\n');
  return `Tabs.definePreset('${p.name}', {\n${lines}\n});`;
}

function buildMarkup(name) {
  return `<div data-tabs-settings="${name}">
  <div data-tablist>
    <button data-tab-button data-tab="tab1" class="is-active">Tab 1</button>
    <button data-tab-button data-tab="tab2">Tab 2</button>
    <button data-tab-button data-tab="tab3">Tab 3</button>
  </div>
  <div data-tab-panel data-tab="tab1">Panel 1</div>
  <div data-tab-panel data-tab="tab2" hidden>Panel 2</div>
  <div data-tab-panel data-tab="tab3" hidden>Panel 3</div>
</div>`;
}

function downloadBase() {
  const files = [
    ['/components/hv-tabs/script.js', 'script.js'],
    ['/components/hv-tabs/style.scss', 'style.scss'],
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
  blink(btn.download, '✓ Downloaded');
}

async function copyPreset() {
  const code = buildDefineCode(readPreset());
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), {
      value: code,
      style: 'position:fixed;left:-9999px',
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  blink(btn.copyPreset, '✓ Copied');
}

async function copyMarkup() {
  const tpl = buildMarkup(readPreset().name);
  try {
    await navigator.clipboard.writeText(tpl);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), {
      value: tpl,
      style: 'position:fixed;left:-9999px',
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  blink(btn.copyMarkup, '✓ Copied');
}

async function downloadReadme() {
  const candidates = [
    './hv-tabs-README.md',
    '../hv-tabs-README.md',
    '../docs/hv-tabs-README.md',
    '/components/hv-tabs/hv-tabs-README.md',
  ];
  let text = '# hv-tabs\n\nREADME не найден рядом с демо.';
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
  a.download = 'hv-tabs-README.md';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
  blink(btn.readme, '✓ Saved');
}

btn.apply.addEventListener('click', applyToDemo);
btn.download.addEventListener('click', downloadBase);
btn.copyPreset.addEventListener('click', copyPreset);
btn.copyMarkup.addEventListener('click', copyMarkup);
btn.readme.addEventListener('click', downloadReadme);

form.addEventListener('change', applyToDemo);

// первичный прогон
applyToDemo();
