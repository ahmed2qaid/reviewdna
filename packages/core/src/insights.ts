import type { AnalysisResult, AutomationOpportunity, EngineeringRule, ReviewHotspot } from '@reviewdna/schema';

function hotspotPath(path:string):string{
  const normalized=path.replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+|\/+$/g,'');
  if(!normalized)return'(root)';
  const parts=normalized.split('/').filter(Boolean);
  if(parts.length<=1)return'(root)';
  const first=parts[0]!.toLowerCase();
  const grouped=new Set(['src','lib','app','apps','packages','services','modules','components']);
  return grouped.has(first)&&parts.length>=3?`${parts[0]}/${parts[1]}`:parts[0]!;
}

function deriveHotspots(result:AnalysisResult):ReviewHotspot[]{
  const rows=new Map<string,{evidence:Set<string>;rules:Set<string>;categories:Map<string,number>}>(),seen=new Set<string>();
  for(const rule of result.rules){
    for(const evidence of rule.evidence){
      if(!evidence.path)continue;
      const path=hotspotPath(evidence.path),identity=`${evidence.id}|${path}`;
      let row=rows.get(path);if(!row){row={evidence:new Set(),rules:new Set(),categories:new Map()};rows.set(path,row);}
      row.rules.add(rule.fingerprint);
      if(seen.has(identity))continue;
      seen.add(identity);row.evidence.add(evidence.id);row.categories.set(rule.category,(row.categories.get(rule.category)??0)+1);
    }
  }
  const total=[...rows.values()].reduce((sum,row)=>sum+row.evidence.size,0);
  return [...rows.entries()].map(([path,row])=>({
    path,evidenceCount:row.evidence.size,ruleCount:row.rules.size,
    percentage:total?Math.round(row.evidence.size/total*1000)/10:0,
    categories:Object.fromEntries([...row.categories.entries()].sort((a,b)=>b[1]-a[1]))
  })).sort((a,b)=>b.evidenceCount-a.evidenceCount||a.path.localeCompare(b.path)).slice(0,20);
}

function candidate(rule:EngineeringRule):AutomationOpportunity|undefined{
  if(rule.humanDecision?.action==='ignore'||rule.status==='superseded'||rule.confidence<60)return undefined;
  const text=rule.text.toLowerCase();
  const make=(kind:AutomationOpportunity['kind'],strength:AutomationOpportunity['strength'],reason:string,suggestedMechanisms:string[]):AutomationOpportunity=>({
    fingerprint:rule.fingerprint,text:rule.text,category:rule.category,kind,strength,reason,suggestedMechanisms,scope:[...rule.scope]
  });

  if(/\b(prettier|format(?:ting)?|indent(?:ation)?|whitespace|quote style|semicolon)\b/.test(text))return make('format-rule',/\bprettier\b/.test(text)||rule.confidence>=85?'high':'medium','The convention describes deterministic formatting that can be checked without semantic judgment.',['formatter configuration','format check in CI']);
  if(/\b(typescript|no explicit any|explicit any|implicit any|type[- ]safe|strict null|type annotation)\b/.test(text))return make('type-policy',rule.confidence>=80?'high':'medium','The convention describes a type-system constraint that can often be encoded in compiler or type-aware lint settings.',['TypeScript/compiler configuration','type-aware lint rule','CI typecheck']);
  if(rule.category==='security'||/\b(secret|token|credential|password|api key|bearer)\b/.test(text))return make('security-scan',/\b(secret|token|credential|password|api key|bearer)\b/.test(text)&&rule.confidence>=75?'high':'medium','Recurring security guidance may be partially enforceable with scanning or static policy checks.',['secret scanning','SAST or custom security lint','CI security policy check']);
  if(rule.category==='dependency')return make('dependency-policy',rule.confidence>=80?'high':'medium','Dependency guidance can often be surfaced automatically through package-policy or dependency-review checks.',['dependency review','package allow/deny policy','CI dependency check']);
  if(rule.category==='testing')return make('test-gate','medium','Testing guidance is often partially enforceable through CI gates, changed-file policies, or regression-test checks.',['CI test gate','changed-file test policy','coverage/regression check']);
  if(rule.category==='style'||rule.category==='naming'||/\b(console\.log|debugger|unused|import order|naming convention)\b/.test(text))return make('lint-rule',/\b(console\.log|debugger|unused|import order)\b/.test(text)&&rule.confidence>=75?'high':'medium','The convention resembles a syntactic or naming rule that a linter can often detect consistently.',['ESLint/custom linter rule','CI lint check']);
  if(rule.category==='error-handling'&&/\b(swallow|empty catch|catch block|unhandled|exception)\b/.test(text))return make('lint-rule','medium','Part of this error-handling convention may be detectable through static analysis, while contextual cases still need review.',['static analysis rule','custom linter','CI policy check']);
  if(rule.category==='performance'&&/\b(n\+1|query count|performance regression|latency budget)\b/.test(text))return make('ci-check','medium','The recurring performance guidance can potentially be turned into a regression or query-budget check.',['performance regression test','query-count assertion','CI budget check']);
  return undefined;
}

export function applyAnalysisInsights(result:AnalysisResult):AnalysisResult{
  const automationOpportunities=result.rules.map(candidate).filter((item):item is AutomationOpportunity=>Boolean(item));
  result.insights={reviewHotspots:deriveHotspots(result),automationOpportunities};
  result.metadata.insightsModel='deterministic-insights-v1';
  return result;
}
