// Logowanie Google (Google Identity Services) i dostęp do Google Sheets REST API.
window.Api = (() => {
  const CFG = window.KOMIS_CONFIG;
  const SCOPES = 'openid email https://www.googleapis.com/auth/spreadsheets';
  const BASE = 'https://sheets.googleapis.com/v4/spreadsheets/';
  const KEY = 'komis.token';
  let token = null, exp = 0, email = null, tokenClient = null;

  class AuthError extends Error { constructor(m) { super(m || 'Sesja wygasła – zaloguj się ponownie.'); this.auth = true; } }

  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (s && s.exp > Date.now()) { token = s.token; exp = s.exp; email = s.email; }
  } catch (e) { /* brak dostępu do sessionStorage */ }

  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify({ token, exp, email })); } catch (e) {}
  }

  function loadGis() {
    return new Promise((res, rej) => {
      if (window.google && google.accounts && google.accounts.oauth2) return res();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => res();
      s.onerror = () => rej(new Error('Nie udało się wczytać logowania Google. Sprawdź połączenie z internetem.'));
      document.head.appendChild(s);
    });
  }

  async function signIn() {
    if (!CFG.CLIENT_ID) throw new Error('Brak CLIENT_ID w pliku js/config.js.');
    await loadGis();
    const r = await new Promise((res, rej) => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CFG.CLIENT_ID,
        scope: SCOPES,
        hint: email || undefined,
        callback: (resp) => resp.error ? rej(new Error('Logowanie przerwane: ' + resp.error)) : res(resp),
        error_callback: (e) => rej(new Error(e && e.type === 'popup_closed' ? 'Zamknięto okno logowania.' : 'Nie udało się otworzyć okna logowania (sprawdź blokadę wyskakujących okien).'))
      });
      tokenClient.requestAccessToken({ prompt: '' });
    });
    token = r.access_token;
    exp = Date.now() + (Number(r.expires_in || 3600) - 120) * 1000;
    const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token } }).then(x => x.json()).catch(() => ({}));
    email = (u.email || '').toLowerCase();
    if (CFG.ALLOWED_EMAILS.length && !CFG.ALLOWED_EMAILS.map(x => x.toLowerCase()).includes(email)) {
      signOut();
      throw new Error('Konto ' + email + ' nie ma dostępu do tej aplikacji.');
    }
    save();
    return email;
  }

  function signOut() {
    if (token && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(token, () => {});
    token = null; exp = 0;
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  const isSignedIn = () => !!token && Date.now() < exp;

  async function req(path, opts = {}) {
    if (!isSignedIn()) throw new AuthError();
    const r = await fetch(BASE + CFG.SPREADSHEET_ID + path, {
      ...opts,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    if (r.status === 401) { token = null; throw new AuthError(); }
    if (!r.ok) {
      let msg = '';
      try { msg = (await r.json()).error.message; } catch (e) {}
      if (r.status === 403) throw new Error('Brak dostępu do arkusza dla tego konta. ' + msg);
      throw new Error('Błąd Google Sheets (' + r.status + '). ' + msg);
    }
    return r.json();
  }

  // Tekst zaczynający się od = + - @ zapisujemy jako tekst, nie formułę.
  const safe = v => (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : (v === undefined || v === null ? '' : v);

  return {
    AuthError,
    signIn, signOut, isSignedIn,
    get email() { return email; },
    batchGet(ranges) {
      const q = ranges.map(r => 'ranges=' + encodeURIComponent(r)).join('&');
      return req('/values:batchGet?' + q + '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER');
    },
    append(range, rows) {
      return req('/values/' + encodeURIComponent(range) + ':append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE',
        { method: 'POST', body: JSON.stringify({ values: rows.map(r => r.map(safe)) }) });
    },
    update(data) { // data: [{range, values}]
      return req('/values:batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: data.map(d => ({ range: d.range, values: d.values.map(r => r.map(safe)) })) })
      });
    }
  };
})();
