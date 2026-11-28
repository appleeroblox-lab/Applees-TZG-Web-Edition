import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { studioRequest } from '../studio/routes.mjs';

const load = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const assets = {
  entry: await load('studio/entry.html'),
  editor: (await load('studio/model-edits.mjs')) + '\n' + (await load('studio/model-catalog.txt')) + '\n' + (await load('studio/workspace.txt')) + '\n' + (await load('studio/ui-editor.txt')) + '\n' + (await load('studio/editor.txt')),
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
  page.setDefaultTimeout(8000);
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
  const canvas = page.locator('canvas');
  const widthBefore = await canvas.evaluate(node => node.clientWidth);
  const splitter = await page.locator('.studioSplitter[data-side=left]').boundingBox();
  await page.mouse.move(splitter.x + 3, splitter.y + 55);
  await page.mouse.down();
  await page.mouse.move(splitter.x + 59, splitter.y + 55, { steps: 5 });
  await page.mouse.up();
  await canvas.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.ok(await canvas.evaluate(node => node.clientWidth) < widthBefore);

  const assetsTab = page.locator('.studioWindowBar').getByRole('button', { name: 'Assets', exact: true });
  const assetsTitle = await assetsTab.boundingBox();
  const scene = await page.locator('.viewport').boundingBox();
  await page.mouse.move(assetsTitle.x + 25, assetsTitle.y + 10);
  await page.mouse.down();
  await page.mouse.move(scene.x + scene.width / 2, scene.y + scene.height / 2, { steps: 8 });
  await page.mouse.up();
  const floating = page.locator('.studioWindow[data-side=float]').filter({ has: page.getByRole('button', { name: 'Assets', exact: true }) });
  await floating.waitFor();
  const floatBefore = await floating.boundingBox();
  await page.mouse.move(floatBefore.x + floatBefore.width - 4, floatBefore.y + floatBefore.height - 4);
  await page.mouse.down();
  await page.mouse.move(floatBefore.x + floatBefore.width + 32, floatBefore.y + floatBefore.height + 18, { steps: 5 });
  await page.mouse.up();
  assert.ok((await floating.boundingBox()).width > floatBefore.width);

  const floatingTitle = await assetsTab.boundingBox();
  const explorerTitle = await page.locator('.studioWindowBar').getByRole('button', { name: 'Explorer', exact: true }).boundingBox();
  await page.mouse.move(floatingTitle.x + 23, floatingTitle.y + 10);
  await page.mouse.down();
  await page.mouse.move(explorerTitle.x + 20, explorerTitle.y + 10, { steps: 8 });
  await page.locator('.studioDockPreview').waitFor();
  await page.mouse.up();
  const rightTabs = page.locator('.studioWindow[data-side=right][data-group=explorer] .studioWindowBar');
  assert.equal(await rightTabs.getByRole('button', { name: 'Assets', exact: true }).count(), 1);
  await rightTabs.getByRole('button', { name: 'Explorer', exact: true }).click();
  await page.getByLabel('Search parts').waitFor();
  await rightTabs.getByRole('button', { name: 'Close Explorer' }).click();
  await page.getByText('View', { exact: true }).click();
  await page.locator('#view-panels').getByRole('button', { name: 'Explorer', exact: true }).click();
  await page.getByLabel('Search parts').waitFor();
  await page.locator('#view-panels').getByRole('button', { name: 'Reset Layout' }).click();
  await page.getByText('View', { exact: true }).click();
  assert.equal(await page.locator('.studioWindow[data-side=left][data-group=assets]').count(), 1);
  await page.getByRole('button', { name: 'Grid', exact: true }).click();
  await page.getByRole('button', { name: 'Focus Selection' }).click();
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  const axis = await page.locator('.studioAxisOverlay [data-axis=X]').boundingBox();
  await page.mouse.move(axis.x + axis.width / 2, axis.y + axis.height / 2);
  await page.mouse.down();
  await page.mouse.move(axis.x + axis.width / 2 + 28, axis.y + axis.height / 2, { steps: 5 });
  await page.mouse.up();
  assert.notEqual(await page.getByLabel('Position X', { exact: true }).inputValue(), '0');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await page.getByLabel('Position X', { exact: true }).inputValue(), '0');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.notEqual(await page.getByLabel('Position X', { exact: true }).inputValue(), '0');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.locator('#color').fill('#123456');
  if (await page.locator('#color').inputValue() !== '#123456') throw new Error('Colour was not updated.');
  await page.getByRole('button', { name: 'Open UI Editor' }).click();
  const preview = page.frameLocator('iframe[title="Game UI preview"]');
  await preview.locator('#settingsDialog').waitFor();
  await page.getByLabel('Preview resolution').selectOption('mobile');
  assert.equal(await page.locator('iframe[title="Game UI preview"]').evaluate(frame => frame.style.width), '844px');
  await page.getByLabel('Preview resolution').selectOption('fit');
  const moveUi = await preview.getByRole('button', { name: 'Move element' }).boundingBox();
  await page.mouse.move(moveUi.x + 6, moveUi.y + 6);
  await page.mouse.down();
  await page.mouse.move(moveUi.x + 26, moveUi.y + 16, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.getByLabel('Element X').inputValue(), '20');
  await page.getByLabel('Element width', { exact: true }).fill('420');
  await page.getByLabel('Element width', { exact: true }).press('Tab');
  assert.equal(await preview.locator('#settingsDialog').evaluate(node => node.style.width), '420px');
  await page.getByRole('button', { name: 'Gradient Editor', exact: true }).click();
  await page.getByRole('button', { name: 'Add stop' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  assert.match(await preview.locator('#settingsDialog').evaluate(node => node.style.backgroundImage), /linear-gradient/);
  await page.getByRole('button', { name: 'Return to Model Studio' }).click();
  await page.getByText('File', { exact: true }).click();
  await page.getByRole('button', { name: 'Publish…' }).click();
  await page.getByLabel('Update title').fill('Interface refresh');
  await page.getByRole('button', { name: 'Keep in Draft' }).click();
  const draftPassword = page.locator('#draft input[type=password]');
  await draftPassword.fill('test password');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await page.locator('#studio-output').getByText('Draft version 1 saved.', { exact: true }).waitFor();
  assert.equal(drafts[1].updateInfo.title, 'Interface refresh');
  assert.equal(drafts[1].ui.settingsDialog.settingsDialog.gradient.length, 3);
  assert.equal(drafts[1].modelMaterials['player-ship'].find(edit => edit.field === 'color').value, '#123456');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Version History' }).click();
  await draftPassword.fill('test password');
  await page.getByRole('button', { name: 'Restore Draft' }).click();
  await page.locator('#studio-output').getByText('Draft version 2 saved.', { exact: true }).waitFor();
  assert.deepEqual(drafts[2], drafts[1]);
  await page.locator('#asset').selectOption('pickaxe');
  await page.locator('#asset:enabled').waitFor();
  assert.equal(await page.locator('#asset').inputValue(), 'pickaxe');
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/lock')),
    page.getByRole('button', { name: 'Lock Studio' }).click()]);
  await page.getByText('Studio is locked.', { exact: true }).waitFor();
  assert.equal(await page.locator('canvas').count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('Rotate to landscape', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Unlock Studio' }).isVisible(), false);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('#startupLandscape').waitFor({ state: 'hidden' });
  await page.locator('#password').fill('test password');
  const [reopened] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/open'), { timeout: 8000 }),
    page.getByRole('button', { name: 'Unlock Studio' }).click(),
  ]);
  assert.equal(await reopened.json(), 'unlock');
  await page.locator('canvas:visible').waitFor({ timeout: 10000 }).catch(async error => {
    throw new Error(await page.locator('#notice').innerText() || error.message);
  });
  const dimensions = await page.evaluate(() => ({
    width: innerWidth, contentWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(dimensions.width, dimensions.contentWidth);
  await page.getByRole('button', { name: 'Zoom In' }).click();
  const touch = await page.context().newCDPSession(page);
  const mobileTab = await page.locator('.studioWindowBar').getByRole('button', { name: 'Assets', exact: true }).boundingBox();
  const mobileScene = await page.locator('.viewport').boundingBox();
  const startTouch = { x: Math.round(mobileTab.x + 20), y: Math.round(mobileTab.y + 10) };
  const endTouch = { x: Math.round(mobileScene.x + mobileScene.width / 2), y: Math.round(mobileScene.y + mobileScene.height / 2) };
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [startTouch] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [endTouch] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.locator('.studioWindow[data-side=float][data-group=assets]').waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Unlock Studio' }).waitFor();
  assert.equal(await page.locator('canvas').count(), 0);
  await page.locator('#password').fill('test password');
  await page.getByRole('button', { name: 'Unlock Studio' }).click();
  await page.locator('.studioWindow[data-side=float][data-group=assets]').waitFor();
  console.log('Studio dock, resize, tabs, touch, persistence, setup, unlock, WebGL preview, edit, save, restore and lock passed.');
} finally {
  await browser?.close();
  server.close();
}
