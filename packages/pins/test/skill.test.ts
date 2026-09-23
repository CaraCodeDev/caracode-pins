import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSkill, markerLine, markerVersion, SKILL_PATH, withMarker } from '../src/skill.js';

const SKILL = '---\nname: pins\ndescription: test skill\n---\n\n# Pins\n\nBody.\n';

describe('skill installer', () => {
  let root: string;
  let logs: string[];
  const logger = { info: (m: string) => logs.push(m) };
  const target = () => path.join(root, SKILL_PATH);
  const install = (version: string) => installSkill({ siteRoot: root, logger, skill: SKILL, version });

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'carapin-skill-'));
    logs = [];
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('missing → writes it with the marker after the frontmatter, logs one line', async () => {
    expect(await install('1.0.0')).toBe('written');
    const content = await readFile(target(), 'utf8');
    expect(content).toBe(`---\nname: pins\ndescription: test skill\n---\n${markerLine('1.0.0')}\n\n# Pins\n\nBody.\n`);
    expect(content.startsWith('---\n')).toBe(true);
    expect(markerVersion(content)).toBe('1.0.0');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('Installed');
  });

  it('carapin marker with an older version → overwrites, logs one line', async () => {
    await mkdir(path.dirname(target()), { recursive: true });
    await writeFile(target(), withMarker('---\nname: pins\n---\nold body\n', '0.9.0'));
    expect(await install('1.0.0')).toBe('updated');
    const content = await readFile(target(), 'utf8');
    expect(content).toBe(withMarker(SKILL, '1.0.0'));
    expect(logs).toEqual([expect.stringContaining('v0.9.0 → v1.0.0')]);
  });

  it('no marker (user-owned) → never touches it, logs one line', async () => {
    await mkdir(path.dirname(target()), { recursive: true });
    const mine = '---\nname: pins\ndescription: my own\n---\nMy rules.\n';
    await writeFile(target(), mine);
    const before = await stat(target());
    expect(await install('1.0.0')).toBe('user-owned');
    expect(await readFile(target(), 'utf8')).toBe(mine);
    expect((await stat(target())).mtimeMs).toBe(before.mtimeMs);
    expect(logs).toEqual([expect.stringContaining('no carapin marker')]);
  });

  it('current version → no write, no log', async () => {
    await install('1.0.0');
    const before = await stat(target());
    logs = [];
    expect(await install('1.0.0')).toBe('current');
    expect((await stat(target())).mtimeMs).toBe(before.mtimeMs);
    expect(logs).toEqual([]);
  });

  it('defaults to the packaged skill/SKILL.md and package.json version', async () => {
    const pkgDir = path.resolve(import.meta.dirname, '..');
    const version = JSON.parse(await readFile(path.join(pkgDir, 'package.json'), 'utf8')).version;
    const skill = await readFile(path.join(pkgDir, 'skill', 'SKILL.md'), 'utf8');
    expect(await installSkill({ siteRoot: root, logger })).toBe('written');
    const content = await readFile(target(), 'utf8');
    expect(content).toBe(withMarker(skill, version));
    expect(content).toMatch(/^---\nname: pins\ndescription: .+\n---\n<!-- carapin-skill v/);
  });
});

describe('installSkill: edited skill text, same version', () => {
  it('overwrites a carapin copy whose text differs even when the version matches', async () => {
    const { mkdtemp, mkdir, writeFile, readFile } = await import('node:fs/promises');
    const os = await import('node:os');
    const path = await import('node:path');
    const root = await mkdtemp(path.join(os.tmpdir(), 'pins-skill-'));
    const file = path.join(root, SKILL_PATH);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, withMarker('---\nname: pins\n---\nold text\n', '1.0.0'));
    const logs: string[] = [];
    const next = '---\nname: pins\n---\nnew text\n';
    expect(await installSkill({ siteRoot: root, logger: { info: (m) => logs.push(m) }, skill: next, version: '1.0.0' })).toBe('updated');
    expect(await readFile(file, 'utf8')).toBe(withMarker(next, '1.0.0'));
    expect(logs).toHaveLength(1);
  });
});
