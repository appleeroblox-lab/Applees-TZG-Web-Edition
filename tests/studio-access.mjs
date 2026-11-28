import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const db = new PGlite({ extensions: { pgcrypto } });
const developer = '00000000-0000-4000-8000-000000000001';
const session = '00000000-0000-4000-8000-000000000002';
const other = '00000000-0000-4000-8000-000000000003';
const otherSession = '00000000-0000-4000-8000-000000000004';
const password = 'fixture password for studio';

await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
  create table auth.sessions (id uuid primary key, user_id uuid, not_after timestamptz);
  create function auth.jwt() returns jsonb language sql stable as
    'select current_setting(''request.jwt.claims'', true)::jsonb';
  create function auth.uid() returns uuid language sql stable as
    'select (auth.jwt()->>''sub'')::uuid';
  insert into auth.users values ('${developer}', now()), ('${other}', now());
  insert into auth.sessions values ('${session}', '${developer}', null),
    ('${otherSession}', '${other}', null);
`);
await db.exec(await readFile(new URL('../supabase/migrations/20261128130000_studio_access.sql', import.meta.url), 'utf8'));

async function claim(user, sessionId, anonymous = false) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: user, session_id: sessionId, is_anonymous: anonymous }),
  ]);
  await db.exec('set role authenticated');
}

async function scalar(sql, ...params) {
  const { rows } = await db.query(sql, params);
  return Object.values(rows[0])[0];
}

try {
  await claim(developer, session);
  assert.equal(await scalar('select tzg_studio_open($1)', password), null);
  await db.exec('reset role');
  await db.query('insert into tzg_studio.developers (user_id) values ($1)', [developer]);
  await claim(other, otherSession);
  assert.equal(await scalar('select tzg_studio_set_initial_password($1)', password), false);
  await claim(developer, session, true);
  assert.equal(await scalar('select tzg_studio_set_initial_password($1)', password), false);
  await claim(developer, session);
  assert.equal(await scalar('select tzg_studio_open($1)', password), null);
  assert.equal(await scalar('select tzg_studio_set_initial_password($1)', 'too short'), false);
  assert.equal(await scalar('select tzg_studio_set_initial_password($1)', password), true);
  assert.equal(await scalar('select tzg_studio_set_initial_password($1)', 'replacement password'), false);
  await db.exec('reset role');
  await db.exec('set role anon');
  await assert.rejects(scalar('select tzg_studio_open($1)', password), { code: '42501' });
  await db.exec('reset role');

  await claim(developer, session, true);
  assert.equal(await scalar('select tzg_studio_open($1)', password), null);
  await claim(other, otherSession);
  assert.equal(await scalar('select tzg_studio_open($1)', password), null);
  await claim(developer, session);
  await assert.rejects(db.query('select * from tzg_studio.developers'), { code: '42501' });
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal(await scalar('select tzg_studio_open($1)', 'wrong password'), null);
  }
  assert.equal(await scalar('select tzg_studio_open($1)', password), null);
  await db.exec('reset role; update tzg_studio.developers set retry_after = now();');
  await claim(developer, session);
  const token = await scalar('select tzg_studio_open($1)', password);
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(await scalar('select tzg_studio_check($1)', token), true);
  await claim(other, otherSession);
  assert.equal(await scalar('select tzg_studio_check($1)', token), false);
  await claim(developer, session);
  await scalar('select tzg_studio_lock($1)', token);
  assert.equal(await scalar('select tzg_studio_check($1)', token), false);
  const idleToken = await scalar('select tzg_studio_open($1)', password);
  await db.exec("reset role; update tzg_studio.unlocks set last_used_at = now() - interval '10 minutes';");
  await claim(developer, session);
  assert.equal(await scalar('select tzg_studio_check($1)', idleToken), false);
  const liveToken = await scalar('select tzg_studio_open($1)', password);
  await db.exec('reset role');
  await db.query('delete from auth.sessions where id = $1', [session]);
  await claim(developer, session);
  assert.equal(await scalar('select tzg_studio_check($1)', liveToken), false);
  console.log('Studio access authorization, rate limit, lock, expiry and sign-out passed.');
} finally {
  await db.close();
}
