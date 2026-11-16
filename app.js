// Główna logika aplikacji: dane, nawigacja, ekrany i formularze.
(() => {
  const { esc, zl, zl2, signCls, date, MON, plate, chip, tag, statusTag, leftTxt, ICON, CAR_SIL, toast, modal, fields, barChart } = UI;
  const CFG = window.KOMIS_CONFIG;
  const $app = document.getElementById('app');
  const SHEET = { cars: 'Auta', costs: 'Koszty', general: "'Koszty ogólne'", auctions: 'Aukcje' };
  const COL = i => String.fromCharCode(65 + i);
  const parseAmt = v => { const n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; };

  // ---------------- dane ----------------
  const Store = {
    mode: (() => { try { return sessionStorage.getItem('komis.mode') || ''; } catch (e) { return ''; } })(),
    raw: null, M: null, loading: false,
    setMode(m) { this.mode = m; try { m ? sessionStorage.setItem('komis.mode', m) : sessionStorage.removeItem('komis.mode'); } catch (e) {} },
    async load() {
      if (this.mode === 'demo') { this.raw = this.raw || Demo.make(); }
      else {
        const r = await Api.batchGet(Model.RANGES);
        const v = r.valueRanges.map(x => x.values || []);
        this.raw = { cars: v[0], costs: v[1], general: v[2], settings: v[3], auctions: v[4] || [] };
      }
      this.M = Model.build(this.raw);
    },
    async append(key, row) {
      if (this.mode === 'demo') { (this.raw[key] = this.raw[key] || []).push(row); }
      else await Api.append(SHEET[key] + '!A:' + COL(row.length - 1), [row]);
    },
    async set(changes) { // [{key,row,col,values:[...]}]
      if (this.mode === 'demo') {
        for (const c of changes) {
          const arr = this.raw[c.key]; const r = arr[c.row - 2] || (arr[c.row - 2] = []);
          c.values.forEach((v, i) => { r[c.col + i] = v; });
        }
      } else {
        await Api.update(changes.map(c => ({ range: SHEET[c.key] + '!' + COL(c.col) + c.row + ':' + COL(c.col + c.values.length - 1) + c.row, values: [c.values] })));
      }
    }
  };

  async function save(fn, okMsg) {
    await fn();
    await Store.load();
    render();
    if (okMsg) toast(okMsg);
  }

  // ---------------- nawigacja ----------------
  const NAV = [['', 'Pulpit', 'home'], ['auta', 'Auta', 'car'], ['aukcje', 'Aukcje', 'cal'], ['koszty', 'Koszty', 'cost'], ['zyski', 'Zyski', 'chart'], ['rozliczenia', 'Rozliczenia', 'swap']];
  const route = () => { const h = location.hash.replace(/^#\/?/, '').split('/'); return { page: h[0] || '', arg: decodeURIComponent(h[1] || '') }; };
  // Symulacje (tylko na tym urządzeniu, nic nie zapisują w arkuszu)
  const SIMKEY = 'komis.sim';
  let sims = {};
  try { sims = JSON.parse(localStorage.getItem(SIMKEY) || '{}'); } catch (e) {}
  const saveSims = () => { try { localStorage.setItem(SIMKEY, JSON.stringify(sims)); } catch (e) {} };
  const simOf = c => sims[c.plate] || (sims[c.plate] = { price: c.price ?? c.offer ?? '', items: [], receiver: '' });

  function simCalc(c, sim) {
    const S = Store.M.S;
    const price = parseAmt(sim.price);
    const extra = sim.items.reduce((s, i) => s + (parseAmt(i.amount) || 0), 0);
    const extraL = sim.items.filter(i => i.who === S.L).reduce((s, i) => s + (parseAmt(i.amount) || 0), 0);
    const extraM = extra - extraL;
    const total = c.total + extra;
    if (price === null) return { extra, total };
    const profit = price - total;
    const paidL = c.paidL + extraL, paidM = c.paidM + extraM;
    const dueL = paidL + profit * S.share, dueM = paidM + profit * (1 - S.share);
    const r = { extra, total, profit, dueL, dueM, margin: price ? profit / price : 0 };
    if (sim.receiver) r.balL = dueL - (sim.receiver === S.L ? price : 0);
    return r;
  }

  function simResult(c) {
    const S = Store.M.S, sim = simOf(c), r = simCalc(c, sim);
    if (r.profit === undefined) return '<div class="empty">Wpisz cenę sprzedaży, żeby zobaczyć wynik.</div>';
    return '<dl class="kv"><dt>Koszty dotychczas</dt><dd>' + zl2(c.total) + '</dd><dt>Planowane koszty</dt><dd>' + zl2(r.extra) + '</dd><dt>Koszty razem</dt><dd><b>' + zl2(r.total) + '</b></dd></dl>' +
      '<div class="road" style="margin:12px 0"></div>' +
      '<div class="kpi"><div class="l">Zysk</div><div class="v ' + signCls(r.profit) + '">' + zl2(r.profit) + '</div><div class="s">marża ' + (r.margin * 100).toFixed(1).replace('.', ',') + '% · po ' + zl2(r.profit * S.share) + ' na osobę</div></div>' +
      '<dl class="kv mt"><dt>Należy ' + esc(S.L) + '</dt><dd>' + zl2(r.dueL) + '</dd><dt>Należy ' + esc(S.M) + '</dt><dd>' + zl2(r.dueM) + '</dd></dl>' +
      (r.balL !== undefined ? '<div class="mt small">Po sprzedaży: ' + balTxt(r.balL, S) + '</div>' : '');
  }

  function simCard(c) {
    const S = Store.M.S, sim = simOf(c);
    const opt = (v, sel) => '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(v || '—') + '</option>';
    return '<div class="card mt" id="sim"><div class="row between wrap"><h2>Symulacja sprzedaży</h2><span class="small muted">nic nie zapisuje w bazie</span></div>' +
      '<div class="grid g2"><div class="stack" style="gap:10px">' +
      '<div class="form"><label class="field">Cena sprzedaży (zł)<input data-sim="price" inputmode="decimal" value="' + esc(sim.price) + '" placeholder="np. 52000"></label>' +
      '<label class="field">Kto odbierze pieniądze<select data-sim="receiver">' + ['', S.L, S.M].map(v => opt(v, sim.receiver)).join('') + '</select></label></div>' +
      '<div class="field">Planowane koszty (gwarancja, naprawa, prowizja…)</div>' +
      sim.items.map((it, i) => '<div class="row" style="gap:8px"><input class="search" style="min-width:0;flex:2" data-sim="what" data-i="' + i + '" placeholder="za co" value="' + esc(it.what) + '">' +
        '<input class="search" style="min-width:0;flex:1" data-sim="amount" data-i="' + i + '" inputmode="decimal" placeholder="kwota" value="' + esc(it.amount) + '">' +
        '<select class="search" style="min-width:0;flex:1" data-sim="who" data-i="' + i + '">' + people().map(v => opt(v, it.who)).join('') + '</select>' +
        '<button class="btn ghost" title="Zapisz jako prawdziwy koszt" data-act="sim-save" data-i="' + i + '" data-p="' + esc(c.plate) + '">✓</button>' +
        '<button class="btn ghost danger" title="Usuń" data-act="sim-del" data-i="' + i + '" data-p="' + esc(c.plate) + '">×</button></div>').join('') +
      '<div class="row wrap"><button class="btn" data-act="sim-add" data-p="' + esc(c.plate) + '">+ Planowany koszt</button>' +
      (c.status !== 'Sprzedany' ? '<button class="btn ghost" data-act="sim-offer" data-p="' + esc(c.plate) + '">Ustaw jako cenę ofertową</button>' : '') +
      '<button class="btn ghost" data-act="sim-reset" data-p="' + esc(c.plate) + '">Wyczyść</button></div>' +
      '<div class="small muted">✓ przy pozycji = zapisz ją jako prawdziwy koszt auta.</div>' +
      '</div><div id="sim-res">' + simResult(c) + '</div></div></div>';
  }

  const view = { cars: { f: 'stock', firm: '', q: '' }, costs: { tab: 'gen', month: Model.todayISO().slice(0, 7) }, rep: { mode: 'year', year: new Date().getFullYear(), month: Model.todayISO().slice(0, 7), from: '', to: '' } };

  function shell(inner, page) {
    const on = p => (page === p || (p === 'auta' && page === 'auto')) ? ' on' : '';
    return '<header class="top"><div class="logos"><img src="lukar.svg" alt="LUKAR"><img src="nacar.svg" alt="NACAR"></div>' +
      '<nav class="nav">' + NAV.map(([p, l]) => '<a href="#/' + p + '" class="' + on(p) + '">' + l + '</a>').join('') + '</nav><div class="sp"></div>' +
      '<div class="user">' + (Store.mode === 'demo' ? '<span class="demo-badge">DEMO</span>' : '<span class="hide-m">' + esc(Api.email || '') + '</span>') +
      '<button class="btn ghost" data-act="logout">' + (Store.mode === 'demo' ? 'Wyjdź' : 'Wyloguj') + '</button></div>' +
      '<button class="btn primary add-car" data-act="new-car">+ Dodaj auto</button></header>' +
      '<main>' + inner + '</main>' +
      '<button class="fab" data-act="' + (page === 'auta' ? 'new-car' : page === 'aukcje' ? 'new-auction' : 'new-cost') + '">' + (page === 'auta' ? '+ Dodaj auto' : page === 'aukcje' ? '+ Dodaj aukcję' : '+ Dodaj koszt') + '</button>' +
      '<nav class="tabbar">' + NAV.map(([p, l, ic]) => '<a href="#/' + p + '" class="' + on(p) + '">' + ICON[ic] + l + '</a>').join('') + '</nav>';
  }

  function render() {
    if (!Store.M) return;
    const { page, arg } = route();
    let html;
    try {
      if (page === 'auta') html = pageCars();
      else if (page === 'auto') html = pageCar(arg);
      else if (page === 'koszty') html = pageCosts();
      else if (page === 'zyski') html = pageReport();
      else if (page === 'aukcje') html = pageAuctions();
      else if (page === 'rozliczenia') html = pageSettle();
      else html = pageHome();
    } catch (e) { console.error(e); html = '<div class="card">Błąd widoku: ' + esc(e.message) + '</div>'; }
    $app.innerHTML = shell(html, page);
    $app.querySelectorAll('.logos img').forEach(img => img.addEventListener('error', () => { img.replaceWith(Object.assign(document.createElement('b'), { textContent: img.alt, style: 'font-size:15px;letter-spacing:.08em;color:' + (img.alt === 'LUKAR' ? 'var(--lukar)' : 'var(--nacar)') })); }));
  }

  // ---------------- fragmenty ----------------
  const carLine = (c, right) => '<div class="it clickable" data-href="#/auto/' + encodeURIComponent(c.plate) + '"><div class="meta">' + plate(c.plate) +
    '<div class="sub">' + chip(c.firm) + '<span>' + esc(c.model || '') + '</span></div></div><div class="amt">' + (right || '') + '</div></div>';
  const kpi = (l, v, s, cls) => '<div class="card kpi"><div class="l">' + l + '</div><div class="v ' + (cls || '') + '">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
  const balTxt = (bL, S) => Math.abs(bL) < 0.5 ? 'rozliczeni na zero' : bL > 0 ? esc(S.M) + ' → ' + esc(S.L) + ': <b>' + zl2(bL) + '</b>' : esc(S.L) + ' → ' + esc(S.M) + ': <b>' + zl2(-bL) + '</b>';
  const monthRange = ym => { const [y, m] = ym.split('-').map(Number); return [ym + '-01', new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)]; };

  // ---------------- Aukcje ----------------
  const DOW = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const dayLabel = iso => { const d = Model.daysBetween(Store.M.today, iso); const w = DOW[new Date(iso + 'T00:00:00Z').getUTCDay()]; return d === 0 ? 'Dziś' : d === 1 ? 'Jutro' : w.charAt(0).toUpperCase() + w.slice(1) + ', ' + date(iso).slice(0, 5); };
  const href = l => l ? (/^https?:\/\//i.test(l) ? l : 'https://' + l) : '';
  const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  function auctionLine(a, iso) {
    const past = iso === Store.M.today && a.time && a.time < nowHM();
    return '<div class="it"><div class="meta"><div class="row" style="gap:10px"><b style="font-size:17px;min-width:48px' + (past ? ';color:var(--muted2)' : '') + '">' + esc(a.time || '—') + '</b>' +
      (a.link ? '<a href="' + esc(href(a.link)) + '" target="_blank" rel="noopener"><b>' + esc(a.site) + '</b> ↗</a>' : '<b>' + esc(a.site) + '</b>') + '</div>' +
      ((a.what || a.note) ? '<div class="sub">' + esc([a.what, a.note].filter(Boolean).join(' · ')) + '</div>' : '') + '</div>' +
      '<div class="amt">' + (a.repeat !== 'jednorazowo' ? tag(a.repeat, 'gray') : '') + '<button class="btn ghost" data-act="edit-auction" data-row="' + a.row + '">Edytuj</button></div></div>';
  }
  function auctionsToday() {
    const M = Store.M, t = M.today, tom = Model.addDays(t, 1);
    const td = Model.auctionsOn(M, t), tm = Model.auctionsOn(M, tom);
    return '<div class="card"><div class="row between"><h2>Aukcje dziś</h2><a class="small" href="#/aukcje">Kalendarz →</a></div><div class="list">' +
      (td.length ? td.map(a => auctionLine(a, t)).join('') : '<div class="empty">Dziś brak aukcji.</div>') + '</div>' +
      (tm.length ? '<div class="small muted mt">Jutro: ' + tm.map(a => esc((a.time || '') + ' ' + a.site)).join(', ') + '</div>' : '') + '</div>';
  }
  function pageAuctions() {
    const M = Store.M;
    let days = '';
    for (let i = 0; i < 14; i++) {
      const iso = Model.addDays(M.today, i), list = Model.auctionsOn(M, iso);
      if (!list.length && i > 1) continue;
      days += '<div class="card mt"><div class="row between"><h2>' + dayLabel(iso) + '</h2>' + (list.length ? tag(list.length + '', i === 0 ? 'blue' : 'gray') : '') + '</div><div class="list">' +
        (list.length ? list.map(a => auctionLine(a, iso)).join('') : '<div class="empty">Brak aukcji.</div>') + '</div></div>';
    }
    const rec = M.auctions.filter(a => a.active && a.repeat !== 'jednorazowo');
    return '<div class="head"><div><h1>Aukcje</h1><div class="sub">Najbliższe 2 tygodnie</div></div><button class="btn primary hide-m" data-act="new-auction">+ Dodaj aukcję</button></div>' +
      days +
      (rec.length ? '<div class="card mt"><h2>Stałe aukcje (powtarzane)</h2><div class="list">' + rec.map(a => '<div class="it"><div class="meta"><b>' + esc(a.site) + '</b><span class="sub">' + esc(a.repeat) + (a.repeat === 'co tydzień' ? ' (' + DOW[new Date(a.date + 'T00:00:00Z').getUTCDay()] + ')' : '') + ' · ' + esc(a.time || '') + (a.until ? ' · do ' + date(a.until) : '') + '</span></div><div class="amt"><button class="btn ghost" data-act="edit-auction" data-row="' + a.row + '">Edytuj</button></div></div>').join('') + '</div></div>' : '');
  }
  function auctionForm(a) {
    const sites = [...new Set(Store.M.auctions.map(x => x.site).filter(Boolean).concat(['cararena.pl', 'aukcja.express.pl', 'carclick', 'Autobid', 'OPENLANE', 'BCA']))];
    modal(a ? 'Edytuj aukcję' : 'Nowa aukcja', '<datalist id="dl-sites">' + sites.map(s => '<option value="' + esc(s) + '">').join('') + '</datalist>' + fields([
      { name: 'site', label: 'Serwis / miejsce', list: 'dl-sites', required: true, value: a ? a.site : '', placeholder: 'np. cararena.pl' },
      { name: 'time', label: 'Godzina', type: 'time', value: a ? a.time : '', required: true },
      { name: 'date', label: a && a.repeat !== 'jednorazowo' ? 'Pierwszy dzień' : 'Data', type: 'date', value: a ? a.date : Model.todayISO(), required: true },
      { name: 'repeat', label: 'Powtarzanie', type: 'select', options: ['jednorazowo', 'co tydzień', 'w dni robocze', 'codziennie'], value: a ? a.repeat : 'jednorazowo' },
      { name: 'link', label: 'Link do aukcji', value: a ? a.link : '', full: true, placeholder: 'https://…' },
      { name: 'what', label: 'Co (auta, maks. cena…)', value: a ? a.what : '', full: true },
      { name: 'until', label: 'Powtarzaj do (opcjonalnie)', type: 'date', value: a ? a.until : '' },
      { name: 'note', label: 'Uwagi', value: a ? a.note : '' }
    ]) + (a ? '<div class="row mt"><button type="button" class="btn danger" data-act="del-auction" data-row="' + a.row + '">Usuń z kalendarza</button></div>' : ''), {
      async onSubmit(d) {
        const row = [d.date, d.time, d.site, d.link, d.what, d.repeat, d.until, d.note, 'TAK'];
        if (a) await save(() => Store.set([{ key: 'auctions', row: a.row, col: 0, values: row }]), 'Zapisano aukcję');
        else await save(() => Store.append('auctions', row.concat(Model.nextId(Store.M.auctions, 'A'))), 'Dodano aukcję ' + d.site + ' ' + d.time);
      }
    });
  }

  // ---------------- Pulpit ----------------
  function pageHome() {
    const M = Store.M, S = M.S, t = M.today;
    const [mf, mt] = monthRange(t.slice(0, 7));
    const rm = Model.report(M, mf, mt);
    const ry = Model.report(M, t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31');
    const st = Model.stock(M), b = Model.balances(M);
    const grp = [];
    for (const a of M.alerts) { let g = grp.find(x => x.car === a.car); if (!g) grp.push(g = { car: a.car, items: [] }); g.items.push(a); }
    const alerts = grp.slice(0, 8);
    return '<div class="head"><div><h1>Pulpit</h1><div class="sub">Komis LUKAR · NACAR · ' + date(t) + '</div></div>' + CAR_SIL + '</div>' +
      auctionsToday() +
      '<div class="grid g4 mt">' +
      kpi('Zysk netto – ' + MON[Number(t.slice(5, 7)) - 1], zl(rm.net), rm.count + ' aut · koszty ogólne ' + zl(rm.genNet), signCls(rm.net)) +
      kpi('Zysk netto – ' + t.slice(0, 4), zl(ry.net), esc(S.L) + ' ' + zl(ry.L) + ' · ' + esc(S.M) + ' ' + zl(ry.M), signCls(ry.net)) +
      kpi('Na stanie', st.cars.length + ' aut', 'w autach ' + zl(st.total) + (st.old ? ' · ' + st.old + ' stoi ponad 60 dni' : '')) +
      kpi('Do rozliczenia', b.cars.length + ' aut', balTxt(b.totalL, S)) +
      '</div>' +
      '<div class="grid g2 mt">' +
      '<div class="card"><div class="row between"><h2>Wymaga uwagi</h2>' + (grp.length ? tag(grp.length + ' aut', M.alerts.some(a => a.left < 0) ? 'red' : 'amber') : '') + '</div><div class="list">' +
      (alerts.length ? alerts.map(g => carLine(g.car, g.items.map(a => '<div class="small">' + esc(a.kind) + ' do ' + date(a.due) + ' ' + tag(leftTxt(a.left), a.level) + '</div>').join(''))).join('') : '<div class="empty">Brak terminów w najbliższych 30 dniach.</div>') +
      (grp.length > 8 ? '<div class="it"><span class="small muted">i ' + (grp.length - 8) + ' aut więcej…</span></div>' : '') + '</div></div>' +
      '<div class="card"><div class="row between"><h2>Do rozliczenia</h2><a class="small" href="#/rozliczenia">Rozliczenia →</a></div><div class="list">' +
      (b.cars.length ? b.cars.slice(0, 7).map(c => carLine(c, c.balL === undefined ? tag('kto odebrał?', 'amber') : '<div class="small">' + balTxt(c.balL, S) + '</div><div class="small muted">zysk ' + zl(c.profit) + '</div>')).join('') : '<div class="empty">Wszystko rozliczone.</div>') +
      '</div></div></div>' +
      (M.issues.length ? '<div class="card mt"><div class="row between"><h2>Braki w danych</h2>' + tag(M.issues.length + '', 'gray') + '</div><div class="list">' +
        M.issues.slice(0, 6).map(i => carLine(i.car, '<span class="small">' + esc(i.text) + '</span>')).join('') + '</div></div>' : '');
  }

  // ---------------- Auta ----------------
  function pageCars() {
    const M = Store.M, V = view.cars;
    const groups = {
      stock: ['Na stanie', c => c.status === 'Na stanie' || c.status === 'Aukcja'],
      settle: ['Do rozliczenia', c => c.status === 'Sprzedany' && !c.settled],
      sold: ['Sprzedane', c => c.status === 'Sprzedany'],
      priv: ['Prywatne', c => c.status === 'Prywatny'],
      all: ['Wszystkie', () => true]
    };
    const q = V.q.toUpperCase().replace(/\s+/g, '');
    let list = M.cars.filter(groups[V.f][1]).filter(c => !V.firm || c.firm === V.firm)
      .filter(c => !q || c.plate.includes(q) || (c.model + ' ' + c.vin).toUpperCase().replace(/\s+/g, '').includes(q));
    if (V.f === 'stock') list.sort((a, b) => (b.daysStock || 0) - (a.daysStock || 0));
    else list.sort((a, b) => (b.sold || b.bought || '').localeCompare(a.sold || a.bought || ''));
    const st = Model.stock(M);
    const right = c => {
      if (c.status === 'Sprzedany') return statusTag(c) + '<div class="small mt0">' + date(c.sold) + ' · zysk <b class="' + signCls(c.profit) + '">' + zl(c.profit) + '</b></div>';
      return statusTag(c) + '<div class="small mt0">koszty ' + zl(c.total) + (c.expected !== null ? ' · prognoza <b class="' + signCls(c.expected) + '">' + zl(c.expected) + '</b>' : '') + '</div>';
    };
    return '<div class="head"><div><h1>Auta</h1><div class="sub">' + M.cars.length + ' w bazie</div></div>' +
      '<input class="search" data-in="cars-q" placeholder="Szukaj: numer, model, VIN" value="' + esc(V.q) + '"></div>' +
      '<div class="row wrap between"><div class="pills">' + Object.entries(groups).map(([k, [l, f]]) => '<button data-set="cars.f" data-v="' + k + '" class="' + (V.f === k ? 'on' : '') + '">' + l + ' ' + M.cars.filter(f).length + '</button>').join('') + '</div>' +
      '<div class="seg">' + [['', 'Obie firmy'], ['LUKAR', 'LUKAR'], ['NACAR', 'NACAR']].map(([v, l]) => '<button data-set="cars.firm" data-v="' + v + '" class="' + (V.firm === v ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div>' +
      (V.f === 'stock' ? '<div class="grid g4 mt">' + kpi('Aut na stanie', st.cars.length) + kpi('Pieniądze w autach', zl(st.total)) + kpi('Wkład ' + esc(M.S.L), zl(st.L)) + kpi('Wkład ' + esc(M.S.M), zl(st.M)) + '</div>' : '') +
      '<div class="card mt"><div class="list">' + (list.length ? list.map(c => carLine(c, right(c))).join('') : '<div class="empty">Brak aut dla wybranych filtrów.</div>') + '</div></div>';
  }

  // ---------------- Karta auta ----------------
  function pageCar(p) {
    const M = Store.M, S = M.S, c = M.carByPlate[Model.plateKey(p)];
    if (!c) return '<div class="card">Nie znaleziono auta ' + esc(p) + '. <a href="#/auta">Wróć do listy</a></div>';
    const dl = (label, due, done) => '<dt>' + label + '</dt><dd>' + (done ? tag('zrobione', 'green') : due ? date(due) + ' ' + (() => { const d = Model.daysBetween(M.today, due); return d <= 30 ? tag(leftTxt(d), d <= 14 ? 'red' : 'amber') : ''; })() : '—') + '</dd>';
    const sold = c.status === 'Sprzedany';
    let settle = '';
    if (sold) {
      settle = '<dl class="kv"><dt>Wkład ' + esc(S.L) + '</dt><dd>' + zl2(c.paidL) + '</dd><dt>Wkład ' + esc(S.M) + '</dt><dd>' + zl2(c.paidM) + '</dd>' +
        (c.unknownPaid > 0.005 ? '<dt>Bez płatnika</dt><dd class="neg">' + zl2(c.unknownPaid) + '</dd>' : '') +
        (c.profit !== null ? '<dt>Należy ' + esc(S.L) + '</dt><dd>' + zl2(c.dueL) + '</dd><dt>Należy ' + esc(S.M) + '</dt><dd>' + zl2(c.dueM) + '</dd>' : '') +
        '<dt>Pieniądze odebrał</dt><dd>' + esc(c.receiver || '—') + '</dd></dl>' +
        '<div class="mt">' + (c.settled ? tag('Rozliczone', 'green') : c.balL !== undefined ? '<div>' + balTxt(c.balL, S) + '</div>' : tag('Uzupełnij, kto odebrał pieniądze', 'amber')) + '</div>';
    } else {
      settle = '<dl class="kv"><dt>Wkład ' + esc(S.L) + '</dt><dd>' + zl2(c.paidL) + '</dd><dt>Wkład ' + esc(S.M) + '</dt><dd>' + zl2(c.paidM) + '</dd>' +
        (c.unknownPaid > 0.005 ? '<dt>Bez płatnika</dt><dd class="neg">' + zl2(c.unknownPaid) + '</dd>' : '') + '</dl>';
    }
    return '<div class="head"><div class="stack" style="gap:10px;align-items:flex-start"><a class="small" href="#/auta">← Auta</a>' + plate(c.plate, true) +
      '<div class="row wrap">' + chip(c.firm) + '<span class="muted">' + esc(c.model) + (c.year ? ' · ' + esc(c.year) : '') + '</span>' + statusTag(c) + '</div></div>' +
      '<div class="row wrap"><button class="btn" data-act="edit-car" data-p="' + esc(c.plate) + '">Edytuj</button>' +
      '<button class="btn" data-act="new-cost" data-p="' + esc(c.plate) + '">+ Koszt</button>' +
      (c.status !== 'Prywatny' ? '<a class="btn" href="javascript:void(0)" data-act="sim-go">Symulacja</a>' : '') +
      (!sold && c.status !== 'Prywatny' ? '<button class="btn primary" data-act="sell" data-p="' + esc(c.plate) + '">Sprzedaż</button>' : '') +
      (sold && !c.settled ? '<button class="btn primary" data-act="settle-car" data-p="' + esc(c.plate) + '">Oznacz rozliczone</button>' : '') + '</div></div>' +
      '<div class="grid g4">' + kpi('Koszty razem', zl2(c.total), c.costs.length + ' pozycji') +
      kpi(sold ? 'Cena sprzedaży' : 'Cena ofertowa', zl(sold ? c.price : c.offer), sold ? date(c.sold) : '') +
      kpi(sold ? 'Zysk' : 'Zysk przy cenie ofertowej', zl2(sold ? c.profit : c.expected), '', signCls(sold ? c.profit : c.expected)) +
      kpi(sold ? 'Sprzedane po' : 'Na stanie od', (c.daysStock ?? '—') + ' dni', 'zakup ' + date(c.bought)) + '</div>' +
      '<div class="grid g3 mt">' +
      '<div class="card"><h2>Dane auta</h2><dl class="kv"><dt>VIN</dt><dd style="word-break:break-all">' + esc(c.vin || '—') + '</dd><dt>Firma</dt><dd>' + esc(c.firm || '—') + '</dd><dt>Rok</dt><dd>' + esc(c.year || '—') + '</dd><dt>Zakup</dt><dd>' + date(c.bought) + '</dd>' + (c.note ? '<dt>Uwagi</dt><dd>' + esc(c.note) + '</dd>' : '') + '</dl></div>' +
      '<div class="card"><h2>Terminy</h2><dl class="kv">' + dl('Rejestracja', c.regDue, c.registered) + (sold ? dl('Zgłoszenie zbycia', c.repDue, c.reported) : dl('OC', c.oc) + dl('Badanie techn.', c.bt)) + '</dl></div>' +
      '<div class="card"><h2>Rozliczenie</h2>' + settle + '</div></div>' +
      (c.status !== 'Prywatny' ? simCard(c) : '') +
      '<div class="card mt"><div class="row between"><h2>Koszty</h2><button class="btn ghost" data-act="new-cost" data-p="' + esc(c.plate) + '">+ Dodaj</button></div>' +
      (c.costs.length ? '<div class="scroll-x"><table class="tbl"><thead><tr><th>Data</th><th>Za co</th><th class="hide-m">Kategoria</th><th class="hide-m">Kto</th><th class="num">Kwota</th></tr></thead><tbody>' +
        c.costs.map(k => '<tr><td>' + date(k.date) + '</td><td class="tw">' + esc(k.what) + '<div class="small muted hide-d">' + (k.who ? esc(k.who) : '<span class="neg">kto płacił?</span>') + '</div></td><td class="hide-m muted">' + esc(k.cat) + '</td><td class="hide-m">' + (k.who ? esc(k.who) : tag('?', 'amber')) + '</td><td class="num">' + zl2(k.amount) + '</td></tr>').join('') +
        '<tr class="tot"><td colspan="2">Razem</td><td class="hide-m"></td><td class="hide-m"></td><td class="num">' + zl2(c.total) + '</td></tr></tbody></table></div>' : '<div class="empty">Brak kosztów.</div>') + '</div>';
  }

  // ---------------- Koszty ----------------
  function pageCosts() {
    const M = Store.M, V = view.costs;
    const [from, to] = monthRange(V.month);
    let rows, total;
    if (V.tab === 'gen') {
      rows = M.gen.filter(g => g.date >= from && g.date <= to).sort((a, b) => b.date.localeCompare(a.date));
      total = rows.reduce((s, g) => s + g.net, 0);
    } else {
      rows = M.costs.filter(c => c.date >= from && c.date <= to).sort((a, b) => b.date.localeCompare(a.date));
      total = rows.reduce((s, c) => s + c.amount, 0);
    }
    const [y, m] = V.month.split('-').map(Number);
    const shift = d => { const dt = new Date(Date.UTC(y, m - 1 + d, 1)); return dt.toISOString().slice(0, 7); };
    const body = V.tab === 'gen'
      ? '<table class="tbl"><thead><tr><th>Data</th><th>Za co</th><th class="hide-m">Kategoria</th><th>Kto</th><th class="hide-m">Rozl.</th><th class="num">Kwota</th></tr></thead><tbody>' +
        rows.map(g => '<tr><td>' + date(g.date) + '</td><td>' + esc(g.what) + (g.firm ? ' ' + chip(g.firm) : '') + '</td><td class="hide-m muted">' + esc(g.cat) + '</td><td>' + esc(g.who) + '</td><td class="hide-m">' + (g.settled ? '✓' : tag('nie', 'amber')) + '</td><td class="num ' + (g.type === 'Przychód' ? 'pos' : '') + '">' + (g.type === 'Przychód' ? '+' : '') + zl2(g.amount) + '</td></tr>').join('') +
        '<tr class="tot"><td colspan="2">Koszty ogólne netto</td><td class="hide-m"></td><td></td><td class="hide-m"></td><td class="num">' + zl2(total) + '</td></tr></tbody></table>'
      : '<table class="tbl"><thead><tr><th>Data</th><th>Auto</th><th>Za co</th><th>Kto</th><th class="num">Kwota</th></tr></thead><tbody>' +
        rows.map(c => '<tr class="clickable" data-href="#/auto/' + encodeURIComponent(c.plate) + '"><td>' + date(c.date) + '</td><td><b>' + esc(c.plate) + '</b></td><td>' + esc(c.what) + '</td><td>' + (c.who ? esc(c.who) : tag('?', 'amber')) + '</td><td class="num">' + zl2(c.amount) + '</td></tr>').join('') +
        '<tr class="tot"><td colspan="4">Razem</td><td class="num">' + zl2(total) + '</td></tr></tbody></table>';
    return '<div class="head"><div><h1>Koszty</h1><div class="sub">' + MON[m - 1] + ' ' + y + '</div></div><button class="btn primary hide-m" data-act="new-cost">+ Dodaj koszt</button></div>' +
      '<div class="row wrap between"><div class="seg"><button data-set="costs.tab" data-v="gen" class="' + (V.tab === 'gen' ? 'on' : '') + '">Ogólne (ZUS, podatki…)</button><button data-set="costs.tab" data-v="car" class="' + (V.tab === 'car' ? 'on' : '') + '">Koszty aut</button></div>' +
      '<div class="row"><button class="btn" data-set="costs.month" data-v="' + shift(-1) + '">←</button><input class="search" style="min-width:0;width:150px" type="month" data-in="costs-month" value="' + V.month + '"><button class="btn" data-set="costs.month" data-v="' + shift(1) + '">→</button></div></div>' +
      '<div class="card mt scroll-x">' + (rows.length ? body : '<div class="empty">Brak pozycji w tym miesiącu.</div>') + '</div>';
  }

  // ---------------- Zyski ----------------
  function pageReport() {
    const M = Store.M, S = M.S, V = view.rep;
    let from, to, label;
    if (V.mode === 'month') { [from, to] = monthRange(V.month); label = MON[Number(V.month.slice(5)) - 1] + ' ' + V.month.slice(0, 4); }
    else if (V.mode === 'range') { from = V.from || (V.year + '-01-01'); to = V.to || M.today; label = date(from) + ' – ' + date(to); }
    else { from = V.year + '-01-01'; to = V.year + '-12-31'; label = 'rok ' + V.year; }
    const r = Model.report(M, from, to);
    const year = Number((V.mode === 'year' ? V.year : from.slice(0, 4)));
    const ms = Model.months(M, year);
    const prev = Model.report(M, (year - 1) + '-01-01', (year - 1) + '-12-31');
    const years = [...new Set(M.cars.map(c => c.sold.slice(0, 4)).filter(Boolean).concat(M.gen.map(g => g.date.slice(0, 4)).filter(Boolean)))].sort();
    const ctrl = V.mode === 'month' ? '<input class="search" style="min-width:0;width:160px" type="month" data-in="rep-month" value="' + V.month + '">'
      : V.mode === 'range' ? '<input class="search" style="min-width:0;width:150px" type="date" data-in="rep-from" value="' + from + '"><input class="search" style="min-width:0;width:150px" type="date" data-in="rep-to" value="' + to + '">'
      : '<div class="seg">' + years.map(y => '<button data-set="rep.year" data-v="' + y + '" class="' + (String(V.year) === y ? 'on' : '') + '">' + y + '</button>').join('') + '</div>';
    const carRow = c => carLine(c, '<b class="' + signCls(c.profit) + '">' + zl(c.profit) + '</b><div class="small muted">' + date(c.sold) + '</div>');
    return '<div class="head"><div><h1>Zyski</h1><div class="sub">' + esc(label) + '</div></div></div>' +
      '<div class="row wrap"><div class="seg">' + [['month', 'Miesiąc'], ['year', 'Rok'], ['range', 'Zakres']].map(([k, l]) => '<button data-set="rep.mode" data-v="' + k + '" class="' + (V.mode === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' + ctrl + '</div>' +
      '<div class="grid g4 mt">' +
      kpi('Zysk netto', zl(r.net), 'po kosztach ogólnych', signCls(r.net)) +
      kpi('Zysk z aut', zl(r.carProfit), r.count + ' sprzedanych · przychód ' + zl(r.revenue)) +
      kpi('Koszty ogólne netto', zl(r.genNet), 'koszty ' + zl(r.genCost) + ' · przychody ' + zl(r.genIncome)) +
      kpi('Średni zysk na auto', zl(r.avg), r.avgDays !== null ? 'średnio ' + Math.round(r.avgDays) + ' dni do sprzedaży' : '') + '</div>' +
      '<div class="grid g2 mt">' +
      '<div class="card"><h2>Podział między wspólników</h2><dl class="kv"><dt>' + esc(S.L) + '</dt><dd class="' + signCls(r.L) + '">' + zl2(r.L) + '</dd><dt>' + esc(S.M) + '</dt><dd class="' + signCls(r.M) + '">' + zl2(r.M) + '</dd></dl><div class="small muted mt">Zysk z aut dzielony ' + Math.round(S.share * 100) + '/' + Math.round(100 - S.share * 100) + ', koszty ogólne według kolumny „Podział”.</div></div>' +
      '<div class="card"><h2>Według firmy</h2><table class="tbl"><thead><tr><th>Firma</th><th class="num">Aut</th><th class="num">Zysk z aut</th><th class="num">Koszty ogólne</th></tr></thead><tbody>' +
      r.byFirm.map(f => '<tr><td>' + chip(f.firm) + '</td><td class="num">' + f.count + '</td><td class="num">' + zl(f.profit) + '</td><td class="num">' + zl(f.gen) + '</td></tr>').join('') +
      '<tr><td class="muted">wspólne</td><td></td><td></td><td class="num">' + zl(r.genShared) + '</td></tr></tbody></table></div></div>' +
      '<div class="card mt"><div class="row between wrap"><h2>Miesiące ' + year + '</h2><div class="legend"><span><i style="background:#15803D"></i>zysk netto</span><span><i style="background:#1D4ED8"></i>zysk z aut (linia)</span>' + (prev.count || prev.genNet ? '<span>rok ' + (year - 1) + ': ' + zl(prev.net) + '</span>' : '') + '</div></div>' + barChart(ms) +
      '<div class="scroll-x mt"><table class="tbl"><thead><tr><th>Miesiąc</th><th class="num">Aut</th><th class="num">Zysk z aut</th><th class="num">Koszty ogólne</th><th class="num">Zysk netto</th><th class="num hide-m">' + esc(S.L) + '</th><th class="num hide-m">' + esc(S.M) + '</th></tr></thead><tbody>' +
      ms.map(x => '<tr><td>' + MON[x.m - 1] + '</td><td class="num">' + x.count + '</td><td class="num">' + zl(x.carProfit) + '</td><td class="num">' + zl(x.genNet) + '</td><td class="num ' + signCls(x.net) + '"><b>' + zl(x.net) + '</b></td><td class="num hide-m">' + zl(x.L) + '</td><td class="num hide-m">' + zl(x.M) + '</td></tr>').join('') +
      (() => { const t = Model.report(M, year + '-01-01', year + '-12-31'); return '<tr class="tot"><td>Razem</td><td class="num">' + t.count + '</td><td class="num">' + zl(t.carProfit) + '</td><td class="num">' + zl(t.genNet) + '</td><td class="num ' + signCls(t.net) + '">' + zl(t.net) + '</td><td class="num hide-m">' + zl(t.L) + '</td><td class="num hide-m">' + zl(t.M) + '</td></tr>'; })() +
      '</tbody></table></div></div>' +
      '<div class="grid g3 mt">' +
      '<div class="card"><h2>Najlepsze auta</h2><div class="list">' + (r.best.map(carRow).join('') || '<div class="empty">—</div>') + '</div></div>' +
      '<div class="card"><h2>Najsłabsze auta</h2><div class="list">' + (r.worst.map(carRow).join('') || '<div class="empty">—</div>') + '</div></div>' +
      '<div class="card"><h2>Koszty ogólne wg kategorii</h2><table class="tbl"><tbody>' + (r.genByCat.map(([k, v]) => '<tr><td>' + esc(k) + '</td><td class="num ' + (v < 0 ? 'pos' : '') + '">' + zl(v) + '</td></tr>').join('') || '<tr><td class="muted">—</td></tr>') + '</tbody></table></div></div>';
  }

  // ---------------- Rozliczenia ----------------
  function pageSettle() {
    const M = Store.M, S = M.S, b = Model.balances(M);
    return '<div class="head"><div><h1>Rozliczenia</h1><div class="sub">Auta sprzedane i koszty ogólne bez „Rozliczone: TAK”</div></div></div>' +
      '<div class="grid g3">' + kpi('Saldo łącznie', '<span style="font-size:18px">' + balTxt(b.totalL, S) + '</span>') + kpi('Z aut', zl2(b.carL), b.cars.length + ' aut' + (b.missing.length ? ' · ' + b.missing.length + ' bez „kto odebrał”' : '')) + kpi('Z kosztów ogólnych', zl2(b.genL), b.gen.length + ' pozycji') + '</div>' +
      '<div class="small muted mt">Kwoty: plus = ' + esc(S.L) + ' ma do odebrania, minus = ma do oddania.</div>' +
      '<div class="card mt"><div class="row between"><h2>Auta</h2><label class="row small"><input type="checkbox" data-all="car"> zaznacz wszystkie</label></div><div class="list">' +
      (b.cars.length ? b.cars.map(c => '<div class="it"><label class="row" style="gap:12px"><input type="checkbox" data-pick="car" value="' + c.row + '"' + (c.balL === undefined ? ' disabled' : '') + '><span class="meta">' + plate(c.plate) + '<span class="sub">' + chip(c.firm) + '<a href="#/auto/' + encodeURIComponent(c.plate) + '">' + esc(c.model) + '</a></span></span></label><div class="amt">' +
        (c.balL === undefined ? tag('uzupełnij, kto odebrał', 'amber') : '<b class="' + signCls(c.balL) + '">' + zl2(c.balL) + '</b><div class="small muted">zysk ' + zl(c.profit) + ' · odebrał ' + esc(c.receiver) + '</div>') + '</div></div>').join('') : '<div class="empty">Brak.</div>') + '</div></div>' +
      '<div class="card mt"><div class="row between"><h2>Koszty ogólne</h2><label class="row small"><input type="checkbox" data-all="gen"> zaznacz wszystkie</label></div><div class="list">' +
      (b.gen.length ? b.gen.map(g => { const v = g.net * ((g.who === S.L ? 1 : 0) - g.shareL); return '<div class="it"><label class="row" style="gap:12px"><input type="checkbox" data-pick="gen" value="' + g.row + '"><span class="meta"><b>' + esc(g.what) + '</b><span class="sub">' + date(g.date) + ' · ' + esc(g.who) + ' · ' + (g.type === 'Przychód' ? 'przychód ' : '') + zl2(g.amount) + '</span></span></label><div class="amt"><b class="' + signCls(v) + '">' + zl2(v) + '</b></div></div>'; }).join('') : '<div class="empty">Brak.</div>') + '</div></div>' +
      '<div class="row mt" style="justify-content:flex-end"><button class="btn primary" data-act="settle-picked">Oznacz zaznaczone jako rozliczone</button></div>';
  }

  // ---------------- formularze ----------------
  const today = () => Model.todayISO();
  const people = () => [Store.M.S.L, Store.M.S.M];

  function costForm(prePlate, pre = {}) {
    const M = Store.M, S = M.S;
    const plates = M.cars.slice().sort((a, b) => (a.status === 'Na stanie' ? 0 : 1) - (b.status === 'Na stanie' ? 0 : 1) || (b.bought || '').localeCompare(a.bought || ''));
    const dl = '<datalist id="dl-plates">' + plates.map(c => '<option value="' + esc(c.plate) + '">' + esc(c.model) + '</option>').join('') + '</datalist>';
    const body = dl + fields([
      { name: 'kind', label: 'Rodzaj', type: 'select', options: [['car', 'Koszt auta'], ['gen', 'Koszt ogólny (ZUS, podatki, OC placu…)'], ['inc', 'Przychód ogólny (sprzedaż kół, zwrot…)']], value: prePlate ? 'car' : 'car', full: true },
      { name: 'plate', label: 'Auto (nr rejestracyjny)', list: 'dl-plates', value: prePlate || '', full: true, placeholder: 'np. WE6N797' },
      { name: 'what', label: 'Za co', required: true, full: true, value: pre.what || '' },
      { name: 'amount', label: 'Kwota (zł)', inputmode: 'decimal', required: true, value: pre.amount || '' },
      { name: 'date', label: 'Data', type: 'date', value: today(), required: true },
      { name: 'who', label: 'Kto płacił / u kogo pieniądze', type: 'select', options: people(), value: pre.who || (Api.email && /micha/i.test(Api.email) ? S.M : S.L) },
      { name: 'catCar', label: 'Kategoria', type: 'select', options: S.carCats, value: S.carCats.find(x => /napraw/i.test(x)) || S.carCats[0] },
      { name: 'catGen', label: 'Kategoria', type: 'select', options: S.genCats, hidden: true },
      { name: 'firm', label: 'Firma', type: 'select', options: [['', 'wspólne / bez firmy'], 'LUKAR', 'NACAR'], hidden: true },
      { name: 'split', label: 'Podział', type: 'select', options: S.split, hidden: true },
      { name: 'doc', label: 'Dokument', type: 'select', options: [['', '—'], 'FV', 'paragon', 'umowa', 'brak'] },
      { name: 'note', label: 'Uwagi', full: true }
    ]);
    modal('Dodaj koszt', body, {
      onOpen(form) {
        const sync = () => {
          const k = form.kind.value, car = k === 'car';
          for (const n of ['plate', 'catCar']) form.querySelector('[data-f=' + n + ']').classList.toggle('hidden', !car);
          for (const n of ['catGen', 'firm', 'split']) form.querySelector('[data-f=' + n + ']').classList.toggle('hidden', car);
          form.plate.required = car;
          if (k === 'inc') { const o = [...form.catGen.options].find(o => /sprzeda/i.test(o.value)); if (o) form.catGen.value = o.value; }
        };
        form.kind.addEventListener('change', sync); sync();
      },
      async onSubmit(d) {
        const amount = parseAmt(d.amount);
        if (amount === null || amount < 0) throw new Error('Nieprawidłowa kwota.');
        if (d.kind === 'car') {
          const p = Model.plateKey(d.plate);
          if (!M.carByPlate[p]) throw new Error('Nie ma auta ' + p + ' w bazie. Dodaj je najpierw („+ Dodaj auto”).');
          const id = Model.nextId(M.costs, 'K');
          await save(() => Store.append('costs', [p, d.what, amount, d.date, d.who, d.catCar, d.doc, '', d.note, id]), 'Dodano koszt ' + zl2(amount) + ' do ' + p);
          if (pre.onSaved) pre.onSaved();
        } else {
          const id = Model.nextId(M.gen, 'G');
          await save(() => Store.append('general', [d.date, d.what, d.catGen, d.kind === 'inc' ? 'Przychód' : 'Koszt', amount, d.who, d.firm, d.split, d.doc, '', 'NIE', d.note, id, '']), 'Dodano ' + (d.kind === 'inc' ? 'przychód' : 'koszt ogólny') + ' ' + zl2(amount));
        }
      }
    });
  }

  function carForm() {
    const M = Store.M, S = M.S;
    modal('Nowe auto', fields([
      { name: 'plate', label: 'Nr rejestracyjny', required: true, placeholder: 'WE1234X' },
      { name: 'firm', label: 'Firma', type: 'select', options: ['LUKAR', 'NACAR'] },
      { name: 'model', label: 'Marka i model', required: true, full: true, placeholder: 'Hyundai i30 1.5 DPI 80 tys. km' },
      { name: 'year', label: 'Rok produkcji', inputmode: 'numeric' },
      { name: 'vin', label: 'VIN' },
      { name: 'bought', label: 'Data zakupu', type: 'date', value: today(), required: true },
      { name: 'buy', label: 'Cena zakupu (zł)', inputmode: 'decimal' },
      { name: 'who', label: 'Kto zapłacił za zakup', type: 'select', options: people() },
      { name: 'offer', label: 'Cena ofertowa (zł)', inputmode: 'decimal' },
      { name: 'oc', label: 'Termin OC', type: 'date' },
      { name: 'bt', label: 'Termin badania technicznego', type: 'date' }
    ]), {
      submitLabel: 'Dodaj auto',
      async onSubmit(d) {
        const p = Model.plateKey(d.plate);
        if (M.carByPlate[p]) throw new Error('Auto ' + p + ' już jest w bazie.');
        const buy = parseAmt(d.buy), offer = parseAmt(d.offer);
        await save(async () => {
          await Store.append('cars', [p, d.model, d.year, d.vin.toUpperCase(), d.firm, d.bought, 'Na stanie', offer ?? '', '', '', '', d.oc, d.bt, '', '', '', '']);
          if (buy) await Store.append('costs', [p, 'zakup', buy, d.bought, d.who, 'zakup', '', '', '', Model.nextId(M.costs, 'K')]);
        }, 'Dodano auto ' + p);
        location.hash = '#/auto/' + encodeURIComponent(p);
      }
    });
  }

  function sellForm(c) {
    const S = Store.M.S;
    modal('Sprzedaż ' + c.plate, fields([
      { name: 'sold', label: 'Data sprzedaży', type: 'date', value: today(), required: true },
      { name: 'price', label: 'Cena sprzedaży (zł)', inputmode: 'decimal', required: true, value: c.offer ?? '' },
      { name: 'receiver', label: 'Kto odebrał pieniądze', type: 'select', options: people(), full: true }
    ]) + '<p class="small muted">Zgłoszenie zbycia trzeba zrobić w ciągu ' + S.sellDays + ' dni – aplikacja przypomni o terminie.</p>', {
      submitLabel: 'Zapisz sprzedaż',
      async onSubmit(d) {
        const price = parseAmt(d.price);
        if (price === null) throw new Error('Podaj cenę sprzedaży.');
        await save(() => Store.set([{ key: 'cars', row: c.row, col: 6, values: ['Sprzedany'] }, { key: 'cars', row: c.row, col: 8, values: [d.sold, price, d.receiver] }, { key: 'cars', row: c.row, col: 15, values: ['NIE'] }]),
          'Zapisano sprzedaż ' + c.plate + ', zysk ' + zl(price - c.total));
      }
    });
  }

  function editForm(c) {
    const S = Store.M.S;
    const tn = v => v ? 'TAK' : 'NIE';
    modal('Edytuj ' + c.plate, fields([
      { name: 'model', label: 'Marka i model', value: c.model, full: true },
      { name: 'year', label: 'Rok produkcji', value: c.year },
      { name: 'vin', label: 'VIN', value: c.vin },
      { name: 'firm', label: 'Firma', type: 'select', options: S.firms, value: c.firm },
      { name: 'status', label: 'Status', type: 'select', options: S.statuses, value: c.status },
      { name: 'bought', label: 'Data zakupu', type: 'date', value: c.bought },
      { name: 'offer', label: 'Cena ofertowa (zł)', inputmode: 'decimal', value: c.offer ?? '' },
      { name: 'sold', label: 'Data sprzedaży', type: 'date', value: c.sold },
      { name: 'price', label: 'Cena sprzedaży (zł)', inputmode: 'decimal', value: c.price ?? '' },
      { name: 'receiver', label: 'Kto odebrał pieniądze', type: 'select', options: [''].concat(people()), value: c.receiver },
      { name: 'oc', label: 'Termin OC', type: 'date', value: c.oc },
      { name: 'bt', label: 'Termin badania technicznego', type: 'date', value: c.bt },
      { name: 'registered', label: 'Zarejestrowane?', type: 'select', options: ['NIE', 'TAK'], value: tn(c.registered) },
      { name: 'reported', label: 'Zbycie zgłoszone?', type: 'select', options: ['NIE', 'TAK'], value: tn(c.reported) },
      { name: 'settled', label: 'Rozliczone?', type: 'select', options: ['NIE', 'TAK'], value: tn(c.settled) },
      { name: 'note', label: 'Uwagi', type: 'textarea', value: c.note, full: true }
    ]), {
      async onSubmit(d) {
        const offer = parseAmt(d.offer), price = parseAmt(d.price);
        await save(() => Store.set([{ key: 'cars', row: c.row, col: 1, values: [d.model, d.year, d.vin.toUpperCase(), d.firm, d.bought, d.status, offer ?? '', d.sold, price ?? '', d.receiver, d.oc, d.bt, d.registered, d.reported, d.settled, d.note] }]), 'Zapisano ' + c.plate);
      }
    });
  }

  async function markSettled(carRows, genRows) {
    if (!carRows.length && !genRows.length) { toast('Nic nie zaznaczono.'); return; }
    modal('Rozliczenie', '<p>Oznaczyć jako rozliczone: <b>' + carRows.length + '</b> aut i <b>' + genRows.length + '</b> pozycji kosztów ogólnych?</p><p class="small muted">Zrób to dopiero po faktycznym przekazaniu pieniędzy.</p>', {
      submitLabel: 'Tak, rozliczone',
      onSubmit: () => save(() => Store.set(carRows.map(r => ({ key: 'cars', row: r, col: 15, values: ['TAK'] })).concat(genRows.map(r => ({ key: 'general', row: r, col: 10, values: ['TAK'] })))), 'Zapisano rozliczenie')
    });
  }

  // ---------------- zdarzenia ----------------
  document.addEventListener('click', async e => {
    const href = e.target.closest('[data-href]');
    if (href && !e.target.closest('a,button,input,label')) { location.hash = href.dataset.href; return; }
    const set = e.target.closest('[data-set]');
    if (set) { const [o, k] = set.dataset.set.split('.'); view[o === 'rep' ? 'rep' : o][k] = isNaN(set.dataset.v) || set.dataset.v === '' || k === 'month' ? set.dataset.v : Number(set.dataset.v); render(); return; }
    const all = e.target.closest('[data-all]');
    if (all) { document.querySelectorAll('[data-pick=' + all.dataset.all + ']:not(:disabled)').forEach(i => { i.checked = all.checked; }); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const M = Store.M, car = a.dataset.p ? M.carByPlate[a.dataset.p] : null;
    try {
      switch (a.dataset.act) {
        case 'new-cost': return costForm(a.dataset.p || (route().page === 'auto' ? route().arg : ''));
        case 'new-car': return carForm();
        case 'new-auction': return auctionForm(null);
        case 'edit-auction': return auctionForm(M.auctions.find(x => x.row === Number(a.dataset.row)));
        case 'del-auction': {
          const row = Number(a.dataset.row);
          document.querySelector('.modal-bg')?.remove();
          return save(() => Store.set([{ key: 'auctions', row, col: 8, values: ['NIE'] }]), 'Usunięto aukcję z kalendarza');
        }
        case 'sim-go': return document.getElementById('sim')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        case 'sim-add': { simOf(car).items.push({ what: '', amount: '', who: people()[0] }); saveSims(); render(); const ins = document.querySelectorAll('[data-sim=what]'); ins[ins.length - 1]?.focus(); return; }
        case 'sim-del': { simOf(car).items.splice(Number(a.dataset.i), 1); saveSims(); return render(); }
        case 'sim-reset': { delete sims[car.plate]; saveSims(); return render(); }
        case 'sim-offer': {
          const price = parseAmt(simOf(car).price);
          if (price === null) return toast('Wpisz cenę w symulacji.', true);
          return save(() => Store.set([{ key: 'cars', row: car.row, col: 7, values: [price] }]), 'Cena ofertowa ' + car.plate + ': ' + zl(price));
        }
        case 'sim-save': {
          const i = Number(a.dataset.i), it = simOf(car).items[i];
          if (!it || parseAmt(it.amount) === null) return toast('Uzupełnij kwotę tej pozycji.', true);
          return costForm(car.plate, { what: it.what, amount: it.amount, who: it.who, onSaved: () => { simOf(car).items.splice(i, 1); saveSims(); render(); } });
        }
        case 'sell': return sellForm(car);
        case 'edit-car': return editForm(car);
        case 'settle-car': return markSettled([car.row], []);
        case 'settle-picked': {
          const pick = k => [...document.querySelectorAll('[data-pick=' + k + ']:checked')].map(i => Number(i.value));
          return markSettled(pick('car'), pick('gen'));
        }
        case 'logout': Api.signOut(); Store.setMode(''); Store.M = null; Store.raw = null; return start();
        case 'login': return doLogin();
        case 'demo': Store.setMode('demo'); return boot();
      }
    } catch (err) { handleErr(err); }
  });
  function simInput(e) {
    const f = e.target.dataset && e.target.dataset.sim;
    if (!f) return false;
    const c = Store.M.carByPlate[Model.plateKey(route().arg)];
    if (!c) return true;
    const sim = simOf(c);
    if (e.target.dataset.i !== undefined) sim.items[Number(e.target.dataset.i)][f] = e.target.value; else sim[f] = e.target.value;
    saveSims();
    const box = document.getElementById('sim-res');
    if (box) box.innerHTML = simResult(c);
    return true;
  }
  document.addEventListener('input', e => {
    if (simInput(e)) return;
    const k = e.target.dataset && e.target.dataset.in;
    if (!k) return;
    const v = e.target.value;
    if (k === 'cars-q') { view.cars.q = v; const pos = e.target.selectionStart; render(); const i = document.querySelector('[data-in=cars-q]'); i.focus(); i.setSelectionRange(pos, pos); }
  });
  document.addEventListener('change', e => {
    if (simInput(e)) return;
    const k = e.target.dataset && e.target.dataset.in;
    if (!k || !e.target.value) return;
    if (k === 'costs-month') view.costs.month = e.target.value;
    if (k === 'rep-month') view.rep.month = e.target.value;
    if (k === 'rep-from') view.rep.from = e.target.value;
    if (k === 'rep-to') view.rep.to = e.target.value;
    render();
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  // ---------------- start ----------------
  function handleErr(err) {
    console.error(err);
    if (err && err.auth) { Store.M = null; loginScreen(err.message); }
    else toast(err.message || String(err), true);
  }
  window.addEventListener('unhandledrejection', ev => handleErr(ev.reason));

  function loginScreen(msg) {
    const noCfg = !CFG.CLIENT_ID;
    $app.innerHTML = '<div class="login"><div class="box"><div class="logos"><img src="lukar.svg" alt="LUKAR"><img src="nacar.svg" alt="NACAR"></div>' +
      '<h1>Komis</h1><p>Auta, koszty, zyski i rozliczenia LUKAR · NACAR.</p><div class="road"></div>' +
      (msg ? '<p class="neg small">' + esc(msg) + '</p>' : '') +
      (noCfg ? '<p class="small">Logowanie nie jest jeszcze skonfigurowane (brak CLIENT_ID w <code>js/config.js</code>).</p>' : '<button class="btn primary" style="width:100%;height:46px;justify-content:center" data-act="login">Zaloguj kontem Google</button>') +
      '<button class="btn ' + (noCfg ? 'primary' : 'ghost') + '" style="width:100%;height:42px;justify-content:center;margin-top:10px" data-act="demo">Zobacz na przykładowych danych</button></div></div>';
  }

  async function doLogin() {
    try { await Api.signIn(); Store.setMode('live'); await boot(); }
    catch (err) { loginScreen(err.message); }
  }

  async function boot() {
    $app.innerHTML = '<div class="loading"><div class="spin"></div>Wczytuję dane…</div>';
    try { await Store.load(); render(); }
    catch (err) { handleErr(err); if (!err.auth) loginScreen(err.message); }
  }

  function start() {
    if (window.KOMIS_PREVIEW && !Store.mode) Store.setMode('demo');
    if (Store.mode === 'demo') return boot();
    if (Store.mode === 'live' && Api.isSignedIn()) return boot();
    loginScreen();
  }

  window.KomisApp = { Store, render, view };
  start();
})();
