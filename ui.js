// Drobne elementy interfejsu: formatowanie, tablice rejestracyjne, etykiety, okna, komunikaty.
window.UI = (() => {
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const zl = (v, dec) => (v === null || v === undefined || isNaN(v)) ? '—' : (dec ? nf2 : nf0).format(Math.abs(v) < 0.005 ? 0 : v) + ' zł';
  const zl2 = v => zl(v, true);
  const signCls = v => v > 0.005 ? 'pos' : v < -0.005 ? 'neg' : '';
  const MON = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
  const MON3 = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const date = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '—';

  const EU = '<svg class="eu" viewBox="0 0 20 28" aria-hidden="true"><rect width="20" height="28" fill="#0B3D91"/><g fill="#FFCC00"><circle cx="10" cy="4.3" r=".75"/><circle cx="12.6" cy="5" r=".75"/><circle cx="14.5" cy="6.9" r=".75"/><circle cx="15.2" cy="9.5" r=".75"/><circle cx="14.5" cy="12.1" r=".75"/><circle cx="12.6" cy="14" r=".75"/><circle cx="10" cy="14.7" r=".75"/><circle cx="7.4" cy="14" r=".75"/><circle cx="5.5" cy="12.1" r=".75"/><circle cx="4.8" cy="9.5" r=".75"/><circle cx="5.5" cy="6.9" r=".75"/><circle cx="7.4" cy="5" r=".75"/></g><text x="10" y="25" text-anchor="middle" font-family="Inter, sans-serif" font-size="6.5" font-weight="700" fill="#fff">PL</text></svg>';
  function plate(p, big) {
    p = String(p || '');
    const m = p.match(/^([A-Z]{2})([A-Z])?(.*)$/);
    let a = p, b = '';
    if (m) { if (m[2] && /^[A-Z]/.test(m[2]) && p.length >= 7 && /\d/.test(m[3].charAt(0) || '')) { a = m[1] + m[2]; b = m[3]; } else { a = m[1]; b = (m[2] || '') + m[3]; } }
    return '<span class="plate' + (big ? ' big' : '') + '" aria-label="' + esc(p) + '">' + EU + '<span class="tx"><span>' + esc(a) + '</span>' + (b ? '<span class="dot"></span><span>' + esc(b) + '</span>' : '') + '</span></span>';
  }
  const chip = f => '<span class="chip ' + (f === 'LUKAR' || f === 'NACAR' ? f : 'other') + '">' + esc(f || '—') + '</span>';
  const tag = (t, c) => '<span class="tag ' + c + '">' + esc(t) + '</span>';
  function statusTag(c) {
    if (c.status === 'Sprzedany') return c.settled ? tag('Sprzedany', 'green') : tag('Do rozliczenia', 'amber');
    if (c.status === 'Na stanie') return tag('Na stanie · ' + (c.daysStock ?? '?') + ' dni', (c.daysStock || 0) > 90 ? 'red' : (c.daysStock || 0) > 60 ? 'amber' : 'blue');
    return tag(c.status, 'gray');
  }
  const leftTxt = d => d < 0 ? (-d) + ' dni po terminie' : d === 0 ? 'dziś' : 'za ' + d + (d === 1 ? ' dzień' : ' dni');

  const ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M3 17v-4l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v4"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/></svg>',
    cost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h13l-4-4M17 17H4l4 4"/></svg>'
  };
  const CAR_SIL = '<svg width="120" height="40" viewBox="0 0 120 40" fill="none" stroke="#B6C2D4" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 31h8M98 31h16M14 31c0-5 3-7 8-8l12-1 11-10c2-2 5-3 8-3h20c4 0 7 1 10 4l8 8 11 2c4 1 6 3 6 7"/><path d="M48 12v10M34 22h60"/><circle cx="36" cy="31" r="6"/><circle cx="88" cy="31" r="6"/></svg>';

  let toastT;
  function toast(msg, err) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); document.body.appendChild(t); }
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    clearTimeout(toastT);
    toastT = setTimeout(() => t.remove(), err ? 6000 : 2600);
  }

  // Okno z formularzem. fields: [{name,label,type,options,value,required,full,step,list}]
  function modal(title, bodyHtml, { onSubmit, submitLabel = 'Zapisz', onOpen } = {}) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = '<form class="modal" novalidate><div class="mh"><h2>' + esc(title) + '</h2><button type="button" class="x" aria-label="Zamknij">×</button></div>' + bodyHtml +
      '<div class="mf"><button type="button" class="btn cancel">Anuluj</button>' + (onSubmit ? '<button class="btn primary" type="submit">' + esc(submitLabel) + '</button>' : '') + '</div></form>';
    const close = () => bg.remove();
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('.x') || e.target.closest('.cancel')) close(); });
    const form = bg.querySelector('form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const bad = [...form.querySelectorAll('[required]')].find(i => !String(i.value).trim());
      if (bad) { bad.focus(); toast('Uzupełnij pole: ' + (bad.closest('.field')?.firstChild?.textContent || ''), true); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Zapisuję…';
      try { await onSubmit(data, form); close(); }
      catch (err) { btn.disabled = false; btn.textContent = submitLabel; toast(err.message || String(err), true); }
    });
    document.body.appendChild(bg);
    if (onOpen) onOpen(form);
    const first = form.querySelector('input:not([type=hidden]),select');
    if (first && window.matchMedia('(min-width:861px)').matches) first.focus();
    return { close, form };
  }
  function fields(list) {
    return '<div class="form">' + list.map(f => {
      const cls = 'field' + (f.full ? ' full' : '') + (f.hidden ? ' hidden' : '');
      const req = f.required ? ' required' : '';
      let input;
      if (f.type === 'select') input = '<select name="' + f.name + '"' + req + '>' + f.options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(v) === String(f.value ?? '') ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
      else if (f.type === 'textarea') input = '<textarea name="' + f.name + '">' + esc(f.value || '') + '</textarea>';
      else input = '<input name="' + f.name + '" type="' + (f.type || 'text') + '"' + (f.step ? ' step="' + f.step + '"' : '') + (f.inputmode ? ' inputmode="' + f.inputmode + '"' : '') + (f.list ? ' list="' + f.list + '"' : '') + ' value="' + esc(f.value ?? '') + '"' + req + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + ' autocomplete="off">';
      return '<label class="' + cls + '" data-f="' + f.name + '">' + esc(f.label) + input + '</label>';
    }).join('') + '</div>';
  }

  // Prosty wykres słupkowy (SVG) dla 12 miesięcy: słupki zysku netto, linia zysku z aut.
  function barChart(rows) {
    const W = 720, H = 220, pl = 52, pb = 26, pt = 10;
    const vals = rows.flatMap(r => [r.net, r.carProfit]);
    let max = Math.max(1, ...vals), min = Math.min(0, ...vals);
    const span = max - min || 1;
    const y = v => pt + (max - v) / span * (H - pt - pb);
    const bw = (W - pl - 10) / rows.length;
    const ticks = 4; let grid = '';
    for (let i = 0; i <= ticks; i++) {
      const v = min + span * i / ticks; const yy = y(v);
      grid += '<line x1="' + pl + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '" stroke="#EDF1F6"/><text x="' + (pl - 6) + '" y="' + (yy + 4) + '" font-size="10" fill="#94A3B8" text-anchor="end">' + nf0.format(Math.round(v / 1000)) + ' tys.</text>';
    }
    let bars = '', line = '';
    rows.forEach((r, i) => {
      const x = pl + i * bw + bw * 0.18, w = bw * 0.64;
      const y0 = y(0), y1 = y(r.net);
      bars += '<rect x="' + x + '" y="' + Math.min(y0, y1) + '" width="' + w + '" height="' + Math.max(1, Math.abs(y1 - y0)) + '" rx="3" fill="' + (r.net >= 0 ? '#15803D' : '#DC2626') + '"><title>' + esc(MON[r.m - 1]) + ': zysk netto ' + zl(r.net) + ', zysk z aut ' + zl(r.carProfit) + ', koszty ogólne ' + zl(r.genNet) + '</title></rect>';
      bars += '<text x="' + (x + w / 2) + '" y="' + (H - 8) + '" font-size="10.5" fill="#64748B" text-anchor="middle">' + MON3[r.m - 1] + '</text>';
      line += (i ? 'L' : 'M') + (x + w / 2) + ' ' + y(r.carProfit);
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Zysk miesięczny">' + grid +
      '<line x1="' + pl + '" x2="' + W + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#CBD5E1"/>' + bars +
      '<path d="' + line + '" fill="none" stroke="#1D4ED8" stroke-width="2" stroke-dasharray="5 4"/></svg>';
  }

  return { esc, zl, zl2, signCls, date, MON, MON3, plate, chip, tag, statusTag, leftTxt, ICON, CAR_SIL, toast, modal, fields, barChart };
})();
