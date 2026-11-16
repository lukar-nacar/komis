// Model danych: zamienia wiersze arkusza na obiekty i liczy koszty, zyski, salda i terminy.
window.Model = (() => {
  const DAY = 86400000;
  const RANGES = ["Auta!A2:Q", "Koszty!A2:J", "'Koszty ogólne'!A2:N", "Ustawienia!A1:F40"];

  // --- daty: w arkuszu numer seryjny (dni od 1899-12-30) albo tekst ---
  function toISO(v) {
    if (v === '' || v === null || v === undefined) return '';
    if (typeof v === 'number') {
      const d = new Date(Math.round((v - 25569) * DAY));
      return d.toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return '';
  }
  const ms = iso => iso ? Date.parse(iso + 'T00:00:00Z') : NaN;
  const addDays = (iso, n) => iso ? new Date(ms(iso) + n * DAY).toISOString().slice(0, 10) : '';
  const todayISO = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY);

  function num(v) {
    if (typeof v === 'number') return v;
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(String(v).replace(/\s|zł/g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  const str = v => (v === null || v === undefined) ? '' : String(v).trim();
  const plateKey = v => str(v).toUpperCase().replace(/\s+/g, '');
  const yes = v => str(v).toUpperCase() === 'TAK';

  function parseSettings(rows) {
    const cell = (r, c) => str((rows[r - 1] || [])[c]);
    const col = (c) => rows.slice(8).map(r => str(r[c])).filter(Boolean);
    let share = num((rows[3] || [])[1]);
    if (share === null) share = 0.5;
    if (share > 1) share = share / 100;
    return {
      L: cell(2, 1) || 'Łukasz',
      M: cell(3, 1) || 'Michał',
      share,
      regDays: num(cell(5, 1)) || 90,
      sellDays: num(cell(6, 1)) || 30,
      statuses: col(0).length ? col(0) : ['Aukcja', 'Na stanie', 'Sprzedany', 'Prywatny'],
      carCats: col(1).length ? col(1) : ['zakup', 'transport', 'naprawa / serwis', 'inne'],
      firms: col(2).length ? col(2) : ['LUKAR', 'NACAR'],
      genCats: col(3).length ? col(3) : ['ZUS', 'Podatki (VAT / PIT)', 'Inne'],
      split: ['50/50', 'tylko ' + (cell(2, 1) || 'Łukasz'), 'tylko ' + (cell(3, 1) || 'Michał')]
    };
  }

  function build(raw) {
    const S = parseSettings(raw.settings || []);
    const today = todayISO();

    const costs = (raw.costs || []).map((r, i) => ({
      row: i + 2, plate: plateKey(r[0]), what: str(r[1]), amount: num(r[2]) || 0, date: toISO(r[3]),
      who: str(r[4]), cat: str(r[5]), doc: str(r[6]), acc: str(r[7]), note: str(r[8]), id: str(r[9])
    })).filter(c => c.plate || c.amount);

    const gen = (raw.general || []).map((r, i) => {
      const type = str(r[3]) || 'Koszt';
      const amount = num(r[4]) || 0;
      const split = str(r[7]) || '50/50';
      const shareL = split === S.split[1] ? 1 : split === S.split[2] ? 0 : S.share;
      return {
        row: i + 2, date: toISO(r[0]), what: str(r[1]), cat: str(r[2]), type, amount, who: str(r[5]), firm: str(r[6]),
        split, doc: str(r[8]), acc: str(r[9]), settled: yes(r[10]), note: str(r[11]), id: str(r[12]),
        net: type === 'Przychód' ? -amount : amount, shareL
      };
    }).filter(g => g.what || g.amount);

    const byPlate = {};
    for (const c of costs) (byPlate[c.plate] = byPlate[c.plate] || []).push(c);

    const cars = (raw.cars || []).map((r, i) => {
      const plate = plateKey(r[0]);
      if (!plate) return null;
      const list = (byPlate[plate] || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const total = list.reduce((s, c) => s + c.amount, 0);
      const paidL = list.filter(c => c.who === S.L).reduce((s, c) => s + c.amount, 0);
      const paidM = list.filter(c => c.who === S.M).reduce((s, c) => s + c.amount, 0);
      const car = {
        row: i + 2, plate, model: str(r[1]), year: str(r[2]), vin: str(r[3]), firm: str(r[4]),
        bought: toISO(r[5]), status: str(r[6]) || 'Na stanie', offer: num(r[7]), sold: toISO(r[8]), price: num(r[9]),
        receiver: str(r[10]), oc: toISO(r[11]), bt: toISO(r[12]), registered: yes(r[13]), reported: yes(r[14]),
        settled: yes(r[15]), note: str(r[16]),
        costs: list, total, paidL, paidM, unknownPaid: total - paidL - paidM
      };
      car.profit = car.price !== null ? car.price - total : null;
      if (car.profit !== null) {
        car.dueL = paidL + car.profit * S.share;
        car.dueM = paidM + car.profit * (1 - S.share);
        if (car.receiver) {
          car.balL = car.dueL - (car.receiver === S.L ? car.price : 0);
          car.balM = car.dueM - (car.receiver === S.M ? car.price : 0);
        }
      }
      car.expected = car.offer !== null ? car.offer - total : null;
      car.daysStock = car.bought ? daysBetween(car.bought, car.sold || today) : null;
      car.regDue = car.bought && !car.registered ? addDays(car.bought, S.regDays) : '';
      car.repDue = car.sold && !car.reported ? addDays(car.sold, S.sellDays) : '';
      return car;
    }).filter(Boolean);

    const carByPlate = {};
    for (const c of cars) carByPlate[c.plate] = c;
    const orphanCosts = costs.filter(c => c.plate && !carByPlate[c.plate]);

    // --- terminy i alarmy ---
    const alerts = [];
    const pushDl = (car, kind, due) => {
      if (!due) return;
      const left = daysBetween(today, due);
      if (left > 30) return;
      alerts.push({ car, kind, due, left, level: left <= 14 ? 'red' : 'amber' });
    };
    for (const c of cars) {
      if (c.status === 'Prywatny') continue;
      if (c.status === 'Na stanie' || c.status === 'Aukcja') {
        pushDl(c, 'Rejestracja', c.regDue);
        pushDl(c, 'OC', c.oc);
        pushDl(c, 'Badanie techniczne', c.bt);
      }
      if (c.status === 'Sprzedany') pushDl(c, 'Zgłoszenie zbycia', c.repDue);
    }
    alerts.sort((a, b) => a.left - b.left);

    const issues = [];
    for (const c of cars) {
      if (c.status === 'Prywatny') continue;
      if (c.status === 'Sprzedany' && !c.settled) {
        if (!c.sold) issues.push({ car: c, text: 'brak daty sprzedaży' });
        if (c.price === null) issues.push({ car: c, text: 'brak ceny sprzedaży' });
        if (!c.receiver) issues.push({ car: c, text: 'nie wpisano, kto odebrał pieniądze' });
      }
      if (c.status === 'Na stanie' && !c.vin) issues.push({ car: c, text: 'brak VIN' });
      if (c.unknownPaid > 0.005 && !c.settled) issues.push({ car: c, text: 'koszt bez płatnika' });
    }

    return { S, cars, costs, gen, carByPlate, orphanCosts, alerts, issues, today };
  }

  // --- raporty ---
  function inRange(iso, from, to) { return iso && iso >= from && iso <= to; }

  function report(M, from, to) {
    const S = M.S;
    const sold = M.cars.filter(c => c.status !== 'Prywatny' && c.profit !== null && inRange(c.sold, from, to));
    const g = M.gen.filter(x => inRange(x.date, from, to));
    const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
    const carProfit = sum(sold, c => c.profit);
    const genNet = sum(g, x => x.net);
    const genL = sum(g, x => x.net * x.shareL);
    const r = {
      count: sold.length,
      revenue: sum(sold, c => c.price),
      carCosts: sum(sold, c => c.total),
      carProfit, genNet, genCost: sum(g.filter(x => x.type !== 'Przychód'), x => x.amount), genIncome: sum(g.filter(x => x.type === 'Przychód'), x => x.amount),
      net: carProfit - genNet,
      L: carProfit * S.share - genL,
      M: carProfit * (1 - S.share) - (genNet - genL),
      avg: sold.length ? carProfit / sold.length : 0,
      avgDays: (() => { const d = sold.filter(c => c.bought && c.sold).map(c => daysBetween(c.bought, c.sold)).filter(x => x >= 0); return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null; })(),
      sold, gen: g
    };
    r.byFirm = ['LUKAR', 'NACAR'].map(f => {
      const s = sold.filter(c => c.firm === f);
      const gg = g.filter(x => x.firm === f);
      return { firm: f, count: s.length, profit: sum(s, c => c.profit), gen: sum(gg, x => x.net) };
    });
    r.genShared = sum(g.filter(x => x.firm !== 'LUKAR' && x.firm !== 'NACAR'), x => x.net);
    const cats = {};
    for (const x of g) cats[x.cat || 'Inne'] = (cats[x.cat || 'Inne'] || 0) + x.net;
    r.genByCat = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    r.best = sold.slice().sort((a, b) => b.profit - a.profit).slice(0, 5);
    r.worst = sold.slice().sort((a, b) => a.profit - b.profit).slice(0, 5);
    return r;
  }

  function months(M, year) {
    const out = [];
    for (let m = 1; m <= 12; m++) {
      const from = year + '-' + String(m).padStart(2, '0') + '-01';
      const to = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
      out.push({ m, from, to, ...report(M, from, to) });
    }
    return out;
  }

  function balances(M) {
    const S = M.S;
    const cars = M.cars.filter(c => c.status === 'Sprzedany' && !c.settled);
    const gen = M.gen.filter(g => !g.settled);
    const carL = cars.reduce((s, c) => s + (c.balL || 0), 0);
    const genL = gen.reduce((s, g) => s + g.net * ((g.who === S.L ? 1 : 0) - g.shareL), 0);
    return { cars, gen, carL, genL, totalL: carL + genL, missing: cars.filter(c => c.balL === undefined) };
  }

  function stock(M) {
    const cars = M.cars.filter(c => c.status === 'Na stanie' || c.status === 'Aukcja');
    return {
      cars,
      total: cars.reduce((s, c) => s + c.total, 0),
      L: cars.reduce((s, c) => s + c.paidL, 0),
      M: cars.reduce((s, c) => s + c.paidM, 0),
      old: cars.filter(c => (c.daysStock || 0) > 60).length
    };
  }

  const nextId = (list, prefix) => {
    let max = 0;
    for (const x of list) { const m = (x.id || '').match(/^\D*(\d+)$/); if (m) max = Math.max(max, Number(m[1])); }
    return prefix + String(max + 1).padStart(4, '0');
  };

  return { RANGES, build, report, months, balances, stock, nextId, toISO, todayISO, addDays, daysBetween, plateKey };
})();
