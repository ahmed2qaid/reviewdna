import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REVIEWDNA_PLUGIN_API_VERSION, PluginRegistry, assertPlugin, assertScoreContribution, definePlugin
} from '../packages/plugin-sdk/dist/index.js';

const context={repository:'acme/repo',generatedAt:'2026-08-30T00:00:00Z'};

const collector=definePlugin({
  apiVersion:REVIEWDNA_PLUGIN_API_VERSION,
  kind:'collector',
  name:'fixture-collector',
  version:'0.1.0',
  async collect(request){return{records:[],documentation:[{path:'AGENTS.md',content:`Repository: ${request.repository}`}],cursor:'next'};}
});

const exporter=definePlugin({
  apiVersion:'1',kind:'exporter',name:'json-summary',
  export(result){return[{path:'summary.json',mediaType:'application/json',content:JSON.stringify(result.summary)}];}
});

const scorer=definePlugin({
  apiVersion:'1',kind:'scorer',name:'maintainer-signal',
  score(){return{key:'maintainer-signal',value:3,reason:'Direct maintainer evidence adds a small explainable contribution.'};}
});

const provider=definePlugin({
  apiVersion:'1',kind:'provider',name:'local-test-provider',capabilities:['embedding','rule-refinement'],recommendedThreshold:.7,
  async embed(texts){return texts.map((_,index)=>[index+1,1]);},
  async refineRule(rule){return rule.text;}
});

test('plugin registry stores typed plugin kinds without silent replacement',()=>{
  const registry=new PluginRegistry();
  registry.register(collector);registry.register(exporter);registry.register(scorer);registry.register(provider);
  assert.equal(registry.size,4);
  assert.equal(registry.get('collector','fixture-collector'),collector);
  assert.equal(registry.list('provider').length,1);
  assert.equal(registry.has('exporter','json-summary'),true);
  assert.throws(()=>registry.register(collector),/duplicate plugin collector:fixture-collector/);
});

test('collector and provider contracts are executable',async()=>{
  const collected=await collector.collect({repository:'acme/repo',maxItems:5},context);
  assert.deepEqual(collected.records,[]);
  assert.equal(collected.documentation?.[0]?.path,'AGENTS.md');
  assert.deepEqual(await provider.embed?.(['a','b'],context),[[1,1],[2,1]]);
});

test('plugin runtime validation rejects incompatible API versions and capabilities',()=>{
  assert.throws(()=>assertPlugin({apiVersion:'2',kind:'collector',name:'bad',collect(){}}),/apiVersion must be 1/);
  assert.throws(()=>assertPlugin({apiVersion:'1',kind:'provider',name:'missing-embed',capabilities:['embedding']}),/does not implement embed/);
  assert.throws(()=>assertPlugin({apiVersion:'1',kind:'exporter',name:'Bad Name',export(){}}),/name must be a lowercase slug/);
});

test('score contributions are bounded and explainable',()=>{
  assert.equal(assertScoreContribution({key:'review-signal',value:4,reason:'Repeated accepted evidence.'}).value,4);
  assert.throws(()=>assertScoreContribution({key:'review-signal',value:26,reason:'Too large.'}),/between -25 and 25/);
  assert.throws(()=>assertScoreContribution({key:'review-signal',value:2,reason:''}),/reason must explain/);
});
