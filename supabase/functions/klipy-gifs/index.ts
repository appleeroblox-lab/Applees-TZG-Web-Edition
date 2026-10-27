// @ts-nocheck
// Paste this complete file into the Supabase function editor. No external imports.
export const klipyImage = value => typeof value === 'string' && value.length <= 2048 && /^https:\/\/static[12]?\.klipy\.com\/[A-Za-z0-9._~%/-]+\.gif(?:\?[A-Za-z0-9._~%&=+;:@,/?!-]*)?$/.test(value);
export function createHandler({env = name => Deno.env.get(name), fetcher = fetch, now = Date.now} = {}) {
 const visits = new Map();
 return async request => {
  const origin = request.headers.get('origin');
  const allowed = env('TZG_ALLOWED_ORIGIN') || 'https://appleeroblox-lab.github.io';
  const headers = {'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'Vary': 'Origin'};
  const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers});
  if (origin && origin !== allowed) return reply({error: 'Origin is not allowed.'}, 403);
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (request.method !== 'POST') return reply({error: 'Use POST.'}, 405);
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer \S+$/.test(authorization)) return reply({error: 'Sign in to browse KLIPY.'}, 401);
  const project = env('SUPABASE_URL'), anon = env('SUPABASE_ANON_KEY'), key = env('KLIPY_API_KEY');
  if (!project || !anon || !key) return reply({error: 'KLIPY function setup is incomplete.'}, 503);
  try {
   const auth = await fetcher(project + '/auth/v1/user', {headers: {authorization, apikey: anon}, signal: AbortSignal.timeout(8000)});
   const user = auth.ok ? await auth.json() : null;
   if (!user?.id) return reply({error: 'Sign in again to browse KLIPY.'}, 401);
   const time = now();
   for (const [id, state] of visits) if (time - state.start >= 60000) visits.delete(id);
   if (!visits.has(user.id) && visits.size >= 2000) return reply({error: 'GIF search is busy. Retry shortly.'}, 429);
   const state = visits.get(user.id) || {start: time, count: 0};
   if (++state.count > 20) return reply({error: 'Please wait before searching again.'}, 429);
   visits.set(user.id, state);
   const text = await request.text();
   if (text.length > 2048) return reply({error: 'Request is too large.'}, 400);
   let input;try {input = JSON.parse(text);} catch {return reply({error: 'Invalid request.'}, 400);}
   if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({error: 'Invalid request.'}, 400);
   const q = String(input.q || '').slice(0,80), base = 'https://api.klipy.com/api/v1/' + encodeURIComponent(key) + '/gifs/';
   let url, options = {};
   if (input.action === 'share') {
    if (typeof input.slug !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(input.slug)) return reply({error: 'Invalid GIF.'}, 400);
    url = new URL(base + 'share/' + input.slug);
    options = {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({customer_id: user.id, q})};
   } else if (input.action === 'search') {
    const page = Number(input.page ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 100) return reply({error: 'Invalid page.'}, 400);
    url = new URL(base + (q.trim() ? 'search' : 'trending'));
    url.search = new URLSearchParams({page: String(page), per_page: '24', customer_id: user.id, locale: 'us', format_filter: 'gif', content_filter: 'high', ...(q.trim() ? {q} : {})}).toString();
   } else return reply({error: 'Invalid action.'}, 400);
   const response = await fetcher(url.href, {...options, redirect: 'error', signal: AbortSignal.timeout(8000)});
   if (!response.ok) return reply({error: response.status === 429 ? 'KLIPY search limit reached. Please retry later.' : 'KLIPY is unavailable. Check the API key and retry.'}, response.status === 429 ? 429 : 502);
   const body = await response.json();
   if (body.result !== true) return reply({error: 'KLIPY did not accept the request.'}, 502);
   if (input.action === 'share') return reply({ok: true});
   const rows = Array.isArray(body.data?.data) ? body.data.data : [];
   // Keep provider order and exact delivery URLs. Never download or store media bytes.
   const items = rows.slice(0,24).flatMap(item => {
    if (item.type === 'ad') return []; // This integration requires Ads disabled in the partner panel.
    if (typeof item.slug !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(item.slug)) return [];
    const media = ['sm','xs','md','hd'].map(size => item.file?.[size]?.gif).find(file => klipyImage(file?.url));
    if (!media) return [];
    return [{title: String(item.title || 'GIF').slice(0,120), slug: item.slug, url: media.url, preview: media.url, source: 'klipy', query: q}];
   });
   if (rows.some(item => item.type === 'ad')) return reply({error: 'Disable Ads for this KLIPY platform before using the GIF picker.'}, 503);
   return reply({items, hasNext: body.data?.has_next === true || body.data?.has_next_page === true || rows.length === 24});
  } catch {return reply({error: 'GIF service timed out or is unavailable. Please retry.'}, 502);}
 };
}
if (typeof Deno !== 'undefined') Deno.serve(createHandler());
