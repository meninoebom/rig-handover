import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const GOOD_NIGHT = '2026-11-01';
const EMPTY_NIGHT = '2026-11-02';
const BAD_NIGHT = '2026-11-03';
const MISSING_NIGHT = '2026-11-04';

const goodLines = [
  { at: '2026-11-01T01:00:00+01:00', job: 'zeta/last', status: 'ok', owner: 'sam', error: null },
  { at: '2026-11-01T02:00:00+01:00', job: 'alpha/first', status: 'retry', owner: null, error: 'timeout' },
  { at: '2026-11-01T03:00:00+01:00', job: 'alpha/first', status: 'ok', owner: null, error: null },
  { at: '2026-11-01T04:00:00+01:00', job: 'mid/job', status: 'fail', owner: 'kim', error: 'boom' },
]
  .map((line) => JSON.stringify(line))
  .join('\n');

const badLineNight = [
  JSON.stringify({ at: '2026-11-03T01:00:00+01:00', job: 'only/job', status: 'ok', owner: 'sam', error: null }),
  'this is not json',
].join('\n');

let runsDir: string;

function app() {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(runsDir, `${GOOD_NIGHT}.jsonl`), `${goodLines}\n`);
  writeFileSync(join(runsDir, `${EMPTY_NIGHT}.jsonl`), '');
  writeFileSync(join(runsDir, `${BAD_NIGHT}.jsonl`), `${badLineNight}\n`);
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('answers 200 with the jobs of the night', async () => {
    const res = await app().request(`/digest/${GOOD_NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`digest ${GOOD_NIGHT}`);
    expect(html).toContain('alpha/first');
    expect(html).not.toContain('could not be read');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app().request(`/digest/${MISSING_NIGHT}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`no digest for ${MISSING_NIGHT}`);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app().request(`/digest/${EMPTY_NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });

  it('says a line could not be read for a night with a bad line', async () => {
    const res = await app().request(`/digest/${BAD_NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line could not be read');
    expect(html).toContain('only/job');
  });
});

describe('GET /api/digest/:night', () => {
  it('answers 200 with the night as JSON', async () => {
    const res = await app().request(`/api/digest/${GOOD_NIGHT}`);
    const night = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(night.night).toBe(GOOD_NIGHT);
    expect(night.badLines).toBe(0);
    expect(night.rows).toHaveLength(3);
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app().request(`/api/digest/${MISSING_NIGHT}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no digest for this night', night: MISSING_NIGHT });
  });

  it('returns empty rows for an empty night', async () => {
    const res = await app().request(`/api/digest/${EMPTY_NIGHT}`);
    const night = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(night.rows).toEqual([]);
    expect(night.badLines).toBe(0);
  });

  it('reports badLines for a night with a bad line', async () => {
    const res = await app().request(`/api/digest/${BAD_NIGHT}`);
    const night = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual(['only/job']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const api = (await (await app().request(`/api/digest/${GOOD_NIGHT}`)).json()) as Night;
    const html = await (await app().request(`/digest/${GOOD_NIGHT}`)).text();
    const apiJobs = api.rows.map((r) => r.job);
    const pageJobs = [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]);
    expect(apiJobs).toEqual(['alpha/first', 'mid/job', 'zeta/last']);
    expect(pageJobs).toEqual(apiJobs);
  });
});
