import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  analysisInputHash, applyAnalysisInsights, checkpointStageAtLeast, createPipelineCheckpoint, pipelineOptionsHash,
  validPipelineCheckpoint, type DocumentationSource, type PipelineCheckpoint, type PipelineCheckpointStage
} from '@reviewdna/core';
import type { AnalysisResult, ReviewRecord } from '@reviewdna/schema';

export interface CheckpointPipelineSteps {
  discovery:()=>Promise<AnalysisResult>;
  documentation:(result:AnalysisResult)=>Promise<AnalysisResult>;
  refinement:(result:AnalysisResult)=>Promise<AnalysisResult>;
  decisions:(result:AnalysisResult)=>Promise<AnalysisResult>;
}

export interface CheckpointPipelineOptions {
  repository:string;
  records:ReviewRecord[];
  documentation:DocumentationSource[];
  optionsIdentity:unknown;
  checkpointFile:string;
  resume:boolean;
  enabled:boolean;
  steps:CheckpointPipelineSteps;
  onResume?:(stage:PipelineCheckpointStage)=>void;
  onCheckpoint?:(stage:PipelineCheckpointStage)=>void;
}

async function readCheckpoint(path:string,repository:string,inputHash:string,optionsHash:string):Promise<PipelineCheckpoint|undefined>{
  try{return validPipelineCheckpoint(JSON.parse(await readFile(path,'utf8')),repository,inputHash,optionsHash);}catch{return undefined;}
}

async function persistCheckpoint(path:string,checkpoint:PipelineCheckpoint):Promise<void>{
  const parent=resolve(path,'..');await mkdir(parent,{recursive:true});
  await writeFile(path,JSON.stringify(checkpoint,null,2));
}

export async function runCheckpointedPipeline(options:CheckpointPipelineOptions):Promise<{result:AnalysisResult;inputHash:string;optionsHash:string;resumedFrom?:PipelineCheckpointStage}>{
  const inputHash=analysisInputHash(options.records,options.documentation),optionsHash=pipelineOptionsHash(options.optionsIdentity);
  const checkpoint=options.enabled&&options.resume?await readCheckpoint(options.checkpointFile,options.repository,inputHash,optionsHash):undefined;
  const resumedFrom=checkpoint?.stage;
  if(resumedFrom)options.onResume?.(resumedFrom);
  const save=async(stage:PipelineCheckpointStage,result:AnalysisResult)=>{
    if(!options.enabled)return;
    await persistCheckpoint(options.checkpointFile,createPipelineCheckpoint(options.repository,inputHash,optionsHash,stage,result));options.onCheckpoint?.(stage);
  };

  let result:AnalysisResult;
  if(checkpoint&&checkpointStageAtLeast(checkpoint.stage,'discovery'))result=checkpoint.result;
  else{result=await options.steps.discovery();await save('discovery',result);}

  if(!(checkpoint&&checkpointStageAtLeast(checkpoint.stage,'documentation'))){result=await options.steps.documentation(result);await save('documentation',result);}
  if(!(checkpoint&&checkpointStageAtLeast(checkpoint.stage,'refinement'))){result=await options.steps.refinement(result);await save('refinement',result);}
  if(!(checkpoint&&checkpointStageAtLeast(checkpoint.stage,'decisions'))){result=await options.steps.decisions(result);await save('decisions',result);}

  result=applyAnalysisInsights(result);
  if(resumedFrom)result.metadata.resumedFromCheckpoint=resumedFrom;
  await save('final',result);
  return{result,inputHash,optionsHash,...(resumedFrom?{resumedFrom}:{})};
}
