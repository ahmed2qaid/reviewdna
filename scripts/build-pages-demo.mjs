import { cp, mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyAnalysisInsights } from '../packages/core/dist/index.js';
import { renderHtml, renderShareSvg } from '../packages/report/dist/index.js';

const sourceDir=resolve('demo-output'),docsDir=resolve('_docs'),siteDir=resolve('_site');
const raw=JSON.parse(await readFile(resolve(sourceDir,'reviewdna.json'),'utf8'));
const result=applyAnalysisInsights(raw);
result.summary.repository='ReviewDNA synthetic demo · acme/backend';
result.metadata.source='fixture';

await rm(siteDir,{recursive:true,force:true});
await mkdir(siteDir,{recursive:true});
await Promise.all([
  writeFile(resolve(siteDir,'index.html'),renderHtml(result)),
  writeFile(resolve(siteDir,'share-card.svg'),renderShareSvg(result)),
  writeFile(resolve(siteDir,'reviewdna.json'),JSON.stringify(result,null,2)),
  copyFile(resolve(sourceDir,'engineering-dna.md'),resolve(siteDir,'engineering-dna.md')),
  cp(docsDir,resolve(siteDir,'docs'),{recursive:true})
]);

await writeFile(resolve(siteDir,'.nojekyll'),'');
console.log(`ReviewDNA Pages demo built at ${siteDir}`);
console.log(`Docs: ${resolve(siteDir,'docs','index.html')}`);
console.log(`Rules: ${result.summary.rules} · Hotspots: ${result.insights?.reviewHotspots.length??0} · Automation candidates: ${result.insights?.automationOpportunities.length??0}`);
