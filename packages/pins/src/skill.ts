/**
 * Installs carapin's Claude skill into the site (M3 Decision 2), from the dev
 * server only. This is carapin's one write outside `.carapin/`.
 *
 * The installed copy carries a marker line with the package version, placed
 * after the frontmatter as an HTML comment so frontmatter parsing is unaffected:
 *
 *   <!-- carapin-skill v0.1.0 · … -->
 *
 * - missing                       → write it, log one line
 * - carapin marker, content differs (new version or edited skill) → overwrite, log one line
 * - no marker (the user's own file) → never touch it, log one line
 * - carapin marker, identical      → nothing, no log
 *
 * Comparing content rather than just the version means skill edits reach the
 * site while the package version stays put (e.g. during carapin's own development).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where the skill goes, relative to the site root. */
export const SKILL_PATH = '.claude/skills/pins/SKILL.md';

const MARKER_RE = /^<!-- carapin-skill v(\S+) /m;

export function markerLine(version: string): string {
  return `<!-- carapin-skill v${version} · installed by @caracode/pins on dev start; delete this line to keep your own edits -->`;
}

/** The carapin version in an installed file, or null if it has no carapin marker. */
export function markerVersion(content: string): string | null {
  return MARKER_RE.exec(content)?.[1] ?? null;
}

/** Puts the marker line straight after the frontmatter (or first, if there is none). */
export function withMarker(skill: string, version: string): string {
  const marker = markerLine(version);
  const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(skill);
  if (!fm) return `${marker}\n\n${skill}`;
  return `${fm[0]}${marker}\n${skill.slice(fm[0].length)}`;
}

export interface SkillLogger {
  info(message: string): void;
}

export type InstallResult = 'written' | 'updated' | 'user-owned' | 'current';

export interface InstallOptions {
  siteRoot: string;
  logger: SkillLogger;
  /** Overrides for tests; default to the package's own `skill/SKILL.md` and `package.json`. */
  skill?: string;
  version?: string;
}

// Both resolve from `dist/skill.js`: `<package>/dist/../skill/SKILL.md`, the same
// layout in this workspace and in node_modules/@caracode/pins.
const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));

async function packageVersion(): Promise<string> {
  const pkg = JSON.parse(await readFile(path.join(PACKAGE_DIR, 'package.json'), 'utf8')) as { version?: unknown };
  if (typeof pkg.version !== 'string') throw new Error('@caracode/pins package.json has no version');
  return pkg.version;
}

export async function installSkill(opts: InstallOptions): Promise<InstallResult> {
  const version = opts.version ?? (await packageVersion());
  const target = path.join(opts.siteRoot, SKILL_PATH);

  let existing: string | null = null;
  try {
    existing = await readFile(target, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  let result: InstallResult;
  if (existing === null) {
    result = 'written';
  } else {
    const installed = markerVersion(existing);
    if (installed === null) {
      opts.logger.info(`${SKILL_PATH} has no carapin marker, so it's yours; leaving it alone.`);
      return 'user-owned';
    }
    result = 'updated';
  }

  const skill = opts.skill ?? (await readFile(path.join(PACKAGE_DIR, 'skill', 'SKILL.md'), 'utf8'));
  const next = withMarker(skill, version);
  if (existing === next) return 'current';
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, next);
  opts.logger.info(
    result === 'written'
      ? `Installed the pins skill for Claude at ${SKILL_PATH} (v${version}).`
      : `Updated the pins skill for Claude at ${SKILL_PATH} (v${markerVersion(existing!)} → v${version}).`,
  );
  return result;
}
