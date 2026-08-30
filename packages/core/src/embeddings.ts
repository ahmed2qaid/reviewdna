import { tokens } from './text.js';

export interface EmbeddingProvider {
  readonly name: string;
  embed(texts:string[]):Promise<number[][]>;
}

export interface LocalFeatureEmbeddingOptions {
  dimensions?:number;
}

const semanticAliases:Record<string,string>={
  db:'database',sql:'database',query:'database',queries:'database',persistence:'database',persist:'database',
  dao:'repository',repositories:'repository',repos:'repository',
  controllers:'controller',handler:'controller',handlers:'controller',route:'endpoint',routes:'endpoint',
  validate:'validation',validated:'validation',validating:'validation',validator:'validation',sanitize:'validation',sanitise:'validation',
  payload:'input',payloads:'input',request:'input',requests:'input',params:'input',parameters:'input',
  tests:'test',testing:'test',spec:'test',specs:'test',regression:'test',
  exception:'error',exceptions:'error',failure:'error',failures:'error',errors:'error',
  logs:'logging',logger:'logging',logged:'logging',
  dependencies:'dependency',packages:'dependency',libraries:'dependency',
  docs:'documentation',readme:'documentation',docstring:'documentation',jsdoc:'documentation'
};

const phraseConcepts:Array<[RegExp,string]>=[
  [/\b(?:validate|validation|sanitize|sanitise|check)\b.{0,32}\b(?:input|payload|request|params?|parameters?)\b/i,'concept:input-validation'],
  [/\b(?:database|db|sql|query|queries|persistence)\b/i,'concept:database-access'],
  [/\b(?:repository|data access|dao)\b/i,'concept:repository-layer'],
  [/\b(?:controller|route handler|http handler)\b/i,'concept:controller-layer'],
  [/\b(?:regression )?(?:test|tests|spec|specs|testing)\b/i,'concept:testing'],
  [/\b(?:error|errors|exception|exceptions|failure|failures)\b/i,'concept:error-handling'],
  [/\b(?:secret|token|credential|password|auth|authentication|authorization)\b/i,'concept:security'],
  [/\b(?:n\+1|latency|performance|slow|cache|memo)\b/i,'concept:performance'],
  [/\b(?:dependency|package|library|npm|module)\b/i,'concept:dependency'],
  [/\b(?:documentation|docs|readme|docstring|jsdoc)\b/i,'concept:documentation']
];

function hash32(input:string):number{
  let hash=2166136261;
  for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}

function featureTokens(text:string):string[]{
  const base=[...tokens(text)].map(token=>semanticAliases[token]??token);
  const features=[...base.map(token=>`word:${token}`)];
  for(let i=0;i<base.length-1;i++)features.push(`bigram:${base[i]}:${base[i+1]}`);
  for(const[pattern,concept]of phraseConcepts)if(pattern.test(text))features.push(concept);
  return features;
}

function normalized(vector:number[]):number[]{
  let sum=0;for(const value of vector)sum+=value*value;
  if(!sum)return vector;
  const norm=Math.sqrt(sum);return vector.map(value=>value/norm);
}

export class LocalFeatureEmbeddingProvider implements EmbeddingProvider{
  readonly name='local-feature-v1';
  private readonly dimensions:number;
  constructor(options:LocalFeatureEmbeddingOptions={}){this.dimensions=Math.max(64,Math.min(2048,options.dimensions??384));}
  async embed(texts:string[]):Promise<number[][]>{
    return texts.map(text=>{
      const vector=Array.from({length:this.dimensions},()=>0);
      for(const feature of featureTokens(text)){
        const hash=hash32(feature),index=hash%this.dimensions,sign=(hash&0x80000000)===0?1:-1;
        vector[index]=(vector[index]??0)+sign;
      }
      return normalized(vector);
    });
  }
}

export function cosineSimilarity(a:number[],b:number[]):number{
  const length=Math.min(a.length,b.length);if(!length)return 0;
  let dot=0,a2=0,b2=0;for(let i=0;i<length;i++){const av=a[i]??0,bv=b[i]??0;dot+=av*bv;a2+=av*av;b2+=bv*bv;}
  if(!a2||!b2)return 0;return dot/(Math.sqrt(a2)*Math.sqrt(b2));
}

export function meanEmbedding(vectors:number[][]):number[]{
  if(!vectors.length)return[];
  const dimensions=Math.max(...vectors.map(vector=>vector.length)),out=Array.from({length:dimensions},()=>0);
  for(const vector of vectors)for(let i=0;i<vector.length;i++)out[i]=(out[i]??0)+(vector[i]??0);
  for(let i=0;i<out.length;i++)out[i]=(out[i]??0)/vectors.length;
  return normalized(out);
}
