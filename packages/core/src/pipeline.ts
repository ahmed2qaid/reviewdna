import type { AnalysisResult, ReviewRecord } from '@reviewdna/schema';
import type { DocumentationSource } from './documentation.js';

export type PipelineCheckpointStage = 'discovery' | 'documentation' | 'refinement' | 'decisions' | 'final';

export interface PipelineCheckpoint {
  version: 1;
  repository: string;
  inputHash: string;
  optionsHash: string;
  stage: PipelineCheckpointStage;
  updatedAt: string;
  result: AnalysisResult;
}

const STAGE_ORDER:PipelineCheckpointStage[]=['discovery','documentation','refinement','decisions','final'];

function canonical(value:unknown):string{
  if(value===null)return'null';
  if(typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='bigint')return JSON.stringify(value.toString());
  if(value===undefined)return'null';
  if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;
  if(typeof value==='object'){
    const object=value as Record<string,unknown>,keys=Object.keys(object).filter(key=>object[key]!==undefined).sort();
    return`{${keys.map(key=>`${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

export function stableContentHash(value:unknown):string{
  const text=canonical(value);
  let hash=0xcbf29ce484222325n;
  for(let index=0;index<text.length;index++){
    const code=text.charCodeAt(index);
    hash^=BigInt(code&0xff);hash=BigInt.asUintN(64,hash*0x100000001b3n);
    if(code>0xff){hash^=BigInt(code>>>8);hash=BigInt.asUintN(64,hash*0x100000001b3n);}
  }
  return`rdna-h1-${hash.toString(16).padStart(16,'0')}`;
}

export function reviewContentIdentity(review:ReviewRecord):string{
  return stableContentHash({
    id:review.id,repo:review.repo,prNumber:review.prNumber,source:review.source,author:review.author,reviewer:review.reviewer,
    body:review.body,path:review.path,createdAt:review.createdAt,url:review.url,resolved:review.resolved,accepted:review.accepted,
    changedAfterReview:review.changedAfterReview,deepEvidenceChecked:review.deepEvidenceChecked,explicitResponse:review.explicitResponse
  });
}

export function analysisInputHash(records:ReviewRecord[],documentation:DocumentationSource[]=[]):string{
  const reviews=records.map(reviewContentIdentity).sort(),docs=documentation.map(source=>({path:source.path,hash:stableContentHash(source.content)})).sort((a,b)=>a.path.localeCompare(b.path));
  return stableContentHash({reviews,docs});
}

export function pipelineOptionsHash(options:unknown):string{return stableContentHash(options);}

export function checkpointStageAtLeast(stage:PipelineCheckpointStage,target:PipelineCheckpointStage):boolean{
  return STAGE_ORDER.indexOf(stage)>=STAGE_ORDER.indexOf(target);
}

export function createPipelineCheckpoint(repository:string,inputHash:string,optionsHash:string,stage:PipelineCheckpointStage,result:AnalysisResult,now=new Date()):PipelineCheckpoint{
  return{version:1,repository,inputHash,optionsHash,stage,updatedAt:now.toISOString(),result:JSON.parse(JSON.stringify(result)) as AnalysisResult};
}

export function validPipelineCheckpoint(value:unknown,repository:string,inputHash:string,optionsHash:string):PipelineCheckpoint|undefined{
  if(!value||typeof value!=='object')return undefined;
  const checkpoint=value as Partial<PipelineCheckpoint>;
  if(checkpoint.version!==1||checkpoint.repository!==repository||checkpoint.inputHash!==inputHash||checkpoint.optionsHash!==optionsHash)return undefined;
  if(!checkpoint.stage||!STAGE_ORDER.includes(checkpoint.stage)||!checkpoint.result||checkpoint.result.schemaVersion!=='1.0')return undefined;
  if(typeof checkpoint.updatedAt!=='string'||!Array.isArray(checkpoint.result.rules))return undefined;
  return checkpoint as PipelineCheckpoint;
}
