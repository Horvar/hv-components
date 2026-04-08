import { Select } from '../script.js';

const form = document.getElementById('hvSelectPlay');
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
    name: ($('presetName').value || '__selectPlay').trim(),
    debug: $('debug').value === 'true',
    conf: {
      mode: $('mode').value,
      placeholder: $('placeholder').value || 'Выберите...',
      clearable: $('clearable').value === 'true',
      searchable: $('searchable').value === 'true',
      chipMode: $('chipMode').value === 'true',
      closeOnSelect: $('closeOnSelect').value === 'true',
      delimiter: $('delimiter').value || ',',
      noResultsText: $('noResultsText').value || 'Ничего не найдено',
    },
  };
}

function applyToDemo() {
  const p = readPreset();
  Select.definePreset(p.name, p.conf);
  Select._ensure().o.debug = p.debug;
  blink(btn.apply, '✓ Применено');
}

function buildDefineCode(p) {
  const order = [
    'mode',
    'placeholder',
    'clearable',
    'searchable',
    'chipMode',
    'closeOnSelect',
    'delimiter',
    'noResultsText',
  ];
  const ordered = {};
  order.forEach((k) => {
    if (p.conf[k] !== undefined) ordered[k] = p.conf[k];
  });
  const lines = Object.entries(ordered)
    .map(([k, v]) => `  ${k}: ${serialize(v)},`)
    .join('\n');
  return `Select.definePreset('${p.name}', {\n${lines}\n});`;
}

function buildMarkup(p) {
  const { name, conf } = p;
  const searchLine = conf.searchable ? '\n    <input data-select-search type="text" placeholder="Поиск..." />' : '';
  const multiAttr = conf.mode === 'multiple' ? ' <!-- multiple -->' : '';

  return `<div data-select-settings="${name}">${multiAttr}
  <input type="hidden" name="my-field" />
  <div data-select-trigger>
    <span data-select-label></span>
    <span data-select-clear aria-hidden="true">×</span>
    <span data-select-arrow aria-hidden="true">▾</span>
  </div>
  <div data-select-dropdown hidden>${searchLine}
    <ul data-select-list>
      <li data-select-option data-value="1">Опция 1</li>
      <li data-select-option data-value="2">Опция 2</li>
      <li data-select-option data-value="3">Опция 3</li>
      <li data-select-option data-value="4" data-disabled>Недоступно</li>
    </ul>
  </div>
</div>`;
}

function downloadBase() {
  const files = [
    ['/components/hv-select/script.js', 'hv-select-script.js'],
    ['/components/hv-select/style.scss', 'hv-select-style.scss'],
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
  const tpl = buildMarkup(readPreset());
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
  const candidates = ['/components/hv-select/README.md', './README.md', '../README.md'];
  let text = '# hv-select\n\nREADME не найден.';
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
  a.download = 'hv-select-README.md';
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
