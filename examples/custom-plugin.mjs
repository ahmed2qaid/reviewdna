import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyAnalysisInsights, discoverRules } from '@reviewdna/core';
import { PluginRegistry, assertScoreContribution, definePlugin } from '@reviewdna/plugin-sdk';

const records=JSON.parse(await readFile('fixtures/reviews.json','utf8'));
const repository=records[0]?.repo??'example/repository';
const context={repository,generatedAt:new Date().toISOString()};
const result=applyAnalysisInsights(discoverRules(records,repository,'fixture',{minEvidence:2}));

const exporter=definePlugin({
  apiVersion:'1',kind:'exporter',name:'ndjson-rule-index',version:'0.1.0',
  export(analysis){
    const content=analysis.rules.map(rule=>JSON.stringify({fingerprint:rule.fingerprint,text:rule.text,confidence:rule.confidence})).join('\n');
    return[{path:'rules.ndjson',content:content+(content?'\n':''),mediaType:'application/x-ndjson'}];
  }
});

const scorer=definePlugin({
  apiVersion:'1',kind:'scorer',name:'undocumented-signal',version:'0.1.0',
  score(rule){
    return assertScoreContribution({
      key:'undocumented-signal',
      value:rule.documented?0:2,
      reason:rule.documented?'The convention is already documented.':'The recurring convention is not represented in repository documentation.'
    });
  }
});

const registry=new PluginRegistry();registry.register(exporter);registry.register(scorer);
const outputDir='plugin-example-output';await mkdir(outputDir,{recursive:true});
for(const artifact of await registry.get('exporter','ndjson-rule-index').export(result,context))await writeFile(resolve(outputDir,artifact.path),artifact.content);
const contribution=result.rules[0]?await registry.get('scorer','undocumented-signal').score(result.rules[0],context):undefined;

console.log(`Plugin registry: ${registry.size} plugins`);
console.log(`Exporter wrote: ${resolve(outputDir,'rules.ndjson')}`);
if(contribution)console.log(`Scorer contribution (not auto-applied): ${contribution.key} ${contribution.value} — ${contribution.reason}`);
