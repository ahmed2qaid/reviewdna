export interface SensitiveRedactionResult { text:string; replacements:number; kinds:Record<string,number>; }

const PATTERNS:Array<{kind:string;pattern:RegExp;replacement:string}>=[
  {kind:'email',pattern:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,replacement:'[redacted-email]'},
  {kind:'github-token',pattern:/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,replacement:'[redacted-github-token]'},
  {kind:'openai-style-key',pattern:/\bsk-[A-Za-z0-9_-]{20,}\b/g,replacement:'[redacted-api-key]'},
  {kind:'aws-access-key',pattern:/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,replacement:'[redacted-aws-key]'},
  {kind:'jwt',pattern:/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g,replacement:'[redacted-jwt]'},
  {kind:'bearer-token',pattern:/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/gi,replacement:'Bearer [redacted-token]'},
  {kind:'international-phone',pattern:/\+\d(?:[\s().-]*\d){7,14}\b/g,replacement:'[redacted-phone]'},
  {kind:'credential-assignment',pattern:/\b(password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret|secret)\b(\s*[:=]\s*)(["']?)[^\s,"'}]{8,}\3/gi,replacement:'$1$2[redacted-secret]'}
];

export function redactSensitiveText(input:string):SensitiveRedactionResult{
  let text=input,replacements=0;const kinds:Record<string,number>={};
  for(const item of PATTERNS){
    text=text.replace(item.pattern,(...args:unknown[])=>{
      replacements++;kinds[item.kind]=(kinds[item.kind]??0)+1;
      if(item.kind==='credential-assignment'){
        const key=String(args[1]??''),separator=String(args[2]??'');return`${key}${separator}[redacted-secret]`;
      }
      return item.replacement;
    });
  }
  return{text,replacements,kinds};
}
