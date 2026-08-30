import assert from 'node:assert/strict';
import { access, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../apps/cli/dist/index.js', import.meta.url));
const fixture = fileURLToPath(new URL('../fixtures/reviews.json', import.meta.url));
const out = 'e2e-output';

await rm(out, { recursive: true, force: true });

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' }
  });
  if (result.status !== 0) {
    throw new Error(`CLI failed (${args.join(' ')}):\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return result;
}

run(['doctor']);
run(['analyze-fixture', fixture, '--out', out]);

for (const path of [
  `${out}/reviewdna.json`,
  `${out}/reviewdna-report.html`,
  `${out}/engineering-dna.md`,
  `${out}/AGENTS.suggested.md`
]) await access(path);

const analysis = JSON.parse(await readFile(`${out}/reviewdna.json`, 'utf8'));
assert.equal(analysis.schemaVersion, '1.0');
assert.equal(analysis.metadata.source, 'fixture');
assert.ok(analysis.summary.reviewsAnalyzed > 0);
assert.ok(Array.isArray(analysis.rules));

console.log(`ReviewDNA E2E passed on ${process.platform}/${process.arch} with Node ${process.version}.`);
