import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { applyAnalysisInsights, discoverRules } from '../packages/core/dist/index.js';

const totalReviews = Number(process.env.REVIEWDNA_LARGE_BENCHMARK_REVIEWS ?? 10000);
if (!Number.isInteger(totalReviews) || totalReviews < 1000 || totalReviews > 100000) {
  throw new Error('REVIEWDNA_LARGE_BENCHMARK_REVIEWS must be an integer between 1000 and 100000.');
}

const templates = [
  ['testing', 'Always add regression tests for behavior changes before merging.', 'tests'],
  ['security', 'Validate untrusted request input before it reaches service or persistence code.', 'src/api'],
  ['architecture', 'Keep database access inside repository modules instead of controllers.', 'src/data'],
  ['error-handling', 'Handle expected errors explicitly and return stable typed error results.', 'src/core'],
  ['dependency', 'Avoid adding a new dependency when the platform already provides the capability.', 'src'],
  ['documentation', 'Update contributor documentation when public workflow behavior changes.', 'docs'],
  ['performance', 'Avoid repeated database queries inside loops and batch related reads.', 'src/data'],
  ['api-design', 'Preserve backwards compatibility for public API response fields.', 'src/api'],
  ['maintainability', 'Extract repeated business logic into a shared service with focused tests.', 'src/services'],
  ['naming', 'Use descriptive domain names instead of ambiguous temporary variable names.', 'src'],
  ['style', 'Keep formatting consistent with the repository formatter and lint rules.', 'src'],
  ['general', 'Prefer small focused changes that are easy to review and verify.', 'src']
];

function review(index) {
  const [, text, area] = templates[index % templates.length];
  const variation = index % 3 === 0 ? ' Please enforce this consistently.' : index % 3 === 1 ? ' This should remain the default convention.' : '';
  return {
    id: `large-${index}`,
    repo: 'benchmark/large-repository',
    prNumber: index + 1,
    reviewer: `reviewer-${index % 37}`,
    body: `${text}${variation}`,
    path: `${area}/module-${index % 71}.ts`,
    createdAt: new Date(Date.UTC(2024 + (index % 3), index % 12, 1 + (index % 27))).toISOString(),
    url: `https://example.test/pull/${index + 1}#review`,
    source: 'review-comment'
  };
}

const records = Array.from({ length: totalReviews }, (_, index) => review(index));
const heapBefore = process.memoryUsage().heapUsed;
const started = performance.now();
const result = applyAnalysisInsights(discoverRules(records, 'benchmark/large-repository', 'fixture', { minEvidence: 2 }));
const elapsedMs = performance.now() - started;
const heapAfter = process.memoryUsage().heapUsed;
const heapDeltaMb = Math.max(0, heapAfter - heapBefore) / 1024 / 1024;

if (result.summary.reviewsAnalyzed !== totalReviews) throw new Error(`Expected ${totalReviews} analyzed reviews, received ${result.summary.reviewsAnalyzed}.`);
if (result.rules.length === 0) throw new Error('Large benchmark unexpectedly discovered zero recurring rules.');
if (!Number.isFinite(elapsedMs) || elapsedMs > 60000) throw new Error(`Large benchmark exceeded broad 60s regression guard: ${elapsedMs.toFixed(0)}ms.`);
if (!Number.isFinite(heapDeltaMb) || heapDeltaMb > 1024) throw new Error(`Large benchmark exceeded broad 1GB heap-delta guard: ${heapDeltaMb.toFixed(1)}MB.`);

const metrics = {
  benchmarkVersion: 1,
  reviews: totalReviews,
  rules: result.rules.length,
  rejected: result.rejected.length,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  reviewsPerSecond: Number((totalReviews / (elapsedMs / 1000)).toFixed(2)),
  heapDeltaMb: Number(heapDeltaMb.toFixed(2)),
  node: process.version,
  platform: process.platform,
  architecture: process.arch
};

await mkdir('benchmark-output', { recursive: true });
await writeFile('benchmark-output/large-repository.json', `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify(metrics, null, 2));
