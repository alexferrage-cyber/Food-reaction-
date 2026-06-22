/* Crew Day Briefing - Vanilla JS, GitHub Pages compatible */
'use strict';

const DEFAULT_SETTINGS = {
  googleClientId: '741230543983-gs16l5qp9mmmj6peoch347vahj5oq6sc.apps.googleusercontent.com',
  calendarId: 'primary',
  homeLeadMinutes: 120,
  shuttleLeadMinutes: 55,
  shortTtmMinutes: 55,
  homeBase: 'CDG',
  weatherProxyUrl: '',
  flightKeywords: ['AF', 'flight', 'vol', 'crew', 'duty', 'report', 'dep', 'arr', 'MLR']
};

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
let settings = loadSettings();
let tokenClient = null;
let googleAccessToken = '';
let currentPlan = null;

const IATA_TO_ICAO = {
  CDG: 'LFPG', ORY: 'LFPO', BOD: 'LFBD', MUC: 'EDDM', AMS: 'EHAM', LIS: 'LPPT', NCE: 'LFMN', TLS: 'LFBO', LYS: 'LFLL', MRS: 'LFML', MPL: 'LFMT', NTE: 'LFRS', RNS: 'LFRN', BES: 'LFRB', BIQ: 'LFBZ', PUF: 'LFBP', BIA: 'LFKB', AJA: 'LFKJ', CLY: 'LFKC', FSC: 'LFKF', SXB: 'LFST', LIL: 'LFQQ', CFR: 'LFRK', RAK: 'GMMX', CMN: 'GMMN', TUN: 'DTTA', ALG: 'DAAG', BCN: 'LEBL', MAD: 'LEMD', OPO: 'LPPR', FCO: 'LIRF', MXP: 'LIMC', LIN: 'LIML', VCE: 'LIPZ', FLR: 'LIRQ', NAP: 'LIRN', ATH: 'LGAV', IST: 'LTFM', LHR: 'EGLL', LGW: 'EGKK', LCY: 'EGLC', MAN: 'EGCC', DUB: 'EIDW', GVA: 'LSGG', ZRH: 'LSZH', BRU: 'EBBR', FRA: 'EDDF', HAM: 'EDDH', BER: 'EDDB', DUS: 'EDDL', STR: 'EDDS', CPH: 'EKCH', OSL: 'ENGM', ARN: 'ESSA', HEL: 'EFHK', WAW: 'EPWA', PRG: 'LKPR', VIE: 'LOWW', BUD: 'LHBP', OTP: 'LROP', BEG: 'LYBE', SOF: 'LBSF', CAI: 'HECA', TLV: 'LLBG', DXB: 'OMDB', JFK: 'KJFK', EWR: 'KEWR', BOS: 'KBOS', IAD: 'KIAD', ATL: 'KATL', LAX: 'KLAX', SFO: 'KSFO', YUL: 'CYUL', YYZ: 'CYYZ'
};

const $ = (id) => document.getElementById(id);

window.addEventListener('DOMContentLoaded', () => {
  initialiseUi();
  bindEvents();
  updateStatus('Prêt. Connecte Google Calendar, puis charge une date.');
});

function initialiseUi() {
  const today = new Date();
  $('dateInput').value = formatDateInput(today);
  $('calendarIdInput').value = settings.calendarId;
  fillSettingsDialog();
}

function bindEvents() {
  $('openSettingsBtn').addEventListener('click', () => $('settingsDialog').showModal());
  $('saveSettingsBtn').addEventListener('click', saveSettingsFromDialog);
  $('clearLocalBtn').addEventListener('click', clearLocalData);
  $('connectBtn').addEventListener('click', connectGoogleCalendar);
  $('loadBtn').addEventListener('click', loadSelectedDayFromGoogle);
  $('parseManualBtn').addEventListener('click', parseManualText);
  $('localSummaryBtn').addEventListener('click', () => renderBrief(generateLocalBriefing(currentPlan)));
  $('refreshWeatherBtn').addEventListener('click', refreshWeather);
  $('calendarIdInput').addEventListener('change', (e) => {
    settings.calendarId = e.target.value.trim() || 'primary';
    saveSettings(settings);
  });
}

function fillSettingsDialog() {
  $('googleClientIdInput').value = settings.googleClientId || '';
  $('homeLeadInput').value = settings.homeLeadMinutes;
  $('shuttleLeadInput').value = settings.shuttleLeadMinutes;
  $('shortTtmInput').value = settings.shortTtmMinutes;
  $('homeBaseInput').value = settings.homeBase;
  if ($('weatherProxyUrlInput')) $('weatherProxyUrlInput').value = settings.weatherProxyUrl || '';
  $('flightKeywordsInput').value = settings.flightKeywords.join(', ');
}

function saveSettingsFromDialog() {
  settings = {
    googleClientId: $('googleClientIdInput').value.trim(),
    calendarId: $('calendarIdInput').value.trim() || 'primary',
    homeLeadMinutes: Number($('homeLeadInput').value) || DEFAULT_SETTINGS.homeLeadMinutes,
    shuttleLeadMinutes: Number($('shuttleLeadInput').value) || DEFAULT_SETTINGS.shuttleLeadMinutes,
    shortTtmMinutes: Number($('shortTtmInput').value) || DEFAULT_SETTINGS.shortTtmMinutes,
    homeBase: ($('homeBaseInput').value.trim() || 'CDG').toUpperCase(),
    weatherProxyUrl: $('weatherProxyUrlInput') ? $('weatherProxyUrlInput').value.trim().replace(/\/$/, '') : '',
    flightKeywords: $('flightKeywordsInput').value.split(',').map(s => s.trim()).filter(Boolean)
  };
  saveSettings(settings);
  $('calendarIdInput').value = settings.calendarId;
  $('settingsDialog').close();
  updateStatus('Paramètres enregistrés.');
}

