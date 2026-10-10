import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { TaskSelection } from '../src/task-selection.mjs';
import { loadTracking, saveTracking } from '../src/tracking-store.mjs';
import { waitingFrequencies, waitingChordSource } from '../src/waiting-tone.mjs';
import { formatClientStatus, waitingCount } from '../src/client-status.mjs';

test('sound selection follows IDs through reordering', () => {
  const view = new TaskSelection();
  view.update([{ id: 'a' }, { id: 'b' }]);
  view.key('down'); view.key('space');
  view.update([{ id: 'b' }, { id: 'a' }, { id: 'c' }]);
  assert.equal(view.tasks[view.cursor].id, 'b');
  assert.deepEqual(view.tracked.map(t => t.id), ['a', 'c']);
  view.update([]); view.key('space'); view.key('down');
  assert.equal(view.cursor, 0);
});

test('selected choices persist across restart, isolated by server', async () => {
  const root = await mkdtemp(join(tmpdir(), 'koala-client-test-'));
  try {
    const view = new TaskSelection();
    view.update([{ id: 'a' }, { id: 'b' }]);
    view.key('n'); view.key('down'); view.key('space');
    await saveTracking(root, 'https://one.example/', view.snapshot());
    const restarted = new TaskSelection(await loadTracking(root, 'https://one.example'));
    restarted.update([{ id: 'b' }, { id: 'a' }, { id: 'new' }]);
    assert.deepEqual(restarted.tracked.map(t => t.id), ['b']);
    assert.equal(await loadTracking(root, 'https://two.example'), undefined);
    const [file] = await readdir(join(root, 'client-tracking'));
    await writeFile(join(root, 'client-tracking', file), '{broken');
    await assert.rejects(loadTracking(root, 'https://one.example'), /couldn't read saved sound selection/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('harmony starts at C3, layers octaves, and stays below Nyquist', () => {
  assert.deepEqual(waitingFrequencies(0), []);
  const voices = waitingFrequencies(3);
  assert.ok(Math.abs(voices[0] - 130.8128) < 0.001);
  assert.equal(voices[1] / voices[0], 2);
  assert.equal(voices[2] / voices[1], 2);
  assert.deepEqual(waitingFrequencies(4).slice(0, 3), voices);
  const full = waitingFrequencies(100);
  assert.ok(full.at(-1) > 16000 && full.at(-1) < 22050);
  assert.equal(waitingChordSource(0), null);
});

test('actual ffmpeg accepts full octave mix', context => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', waitingChordSource(10), '-t', '0.1', '-f', 'null', '-'], { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') return context.skip('ffmpeg not installed');
  assert.equal(result.status, 0, result.stderr);
});

test('only selected active waiting sessions sound; idle is not waiting', () => {
  const task = { id: '01960000-0000-7000-8000-000000000001', title: 'hello\x1b[2J\nworld', status: 'active', updated_at: '2026-10-01', pty: { running: true }, needsInput: { since: '2026-10-01', question: false } };
  const view = new TaskSelection();
  view.update([task, { ...task, id: 'done', status: 'done' }, { ...task, id: 'idle', needsInput: undefined }]);
  assert.equal(waitingCount(view.tracked), 1);
  view.key('space');
  assert.equal(waitingCount(view.tracked), 0);
  const text = formatClientStatus([task], 'https://one.example', Date.now(), view);
  assert.ok(text.includes('> [ ]'));
  assert.ok(text.includes('waiting for input'));
  assert.ok(!text.includes('\x1b'));
});
