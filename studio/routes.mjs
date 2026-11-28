const rpc = Object.freeze({
  open: 'tzg_studio_open',
  setup: 'tzg_studio_set_initial_password',
  lock: 'tzg_studio_lock',
  read: 'tzg_studio_read_draft',
  write: 'tzg_studio_write_draft',
  history: 'tzg_studio_history',
  editor: 'tzg_studio_check',
});

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

function response(body, status = 200, contentType = 'application/json', extra = {}) {
  return new Response(body, { status, headers: { ...headers, ...extra, 'Content-Type': contentType } });
}

export async function studioRequest(request, env, assets, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.pathname === '/studio/' && request.method === 'GET') {
    const nonce = crypto.randomUUID();
    return response(assets.entry.replaceAll('__STUDIO_NONCE__', nonce), 200, 'text/html; charset=utf-8', {
      'Content-Security-Policy': [
        "default-src 'none'", "frame-ancestors 'none'", "base-uri 'none'",
        "form-action 'none'", "font-src 'self'", "img-src 'self' blob: data:",
        "connect-src 'self'", "style-src 'unsafe-inline'",
        `script-src 'nonce-${nonce}' 'self' blob:`,
      ].join('; '),
    });
  }
  const action = url.pathname.match(/^\/studio\/api\/([a-z]+)$/)?.[1];
  if (!action || !Object.hasOwn(rpc, action) || request.method !== 'POST') return response(null, 404);
  if (request.headers.get('Origin') !== url.origin) return response(null, 403);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return response(null, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return response(null, 503);

  const reader = request.body?.getReader();
  if (!reader) return response(null, 400);
  const decoder = new TextDecoder();
  let input = '';
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 300000) {
        await reader.cancel();
        return response(null, 413);
      }
      input += decoder.decode(value, { stream: true });
    }
    input += decoder.decode();
    const args = JSON.parse(input);
    if (!args || Array.isArray(args) || typeof args !== 'object') return response(null, 400);
    const upstream = await fetcher(new URL('/rest/v1/rpc/' + rpc[action], env.SUPABASE_URL), {
      method: 'POST',
      headers: { Authorization: auth, apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!upstream.ok) return response(null, [401, 403].includes(upstream.status) ? upstream.status : 502);
    const result = await upstream.json();
    if (action === 'editor') return result === true
      ? response(assets.editor, 200, 'text/javascript; charset=utf-8')
      : response(null, 403);
    return response(JSON.stringify(result));
  } catch (error) {
    return response(null, error instanceof SyntaxError ? 400 : 502);
  }
}
