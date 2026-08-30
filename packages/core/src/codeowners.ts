import type { AnalysisResult } from '@reviewdna/schema';

export interface CodeOwnersSource { path:string; content:string; }
export interface CodeOwnerRule { pattern:string; owners:string[]; }

function globRegex(pattern:string):RegExp{
  let p=pattern.trim();
  const anchored=p.startsWith('/');
  p=p.replace(/^\/+/, '');
  if(p.endsWith('/'))p+='**';
  const hasSlash=p.includes('/');
  let escaped=p.replace(/[.+^${}()|[\]\\]/g,'\\$&');
  escaped=escaped.replace(/\*\*/g,'__DOUBLE_STAR__').replace(/\*/g,'[^/]*').replace(/\?/g,'[^/]').replace(/__DOUBLE_STAR__/g,'.*');
  const prefix=anchored||hasSlash?'^':'(?:^|.*/)';
  return new RegExp(`${prefix}${escaped}$`);
}

export function parseCodeOwners(content:string):CodeOwnerRule[]{
  const rules:CodeOwnerRule[]=[];
  for(const raw of content.split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('#'))continue;
    const parts=line.split(/\s+/).filter(Boolean);
    const pattern=parts.shift();
    const owners=parts.filter(owner=>owner.startsWith('@'));
    if(pattern&&owners.length)rules.push({pattern,owners});
  }
  return rules;
}

export function ownersForPath(path:string,rules:CodeOwnerRule[]):string[]{
  let owners:string[]=[];
  for(const rule of rules){
    try{if(globRegex(rule.pattern).test(path))owners=rule.owners;}
    catch{continue;}
  }
  return owners;
}

export function isDirectCodeOwner(path:string,reviewer:string,rules:CodeOwnerRule[]):boolean{
  const expected=`@${reviewer}`.toLowerCase();
  return ownersForPath(path,rules).some(owner=>owner.toLowerCase()===expected);
}

export function applyCodeOwnerEvidence(result:AnalysisResult,source?:CodeOwnersSource):AnalysisResult{
  const rules=source?parseCodeOwners(source.content):[];
  for(const rule of result.rules){
    const previous=rule.scoreBreakdown.codeOwnerEvidence??0;
    let direct=0;
    for(const evidence of rule.evidence){
      const matched=Boolean(evidence.path&&rules.length&&isDirectCodeOwner(evidence.path,evidence.reviewer,rules));
      evidence.codeOwner=matched;
      if(matched)direct++;
    }
    const points=rule.evidenceCount?Math.min(10,Math.round(10*direct/rule.evidenceCount)):0;
    rule.scoreBreakdown.codeOwnerEvidence=points;
    rule.scoreBreakdown.total=Math.max(0,Math.min(100,rule.scoreBreakdown.total-previous+points));
    rule.confidence=rule.scoreBreakdown.total;
  }
  result.summary.highConfidenceRules=result.rules.filter(rule=>rule.confidence>=80).length;
  return result;
}
