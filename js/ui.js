// მცირე DOM-დამხმარეები: ელემენტების შექმნა, ტექსტის ფორმატირება, შეტყობინებები, ციფრული კლავიატურა.

import { formatNumber } from './soroban.js';

// [12, 35, -21] → „12 + 35 − 21“
export function exprText(terms) {
  return terms.map((t, i) => (i === 0 ? formatNumber(t) : (t < 0 ? ' − ' : ' + ') + formatNumber(Math.abs(t)))).join('');
}

export function digitCount(n) {
  return String(Math.abs(n)).length;
}

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

// **მუქი** და `ფორმულა` → DOM კვანძები
export function rich(str) {
  const out = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`/g;
  let last = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    if (m[1] !== undefined) out.push(h('strong', null, m[1]));
    else out.push(h('span', { class: 'chip' }, m[2]));
    last = re.lastIndex;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

// აბზაცები: „• “-ით დაწყებული ხაზები სიად, მხოლოდ `ფორმულებისგან` შემდგარი ხაზი — ფორმულების ბადედ
export function paragraphs(lines) {
  const out = [];
  let list = null;
  for (const line of lines || []) {
    if (line.startsWith('• ')) {
      if (!list) { list = h('ul', { class: 'bullets' }); out.push(list); }
      list.appendChild(h('li', null, rich(line.slice(2))));
      continue;
    }
    list = null;
    if (/^(`[^`]+`\s*)+$/.test(line.trim())) {
      const chips = line.match(/`([^`]+)`/g).map((s) => h('span', { class: 'chip big' }, s.slice(1, -1)));
      out.push(h('div', { class: 'formulas' }, chips));
    } else {
      out.push(h('p', null, rich(line)));
    }
  }
  return out;
}

let toastTimer = null;
export function toast(msg, opts = {}) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(el);
  }
  el.innerHTML = '';
  el.appendChild(h('span', null, msg));
  if (opts.action) {
    el.appendChild(h('button', { class: 'toast-btn', on: { click: () => { hide(); opts.onAction?.(); } } }, opts.action));
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  const hide = () => el.classList.remove('show');
  if (!opts.sticky) toastTimer = setTimeout(hide, opts.duration || 2600);
}

export function confirmDialog(message, { ok = 'დიახ', cancel = 'გაუქმება', danger = false } = {}) {
  return new Promise((resolve) => {
    const close = (v) => { overlay.remove(); resolve(v); };
    const overlay = h('div', { class: 'modal-overlay', on: { click: (e) => { if (e.target === overlay) close(false); } } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        h('p', null, message),
        h('div', { class: 'row end' },
          h('button', { class: 'btn ghost', on: { click: () => close(false) } }, cancel),
          h('button', { class: danger ? 'btn danger' : 'btn primary', on: { click: () => close(true) } }, ok)
        )
      )
    );
    document.body.appendChild(overlay);
    overlay.querySelector('.btn.primary, .btn.danger').focus();
  });
}

// ციფრული კლავიატურა რიცხვის ჩასაწერად
export function numpad({ onSubmit, maxLen = 7 }) {
  let value = '';
  const display = h('div', { class: 'np-display', 'aria-live': 'polite' }, ' ');
  const render = () => { display.textContent = value || ' '; submit.disabled = !value; };
  const press = (k) => {
    if (k === 'del') value = value.slice(0, -1);
    else if (value.length < maxLen) value = value === '0' ? k : value + k;
    render();
  };
  const submit = h('button', { class: 'np-key ok', 'aria-label': 'დადასტურება', on: { click: () => value && onSubmit(Number(value)) } }, '✓');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) =>
    h('button', { class: 'np-key', on: { click: () => press(k) } }, k));
  keys.push(h('button', { class: 'np-key del', 'aria-label': 'წაშლა', on: { click: () => press('del') } }, '⌫'));
  keys.push(h('button', { class: 'np-key', on: { click: () => press('0') } }, '0'));
  keys.push(submit);
  const el = h('div', { class: 'numpad' }, display, h('div', { class: 'np-grid' }, keys));
  render();
  return {
    el,
    reset() { value = ''; render(); },
    setDisabled(d) { el.querySelectorAll('button').forEach((b) => { b.disabled = d || (b === submit && !value); }); }
  };
}

export function fmtSec(sec) {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return '—';
  return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)} წმ`;
}

export function fmtPct(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return `${Math.round(x * 100)}%`;
}

export function fmtMin(ms) {
  return `${Math.round((ms || 0) / 60000)} წთ`;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
