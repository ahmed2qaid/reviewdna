import type { AnalysisResult, EngineeringRule, ReviewRecord, RuleEvidence } from '@reviewdna/schema';

export const REVIEWDNA_PLUGIN_API_VERSION='1' as const;
export type ReviewDNAPluginApiVersion=typeof REVIEWDNA_PLUGIN_API_VERSION;
export type PluginKind='collector'|'provider'|'exporter'|'scorer';
export type ProviderCapability='embedding'|'rule-refinement';

export interface PluginContext{
  repository:string;
  generatedAt:string;
  signal?:AbortSignal|undefined;
}

export interface PluginBase<K extends PluginKind>{
  apiVersion:ReviewDNAPluginApiVersion;
  kind:K;
  name:string;
  version?:string|undefined;
  description?:string|undefined;
}

export interface PluginDocumentationSource{path:string;content:string;}
export interface CollectorRequest{repository:string;maxItems?:number|undefined;cursor?:string|undefined;}
export interface CollectorResult{
  records:ReviewRecord[];
  documentation?:PluginDocumentationSource[]|undefined;
  cursor?:string|undefined;
  metadata?:Record<string,string|number|boolean|null>|undefined;
}
export interface CollectorPlugin extends PluginBase<'collector'>{
  collect(request:CollectorRequest,context:PluginContext):Promise<CollectorResult>;
}

export interface ProviderPlugin extends PluginBase<'provider'>{
  capabilities:ProviderCapability[];
  recommendedThreshold?:number|undefined;
  embed?(texts:string[],context:PluginContext):Promise<number[][]>;
  refineRule?(rule:EngineeringRule,evidence:RuleEvidence[],context:PluginContext):Promise<string>;
}

export interface PluginArtifact{
  path:string;
  content:string;
  mediaType?:string|undefined;
}
export interface ExporterPlugin extends PluginBase<'exporter'>{
  export(result:AnalysisResult,context:PluginContext):PluginArtifact[]|Promise<PluginArtifact[]>;
}

export interface ScoreContribution{
  key:string;
  value:number;
  reason:string;
  label?:string|undefined;
}
export interface ScorerPlugin extends PluginBase<'scorer'>{
  score(rule:EngineeringRule,context:PluginContext):ScoreContribution|Promise<ScoreContribution>;
}

export type ReviewDNAPlugin=CollectorPlugin|ProviderPlugin|ExporterPlugin|ScorerPlugin;
export type PluginForKind<K extends PluginKind>=Extract<ReviewDNAPlugin,{kind:K}>;

const NAME=/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const VERSION=/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;

function pluginError(message:string):never{throw new Error(`ReviewDNA plugin error: ${message}`);}
function callable(value:unknown):value is(...args:never[])=>unknown{return typeof value==='function';}

export function assertPlugin(plugin:unknown):asserts plugin is ReviewDNAPlugin{
  if(!plugin||typeof plugin!=='object')pluginError('plugin must be an object');
  const value=plugin as Partial<ReviewDNAPlugin>&Record<string,unknown>;
  if(value.apiVersion!==REVIEWDNA_PLUGIN_API_VERSION)pluginError(`apiVersion must be ${REVIEWDNA_PLUGIN_API_VERSION}`);
  if(typeof value.name!=='string'||!NAME.test(value.name))pluginError('name must be a lowercase slug using letters, numbers, dot, underscore, or hyphen');
  if(value.version!==undefined&&(typeof value.version!=='string'||!VERSION.test(value.version)))pluginError('version must be a short non-empty version identifier');
  if(!['collector','provider','exporter','scorer'].includes(String(value.kind)))pluginError('kind must be collector, provider, exporter, or scorer');

  if(value.kind==='collector'&&!callable(value.collect))pluginError(`collector ${value.name} must implement collect()`);
  if(value.kind==='exporter'&&!callable(value.export))pluginError(`exporter ${value.name} must implement export()`);
  if(value.kind==='scorer'&&!callable(value.score))pluginError(`scorer ${value.name} must implement score()`);
  if(value.kind==='provider'){
    if(!Array.isArray(value.capabilities)||value.capabilities.length===0)pluginError(`provider ${value.name} must declare at least one capability`);
    const capabilities=[...new Set(value.capabilities)];
    if(capabilities.some(item=>item!=='embedding'&&item!=='rule-refinement'))pluginError(`provider ${value.name} declares an unknown capability`);
    if(capabilities.includes('embedding')&&!callable(value.embed))pluginError(`provider ${value.name} declares embedding but does not implement embed()`);
    if(capabilities.includes('rule-refinement')&&!callable(value.refineRule))pluginError(`provider ${value.name} declares rule-refinement but does not implement refineRule()`);
    if(value.recommendedThreshold!==undefined&&(!Number.isFinite(value.recommendedThreshold)||value.recommendedThreshold<=0||value.recommendedThreshold>1))pluginError(`provider ${value.name} recommendedThreshold must be > 0 and <= 1`);
  }
}

export function definePlugin<T extends ReviewDNAPlugin>(plugin:T):T{assertPlugin(plugin);return plugin;}

export function assertScoreContribution(input:ScoreContribution):ScoreContribution{
  if(!input||typeof input!=='object')pluginError('score contribution must be an object');
  if(typeof input.key!=='string'||!NAME.test(input.key))pluginError('score contribution key must be a lowercase slug');
  if(!Number.isFinite(input.value)||input.value<-25||input.value>25)pluginError('score contribution value must be finite and between -25 and 25');
  if(typeof input.reason!=='string'||input.reason.trim().length<3)pluginError('score contribution reason must explain the signal');
  return input;
}

export class PluginRegistry{
  private readonly plugins=new Map<string,ReviewDNAPlugin>();
  register<T extends ReviewDNAPlugin>(plugin:T):T{
    assertPlugin(plugin);
    const key=`${plugin.kind}:${plugin.name}`;
    if(this.plugins.has(key))pluginError(`duplicate plugin ${key}`);
    this.plugins.set(key,plugin);
    return plugin;
  }
  get<K extends PluginKind>(kind:K,name:string):PluginForKind<K>|undefined{return this.plugins.get(`${kind}:${name}`) as PluginForKind<K>|undefined;}
  list<K extends PluginKind>(kind?:K):Array<K extends PluginKind?PluginForKind<K>:ReviewDNAPlugin>{
    const values=[...this.plugins.values()].filter(plugin=>kind===undefined||plugin.kind===kind);
    return values as Array<K extends PluginKind?PluginForKind<K>:ReviewDNAPlugin>;
  }
  has(kind:PluginKind,name:string):boolean{return this.plugins.has(`${kind}:${name}`);}
  get size():number{return this.plugins.size;}
}