function clearLocalData() {
  if (!confirm('Effacer les paramètres locaux ? Le briefing en cours sera aussi vidé de cette session.')) return;
  localStorage.removeItem('crewDayBriefingSettings');
  settings = { ...DEFAULT_SETTINGS };
  currentPlan = null;
  googleAccessToken = '';
  fillSettingsDialog();
  renderPlan(null);
  updateStatus('Données locales effacées.');
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('crewDayBriefingSettings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(value) {
  localStorage.setItem('crewDayBriefingSettings', JSON.stringify(value));
}

function updateStatus(message, type = 'info') {
  const el = $('status');
  el.textContent = message;
  el.dataset.type = type;
}

function connectGoogleCalendar() {
  if (!settings.googleClientId) {
    updateStatus('Client ID Google manquant. Ouvre Paramètres.', 'warn');
    $('settingsDialog').showModal();
    return;
  }
  if (!window.google?.accounts?.oauth2) {
    updateStatus('La librairie Google Identity Services n’est pas encore chargée. Réessaie dans quelques secondes.', 'warn');
    return;
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: settings.googleClientId,
    scope: GOOGLE_SCOPE,
    prompt: 'consent',
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        updateStatus(`Erreur OAuth Google : ${tokenResponse.error}`, 'bad');
        return;
      }
      googleAccessToken = tokenResponse.access_token;
      updateStatus('Google Calendar connecté en lecture seule.');
      loadSelectedDayFromGoogle();
    }
  });
  tokenClient.requestAccessToken();
}

