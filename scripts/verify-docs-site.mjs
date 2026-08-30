import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const requiredPages = [
  '_docs/index.html',
  '_docs/migration.html',
  '_docs/security.html',
  '_docs/security-audit.html',
  '_docs/plugins.html',
  '_docs/programmatic-api.html',
  '_docs/gitlab.html',
  '_site/docs/index.html',
  '_site/docs/migration.html',
  '_site/docs/search-index.json'
];

for (const path of requiredPages) await access(path);

const index = JSON.parse(await readFile('_docs/search-index.json', 'utf8'));
assert.ok(Array.isArray(index));
assert.ok(index.length >= 10, `Expected at least 10 indexed docs, received ${index.length}.`);
assert.equal(index.some(item => item.page === 'migration.html'), true);
assert.equal(index.some(item => item.page === 'plugins.html'), true);
assert.equal(index.some(item => item.page === 'programmatic-api.html'), true);

const migration = await readFile('_site/docs/migration.html', 'utf8');
assert.ok(migration.includes('ReviewDNA migration guide'));
assert.ok(migration.includes('schemaVersion'));
assert.equal(migration.includes('<script>alert('), false);

const docsHome = await readFile('_site/docs/index.html', 'utf8');
assert.ok(docsHome.includes('ReviewDNA Docs'));
assert.ok(docsHome.includes('Filter documentation'));
assert.ok(docsHome.includes('search-index'));

console.log(`ReviewDNA docs site verification passed with ${index.length} indexed pages.`);
