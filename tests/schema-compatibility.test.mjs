import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { discoverRules } from '../packages/core/dist/index.js';

const schema = JSON.parse(await readFile(new URL('../packages/schema/analysis-result.schema.json', import.meta.url), 'utf8'));
const abi = JSON.parse(await readFile(new URL('../fixtures/schema/analysis-result-1.0-abi.json', import.meta.url), 'utf8'));

function sorted(values = []) { return [...values].sort(); }

function assertSameSet(actual, expected, label) {
  assert.deepEqual(sorted(actual), sorted(expected), label);
}

function assertPropertiesPreserved(definitionName, baseline) {
  const current = schema.$defs?.[definitionName];
  assert.ok(current, `Missing schema definition ${definitionName}`);
  if (baseline.required) assertSameSet(current.required ?? [], baseline.required, `${definitionName} required fields changed`);
  if (baseline.properties) {
    for (const property of baseline.properties) {
      assert.ok(Object.hasOwn(current.properties ?? {}, property), `${definitionName}.${property} was removed`);
    }
  }
  if (baseline.enum) assertSameSet(current.enum ?? [], baseline.enum, `${definitionName} enum changed`);
}

test('AnalysisResult schema 1.0 preserves its published ABI contract', () => {
  assert.equal(schema.$id, abi.$id);
  assertSameSet(schema.required ?? [], abi.topLevelRequired, 'top-level required fields changed');
  for (const [name, baseline] of Object.entries(abi.definitions)) assertPropertiesPreserved(name, baseline);
});

function review(id, body, reviewer, prNumber) {
  return {
    id,
    repo: 'compat/repo',
    prNumber,
    reviewer,
    body,
    path: 'src/api.ts',
    createdAt: `2026-0${prNumber}-01T00:00:00Z`,
    url: `https://example.test/review/${id}`,
    source: 'review-comment'
  };
}

test('rule fingerprints remain stable when equivalent evidence order and transport metadata change', () => {
  const a = review('a', 'Always validate request payloads before calling the repository layer.', 'alice', 1);
  const b = review('b', 'Validate request payloads before repository access and reject invalid input.', 'bob', 2);
  const first = discoverRules([a, b], 'compat/repo', 'fixture', { minEvidence: 2 });

  const movedA = { ...a, id: 'transport-a', reviewer: 'carol', url: 'https://mirror.test/a' };
  const movedB = { ...b, id: 'transport-b', reviewer: 'dave', url: 'https://mirror.test/b' };
  const second = discoverRules([movedB, movedA], 'compat/repo', 'fixture', { minEvidence: 2 });

  assert.equal(first.rules.length, 1);
  assert.equal(second.rules.length, 1);
  assert.equal(first.rules[0].fingerprint, second.rules[0].fingerprint);
});