async function loadSelectedDayFromGoogle() {
  if (!googleAccessToken) {
    if (tokenClient) tokenClient.requestAccessToken({ prompt: '' });
    else connectGoogleCalendar();
    return;
  }
  const date = parseDateInput($('dateInput').value);
  const timeMin = startOfDay(date);
  const timeMax = addHours(addDays(startOfDay(date), 1), 6); // garde les fins de journée et découchers tardifs
  const calendarId = encodeURIComponent(settings.calendarId || 'primary');
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('timeMax', timeMax.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '80');

  updateStatus('Chargement Google Calendar…');
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${googleAccessToken}` } });
    if (!res.ok) {
      const details = await readGoogleError(res);
      if (res.status === 401) googleAccessToken = '';
      throw new Error(details);
    }
    const data = await res.json();
    const events = data.items || [];
    const plan = buildDayPlan(events, date);
    renderPlan(plan);
    updateStatus(`${events.length} événement(s) lus, ${plan.sectors.length} vol(s) détecté(s).`);
  } catch (err) {
    updateStatus(err.message, 'bad');
  }
}


async function readGoogleError(res) {
  let body = '';
  try { body = await res.text(); } catch { body = ''; }
  let message = body;
  let reason = '';
  try {
    const json = JSON.parse(body);
    message = json?.error?.message || body;
    reason = json?.error?.errors?.[0]?.reason || json?.error?.status || '';
  } catch { /* keep text body */ }

  const lower = `${message} ${reason}`.toLowerCase();
  if (res.status === 401) {
    return 'Autorisation Google expirée. Clique de nouveau sur « Connecter Google Calendar ».';
  }
  if (res.status === 403 && /disabled|not been used|accessnotconfigured|api has not been used/.test(lower)) {
    return 'Google Calendar API non activée dans ce projet Google Cloud. Va dans APIs & Services > Library > Google Calendar API > Enable, attends 2 minutes, puis reconnecte.';
  }
  if (res.status === 403 && /insufficient|scope|permission/.test(lower)) {
    return 'Droits insuffisants pour lire Google Calendar. Vérifie le scope calendar.events.readonly dans Google Cloud, ajoute ton Gmail dans Test users, puis reconnecte en acceptant le consentement.';
  }
  if (res.status === 403 && /not found|forbidden/.test(lower)) {
    return `Accès refusé à l’agenda « ${settings.calendarId || 'primary'} ». Vérifie Calendar ID, Test users et autorisation OAuth. Détail Google : ${message}`;
  }
  return `Google Calendar HTTP ${res.status}${reason ? ` / ${reason}` : ''} : ${message}`;
}

function parseManualText() {
  const text = $('manualInput').value.trim();
  if (!text) return updateStatus('Colle au moins un événement ou une rotation.', 'warn');

  const blocks = splitManualBlocks(text);
  const now = parseDateInput($('dateInput').value);
  const events = blocks.map((block, idx) => manualBlockToCalendarEvent(block, idx, now));
  const plan = buildDayPlan(events, now);
  renderPlan(plan);
  updateStatus(`${blocks.length} bloc(s) analysé(s), ${plan.sectors.length} vol(s) détecté(s).`);
}

function splitManualBlocks(text) {
  const normalized = text.replace(/\r/g, '').trim();
  const parts = normalized.split(/\n\s*\n(?=(?:AF|TO|KL|DL|A5|MLR|[A-Z]{2}\d{2,4}|Départ|Arrivée))/gi).map(p => p.trim()).filter(Boolean);
  return parts.length ? parts : [normalized];
}

function manualBlockToCalendarEvent(block, idx, baseDate) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] || `Événement ${idx + 1}`;
  const start = inferStartFromText(block, baseDate) || addHours(startOfDay(baseDate), 12 + idx);
  const end = inferEndFromText(block, baseDate) || addMinutes(start, 90);
  return {
    id: `manual-${idx}`,
    summary: firstLine,
    description: lines.slice(1).join('\n'),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() }
  };
}

function buildDayPlan(events, selectedDate) {
  const parsed = events.map(parseCalendarEvent).filter(Boolean);
  const sectors = parsed.filter(e => e.kind === 'sector').sort((a, b) => a.start - b.start);
  const rotations = parsed.filter(e => e.kind === 'rotation');
  const ignored = events.filter(ev => !parsed.find(p => p.sourceId === ev.id));
  const rotation = rotations[0] || null;
  const calculations = calculateDay(sectors, rotation);
  const weather = {};
  const plan = { selectedDate, sectors, rotation, rotations, ignored, calculations, weather, rawCount: events.length };
  plan.alerts = buildAlerts(plan);
  currentPlan = plan;
  return plan;
}

function parseCalendarEvent(event) {
  const summary = normalizeText(event.summary || '');
  const description = normalizeText(htmlToText(event.description || ''));
  const fullText = `${summary}\n${description}`;
  const sourceStart = parseEventDate(event.start);
  const sourceEnd = parseEventDate(event.end);

  if (isFlightEvent(summary, description)) {
    return parseSectorEvent(event.id, summary, description, sourceStart, sourceEnd);
  }
  if (isRotationEvent(summary, description)) {
    return parseRotationEvent(event.id, summary, description, sourceStart, sourceEnd);
  }
  if (containsAny(fullText, settings.flightKeywords)) {
    const guessed = parseSectorEvent(event.id, summary, description, sourceStart, sourceEnd);
    if (guessed.flightNo || guessed.dep || guessed.arr) return guessed;
  }
  return null;
}

function isFlightEvent(summary, description) {
  return /\b[A-Z]{2}\d{2,4}\s*\([A-Z]{3}\s*-\s*[A-Z]{3}\)/i.test(summary)
    || /Départ\s+[A-Z]{3}.*Arrivée\s+[A-Z]{3}/is.test(description);
}

function isRotationEvent(summary, description) {
  return /^MLR/i.test(summary) || /Temps de vol\s*:|Réengagement|Indemnités|HC\s*:/i.test(description);
}

function parseSectorEvent(sourceId, summary, description, sourceStart, sourceEnd) {
  const titleMatch = summary.match(/\b([A-Z]{2}\d{2,4})\s*\((\w{3})\s*-\s*(\w{3})\)\s*([A-Z0-9-]+)?/i);
  const depLine = description.match(/Départ\s+([A-Z]{3})\s+([^\n]+?)\s+(\d{1,2}:\d{2})\s*(?:\(([+-]\d{2}:?\d{2})\))?/i);
  const arrLine = description.match(/Arriv[ée]e?\s+([A-Z]{3})\s+([^\n]+?)\s+(\d{1,2}:\d{2})\s*(?:\(([+-]\d{2}:?\d{2})\))?/i);
  const layoverMatch = description.match(/D[ée]coucher\s+[àa]\s+([A-Z]{3})/i);
  const groundStopMatch = description.match(/Temps\s+d['’]?arr[eê]t\s+([0-9]{1,2}h[0-9]{2})/i);

  const dep = (depLine?.[1] || titleMatch?.[2] || '').toUpperCase();
  const arr = (arrLine?.[1] || titleMatch?.[3] || '').toUpperCase();
  const start = depLine ? parseFrenchEventDate(depLine[2], depLine[3], depLine[4], sourceStart) : sourceStart;
  const end = arrLine ? parseFrenchEventDate(arrLine[2], arrLine[3], arrLine[4], start || sourceEnd) : sourceEnd;

  return {
    kind: 'sector',
    sourceId,
    title: summary,
    flightNo: (titleMatch?.[1] || summary.match(/\b[A-Z]{2}\d{2,4}\b/i)?.[0] || '').toUpperCase(),
    dep,
    arr,
    depIcao: iataToIcao(dep),
    arrIcao: iataToIcao(arr),
    start: start || sourceStart || new Date(),
    end: end || sourceEnd || addMinutes(start || new Date(), 90),
    crew: parseCrew(description),
    layover: layoverMatch?.[1]?.toUpperCase() || '',
    groundStop: groundStopMatch?.[1] || '',
    rawDescription: description
  };
}

function parseRotationEvent(sourceId, summary, description, sourceStart, sourceEnd) {
  const depUtc = description.match(/Départ\s*:\s*([^\n]+?)\s+(\d{1,2}:\d{2})\s*\(Z\)/i);
  const arrUtc = description.match(/Arriv[ée]e?\s*:\s*([^\n]+?)\s+(\d{1,2}:\d{2})\s*\(Z\)/i);
  const flightTime = description.match(/Temps de vol\s*:\s*([0-9]{1,2}h[0-9]{2})/i)?.[1] || '';
  const mep = description.match(/Temps de vol en MEP\s*:\s*([0-9]{1,2}h[0-9]{2})/i)?.[1] || '';
  const hc = description.match(/\bHC\s*:\s*([0-9]{1,2}h[0-9]{2})/i)?.[1] || '';
  const hdv = description.match(/\bHDV\s*:\s*([0-9]{1,2}h[0-9]{2})/i)?.[1] || '';
  const reengagement = description.match(/Réengagement\s+([^\n]+)/i)?.[1] || '';
  const layoverTitle = summary.match(/-\s*([A-Z]{3})(?:\s|$)/i)?.[1]?.toUpperCase() || '';
  const allowances = parseAllowances(description);

  return {
    kind: 'rotation',
    sourceId,
    title: summary,
    start: sourceStart || new Date(),
    end: sourceEnd || addHours(sourceStart || new Date(), 8),
    depUtcText: depUtc ? `${depUtc[1]} ${depUtc[2]}Z` : '',
    arrUtcText: arrUtc ? `${arrUtc[1]} ${arrUtc[2]}Z` : '',
    flightTime,
    mep,
    hc,
    hdv,
    reengagement,
    layover: layoverTitle,
    allowances,
    rawDescription: description
  };
}

function parseCrew(description) {
  const crew = [];
  const marker = description.search(/Equipage\s*:/i);
  if (marker < 0) return crew;
  const after = description.slice(marker).split('\n').slice(1);
  for (const line of after) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith('-')) break;
    const cleaned = trimmed.replace(/^-\s*/, '').replace(/\s+/g, ' ').trim();
    const m = cleaned.match(/^(CDB|OPL|CCP|CC|HST|PNT|PNC|PCB|STW)\s+(.+)$/i);
    crew.push({ role: (m?.[1] || '').toUpperCase(), name: (m?.[2] || cleaned).trim() });
  }
  return crew;
}

function parseAllowances(description) {
  const allowances = [];
  const re = /Escale\s*:\s*([A-Z]{3})\s*:\s*EUR\s*Repas\s*([0-9]+(?:[.,][0-9]{2})?)€\s*-\s*Menu frais\s*([0-9]+(?:[.,][0-9]{2})?)€/gi;
  let m;
  while ((m = re.exec(description)) !== null) {
    allowances.push({ station: m[1], meal: Number(m[2].replace(',', '.')), frais: Number(m[3].replace(',', '.')) });
  }
  return allowances;
}

function calculateDay(sectors, rotation) {
  if (!sectors.length) return {};
  const first = sectors[0];
  const last = sectors[sectors.length - 1];
  const homeDeparture = addMinutes(first.start, -settings.homeLeadMinutes);
  const shuttleDeparture = addMinutes(first.start, -settings.shuttleLeadMinutes);
  const ttms = [];
  for (let i = 0; i < sectors.length - 1; i++) {
    const cur = sectors[i];
    const next = sectors[i + 1];
    const minutes = diffMinutes(cur.end, next.start);
    ttms.push({ from: cur, to: next, minutes, label: formatDuration(minutes), status: ttmStatus(minutes) });
  }
  const totalFlightMinutes = sectors.reduce((acc, s) => acc + Math.max(0, diffMinutes(s.start, s.end)), 0);
  const dutySpanMinutes = diffMinutes(first.start, last.end);
  const route = [first.dep, ...sectors.map(s => s.arr)].filter(Boolean).join('-');
  const crewChanges = detectCrewChanges(sectors);
  return { first, last, homeDeparture, shuttleDeparture, ttms, totalFlightMinutes, dutySpanMinutes, route, crewChanges, rotation };
}

function ttmStatus(minutes) {
  if (minutes < 0) return 'bad';
  if (minutes < settings.shortTtmMinutes) return 'bad';
  if (minutes < settings.shortTtmMinutes + 20) return 'warn';
  return 'ok';
}

function detectCrewChanges(sectors) {
  const changes = [];
  for (let i = 0; i < sectors.length - 1; i++) {
    const aNames = sectors[i].crew.map(c => `${c.role}:${c.name}`.toUpperCase()).sort().join('|');
    const bNames = sectors[i + 1].crew.map(c => `${c.role}:${c.name}`.toUpperCase()).sort().join('|');
    if (aNames && bNames && aNames !== bNames) changes.push({ from: sectors[i], to: sectors[i + 1] });
  }
  return changes;
}

function buildAlerts(plan) {
  if (!plan?.sectors?.length) return [];
  const alerts = [];
  for (const ttm of plan.calculations.ttms) {
    if (ttm.status === 'bad') alerts.push({ level: 'bad', text: `TTM court entre ${ttm.from.flightNo} et ${ttm.to.flightNo} : ${ttm.label}.` });
    if (ttm.status === 'warn') alerts.push({ level: 'warn', text: `TTM à surveiller entre ${ttm.from.flightNo} et ${ttm.to.flightNo} : ${ttm.label}.` });
  }
  for (const ch of plan.calculations.crewChanges) alerts.push({ level: 'warn', text: `Changement équipage détecté entre ${ch.from.flightNo} et ${ch.to.flightNo}.` });
  if (plan.sectors.some(s => !s.depIcao || !s.arrIcao)) alerts.push({ level: 'warn', text: 'Certains IATA ne sont pas mappés en ICAO : météo auto impossible pour ces terrains.' });
  if (!alerts.length) alerts.push({ level: 'ok', text: 'Aucune alerte détectée par le parser local.' });
  return alerts;
}

function renderPlan(plan) {
  currentPlan = plan;
  renderMetrics(plan);
  renderQuickSummary(plan);
  renderAlerts(plan);
  renderTimeline(plan);
  renderTtm(plan);
  renderFlights(plan);
  renderRotation(plan);
  renderWeather(plan);
  if (!plan) renderBrief('Aucune synthèse générée.');
}

function renderMetrics(plan) {
  const grid = $('metricsGrid');
  grid.innerHTML = '';
  if (!plan?.sectors?.length) return;
  const c = plan.calculations;
  const metrics = [
    ['Départ maison', formatTime(c.homeDeparture), `H-${settings.homeLeadMinutes} avant STD ${formatTime(c.first.start)}`],
    ['Départ navette', formatTime(c.shuttleDeparture), `H-${settings.shuttleLeadMinutes} avant 1er vol`],
    ['Route', c.route || '—', `${plan.sectors.length} secteur(s)`],
    ['Fin journée', formatTime(c.last.end), c.last.layover ? `Découcher ${c.last.layover}` : 'Dernière arrivée']
  ];
  for (const [label, value, sub] of metrics) {
    const div = document.createElement('div');
    div.className = 'metric';
    div.innerHTML = `<div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div><div class="sub">${escapeHtml(sub)}</div>`;
    grid.appendChild(div);
  }
}

function renderQuickSummary(plan) {
  const box = $('quickSummary');
  if (!plan?.sectors?.length) {
    box.textContent = 'Aucune journée chargée.';
    box.classList.add('empty');
    return;
  }
  box.classList.remove('empty');
  box.innerHTML = '';
  const c = plan.calculations;
  box.appendChild(paragraph(`Journée ${plan.sectors.length} secteur(s) : ${c.route}.`));
  box.appendChild(paragraph(`Départ maison conseillé ${formatTime(c.homeDeparture)}. Départ navette ${formatTime(c.shuttleDeparture)}.`));
  const ttmText = c.ttms.length ? c.ttms.map(t => `${t.from.arr}: ${t.label}`).join(' · ') : 'Pas de TTM.';
  box.appendChild(paragraph(`TTM : ${ttmText}`));
  const crewChangeText = c.crewChanges.length ? 'Changement équipage détecté.' : 'Équipage stable détecté.';
  box.appendChild(paragraph(crewChangeText));
  const wxCount = Object.keys(plan.weather || {}).length;
  box.appendChild(paragraph(wxCount ? `Météo chargée pour ${wxCount} terrain(s).` : 'Météo non chargée. Clique METAR/TAF.'));
}

function renderAlerts(plan) {
  const panel = $('alertsPanel');
  const list = $('alertsList');
  list.innerHTML = '';
  if (!plan?.alerts?.length) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  for (const a of plan.alerts) {
    const div = document.createElement('div');
    div.className = `alert ${a.level || ''}`;
    div.textContent = a.text;
    list.appendChild(div);
  }
}

function renderTimeline(plan) {
  const box = $('timeline');
  box.innerHTML = '';
  if (!plan?.sectors?.length) { box.textContent = 'Aucune donnée.'; box.classList.add('empty'); return; }
  box.classList.remove('empty');
  const items = [];
  items.push({ time: plan.calculations.homeDeparture, title: 'Départ maison', meta: `H-${settings.homeLeadMinutes} avant ${plan.calculations.first.flightNo}` });
  items.push({ time: plan.calculations.shuttleDeparture, title: 'Départ navette', meta: `H-${settings.shuttleLeadMinutes} avant ${plan.calculations.first.flightNo}` });
  for (const s of plan.sectors) items.push({ time: s.start, title: `${s.flightNo} ${s.dep}-${s.arr}`, meta: `${formatTime(s.start)}-${formatTime(s.end)}` });
  items.sort((a, b) => a.time - b.time);
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'timeline-item';
    div.innerHTML = `<div class="timeline-time">${escapeHtml(formatTime(item.time))}</div><div><div class="timeline-title">${escapeHtml(item.title)}</div><div class="timeline-meta">${escapeHtml(item.meta)}</div></div>`;
    box.appendChild(div);
  }
}

function renderTtm(plan) {
  const box = $('ttmTable');
  box.innerHTML = '';
  if (!plan?.calculations?.ttms?.length) { box.textContent = 'Aucun TTM à calculer.'; box.classList.add('empty'); return; }
  box.classList.remove('empty');
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Entre</th><th>TTM</th><th>État</th><th>Détail</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const t of plan.calculations.ttms) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(t.from.flightNo)} → ${escapeHtml(t.to.flightNo)}</td><td>${escapeHtml(t.label)}</td><td><span class="badge ${t.status}">${escapeHtml(labelStatus(t.status))}</span></td><td>${escapeHtml(formatTime(t.from.end))} → ${escapeHtml(formatTime(t.to.start))}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  box.appendChild(table);
}

function renderFlights(plan) {
  const box = $('flightsList');
  box.innerHTML = '';
  if (!plan?.sectors?.length) { box.textContent = 'Aucun vol détecté.'; box.classList.add('empty'); return; }
  box.classList.remove('empty');
  for (const s of plan.sectors) {
    const div = document.createElement('div');
    div.className = 'card';
    const crewHtml = s.crew.length ? `<ul class="crew-list">${s.crew.map(c => `<li>${escapeHtml(c.role ? `${c.role} ` : '')}${escapeHtml(c.name)}</li>`).join('')}</ul>` : '<p class="muted">Équipage non détecté.</p>';
    div.innerHTML = `
      <div class="card-title"><strong>${escapeHtml(s.flightNo || 'Vol')}</strong><span class="badge">${escapeHtml(s.dep)}-${escapeHtml(s.arr)}</span></div>
      <div class="kv">
        <span>STD/STA</span><span>${escapeHtml(formatDateTime(s.start))} → ${escapeHtml(formatDateTime(s.end))}</span>
        <span>Durée</span><span>${escapeHtml(formatDuration(diffMinutes(s.start, s.end)))}</span>
        <span>Météo</span><span>${escapeHtml([s.depIcao, s.arrIcao].filter(Boolean).join(' / ') || 'ICAO non mappé')}</span>
      </div>
      ${crewHtml}
      ${s.layover ? `<p class="muted">Découcher à ${escapeHtml(s.layover)}${s.groundStop ? ` · arrêt ${escapeHtml(s.groundStop)}` : ''}</p>` : ''}
    `;
    box.appendChild(div);
  }
}

function renderRotation(plan) {
  const box = $('rotationBox');
  box.innerHTML = '';
  if (!plan?.rotation) { box.textContent = 'Aucune rotation détectée.'; box.classList.add('empty'); return; }
  box.classList.remove('empty');
  const r = plan.rotation;
  const div = document.createElement('div');
  div.className = 'card';
  const allowances = r.allowances?.length ? r.allowances.map(a => `${a.station}: repas ${a.meal.toFixed(2)}€, frais ${a.frais.toFixed(2)}€`).join('\n') : '—';
  div.innerHTML = `
    <div class="card-title"><strong>${escapeHtml(r.title)}</strong><span class="badge">Rotation</span></div>
    <div class="kv">
      <span>Départ Z</span><span>${escapeHtml(r.depUtcText || '—')}</span>
      <span>Arrivée Z</span><span>${escapeHtml(r.arrUtcText || '—')}</span>
      <span>Temps vol</span><span>${escapeHtml(r.flightTime || '—')}</span>
      <span>HC / HDV</span><span>${escapeHtml([r.hc, r.hdv].filter(Boolean).join(' / ') || '—')}</span>
      <span>Réengagement</span><span>${escapeHtml(r.reengagement || '—')}</span>
      <span>Indemnités</span><span><pre>${escapeHtml(allowances)}</pre></span>
    </div>
  `;
  box.appendChild(div);
}

function renderWeather(plan) {
  const box = $('weatherBox');
  box.innerHTML = '';
  if (!plan?.weather || !Object.keys(plan.weather).length) { box.textContent = 'Aucune météo chargée.'; box.classList.add('empty'); return; }
  box.classList.remove('empty');
  for (const [icao, wx] of Object.entries(plan.weather)) {
    const div = document.createElement('div');
    div.className = 'card weather-card';
    div.innerHTML = `
      <div class="card-title"><strong>${escapeHtml(icao)}</strong><span class="badge ${wx.error ? 'bad' : 'ok'}">${wx.error ? 'erreur' : (wx.source || 'METAR/TAF')}</span></div>
      ${wx.error ? `<p class="muted">${escapeHtml(wx.error)}</p>` : ''}
      ${wx.metarRaw ? `<h3>METAR décodé</h3><pre>${escapeHtml(wx.metarRaw)}\n\n${escapeHtml(decodeMetar(wx.metarRaw))}</pre>` : ''}
      ${wx.tafRaw ? `<h3>TAF</h3><pre>${escapeHtml(wx.tafRaw)}\n\n${escapeHtml(decodeTaf(wx.tafRaw))}</pre>` : ''}
    `;
    box.appendChild(div);
  }
}

async function refreshWeather() {
  if (!currentPlan?.sectors?.length) return updateStatus('Charge d’abord une journée.', 'warn');
  const stations = [...new Set(currentPlan.sectors.flatMap(s => [s.depIcao, s.arrIcao]).filter(Boolean))];
  if (!stations.length) return updateStatus('Aucun ICAO disponible pour la météo.', 'warn');
  updateStatus(`Chargement METAR/TAF : ${stations.join(', ')}…`);
  await Promise.all(stations.map(async (icao) => {
    currentPlan.weather[icao] = await fetchStationWeather(icao);
  }));
  renderWeather(currentPlan);
  renderBrief(generateLocalBriefing(currentPlan));
  updateStatus('METAR/TAF chargés.');
}

async function fetchStationWeather(icao) {
  const proxyUrl = (settings.weatherProxyUrl || '').trim().replace(/\/$/, '');

  if (proxyUrl) {
    try {
      const url = new URL(proxyUrl);
      url.searchParams.set('icao', icao);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`Proxy météo HTTP ${res.status}`);
      const data = await res.json();
      return {
        metarRaw: data.metarRaw || '',
        tafRaw: data.tafRaw || '',
        source: data.source || 'proxy météo'
      };
    } catch (err) {
      return { error: `Proxy météo : ${err.message}`, metarRaw: '', tafRaw: '' };
    }
  }

  try {
    const [metarRes, tafRes] = await Promise.all([
      fetch(`https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=json`, { cache: 'no-store' }),
      fetch(`https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(icao)}&format=json`, { cache: 'no-store' })
    ]);
    if (!metarRes.ok && !tafRes.ok) throw new Error('API météo indisponible');
    const metarJson = metarRes.ok ? await metarRes.json() : [];
    const tafJson = tafRes.ok ? await tafRes.json() : [];
    return normalizeWeatherResponse(icao, { metar: metarJson, taf: tafJson });
  } catch (err) {
    return {
      error: `Météo non chargée depuis le navigateur. Cause probable : CORS AviationWeather. Configure l’URL du proxy météo Cloudflare Worker dans Paramètres. Détail : ${err.message}`,
      metarRaw: '',
      tafRaw: ''
    };
  }
}

function normalizeWeatherResponse(icao, data) {
  const metarItem = Array.isArray(data.metar) ? data.metar[0] : data.metar;
  const tafItem = Array.isArray(data.taf) ? data.taf[0] : data.taf;
  return {
    metarRaw: pickRaw(metarItem, ['rawOb', 'raw_text', 'raw', 'rawTAF']) || '',
    tafRaw: pickRaw(tafItem, ['rawTAF', 'raw_text', 'raw', 'rawOb']) || ''
  };
}

function pickRaw(obj, keys) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  for (const k of keys) if (obj[k]) return obj[k];
  return '';
}

function decodeMetar(raw) {
  if (!raw) return 'METAR absent.';
  const parts = [];
  const wind = raw.match(/\b(\d{3}|VRB)(\d{2,3})(G\d{2,3})?KT\b/);
  if (wind) parts.push(`Vent ${wind[1]}° ${Number(wind[2])} kt${wind[3] ? ` rafales ${wind[3].slice(1)} kt` : ''}.`);
  if (/\bCAVOK\b/.test(raw)) parts.push('CAVOK : visibilité ≥10 km, pas de nuage significatif, pas de temps significatif.');
  const vis = raw.match(/\b(\d{4})\b/);
  if (vis && !/CAVOK/.test(raw)) parts.push(`Visibilité ${vis[1]} m.`);
  const clouds = [...raw.matchAll(/\b(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?\b/g)].map(m => `${m[1]} ${Number(m[2]) * 100} ft${m[3] ? ` ${m[3]}` : ''}`);
  if (clouds.length) parts.push(`Nuages : ${clouds.join(', ')}.`);
  const temp = raw.match(/\b(M?\d{2})\/(M?\d{2})\b/);
  if (temp) parts.push(`Température/point de rosée ${temp[1].replace('M','-')}/${temp[2].replace('M','-')}°C.`);
  const qnh = raw.match(/\bQ(\d{4})\b/);
  if (qnh) parts.push(`QNH ${qnh[1]} hPa.`);
  const wx = raw.match(/\b(\+|-)?(RA|SHRA|TS|TSRA|FG|BR|HZ|SN|DZ|GR|CB|FZRA)\b/g);
  if (wx) parts.push(`Phénomènes significatifs : ${wx.join(', ')}.`);
  return parts.join('\n') || 'Décodage simple non concluant. Lire le METAR brut.';
}

function decodeTaf(raw) {
  if (!raw) return 'TAF absent.';
  const flags = [];
  if (/\bTEMPO\b/.test(raw)) flags.push('TEMPO présent : variations temporaires à vérifier autour de l’ETA.');
  if (/\bPROB\d{2}\b/.test(raw)) flags.push('PROB présent : probabilité météo à vérifier.');
  if (/\bBECMG\b/.test(raw)) flags.push('BECMG présent : évolution prévue dans la période.');
  if (/\bTS|TSRA\b/.test(raw)) flags.push('Risque orageux mentionné.');
  if (/\bBKN00[1-9]|OVC00[1-9]|FG\b/.test(raw)) flags.push('Point plafond/visibilité bas à surveiller.');
  if (/\bG\d{2,3}KT\b/.test(raw)) flags.push('Rafales mentionnées.');
  if (/\bCAVOK\b/.test(raw) && !flags.length) flags.push('TAF globalement simple avec CAVOK mentionné.');
  return flags.join('\n') || 'Pas de signal fort détecté par le décodage simple.';
}

function generateLocalBriefing(plan) {
  if (!plan?.sectors?.length) return 'Aucune journée chargée.';
  const c = plan.calculations;
  const lines = [];
  lines.push(`BRIEF JOURNÉE — ${formatDate(plan.selectedDate)}`);
  lines.push('');
  lines.push(`Routing : ${c.route}`);
  lines.push(`Secteurs : ${plan.sectors.length}`);
  lines.push(`Premier STD : ${formatTime(c.first.start)} (${c.first.dep})`);
  lines.push(`Dernière STA : ${formatTime(c.last.end)} (${c.last.arr})`);
  lines.push(`Départ maison : ${formatTime(c.homeDeparture)} (H-${settings.homeLeadMinutes})`);
  lines.push(`Départ navette : ${formatTime(c.shuttleDeparture)} (H-${settings.shuttleLeadMinutes})`);
  if (plan.rotation?.hc || plan.rotation?.hdv) lines.push(`Rotation : HC ${plan.rotation.hc || '—'} / HDV ${plan.rotation.hdv || '—'}`);

  lines.push('');
  lines.push('TTM À SURVEILLER');
  const watchTtms = c.ttms.filter(t => t.status !== 'ok');
  if (watchTtms.length) watchTtms.forEach(t => lines.push(`- ${t.from.arr} entre ${t.from.flightNo}/${t.to.flightNo} : ${t.label} (${labelStatus(t.status)})`));
  else if (c.ttms.length) lines.push('- Aucun TTM court selon le seuil paramétré.');
  else lines.push('- Pas de TTM.');

  lines.push('');
  lines.push('ÉQUIPAGE');
  const crew = c.first.crew || [];
  if (crew.length) crew.forEach(member => lines.push(`- ${member.role ? `${member.role} ` : ''}${member.name}`));
  else lines.push('- Non détecté.');
  if (c.crewChanges.length) c.crewChanges.forEach(ch => lines.push(`- Changement détecté entre ${ch.from.flightNo} et ${ch.to.flightNo}.`));

  const wxLines = buildWeatherBriefLines(plan);
  lines.push('');
  lines.push('MÉTÉO ARRIVÉES');
  if (wxLines.length) lines.push(...wxLines);
  else lines.push('- Météo non chargée. Clique METAR/TAF.');

  lines.push('');
  lines.push('ALERTES');
  plan.alerts
    .filter(a => !/avion/i.test(a.text))
    .forEach(a => lines.push(`- ${a.text}`));

  lines.push('');
  lines.push('Note : synthèse indicative. Le briefing officiel, les NOTAM, perfo et procédures compagnie restent prioritaires.');
  return lines.join('\n');
}

function buildWeatherBriefLines(plan) {
  const lines = [];
  for (const s of plan.sectors) {
    const icao = s.arrIcao;
    if (!icao) {
      lines.push(`- ${s.flightNo} arrivée ${s.arr} ${formatTime(s.end)} : ICAO non mappé.`);
      continue;
    }
    const wx = plan.weather?.[icao];
    if (!wx) continue;
    if (wx.error) {
      lines.push(`- ${s.flightNo} arrivée ${s.arr}/${icao} ${formatTime(s.end)} : météo non chargée (${wx.error}).`);
      continue;
    }
    const metarLine = wx.metarRaw ? decodeMetar(wx.metarRaw).split('\n').slice(0, 2).join(' ') : 'METAR absent.';
    const tafLine = wx.tafRaw ? decodeTaf(wx.tafRaw).split('\n').slice(0, 2).join(' ') : 'TAF absent.';
    lines.push(`- ${s.flightNo} arrivée ${s.arr}/${icao} ${formatTime(s.end)} : ${metarLine} TAF : ${tafLine}`);
  }
  return lines;
}

function renderBrief(text) {
  $('briefOutput').textContent = text || 'Aucune synthèse générée.';
}

function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function normalizeText(text) {
  return (text || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
}

function containsAny(text, keywords) {
  const low = text.toLowerCase();
  return keywords.some(k => k && low.includes(k.toLowerCase()));
}

function parseEventDate(part) {
  if (!part) return null;
  const value = part.dateTime || part.date;
  return value ? new Date(value) : null;
}

function parseFrenchEventDate(dayText, timeText, offsetText, fallbackDate) {
  const base = fallbackDate instanceof Date && !isNaN(fallbackDate) ? fallbackDate : new Date();
  const [h, m] = timeText.split(':').map(Number);
  const d = new Date(base);
  // Le Calendar API fournit déjà start/end précis. Ici on corrige surtout les blocs manuels.
  d.setHours(h, m, 0, 0);
  if (offsetText) {
    const offset = offsetText.includes(':') ? offsetText : `${offsetText.slice(0,3)}:${offsetText.slice(3)}`;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}T${timeText}:00${offset}`);
  }
  return d;
}

