// ვირტუალური სორობანის ეკრანული კომპონენტი (DOM). ლოგიკა — soroban.js-ის მოდელში.
// ვიწრო ეკრანზე 13 ღერო 44px-იან შეხების არეს ვერ იტევს, ამიტომ „გადიდების“ რეჟიმში ჩანს მხოლოდ
// მარჯვენა ღეროები (თითო ≥ 48px); ღილაკით ყოველთვის შეიძლება 13-ვე ღეროს ჩვენება.

import { Soroban, MAX_RODS, hasUnitDot, formatNumber } from './soroban.js';
import { h } from './ui.js';
import { fmtScaled } from './muldiv.js';

const MIN_ROD_PX = 48;

export class SorobanView {
  constructor(host, opts = {}) {
    this.host = host;
    this.model = opts.model || new Soroban(MAX_RODS);
    this.opts = {
      interactive: true,
      showValue: true,
      tools: ['clear', 'value', 'zoom'],
      zoom: true,
      minRods: 1,
      compact: false,      // მცირე სიმაღლე (წაკითხვის სავარჯიშოსთვის, რომ კლავიატურა ეკრანზე დაეტიოს)
      dec: 0,              // ათწილადი: ერთეულების ღერო (მნიშვნელობა ნაჩვენებია მძიმით)
      anchor: null,        // ▼ — ღერო, სადაც რიცხვის ერთეულები უნდა ჩაიწეროს (定位点)
      unit: null,          // ▲ — პასუხის ერთეულების ღერო
      ghost: false,        // „მოჩვენებითი“ სორობანი: მძივები არ ჩანს (ვიზუალიზაციის ვარჯიში)
      onChange: null,
      ...opts
    };
    this.zoomed = !!this.opts.zoom;
    this.showValue = !!this.opts.showValue;
    this.interactive = !!this.opts.interactive;
    this.visible = 0;
    this.width = 0;
    this.focusPlaces = [];
    this.marks = {};
    this.build();
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.layout()) : null;
    if (this.ro) this.ro.observe(this.board);
    this.layout(true);
  }

  build() {
    const tools = this.opts.tools || [];
    this.valueEl = h('div', { class: 'sbv-value', 'aria-live': 'polite' });
    this.btnClear = tools.includes('clear')
      ? h('button', { class: 'btn small ghost', type: 'button', on: { click: () => this.clear(true) } }, 'გასუფთავება') : null;
    this.btnValue = tools.includes('value')
      ? h('button', { class: 'btn small ghost', type: 'button', on: { click: () => this.toggleValue() } }) : null;
    this.btnZoom = tools.includes('zoom')
      ? h('button', { class: 'btn small ghost', type: 'button', on: { click: () => this.toggleZoom() } }) : null;
    this.toolbar = h('div', { class: 'sbv-tools' }, this.btnClear, this.btnValue, this.btnZoom);
    this.upRow = h('div', { class: 'sbv-row up' });
    this.beam = h('div', { class: 'sbv-beam' });
    this.loRow = h('div', { class: 'sbv-row lo' });
    this.board = h('div', { class: 'sbv-board' }, this.upRow, this.beam, this.loRow);
    this.digitsRow = h('div', { class: 'sbv-digits' });
    this.anchorRow = h('div', { class: 'sbv-mark-row anchor', 'aria-hidden': 'true' });
    this.unitRow = h('div', { class: 'sbv-mark-row unit', 'aria-hidden': 'true' });
    this.hiddenNote = h('div', { class: 'sbv-note' }, '◀ მძივები დამალულ ღეროებზეც არის — დააჭირე „13 ღერო“');
    this.root = h('div', { class: this.opts.compact ? 'sbv compact' : 'sbv' },
      h('div', { class: 'sbv-top' }, this.valueEl, this.toolbar),
      this.anchorRow, this.board, this.unitRow, this.digitsRow, this.hiddenNote);
    this.board.addEventListener('pointerdown', (e) => this.onPointer(e));
    this.host.appendChild(this.root);
  }

  layout(force = false) {
    const width = this.board.clientWidth;
    if (!width) { if (force) this.render(MAX_RODS); return; }
    const narrow = width / MAX_RODS < MIN_ROD_PX;
    let visible = MAX_RODS;
    if (this.zoomed && narrow) {
      visible = Math.floor(width / MIN_ROD_PX);
      visible = Math.max(visible, 5, this.opts.minRods || 1);
      visible = Math.min(visible, MAX_RODS);
    }
    if (visible !== this.visible || force) this.render(visible);
    const rodW = width / visible;
    const bh = Math.max(18, Math.min(this.opts.compact ? 32 : 42, rodW * 0.8));
    this.root.style.setProperty('--rw', `${rodW}px`);
    this.root.style.setProperty('--bh', `${bh}px`);
    this.bh = bh;
    if (this.btnZoom) {
      this.btnZoom.hidden = !narrow;
      this.btnZoom.textContent = this.zoomed ? '13 ღერო' : 'გადიდება';
    }
    this.width = width;
  }

  render(visible) {
    this.visible = visible;
    this.upRow.innerHTML = '';
    this.loRow.innerHTML = '';
    this.beam.innerHTML = '';
    this.digitsRow.innerHTML = '';
    this.anchorRow.innerHTML = '';
    this.unitRow.innerHTML = '';
    this.cells = [];
    for (let i = 0; i < visible; i++) {
      const p = visible - 1 - i;
      const up = h('div', { class: 'sbv-cell', dataset: { p: String(p), deck: 'up' } },
        h('span', { class: 'rod' }), h('span', { class: 'bead up' }));
      const lo = h('div', { class: 'sbv-cell', dataset: { p: String(p), deck: 'lo' } },
        h('span', { class: 'rod' }),
        [1, 2, 3, 4].map((b) => h('span', { class: 'bead lo', dataset: { b: String(b) } })));
      const slot = h('span', { class: 'sbv-slot', dataset: { p: String(p) } }, hasUnitDot(p) ? h('i', { class: 'dot' }) : null);
      const dg = h('span', { class: 'sbv-digit', dataset: { p: String(p) } });
      this.upRow.appendChild(up);
      this.loRow.appendChild(lo);
      this.beam.appendChild(slot);
      this.digitsRow.appendChild(dg);
      this.anchorRow.appendChild(h('span', { class: 'sbv-mark' }, p === this.opts.anchor ? '▼' : ''));
      this.unitRow.appendChild(h('span', { class: 'sbv-mark' }, p === this.opts.unit ? '▲' : ''));
      this.cells[p] = { up, lo, upBead: up.querySelector('.bead'), loBeads: [...lo.querySelectorAll('.bead')], slot, dg };
    }
    this.update();
  }

  update() {
    const m = this.model;
    for (let p = 0; p < this.visible; p++) {
      const c = this.cells[p];
      if (!c) continue;
      const on = m.upper[p];
      c.upBead.style.setProperty('--s', on ? 1 : 0);
      c.upBead.classList.toggle('on', on);
      const count = m.lower[p];
      c.loBeads.forEach((b, idx) => {
        const i = idx + 1;
        b.style.setProperty('--s', i <= count ? i - 1 : i);
        b.classList.toggle('on', i <= count);
      });
      c.dg.textContent = String(m.getDigit(p));
      const mark = this.marks[p];
      const focus = this.focusPlaces.includes(p);
      for (const el of [c.up, c.lo, c.dg]) {
        el.classList.toggle('bad', mark === 'bad');
        el.classList.toggle('ok', mark === 'ok');
        el.classList.toggle('focus', focus);
      }
    }
    this.valueEl.textContent = this.opts.dec ? fmtScaled(m.value, this.opts.dec) : formatNumber(m.value);
    this.anchorRow.hidden = this.opts.anchor === null || this.opts.anchor === undefined;
    this.unitRow.hidden = this.opts.unit === null || this.opts.unit === undefined;
    this.root.classList.toggle('show-value', this.showValue);
    this.root.classList.toggle('ro', !this.interactive);
    this.root.classList.toggle('ghost', !!this.opts.ghost);
    if (this.btnValue) this.btnValue.textContent = this.showValue ? 'მნიშვნელობის დამალვა' : 'მნიშვნელობის ჩვენება';
    this.hiddenNote.hidden = !(m.highestUsedPlace() >= this.visible);
  }

  onPointer(e) {
    if (!this.interactive) return;
    const cell = e.target.closest('.sbv-cell');
    if (!cell) return;
    e.preventDefault();
    const p = Number(cell.dataset.p);
    if (cell.dataset.deck === 'up') {
      this.model.tapUpper(p);
    } else {
      const rect = cell.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const bh = rect.height / 5;
      const count = this.model.lower[p];
      let best = 1, bestDist = Infinity;
      for (let i = 1; i <= 4; i++) {
        const slot = i <= count ? i - 1 : i;
        const dist = Math.abs((slot + 0.5) * bh - y);
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
      this.model.tapLower(p, best);
    }
    this.clearMarks(false);
    this.update();
    this.opts.onChange?.(this.model.value);
  }

  get value() {
    return this.model.value;
  }

  setValue(n) {
    this.model.setValue(n);
    this.update();
  }

  clear(notify = false) {
    this.model.clear();
    this.clearMarks(false);
    this.update();
    if (notify) this.opts.onChange?.(this.model.value);
  }

  applyMoves(moves) {
    for (const mv of moves) this.model.applyMove(mv);
    this.update();
  }

  setInteractive(b) {
    this.interactive = !!b;
    this.update();
  }

  setShowValue(b) {
    this.showValue = !!b;
    this.update();
  }

  toggleValue() {
    this.setShowValue(!this.showValue);
  }

  toggleZoom() {
    this.zoomed = !this.zoomed;
    this.layout(true);
  }

  setMinRods(n) {
    this.opts.minRods = n;
    this.layout(true);
  }

  // ▼ / ▲ მარკერები და ათწილადის ჩვენება
  setMarkers({ anchor = null, unit = null } = {}) {
    this.opts.anchor = anchor;
    this.opts.unit = unit;
    const need = Math.max(anchor ?? 0, unit ?? 0) + 1;
    if (need > (this.opts.minRods || 1)) this.opts.minRods = need;
    this.layout(true);
  }

  setGhost(b) {
    this.opts.ghost = !!b;
    this.update();
  }

  // სურათის დამალვა/ჩვენება (ვიზუალიზაცია: რიცხვი მოკლედ ჩანს)
  setCovered(b) {
    this.root.classList.toggle('covered', !!b);
  }

  setDecimals(dec) {
    this.opts.dec = dec || 0;
    this.update();
  }

  setHighlight(part) {
    if (part) this.root.dataset.hl = part;
    else delete this.root.dataset.hl;
  }

  setFocus(places) {
    this.focusPlaces = places || [];
    this.update();
  }

  setMarks(marks) {
    this.marks = marks || {};
    this.update();
  }

  clearMarks(update = true) {
    this.marks = {};
    if (update) this.update();
  }

  destroy() {
    if (this.ro) this.ro.disconnect();
    this.root.remove();
  }
}
