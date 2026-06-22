export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';
    const allowedOrigin = env.ALLOWED_ORIGIN || origin || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/weather') {
      return json({ error: 'Not found. Use /weather?icao=LFPG' }, 404, corsHeaders);
    }

    const icao = (url.searchParams.get('icao') || '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(icao)) {
      return json({ error: 'Invalid ICAO. Expected 4 letters.' }, 400, corsHeaders);
    }

    try {
      const [metarRaw, tafRaw] = await Promise.all([
        fetchRawWeather(`https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=json`, 'metar'),
        fetchRawWeather(`https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(icao)}&format=json`, 'taf')
      ]);

      return json({ icao, metarRaw, tafRaw, source: 'AviationWeather via proxy' }, 200, corsHeaders);
    } catch (err) {
      return json({ icao, error: err.message, metarRaw: '', tafRaw: '' }, 502, corsHeaders);
    }
  }
};

async function fetchRawWeather(url, type) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`${type} HTTP ${res.status}`);
  const data = await res.json();
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) return '';
  return item.rawOb || item.rawTAF || item.raw_text || item.raw || '';
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