function inferStartFromText(text, baseDate) {
  const m = text.match(/Départ\s+[A-Z]{3}[^\n]*?(\d{1,2}:\d{2})\s*(?:\(([+-]\d{2}:?\d{2})\))?/i);
  return m ? parseFrenchEventDate('', m[1], m[2], baseDate) : null;
}

function inferEndFromText(text, baseDate) {
  const m = text.match(/Arriv[ée]e?\s+[A-Z]{3}[^\n]*?(\d{1,2}:\d{2})\s*(?:\(([+-]\d{2}:?\d{2})\))?/i);
  return m ? parseFrenchEventDate('', m[1], m[2], baseDate) : null;
}


function iataToIcao(iata) {
  return IATA_TO_ICAO[(iata || '').toUpperCase()] || '';
}


function labelStatus(status) {
  return status === 'ok' ? 'confortable' : status === 'warn' ? 'à surveiller' : 'court';
}

function paragraph(text) {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[ch]));
}

function parseDateInput(value) {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateInput(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function addHours(date, hours) { return addMinutes(date, hours * 60); }
function addMinutes(date, minutes) { const d = new Date(date); d.setMinutes(d.getMinutes() + minutes); return d; }
function diffMinutes(a, b) { return Math.round((new Date(b) - new Date(a)) / 60000); }

function formatTime(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

function formatDate(date) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(date));
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}
