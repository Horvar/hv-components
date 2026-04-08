import { ScrollAnimate } from '../script.js';

// Пример твоих глобальных пресетов:
ScrollAnimate.definePreset('fade', {
  once: true,
  threshold: 0.2,
  activeClass: 'fade-in',
});

ScrollAnimate.definePreset('slideUp', {
  once: true,
  threshold: 0.15,
  activeClass: 'slide-up',
  rootMargin: '-50px',
});

// -------- playground logic --------
const form = document.getElementById('hvsaPlay');
const $ = (n) => form.elements[n];

const els = {
  presetName: $('presetName'),
  debug: $('debug'),
  once: $('once'),
  threshold: $('threshold'),
  rootMargin: $('rootMargin'),
  delay: $('delay'),
  stagger: $('stagger'),
  activeClass: $('activeClass'),
  useBreakpoints: $('useBreakpoints'),
  bpMobileThreshold: $('bpMobileThreshold'),
  bpTabletThreshold: $('bpTabletThreshold'),
  bpDesktopThreshold: $('bpDesktopThreshold'),
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
      : v === null
        ? 'null'
        : JSON.stringify(v);

// toggle breakpoint inputs
els.useBreakpoints.addEventListener('change', () => {
  const enabled = bool(els.useBreakpoints);
  els.bpMobileThreshold.disabled = !enabled;
  els.bpTabletThreshold.disabled = !enabled;
  els.bpDesktopThreshold.disabled = !enabled;
});

function readPreset() {
  const conf = {
    once: bool(els.once),
    threshold: num(els.threshold, 0.2),
    rootMargin: str(els.rootMargin) || '0px',
    delay: num(els.delay, 0),
    stagger: num(els.stagger, 0),
    activeClass: str(els.activeClass) || 'is-animated',
  };

  if (bool(els.useBreakpoints)) {
    conf.breakpoints = {
      mobile: { threshold: num(els.bpMobileThreshold, 0.1) },
      tablet: { threshold: num(els.bpTabletThreshold, 0.2) },
      desktop: { threshold: num(els.bpDesktopThreshold, 0.3) },
    };
  }

  return {
    name: str(els.presetName) || '__saPlay',
    debug: els.debug.value === 'true',
    conf,
  };
}

function buildDefineCode(p) {
  const { name, conf } = p;
  const order = ['once', 'threshold', 'rootMargin', 'delay', 'stagger', 'activeClass', 'breakpoints'];
  const ordered = {};
  order.forEach((k) => {
    if (conf[k] !== undefined) ordered[k] = conf[k];
  });
  const lines = Object.entries(ordered)
    .map(([k, v]) => {
      if (k === 'breakpoints' && v) {
        const bp = JSON.stringify(v, null, 2)
          .split('\n')
          .map((line, i) => (i === 0 ? line : '  ' + line))
          .join('\n');
        return `  ${k}: ${bp},`;
      }
      return `  ${k}: ${serialize(v)},`;
    })
    .join('\n');
  return `ScrollAnimate.definePreset('${name}', {\n${lines}\n});`;
}

function buildMarkup(name) {
  return `<!-- Одиночный элемент -->
<div data-scroll-animate="${name}">
  Контент для анимации
</div>

<!-- Группа с stagger -->
<div data-scroll-animate="${name}">
  <div data-scroll-item>Элемент 1</div>
  <div data-scroll-item>Элемент 2</div>
  <div data-scroll-item>Элемент 3</div>
</div>`;
}

// actions
function applyToDemo() {
  const p = readPreset();
  // включим глобальный debug
  try {
    ScrollAnimate._ensureSingleton().o.debug = p.debug;
    // eslint-disable-next-line no-empty
  } catch {}

  // сбросим все активные классы для перезапуска анимаций
  document.querySelectorAll('[data-scroll-animate="__saPlay"]').forEach((el) => {
    el.classList.remove(p.conf.activeClass);
    el.querySelectorAll('[data-scroll-item]').forEach((item) => {
      item.classList.remove(p.conf.activeClass);
    });
    // сбросим флаг готовности
    el.__hvScrollAnimateReady__ = false;
  });

  // запишем/перезапишем пресет
  ScrollAnimate.definePreset(p.name, p.conf);
  blink(btns.apply, '✓ Применено');
}

function downloadBase() {
  const files = [['/components/hv-scroll-animate/script.js', 'script.js']];
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
    './hv-scroll-animate-README.md',
    '../hv-scroll-animate-README.md',
    '../docs/hv-scroll-animate-README.md',
    '/components/hv-scroll-animate/hv-scroll-animate-README.md',
  ];
  let text = '# hv-scroll-animate\n\nREADME не найден рядом с демо.';
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
  a.download = 'hv-scroll-animate-README.md';
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

// live-apply on change/input
form.addEventListener('change', applyToDemo);
form.addEventListener('input', (e) => {
  if (
    [
      'threshold',
      'rootMargin',
      'delay',
      'stagger',
      'activeClass',
      'once',
      'bpMobileThreshold',
      'bpTabletThreshold',
      'bpDesktopThreshold',
    ].includes(e.target.name)
  )
    applyToDemo();
});

// first apply
applyToDemo();
