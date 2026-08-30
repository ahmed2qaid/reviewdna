import type { AnalysisResult, ClassifiedReview, EngineeringRule, ReviewRecord, RuleEvidence, RuleStatus } from '@reviewdna/schema';
import { classifyReview } from './classification.js';
import { GENERALIZERS, similarity, tokens } from './text.js';

export interface DiscoveryOptions{minEvidence?:number;includeBots?:boolean;}

function stableHash(input:string):string{
  let hash=2166136261;
  for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
}
function fingerprintOf(cluster:ClassifiedReview[]):string{
  const frequency=new Map<string,number>();
  for(const review of cluster)for(const token of tokens(review.body))frequency.set(token,(frequency.get(token)??0)+1);
  const threshold=Math.max(1,Math.ceil(cluster.length/2));
  let concepts=[...frequency].filter(([,count])=>count>=threshold).map(([token])=>token).sort();
  if(!concepts.length)concepts=[...tokens(cluster[0]?.body??'')].sort();
  const category=cluster[0]?.category??'general';
  return `rdna-${category}-${stableHash(`${category}:${concepts.slice(0,16).join('|')}`)}`;
}

function imperativeRule(text:string):string{
  let t=text.trim().replace(/^[-*]\s*/,'').replace(/^(nit|suggestion|suggestion:|please)[:\s-]*/i,'');
  t=t.replace(/\bI (?:think|would|prefer|suggest)\b[:,]?\s*/i,'').replace(/\bcan we\b/i,'Prefer to').replace(/\bcould you\b/i,'');
  const sentences=t.split(/(?<=[.!?])\s+/).filter(Boolean);t=sentences.find(s=>GENERALIZERS.test(s))??sentences[0]??t;t=t.replace(/\?$/,'.').trim();if(!/[.!]$/.test(t))t+='.';return t.charAt(0).toUpperCase()+t.slice(1);
}
function scopeOf(reviews:ClassifiedReview[]):string[]{const dirs=reviews.map(r=>r.path).filter((x):x is string=>Boolean(x)).map(p=>p.includes('/')?p.split('/')[0]+'/**':p),counts=new Map<string,number>();for(const d of dirs)counts.set(d,(counts.get(d)??0)+1);const min=Math.max(2,Math.ceil(reviews.length*.6)),scopes=[...counts].filter(([,n])=>n>=min).map(([d])=>d);return scopes.length?scopes:['repository'];}
function scoreCluster(cluster:ClassifiedReview[],now=new Date()):EngineeringRule['scoreBreakdown']{
  const evidence=cluster.length,reviewers=new Set(cluster.map(r=>r.reviewer)).size,dates=cluster.map(r=>new Date(r.createdAt).getTime()).sort((a,b)=>a-b),newest=dates.at(-1)??now.getTime(),oldest=dates[0]??newest,ageDays=Math.max(0,(now.getTime()-newest)/86400000),spanDays=Math.max(0,(newest-oldest)/86400000),accepted=cluster.filter(r=>r.accepted).length,changedAfterReview=cluster.filter(r=>!r.accepted&&r.resolved&&r.changedAfterReview).length,resolvedOnly=cluster.filter(r=>!r.accepted&&r.resolved&&!r.changedAfterReview).length,evidenceWeight=accepted+changedAfterReview*.85+resolvedOnly*.35;
  const frequency=Math.min(30,evidence*4),reviewerDiversity=Math.min(20,reviewers*4),recency=Math.max(0,Math.round(20-ageDays/30)),acceptedEvidence=evidence?Math.round(20*evidenceWeight/evidence):0,persistence=Math.min(10,Math.round(spanDays/30)),conflictPenalty=0,total=Math.max(0,Math.min(100,frequency+reviewerDiversity+recency+acceptedEvidence+persistence));return {frequency,reviewerDiversity,recency,acceptedEvidence,persistence,conflictPenalty,total};
}
function statusFrom(score:number,lastSeen:string,firstSeen:string):RuleStatus{const age=(Date.now()-new Date(lastSeen).getTime())/86400000;if(age>365)return'stale';const span=(new Date(lastSeen).getTime()-new Date(firstSeen).getTime())/86400000;if(score>=85)return'strong';if(score>=65)return'established';if(span<60)return'emerging';return'established';}
function evidenceOf(r:ClassifiedReview):RuleEvidence{const e:RuleEvidence={id:r.id,prNumber:r.prNumber,reviewer:r.reviewer,createdAt:r.createdAt,url:r.url,body:r.body};if(r.path!==undefined)e.path=r.path;if(r.accepted!==undefined)e.accepted=r.accepted;if(r.resolved!==undefined)e.resolved=r.resolved;if(r.changedAfterReview!==undefined)e.changedAfterReview=r.changedAfterReview;return e;}
function negative(text:string){return /\b(avoid|never|do not|don't|remove|stop|instead of)\b/i.test(text);}
export function detectConflicts(rules:EngineeringRule[]):void{for(let i=0;i<rules.length;i++)for(let j=i+1;j<rules.length;j++){const a=rules[i],b=rules[j];if(!a||!b||a.category!==b.category)continue;if(negative(a.text)!==negative(b.text)&&similarity(a.text,b.text)>=.22){a.conflictingRuleIds.push(b.id);b.conflictingRuleIds.push(a.id);a.status=b.status='disputed';for(const r of[a,b]){r.scoreBreakdown.conflictPenalty=15;r.scoreBreakdown.total=Math.max(0,r.scoreBreakdown.total-15);r.confidence=r.scoreBreakdown.total;}}}}

export function discoverRules(records:ReviewRecord[],repository:string,source:'github'|'fixture'='github',options:DiscoveryOptions={}):AnalysisResult{
  const minEvidence=Math.max(1,options.minEvidence??2),classified=records.map(classifyReview),candidates=classified.filter(r=>r.actionable&&r.generalizable&&!r.noise&&!r.oneOff&&(options.includeBots||!r.bot));
  const rejected=classified.filter(r=>!candidates.includes(r)).map(r=>({id:r.id,body:r.body,reason:r.bot&&!options.includeBots?'bot':r.noise?'noise':r.oneOff?'one-off':!r.actionable?'not-actionable':'not-generalizable'})),clusters:ClassifiedReview[][]=[];
  for(const review of candidates){const target=clusters.find(c=>c[0]&&c[0].category===review.category&&similarity(c[0].body,review.body)>=.16);if(target)target.push(review);else clusters.push([review]);}
  const retained=clusters.filter(c=>{if(c.length>=minEvidence)return true;for(const r of c)rejected.push({id:r.id,body:r.body,reason:'insufficient-evidence'});return false;});
  const rules=retained.map((cluster,index)=>{const sorted=[...cluster].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),score=scoreCluster(cluster),firstSeen=sorted[0]?.createdAt??new Date().toISOString(),lastSeen=sorted.at(-1)?.createdAt??firstSeen;return {id:`RULE-${String(index+1).padStart(4,'0')}`,fingerprint:fingerprintOf(cluster),text:imperativeRule([...cluster].sort((a,b)=>b.body.length-a.body.length)[0]?.body??''),category:cluster[0]?.category??'general',status:statusFrom(score.total,lastSeen,firstSeen),confidence:score.total,evidenceCount:cluster.length,reviewerCount:new Set(cluster.map(r=>r.reviewer)).size,firstSeen,lastSeen,scope:scopeOf(cluster),documented:false,documentedBy:[],documentationConflicts:[],conflictingRuleIds:[],evidence:sorted.map(evidenceOf),scoreBreakdown:score} satisfies EngineeringRule;}).sort((a,b)=>b.confidence-a.confidence);
  detectConflicts(rules);const prs=new Set(records.map(r=>r.prNumber)),reviewers=new Set(records.map(r=>r.reviewer)),categoryCounts:Record<string,number>={};for(const r of rules)categoryCounts[r.category]=(categoryCounts[r.category]??0)+1;
  return {schemaVersion:'1.0',summary:{repository,generatedAt:new Date().toISOString(),reviewsAnalyzed:records.length,pullRequests:prs.size,reviewers:reviewers.size,rules:rules.length,highConfidenceRules:rules.filter(r=>r.confidence>=80).length,emergingRules:rules.filter(r=>r.status==='emerging').length,conflictingRules:rules.filter(r=>r.conflictingRuleIds.length).length,staleRules:rules.filter(r=>r.status==='stale').length,undocumentedRules:rules.filter(r=>!r.documented).length,documentationCoverage:0,documentationDrift:0,categoryCounts},rules,rejected,metadata:{engineVersion:'0.1.0',mode:'deterministic',source}};
}
