import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyAnalysisInsights, discoverRules } from '@reviewdna/core';
import { renderHtml, renderShareSvg } from '@reviewdna/report';

const fixturePath=process.argv[2]??'fixtures/reviews.json';
const outputDir=process.argv[3]??'example-output';
const records=JSON.parse(await readFile(fixturePath,'utf8'));
if(!Array.isArray(records)||records.length===0)throw new Error('Expected a non-empty ReviewRecord array.');

const repository=records[0]?.repo??'example/repository';
let result=discoverRules(records,repository,'fixture',{minEvidence:2});
result=applyAnalysisInsights(result);

await mkdir(outputDir,{recursive:true});
await Promise.all([
  writeFile(resolve(outputDir,'reviewdna.json'),JSON.stringify(result,null,2)),
  writeFile(resolve(outputDir,'reviewdna-report.html'),renderHtml(result)),
  writeFile(resolve(outputDir,'reviewdna-share-card.svg'),renderShareSvg(result))
]);

console.log(`Programmatic ReviewDNA analysis complete for ${repository}.`);
console.log(`Rules: ${result.summary.rules} · Hotspots: ${result.insights?.reviewHotspots.length??0}`);
console.log(`Output: ${resolve(outputDir)}`);
