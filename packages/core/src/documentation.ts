import type { AnalysisResult, DocumentationMatch } from '@reviewdna/schema';
import { applyCodeOwnerEvidence } from './codeowners.js';
import { cosineSimilarity, type EmbeddingProvider } from './embeddings.js';
import { redactSensitiveText } from './sensitive.js';
import { conceptSimilarity, negativePolarity } from './text.js';

export interface DocumentationSource{path:string;content:string;}
export interface SemanticDocumentationOptions{
  threshold?:number;
  conflictThreshold?:number;
  conflictMargin?:number;
  maxFragments?:number;
  maxFragmentsPerSource?:number;
  batchSize?:number;
}

function fragments(content:string){return content.replace(/```[\s\S]*?```/g,' ').split(/\n+|(?<=[.!?])\s+/).map(x=>x.replace(/^\s*[-*#>\d.)]+\s*/,'').trim()).filter(x=>x.length>=18&&x.length<=600);}
function isCodeOwners(path:string){return /(^|\/)CODEOWNERS$/.test(path);}
function refreshDocumentationSummary(result:AnalysisResult){result.summary.undocumentedRules=result.rules.filter(r=>!r.documented).length;result.summary.documentationCoverage=result.rules.length?Math.round(100*(result.rules.length-result.summary.undocumentedRules)/result.rules.length):0;result.summary.documentationDrift=result.rules.filter(r=>r.documentationConflicts.length>0).length;}
function rounded(score:number){return Math.round(score*1000)/1000;}

export function applyDocumentationCoverage(result:AnalysisResult,sources:DocumentationSource[]):AnalysisResult{
  const codeOwners=sources.find(source=>isCodeOwners(source.path)),documentation=sources.filter(source=>!isCodeOwners(source.path));
  for(const rule of result.rules){
    const matches:Array<{path:string;score:number}>=[],conflicts:Array<{path:string;score:number}>=[],provenance:DocumentationMatch[]=[];
    for(const source of documentation){
      let same=0,opposite=0;
      for(const fragment of fragments(source.content)){
        const score=conceptSimilarity(rule.text,fragment);
        if(negativePolarity(rule.text)===negativePolarity(fragment))same=Math.max(same,score);else opposite=Math.max(opposite,score);
      }
      if(same>=.22){matches.push({path:source.path,score:same});provenance.push({path:source.path,kind:'support',matcher:'lexical',score:rounded(same)});}
      if(opposite>=.28&&opposite>same+.03){conflicts.push({path:source.path,score:opposite});provenance.push({path:source.path,kind:'conflict',matcher:'lexical',score:rounded(opposite)});}
    }
    rule.documentedBy=matches.sort((a,b)=>b.score-a.score).map(x=>x.path);
    rule.documentationConflicts=conflicts.sort((a,b)=>b.score-a.score).map(x=>x.path);
    rule.documentationEvidence=provenance;
    rule.documented=rule.documentedBy.length>0;
  }
  result.metadata.documentationMatcher='lexical';
  refreshDocumentationSummary(result);
  return applyCodeOwnerEvidence(result,codeOwners);
}

async function embedBatches(provider:EmbeddingProvider,texts:string[],batchSize:number):Promise<number[][]>{
  const out:number[][]=[];
  for(let index=0;index<texts.length;index+=batchSize){out.push(...await provider.embed(texts.slice(index,index+batchSize)));}
  if(out.length!==texts.length)throw new Error(`Embedding provider ${provider.name} returned ${out.length} vectors for ${texts.length} documentation inputs.`);
  return out;
}

export async function applySemanticDocumentationCoverage(result:AnalysisResult,sources:DocumentationSource[],provider:EmbeddingProvider,options:SemanticDocumentationOptions={}):Promise<AnalysisResult>{
  const threshold=options.threshold??provider.recommendedThreshold??.72,conflictThreshold=options.conflictThreshold??Math.min(1,threshold+.04),margin=options.conflictMargin??.03;
  if(!Number.isFinite(threshold)||threshold<=0||threshold>1)throw new Error('Semantic documentation threshold must be > 0 and <= 1.');
  if(!Number.isFinite(conflictThreshold)||conflictThreshold<=0||conflictThreshold>1)throw new Error('Semantic documentation conflict threshold must be > 0 and <= 1.');
  if(!Number.isFinite(margin)||margin<0||margin>=1)throw new Error('Semantic documentation conflict margin must be >= 0 and < 1.');
  const maxFragments=Math.max(1,Math.floor(options.maxFragments??400)),maxPerSource=Math.max(1,Math.floor(options.maxFragmentsPerSource??80)),batchSize=Math.max(1,Math.min(256,Math.floor(options.batchSize??64)));
  const documentation=sources.filter(source=>!isCodeOwners(source.path));
  const fragmentRows:Array<{path:string;text:string;negative:boolean}>=[];
  for(const source of documentation){for(const text of fragments(source.content).slice(0,maxPerSource)){if(fragmentRows.length>=maxFragments)break;fragmentRows.push({path:source.path,text,negative:negativePolarity(text)});}if(fragmentRows.length>=maxFragments)break;}
  if(!result.rules.length||!fragmentRows.length){result.metadata.documentationMatcher='semantic';result.metadata.documentationEmbeddingProvider=provider.name;result.metadata.documentationSemanticThreshold=threshold;return result;}
  const texts=[...result.rules.map(rule=>rule.text),...fragmentRows.map(row=>row.text)],vectors=await embedBatches(provider,texts,batchSize),ruleVectors=vectors.slice(0,result.rules.length),fragmentVectors=vectors.slice(result.rules.length);
  for(let ruleIndex=0;ruleIndex<result.rules.length;ruleIndex++){
    const rule=result.rules[ruleIndex]!,vector=ruleVectors[ruleIndex]??[],negative=negativePolarity(rule.text),sameByPath=new Map<string,number>(),oppositeByPath=new Map<string,number>();
    for(let fragmentIndex=0;fragmentIndex<fragmentRows.length;fragmentIndex++){
      const row=fragmentRows[fragmentIndex]!,score=cosineSimilarity(vector,fragmentVectors[fragmentIndex]??[]),target=row.negative===negative?sameByPath:oppositeByPath;
      target.set(row.path,Math.max(target.get(row.path)??0,score));
    }
    const documented=new Set(rule.documentedBy),conflicts=new Set(rule.documentationConflicts),provenance=[...(rule.documentationEvidence??[])];
    for(const source of documentation){
      const same=sameByPath.get(source.path)??0,opposite=oppositeByPath.get(source.path)??0;
      if(same>=threshold){documented.add(source.path);provenance.push({path:source.path,kind:'support',matcher:'semantic',score:rounded(same)});}
      if(opposite>=conflictThreshold&&opposite>same+margin){conflicts.add(source.path);provenance.push({path:source.path,kind:'conflict',matcher:'semantic',score:rounded(opposite)});}
    }
    const unique=new Map<string,DocumentationMatch>();for(const match of provenance){const key=`${match.path}|${match.kind}|${match.matcher}`,previous=unique.get(key);if(!previous||match.score>previous.score)unique.set(key,match);}
    rule.documentedBy=[...documented];rule.documentationConflicts=[...conflicts];rule.documentationEvidence=[...unique.values()].sort((a,b)=>b.score-a.score);rule.documented=rule.documentedBy.length>0;
  }
  result.metadata.documentationMatcher='semantic';result.metadata.documentationEmbeddingProvider=provider.name;result.metadata.documentationSemanticThreshold=threshold;
  refreshDocumentationSummary(result);
  return result;
}

export interface RedactionOptions{reviewers?:boolean;paths?:boolean;evidenceBodies?:boolean;sensitiveText?:boolean;}
function alias(input:string){let hash=2166136261;for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}return`reviewer-${(hash>>>0).toString(36).slice(0,6)}`;}
export function redactAnalysis(input:AnalysisResult,options:RedactionOptions={reviewers:true,paths:true,evidenceBodies:false,sensitiveText:false}):AnalysisResult{
  const result=JSON.parse(JSON.stringify(input)) as AnalysisResult;let sensitiveRedactions=0;
  const scrub=(text:string|undefined)=>{if(text===undefined||!options.sensitiveText)return text;const redacted=redactSensitiveText(text);sensitiveRedactions+=redacted.replacements;return redacted.text;};
  for(const rule of result.rules){
    if(options.sensitiveText){rule.text=scrub(rule.text)??rule.text;if(rule.originalText!==undefined)rule.originalText=scrub(rule.originalText);if(rule.humanDecision?.reason!==undefined)rule.humanDecision.reason=scrub(rule.humanDecision.reason);if(rule.humanDecision?.overrideText!==undefined)rule.humanDecision.overrideText=scrub(rule.humanDecision.overrideText);}
    if(options.paths){rule.scope=rule.scope.map(()=>'[redacted-scope]');rule.documentedBy=rule.documentedBy.map(()=>'[redacted-document]');rule.documentationConflicts=rule.documentationConflicts.map(()=>'[redacted-document]');if(rule.documentationEvidence)rule.documentationEvidence=rule.documentationEvidence.map(match=>({...match,path:'[redacted-document]'}));}
    for(const e of rule.evidence){if(options.reviewers)e.reviewer=alias(e.reviewer);if(options.paths&&e.path)e.path='[redacted-path]';if(options.evidenceBodies)e.body='[redacted review text]';else if(options.sensitiveText)e.body=scrub(e.body)??e.body;}
  }
  if(options.sensitiveText){for(const rejected of result.rejected)rejected.body=scrub(rejected.body)??rejected.body;result.metadata.sensitiveRedactions=sensitiveRedactions;}
  result.metadata.redacted=true;return result;
}
