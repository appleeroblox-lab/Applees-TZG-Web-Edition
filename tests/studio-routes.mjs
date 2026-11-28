import assert from 'node:assert/strict';
import { studioRequest } from '../studio/routes.mjs';

const origin = 'https://game.invalid';
const env = { SUPABASE_URL: 'https://database.invalid', SUPABASE_PUBLISHABLE_KEY: 'public' };
const assets = { entry: '<script nonce="__STUDIO_NONCE__"></script>', editor: 'private asset' };
let unlocked = false;
let calls = 0;
const upstream = async (url, options) => {
  calls++;
  assert.equal(url.pathname, '/rest/v1/rpc/tzg_studio_check');
  assert.equal(options.headers.Authorization, 'Bearer game-session');
  return Response.json(unlocked);
};
const request = (path, init) => studioRequest(new Request(origin + path, init), env, assets, upstream);
const post = (headers = {}) => ({
  method: 'POST', headers: { Origin: origin, Authorization: 'Bearer game-session', ...headers },
  body: JSON.stringify({ token: 'studio-session' }),
});
const redirect = await request('/studio');
assert.equal(redirect.status, 308);
assert.equal(redirect.headers.get('Location'), '/studio/');
assert.equal((await request('/studio/', { method: 'HEAD' })).status, 200);
const entry = await request('/studio/');
assert.equal(entry.status, 200);
assert.match(entry.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
assert.equal(entry.headers.get('Cache-Control'), 'no-store');
assert.doesNotMatch(await entry.text(), /private asset|__STUDIO_NONCE__/);
assert.equal((await request('/studio/editor.txt')).status, 404);
assert.equal((await request('/studio/api/editor', post({ Origin: 'https://other.invalid' }))).status, 403);
assert.equal((await request('/studio/api/editor', post({ Authorization: '' }))).status, 401);
assert.equal(calls, 0);
const denied = await request('/studio/api/editor', post());
assert.equal(denied.status, 403);
assert.equal(await denied.text(), '');
unlocked = true;
const editor = await request('/studio/api/editor', post());
assert.equal(editor.status, 200);
assert.equal(editor.headers.get('Cache-Control'), 'no-store');
assert.equal(await editor.text(), 'private asset');
console.log('Studio route guards protect editor assets.');
