import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyAnalysisInsights, discoverRules } from '../packages/core/dist/index.js';

const schema=JSON.parse(await readFile(new URL('../packages/schema/analysis-result.schema.json',import.meta.url),'utf8'));
const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json',import.meta.url),'utf8'));

function resolveRef(root,ref){
  if(!ref.startsWith('#/'))throw new Error(`Unsupported external $ref: ${ref}`);
  return ref.slice(2).split('/').reduce((value,key)=>value?.[key.replace(/~1/g,'/').replace(/~0/g,'~')],root);
}

function validate(value,node,root=schema,path='$'){
  const errors=[];
  if(node.$ref)return validate(value,resolveRef(root,node.$ref),root,path);
  if(Object.hasOwn(node,'const')&&!Object.is(value,node.const))errors.push(`${path} must equal ${JSON.stringify(node.const)}`);
  if(node.enum&&!node.enum.includes(value))errors.push(`${path} must be one of ${node.enum.join(', ')}`);

  if(node.type==='object'){
    if(value===null||typeof value!=='object'||Array.isArray(value))return [...errors,`${path} must be an object`];
    for(const key of node.required??[]){if(!Object.hasOwn(value,key))errors.push(`${path}.${key} is required`);}
    for(const [key,child] of Object.entries(value)){
      const property=node.properties?.[key];
      if(property)errors.push(...validate(child,property,root,`${path}.${key}`));
      else if(node.additionalProperties===false)errors.push(`${path}.${key} is not allowed`);
      else if(node.additionalProperties&&typeof node.additionalProperties==='object')errors.push(...validate(child,node.additionalProperties,root,`${path}.${key}`));
    }
  }else if(node.type==='array'){
    if(!Array.isArray(value))return [...errors,`${path} must be an array`];
    if(node.items)value.forEach((item,index)=>errors.push(...validate(item,node.items,root,`${path}[${index}]`)));
  }else if(node.type==='string'){
    if(typeof value!=='string')errors.push(`${path} must be a string`);
  }else if(node.type==='boolean'){
    if(typeof value!=='boolean')errors.push(`${path} must be a boolean`);
  }else if(node.type==='integer'){
    if(!Number.isInteger(value))errors.push(`${path} must be an integer`);
  }else if(node.type==='number'){
    if(typeof value!=='number'||!Number.isFinite(value))errors.push(`${path} must be a finite number`);
  }

  if(typeof value==='number'){
    if(node.minimum!==undefined&&value<node.minimum)errors.push(`${path} must be >= ${node.minimum}`);
    if(node.maximum!==undefined&&value>node.maximum)errors.push(`${path} must be <= ${node.maximum}`);
  }
  return errors;
}

function analysis(){
  const repository=fixture[0]?.repo??'fixture/repository';
  return applyAnalysisInsights(discoverRules(fixture,repository,'fixture',{minEvidence:2}));
}

test('public AnalysisResult JSON Schema accepts current programmatic output',()=>{
  assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.$id,'https://reviewdna.dev/schema/analysis-result-1.0.json');
  assert.deepEqual(validate(analysis(),schema),[]);
});

test('public AnalysisResult JSON Schema rejects contract-breaking output',()=>{
  const wrongVersion=analysis();wrongVersion.schemaVersion='9.9';
  assert.ok(validate(wrongVersion,schema).some(error=>error.includes('schemaVersion')));
  const unknown=analysis();unknown.untrackedField=true;
  assert.ok(validate(unknown,schema).some(error=>error.includes('untrackedField')));
});

test('@reviewdna/schema exposes the JSON Schema as a package subpath',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../packages/schema/package.json',import.meta.url),'utf8'));
  assert.equal(pkg.exports['./analysis-result.schema.json'],'./analysis-result.schema.json');
});
