import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { studioRequest } from '../studio/routes.mjs';

const load = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const assets = {
  entry: await load('studio/entry.html'),
  editor: (await load('studio/model-edits.mjs')) + '\n' + (await load('studio/model-catalog.txt')) + '\n' + (await load('studio/ui-editor.txt')) + '\n' + (await load('studio/editor.txt')),
};
const env = { SUPABASE_URL: 'https://db.invalid', SUPABASE_PUBLISHABLE_KEY: 'fixture' };
let unlocked = false;
let setup = false;
const drafts = [{}];
async function supabase(url, options) {
  const args = JSON.parse(options.body);
  const action = url.pathname.split('/').at(-1);
  const valid = unlocked && args.token === 'unlock';
  if (action.endsWith('_set_initial_password')) {
    if (setup || args.password !== 'test password') return Response.json(false);
    setup = true;
    return Response.json(true);
  }
  if (action.endsWith('_open')) {
    unlocked = setup && args.password === 'test password';
    return Response.json(unlocked ? 'unlock' : null);
  }
  if (action.endsWith('_check')) return Response.json(valid);
  if (!valid) return Response.json({ status: 'locked' });
  if (action.endsWith('_lock')) {
    unlocked = false;
    return Response.json(null);
  }
  if (action.endsWith('_read_draft')) {
    return Response.json({ status: 'ok', revision: drafts.length - 1, document: drafts.at(-1) });
  }
  if (action.endsWith('_write_draft')) {
    assert.equal(args.expected_revision, drafts.length - 1);
    if (args.password !== 'test password') return Response.json({ status: 'verification_failed' });
    drafts.push(args.edits ?? drafts[args.restore_revision]);
    return Response.json({ status: 'ok', revision: drafts.length - 1 });
  }
  if (action.endsWith('_history')) {
    return Response.json({ status: 'ok', versions: [{ revision: 1, action: 'save' }] });
  }
  throw new Error('Unrecognized backend request');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + req.headers.host);
    if (url.pathname.startsWith('/studio/')) {
      const body = [];
      for await (const chunk of req) body.push(chunk);
      const response = await studioRequest(new Request(url, {
        method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(body) : undefined,
      }), env, assets, supabase);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (url.pathname === '/vendor/supabase.js' || url.pathname === '/supabase-config.js' || url.pathname === '/account-auth-flow.js') {
      const fixture = {
        '/supabase-config.js': 'export const supabaseConfig = { url: "https://db.invalid", publishableKey: "fixture" };',
        '/account-auth-flow.js': 'export const accountEndpoint = async () => ({ session: { access_token: "fixture" } });',
        '/vendor/supabase.js': `export function createClient(url, key, { auth: { storageKey } }) {
          const data = () => ({ session: JSON.parse(localStorage.getItem(storageKey) || 'null') });
          const set = session => { localStorage.setItem(storageKey, JSON.stringify(session)); return { data: data() }; };
          return { auth: { getSession: async () => ({ data: data() }), onAuthStateChange() {},
            signInWithPassword: async () => set({ access_token: 'fixture' }), setSession: async session => set(session),
          } };
        }`,
      };
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(fixture[url.pathname]);
      return;
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(await load('public/index.html'));
      return;
    }
    assert.match(url.pathname, /^\/(vendor|models|fonts|images)\/|^\/(models\.js|startup-landscape\.js|entry-menu\.css|ui-theme\.css|home-experiment\.css|style\.css|reference-ui\.css|settings-appearance\.css|panel-drag\.js|paint-gradient\.js)$/);
    const types = { js: 'text/javascript', json: 'application/json', png: 'image/png', ttf: 'font/ttf', css: 'text/css' };
    const data = await readFile(new URL('../public' + url.pathname, import.meta.url));
    res.writeHead(200, { 'Content-Type': types[url.pathname.split('.').at(-1)] });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.STUDIO_TEST_CHROMIUM,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port + '/studio/');
  await page.getByRole('button', { name: 'Sign in with Google' }).waitFor();
  await page.getByRole('button', { name: 'Sign in with game account' }).click();
  await page.getByLabel('Email or username').fill('applee');
  await page.getByLabel('Game account password').fill('fixture password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('#password').fill('test password');
  await page.getByRole('button', { name: 'Set initial Studio password' }).click();
  await page.getByText('Password set. Enter it again to unlock.', { exact: true }).waitFor();
  await page.locator('#password').fill('test password');
  await page.getByRole('button', { name: 'Unlock Studio' }).click();
  await page.locator('canvas:visible').waitFor({ timeout: 10000 });
  await page.locator('#color').fill('#123456');
  if (await page.locator('#color').inputValue() !== '#123456') throw new Error('Colour was not updated.');
  await page.getByRole('button', { name: 'Open UI Editor' }).click();
  const preview = page.frameLocator('iframe[title="Game UI preview"]');
  await preview.locator('#settingsDialog').waitFor();
  await page.getByLabel('Element width', { exact: true }).fill('420');
  await page.getByLabel('Element width', { exact: true }).press('Tab');
  assert.equal(await preview.locator('#settingsDialog').evaluate(node => node.style.width), '420px');
  await page.getByRole('button', { name: 'Gradient Editor', exact: true }).click();
  await page.getByRole('button', { name: 'Add stop' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  assert.match(await preview.locator('#settingsDialog').evaluate(node => node.style.backgroundImage), /linear-gradient/);
  await page.getByRole('button', { name: 'Return to Model Studio' }).click();
  await page.locator('.studioFile summary').click();
  await page.getByRole('button', { name: 'Publish…' }).click();
  await page.getByLabel('Update title').fill('Interface refresh');
  await page.getByRole('button', { name: 'Keep in Draft' }).click();
  const draftPassword = page.locator('#draft input[type=password]');
  await draftPassword.fill('test password');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await page.locator('#studio-output').getByText('Draft version 1 saved.', { exact: true }).waitFor();
  assert.equal(drafts[1].updateInfo.title, 'Interface refresh');
  assert.equal(drafts[1].ui.settingsDialog.settingsDialog.gradient.length, 3);
  assert.equal(drafts[1].modelMaterials['player-ship'][0].value, '#123456');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Version History' }).click();
  await draftPassword.fill('test password');
  await page.getByRole('button', { name: 'Restore Draft' }).click();
  await page.locator('#studio-output').getByText('Draft version 2 saved.', { exact: true }).waitFor();
  assert.deepEqual(drafts[2], drafts[1]);
  await page.locator('#asset').selectOption('pickaxe');
  await page.waitForFunction(() => !document.querySelector('#asset').disabled);
  assert.equal(await page.locator('#asset').inputValue(), 'pickaxe');
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/lock')),
    page.getByRole('button', { name: 'Lock Studio' }).click()]);
  await page.getByText('Studio is locked.', { exact: true }).waitFor();
  assert.equal(await page.locator('canvas').count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('Rotate to landscape', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Unlock Studio' }).isVisible(), false);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('#password').fill('test password');
  await page.getByRole('button', { name: 'Unlock Studio' }).click();
  await page.locator('canvas:visible').waitFor({ timeout: 10000 }).catch(async error => {
    throw new Error(await page.locator('#notice').innerText() || error.message);
  });
  const dimensions = await page.evaluate(() => ({
    width: innerWidth, contentWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(dimensions.width, dimensions.contentWidth);
  await page.getByRole('button', { name: 'Zoom In' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Unlock Studio' }).waitFor();
  assert.equal(await page.locator('canvas').count(), 0);
  console.log('Studio browser setup, unlock, WebGL preview, edit, save, restore and lock passed.');
} finally {
  await browser?.close();
  server.close();
}
