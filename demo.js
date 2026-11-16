// Przykładowe (zmyślone) dane do trybu demo – nie mają nic wspólnego z prawdziwą bazą.
window.Demo = (() => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  const serial = iso => Math.round(Date.parse(iso + 'T00:00:00Z') / 86400000) + 25569;
  const iso = d => d.toISOString().slice(0, 10);
  const addD = (s, n) => iso(new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000));
  const L = 'Łukasz', M = 'Michał';

  function make() {
    seed = 7;
    const models = [['Hyundai i30 1.5 DPI', 52000], ['Kia Ceed SW 1.5 T-GDI', 58000], ['Renault Clio 0.9 TCe', 34000], ['Skoda Octavia 2.0 TDI', 62000], ['VW Passat 2.0 TDI', 64000], ['Skoda Fabia 1.0 TSI', 33000], ['Kia Rio 1.2', 36000], ['Toyota Corolla 1.6', 49000]];
    const sources = ['Athlon', 'Carklik', 'Arval', 'aukcja', 'skup'];
    const regs = ['WE', 'WW', 'KR', 'KK', 'DW', 'WN', 'WZ', 'GD', 'KRA', 'WD'];
    const now = new Date(); const today = iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
    const cars = [], costs = [], general = [];
    let k = 1;
    const used = new Set();
    for (let i = 0; i < 150; i++) {
      let plate;
      do { const r = pick(regs); plate = r + (r.length === 3 ? int(100, 999) + pick('ABCDEFGHJK') + int(1, 9) : int(1000, 9999) + pick('ABCEGKMNPRSTWXY')); } while (used.has(plate));
      used.add(plate);
      const [model, base] = pick(models);
      const bought = addD(today, -int(5, 520));
      const age = Math.round((Date.parse(today) - Date.parse(bought)) / 86400000);
      const firm = rnd() < 0.5 ? 'LUKAR' : 'NACAR';
      const buyPrice = Math.round(base * (0.78 + rnd() * 0.08) / 100) * 100;
      const payer = firm === 'LUKAR' ? (rnd() < 0.8 ? L : M) : (rnd() < 0.8 ? M : L);
      const isSold = age > 18 && rnd() < 0.93;
      const days = int(8, 75);
      const sold = isSold ? addD(bought, Math.min(days, age - 1)) : '';
      const price = isSold ? Math.round(base * (0.92 + rnd() * 0.12) / 100) * 100 : '';
      const settled = isSold && Math.round((Date.parse(today) - Date.parse(sold)) / 86400000) > 12;
      const status = isSold ? 'Sprzedany' : 'Na stanie';
      cars.push([plate, model + ' ' + int(30, 180) + ' tys. km ' + pick(sources), int(2018, 2023), 'TMAH' + int(1e12, 9e12), firm, serial(bought), status,
        isSold ? '' : Math.round(base / 100) * 100, sold ? serial(sold) : '', price, isSold ? pick([L, M]) : '',
        isSold ? '' : serial(addD(today, int(-3, 200))), isSold ? '' : serial(addD(today, int(5, 300))),
        (isSold || age > 40) ? 'TAK' : '', (isSold && settled) ? 'TAK' : '', isSold ? (settled ? 'TAK' : 'NIE') : '', '']);
      const add = (what, amt, who, cat, off) => costs.push([plate, what, amt, serial(addD(bought, off)), who, cat, rnd() < 0.6 ? 'FV' : '', '', '', 'K' + String(k++).padStart(4, '0')]);
      add('zakup', buyPrice, payer, 'zakup', 0);
      add('transport', int(3, 9) * 100, pick([L, M]), 'transport', 1);
      if (rnd() < 0.6) add(pick(['wymiana klocków', 'serwis olejowy', 'naprawa zawieszenia', 'opony']), int(4, 30) * 100, pick([L, M]), 'naprawa / serwis', int(2, 6));
      if (rnd() < 0.4) add('lakierowanie zderzaka', int(6, 14) * 100, pick([L, M]), 'lakierowanie', int(3, 8));
      add('przygotowanie', int(2, 5) * 100, pick([L, M]), 'przygotowanie / sprzątanie', int(3, 9));
      if (rnd() < 0.5) add('ogłoszenie', int(1, 3) * 100, pick([L, M]), 'ogłoszenie / reklama', int(4, 10));
    }
    // koszty ogólne – co miesiąc przez ostatnie 18 miesięcy
    let g = 1;
    const gadd = (d, what, cat, typ, amt, who, firm, settled) => general.push([serial(d), what, cat, typ, amt, who, firm, '50/50', '', '', settled ? 'TAK' : 'NIE', '', 'G' + String(g++).padStart(4, '0'), '']);
    for (let m = 17; m >= 0; m--) {
      const d0 = new Date(Date.UTC(now.getFullYear(), now.getMonth() - m, 1));
      const d = n => iso(new Date(d0.getTime() + n * 86400000));
      const settled = m > 0;
      gadd(d(14), 'ZUS LUKAR', 'ZUS', 'Koszt', 2650 + int(0, 300), L, 'LUKAR', settled);
      gadd(d(14), 'ZUS NACAR', 'ZUS', 'Koszt', 2580 + int(0, 300), M, 'NACAR', settled);
      gadd(d(19), 'VAT7 LUKAR', 'Podatki (VAT / PIT)', 'Koszt', int(15, 60) * 100, L, 'LUKAR', settled);
      gadd(d(19), 'VAT7 NACAR', 'Podatki (VAT / PIT)', 'Koszt', int(10, 50) * 100, M, 'NACAR', settled);
      gadd(d(4), 'Reklama online', 'Reklama i ogłoszenia', 'Koszt', 2853.6, L, '', settled);
      gadd(d(8), 'Odsetki kredytu NACAR', 'Odsetki i opłaty bankowe', 'Koszt', int(300, 900), M, 'NACAR', settled);
      gadd(d(10), 'OC komisowe', 'Ubezpieczenia (OC komisowe, plac)', 'Koszt', int(150, 450), pick([L, M]), '', settled);
      if (rnd() < 0.5) gadd(d(12), 'Materiały (pady, kwas, ramki)', 'Materiały i narzędzia', 'Koszt', int(100, 800), pick([L, M]), '', settled);
      if (rnd() < 0.4) gadd(d(16), 'Sprzedaż kół zimowych', 'Sprzedaż kół / opon / części', 'Przychód', int(4, 15) * 100, pick([L, M]), '', settled);
    }
    const settings = [['Ustawienie', 'Wartość'], ['Wspólnik 1', L], ['Wspólnik 2', M], ['Udział', 0.5], ['Dni na rejestrację', 90], ['Dni na zbycie', 30], [], ['Statusy aut', 'Kategorie kosztów', 'Firmy', 'Kategorie kosztów ogólnych'],
      ['Aukcja', 'zakup', 'NACAR', 'ZUS'], ['Na stanie', 'transport', 'LUKAR', 'Podatki (VAT / PIT)'], ['Sprzedany', 'naprawa / serwis', 'LUKAR/NACAR', 'Odsetki i opłaty bankowe'], ['Prywatny', 'lakierowanie', '', 'Ubezpieczenia (OC komisowe, plac)'],
      ['', 'przygotowanie / sprzątanie', '', 'Reklama i ogłoszenia'], ['', 'ubezpieczenie', '', 'Materiały i narzędzia'], ['', 'przegląd', '', 'Paliwo / dojazdy'], ['', 'ogłoszenie / reklama', '', 'Sprzedaż kół / opon / części'], ['', 'paliwo / dojazdy', '', 'Zwroty (naprawy, polisy, inne)'], ['', 'prowizja', '', 'Inne'], ['', 'inne']];
    cars.sort((a, b) => b[5] - a[5]);
    return { cars, costs, general, settings };
  }
  return { make };
})();
