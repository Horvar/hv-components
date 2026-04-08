export function initFileFields(root = document) {
  const fields = root.querySelectorAll('.form-file');

  fields.forEach((field) => {
    const input = field.querySelector('input[type="file"]');
    const drop = field.querySelector('.form-file__drop');
    const status = field.querySelector('.form-file__status');
    const list = field.querySelector('.form-file__list');
    const btnPick = field.querySelector('.form-file__btn--pick');
    const btnClear = field.querySelector('.form-file__btn--clear');
    const err = field.querySelector('.form__error');

    const max = parseSize(field.dataset.fileMax || '0');
    const multiple = field.dataset.fileMultiple !== undefined;
    const accept = field.dataset.fileAccept || '';

    if (accept) input.accept = accept;
    if (multiple) input.multiple = true;

    let dt = new DataTransfer();

    function parseSize(val) {
      if (!val) return 0;
      const m = String(val)
        .trim()
        .toUpperCase()
        .match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/);
      if (!m) return 0;
      const num = parseFloat(m[1]);
      const mult = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[m[2] || 'B'];
      return Math.round(num * mult);
    }

    function fmtSize(b) {
      const u = ['B', 'KB', 'MB', 'GB'];
      let i = 0;
      while (b >= 1024 && i < u.length - 1) {
        b /= 1024;
        i++;
      }
      return `${b.toFixed(b >= 10 ? 0 : 1)} ${u[i]}`;
    }

    function showError(msg) {
      err.textContent = msg;
      err.hidden = false;
      field.classList.add('is-error');
    }

    function clearError() {
      err.hidden = true;
      field.classList.remove('is-error');
    }

    function renderList() {
      list.innerHTML = '';
      [...dt.files].forEach((f, i) => {
        const li = document.createElement('li');
        li.className = 'form-file__item';
        li.innerHTML = `
          <span class="form-file__name">${f.name}</span>
          <span class="form-file__size">${fmtSize(f.size)}</span>
          <button type="button" class="form-file__remove" data-i="${i}">Удалить</button>
        `;
        list.append(li);
      });
      status.textContent = dt.files.length ? `Выбрано ${dt.files.length} файл(ов)` : 'Файлы не выбраны';
      btnClear.disabled = !dt.files.length;
      input.files = dt.files;
    }

    function clearAll() {
      dt = new DataTransfer();
      renderList();
      clearError();
    }

    function addFiles(files) {
      clearError();
      for (const f of files) {
        if (max && f.size > max) {
          showError(`«${f.name}» превышает ${fmtSize(max)}`);
          continue;
        }
        if (!multiple && dt.files.length) continue;
        dt.items.add(f);
      }
      renderList();
    }

    // события
    btnPick?.addEventListener('click', () => input.click());
    btnClear?.addEventListener('click', clearAll);
    list.addEventListener('click', (e) => {
      const b = e.target.closest('.form-file__remove');
      if (!b) return;
      const idx = +b.dataset.i;
      const next = new DataTransfer();
      [...dt.files].forEach((f, i) => i !== idx && next.items.add(f));
      dt = next;
      renderList();
    });

    input.addEventListener('change', () => addFiles(input.files));

    // drag&drop
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    ['dragenter', 'dragover'].forEach((t) =>
      drop.addEventListener(t, (e) => {
        stop(e);
        field.classList.add('is-dragover');
      })
    );
    ['dragleave', 'dragend', 'drop'].forEach((t) =>
      drop.addEventListener(t, (e) => {
        stop(e);
        field.classList.remove('is-dragover');
      })
    );
    drop.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files?.length) addFiles(files);
    });
    drop.addEventListener('click', () => input.click());

    renderList();
  });
}
