#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyDocumentationCoverage, applyHumanDecisions, applySemanticDocumentationCoverage, compareAnalysisResults, decisionTemplate, discoverRules, discoverRulesSemantic, LocalFeatureEmbeddingProvider, redactAnalysis, type EmbeddingProvider } from '@reviewdna/core';
import { GitHubCollector } from '@reviewdna/github';
import type { GitHubCollectionState } from '@reviewdna/github';
import { GitHubProposalPublisher, KNOWLEDGE_PROPOSAL_FILES, type KnowledgeProposalFile } from '@reviewdna/github/publisher';
import { buildKnowledgeProposalManifest, exportAgents, exportClaude, exportContributing, exportCursor, exportKnowledgeProposal, exportMarkdown, exportDeltaMarkdown } from '@reviewdna/exporters';
import { OllamaEmbeddingProvider, OllamaProvider, OpenAICompatibleEmbeddingProvider, OpenAICompatibleProvider, refineAnalysis } from '@reviewdna/providers';
import type { ReviewDNAProvider } from '@reviewdna/providers';
import { renderHtml } from '@reviewdna/report';
import type { AnalysisResult, DecisionsFile, ReviewRecord } from '@reviewdna/schema';

const VERSION = '0.2.0-dev';
const flag = (args:string[], name:string, fallback?:string) => { const i=args.indexOf(name); return i>=0 ? args[i+1] : fallback; };
const has = (args:string[], name:string) => args.includes(name);

function help() {
  console.log(`ReviewDNA ${VERSION}\n\nYour reviews already contain your engineering DNA.\n\nCommands:\n  reviewdna analyze owner/repo [--max-prs 100] [--min-evidence 2] [--out reviewdna-output] [--clusterer deterministic|semantic] [--embedding-provider local|ollama|openai-compatible] [--semantic-threshold N] [--semantic-docs] [--documentation-semantic-threshold N] [--issue-comments] [--include-bots] [--redact] [--redact-evidence] [--no-cache] [--cache-dir .reviewdna] [--provider deterministic|ollama|openai-compatible] [--deep-evidence] [--decisions reviewdna.decisions.json]\n  reviewdna analyze-fixture file.json [--min-evidence 2] [--out reviewdna-output] [--clusterer deterministic|semantic] [--embedding-provider ...] [--provider ...]\n  reviewdna export result.json --format agents|claude|cursor|contributing|markdown\n  reviewdna compare before.json after.json\n  reviewdna decisions-template result.json [--out reviewdna.decisions.json]\n  reviewdna proposal result.json [--out reviewdna-proposal]\n  reviewdna publish-proposal owner/repo reviewdna-proposal [--branch reviewdna/proposal-id] [--base main] [--apply]\n  reviewdna watch owner/repo [analyze options] [--out reviewdna-watch] [--baseline-file path] [--fail-on-changes]\n  reviewdna doctor\n  reviewdna --version\n\nSemantic clustering options:\n  --clusterer semantic --embedding-provider local\n  --clusterer semantic --embedding-provider ollama [--embedding-model nomic-embed-text] [--embedding-url http://127.0.0.1:11434]\n  --clusterer semantic --embedding-provider openai-compatible --embedding-model MODEL --embedding-url URL\n  --semantic-threshold N\n\nSemantic documentation options (independent opt-in):\n  --semantic-docs [--documentation-semantic-threshold N]\n  Uses the same --embedding-provider / --embedding-model / --embedding-url configuration.\n\nAI wording refinement options (separate, explicit opt-in):\n  --provider ollama --model qwen3:8b [--provider-url http://127.0.0.1:11434]\n  --provider openai-compatible --model MODEL [--provider-url URL]\n  --max-refine-rules N\n  --provider-continue-on-error\n\nProposal publishing is dry-run by default. Add --apply for an explicit GitHub write.\n\nEnvironment:\n  GITHUB_TOKEN\n  REVIEWDNA_EMBEDDING_BASE_URL\n  REVIEWDNA_EMBEDDING_API_KEY\n  REVIEWDNA_EMBEDDING_MODEL\n  REVIEWDNA_LLM_BASE_URL\n  REVIEWDNA_LLM_API_KEY\n  REVIEWDNA_LLM_MODEL\n`);
}

async function loadCache(path:string):Promise<GitHubCollectionState|undefined> { try { return JSON.parse(await readFile(path,'utf8')) as GitHubCollectionState; } catch { return undefined; } }
async function persistCache(path:string,state:GitHubCollectionState) { const split=Math.max(path.lastIndexOf('/'),path.lastIndexOf('\\')); if(split>0) await mkdir(path.slice(0,split),{recursive:true}); await writeFile(path,JSON.stringify(state,null,2)); }
function cacheFile(repo:string,dir:string) { return resolve(dir,`${repo.replace(/[^a-z0-9_.-]+/gi,'__')}.json`); }
function defaultProposalBranch(){const stamp=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);return `reviewdna/proposal-${stamp}`;}
async function loadProposalFiles(dir:string):Promise<KnowledgeProposalFile[]> { return Promise.all(KNOWLEDGE_PROPOSAL_FILES.map(async name=>({name,content:await readFile(resolve(dir,name),'utf8')}))); }

function providerFromArgs(args:string[]):ReviewDNAProvider|undefined {
  const kind = flag(args,'--provider','deterministic')!;
  if (kind === 'deterministic' || kind === 'none') return undefined;
  if (kind === 'ollama') {
    const model = flag(args,'--model',process.env.REVIEWDNA_LLM_MODEL || 'qwen3:8b')!;
    const baseUrl = flag(args,'--provider-url',process.env.REVIEWDNA_LLM_BASE_URL || 'http://127.0.0.1:11434')!;
    return new OllamaProvider(model,baseUrl);
  }
  if (kind === 'openai-compatible') {
    const model = flag(args,'--model',process.env.REVIEWDNA_LLM_MODEL);
    const baseUrl = flag(args,'--provider-url',process.env.REVIEWDNA_LLM_BASE_URL);
    const apiKey = process.env.REVIEWDNA_LLM_API_KEY;
    if (!model || !baseUrl || !apiKey) throw new Error('openai-compatible requires --model (or REVIEWDNA_LLM_MODEL), --provider-url (or REVIEWDNA_LLM_BASE_URL), and REVIEWDNA_LLM_API_KEY.');
    return new OpenAICompatibleProvider({model,baseUrl,apiKey});
  }
  throw new Error(`Unknown provider: ${kind}. Use deterministic, ollama, or openai-compatible.`);
}

function embeddingProviderFromArgs(args:string[],force=false):EmbeddingProvider|undefined {
  const clusterer=flag(args,'--clusterer','deterministic')!;
  if(clusterer!=='deterministic'&&clusterer!=='semantic')throw new Error(`Unknown clusterer: ${clusterer}. Use deterministic or semantic.`);
  if(!force&&clusterer==='deterministic')return undefined;
  const kind=flag(args,'--embedding-provider','local')!;
  if(kind==='local')return new LocalFeatureEmbeddingProvider();
  if(kind==='ollama'){
    const model=flag(args,'--embedding-model',process.env.REVIEWDNA_EMBEDDING_MODEL||'nomic-embed-text')!;
    const baseUrl=flag(args,'--embedding-url',process.env.REVIEWDNA_EMBEDDING_BASE_URL||'http://127.0.0.1:11434')!;
    return new OllamaEmbeddingProvider(model,baseUrl);
  }
  if(kind==='openai-compatible'){
    const model=flag(args,'--embedding-model',process.env.REVIEWDNA_EMBEDDING_MODEL);
    const baseUrl=flag(args,'--embedding-url',process.env.REVIEWDNA_EMBEDDING_BASE_URL);
    const apiKey=process.env.REVIEWDNA_EMBEDDING_API_KEY;
    if(!model||!baseUrl||!apiKey)throw new Error('openai-compatible embeddings require --embedding-model (or REVIEWDNA_EMBEDDING_MODEL), --embedding-url (or REVIEWDNA_EMBEDDING_BASE_URL), and REVIEWDNA_EMBEDDING_API_KEY.');
    return new OpenAICompatibleEmbeddingProvider({model,baseUrl,apiKey});
  }
  throw new Error(`Unknown embedding provider: ${kind}. Use local, ollama, or openai-compatible.`);
}

async function discoverFromArgs(records:ReviewRecord[],repository:string,source:'github'|'fixture',args:string[],minEvidence:number):Promise<AnalysisResult>{
  const provider=embeddingProviderFromArgs(args),includeBots=has(args,'--include-bots');
  if(!provider)return discoverRules(records,repository,source,{minEvidence,includeBots});
  const rawThreshold=flag(args,'--semantic-threshold'),threshold=rawThreshold===undefined?undefined:Number(rawThreshold);
  if(threshold!==undefined&&(!Number.isFinite(threshold)||threshold<=0||threshold>1))throw new Error('--semantic-threshold must be > 0 and <= 1.');
  if(provider.name.startsWith('openai-compatible:'))process.stderr.write('ReviewDNA: remote embedding provider enabled; classified review text will be sent to the configured endpoint for vectorization.\n');
  process.stderr.write(`ReviewDNA: semantic clustering with ${provider.name}${threshold!==undefined?` at threshold ${threshold}`:''}. Embeddings can group evidence but cannot create rules.\n`);
  return discoverRulesSemantic(records,repository,source,provider,{minEvidence,includeBots,...(threshold!==undefined?{threshold}:{})});
}

async function maybeApplySemanticDocumentation(result:AnalysisResult,docs:Array<{path:string;content:string}>,args:string[]):Promise<AnalysisResult>{
  if(!has(args,'--semantic-docs'))return result;
  const provider=embeddingProviderFromArgs(args,true)!;
  const rawThreshold=flag(args,'--documentation-semantic-threshold'),threshold=rawThreshold===undefined?undefined:Number(rawThreshold);
  if(threshold!==undefined&&(!Number.isFinite(threshold)||threshold<=0||threshold>1))throw new Error('--documentation-semantic-threshold must be > 0 and <= 1.');
  if(provider.name.startsWith('openai-compatible:'))process.stderr.write('ReviewDNA: remote semantic documentation matching enabled; rule text and repository instruction fragments will be sent to the configured embedding endpoint.\n');
  process.stderr.write(`ReviewDNA: semantic documentation matching with ${provider.name}${threshold!==undefined?` at threshold ${threshold}`:''}. Lexical matches remain preserved.\n`);
  return applySemanticDocumentationCoverage(result,docs,provider,{...(threshold!==undefined?{threshold}:{})});
}

async function maybeRefine(result:AnalysisResult,args:string[]):Promise<AnalysisResult> {
  const provider=providerFromArgs(args);
  if(!provider) return result;
  const maxRules=Number(flag(args,'--max-refine-rules',String(result.rules.length)));
  if(!Number.isFinite(maxRules)||maxRules<0) throw new Error('--max-refine-rules must be a non-negative number.');
  if(provider.name==='openai-compatible') process.stderr.write('ReviewDNA: remote wording provider enabled; selected review evidence will be sent to the configured endpoint.\n');
  process.stderr.write(`ReviewDNA: refining up to ${Math.min(maxRules,result.rules.length)} rules with ${provider.name}.\n`);
  return refineAnalysis(result,provider,{maxRules,continueOnError:has(args,'--provider-continue-on-error'),onProgress:(current,total)=>process.stderr.write(`\rRefining rules ${current}/${total}`)}).finally(()=>process.stderr.write('\n'));
}

async function maybeApplyDecisions(result:AnalysisResult,args:string[]):Promise<AnalysisResult> {
  if(has(args,'--no-decisions')) return result;
  const path=flag(args,'--decisions','reviewdna.decisions.json')!;
  try {
    const file=JSON.parse(await readFile(path,'utf8')) as DecisionsFile;
    const applied=applyHumanDecisions(result,file);
    if(applied.summary.applied||applied.summary.unmatched.length)process.stderr.write(`ReviewDNA decisions: ${applied.summary.applied} applied (${applied.summary.promoted} promoted, ${applied.summary.ignored} ignored, ${applied.summary.overridden} overridden); ${applied.summary.unmatched.length} unmatched.\n`);
    return applied.result;
  } catch(err) {
    const code=(err as {code?:string})?.code;
    if(code==='ENOENT') return result;
    throw err;
  }
}

async function save(result:AnalysisResult,outDir:string) {
  await mkdir(outDir,{recursive:true});
  await Promise.all([
    writeFile(resolve(outDir,'reviewdna.json'),JSON.stringify(result,null,2)),
    writeFile(resolve(outDir,'reviewdna-report.html'),renderHtml(result)),
    writeFile(resolve(outDir,'engineering-dna.md'),exportMarkdown(result)),
    writeFile(resolve(outDir,'AGENTS.suggested.md'),exportAgents(result)),
    writeFile(resolve(outDir,'CLAUDE.suggested.md'),exportClaude(result)),
    writeFile(resolve(outDir,'cursor.suggested.mdc'),exportCursor(result)),
    writeFile(resolve(outDir,'CONTRIBUTING.suggested.md'),exportContributing(result))
  ]);
}

function summary(r:AnalysisResult) {
  console.log(`\nReviewDNA 🧬\n\nRepository: ${r.summary.repository}\nReviews analyzed: ${r.summary.reviewsAnalyzed}\nPull requests: ${r.summary.pullRequests}\nReviewers: ${r.summary.reviewers}\nRules discovered: ${r.summary.rules}\nHigh-confidence: ${r.summary.highConfidenceRules}\nConflicting: ${r.summary.conflictingRules}\nStale: ${r.summary.staleRules}\nDocumentation coverage: ${r.summary.documentationCoverage}%\nDocumentation drift: ${r.summary.documentationDrift}\nDocumentation matcher: ${r.metadata.documentationMatcher??'lexical'}${r.metadata.documentationEmbeddingProvider?` (${r.metadata.documentationEmbeddingProvider}${r.metadata.documentationSemanticThreshold!==undefined?`, threshold ${r.metadata.documentationSemanticThreshold}`:''})`:''}\nClusterer: ${r.metadata.clusterer??'deterministic'}${r.metadata.embeddingProvider?` (${r.metadata.embeddingProvider}${r.metadata.semanticThreshold!==undefined?`, threshold ${r.metadata.semanticThreshold}`:''})`:''}\nMode: ${r.metadata.mode}${r.metadata.provider?` (${r.metadata.provider})`:''}\n`);
}

async function analyzeRepository(repo:string,args:string[]):Promise<{result:AnalysisResult;out:string}> {
  const max=Number(flag(args,'--max-prs','100')), minEvidence=Number(flag(args,'--min-evidence','2'));
  if(!Number.isFinite(max)||max<1||!Number.isFinite(minEvidence)||minEvidence<1) throw new Error('--max-prs and --min-evidence must be positive numbers.');
  const out=flag(args,'--out','reviewdna-output')!, redacting=has(args,'--redact')||has(args,'--redact-evidence'), cacheEnabled=!has(args,'--no-cache')&&!redacting, cacheDir=flag(args,'--cache-dir','.reviewdna')!, cachePath=cacheFile(repo,cacheDir);
  const collector=new GitHubCollector({token:process.env.GITHUB_TOKEN,maxPullRequests:max,includeIssueComments:has(args,'--issue-comments'),deepEvidence:has(args,'--deep-evidence')});
  const previous=cacheEnabled&&!has(args,'--refresh-cache')?await loadCache(cachePath):undefined;
  const collection=await collector.collectWithState(repo,previous);
  const docs=await collector.collectDocumentation(repo);
  if(cacheEnabled) await persistCache(cachePath,collection.state); else if(redacting) process.stderr.write('ReviewDNA: raw-review cache disabled because redaction is active.\n');
  console.log(`Collection: ${collection.stats.fetchedPullRequests} fetched PRs, ${collection.stats.cachedPullRequests} reused from local cache, ${collection.stats.deepComparisons} deep evidence comparisons.`);
  let result=await discoverFromArgs(collection.records,repo,'github',args,minEvidence);
  result=applyDocumentationCoverage(result,docs);
  result=await maybeApplySemanticDocumentation(result,docs,args);
  result=await maybeRefine(result,args);
  result=await maybeApplyDecisions(result,args);
  if(redacting) result=redactAnalysis(result,{reviewers:true,paths:true,evidenceBodies:has(args,'--redact-evidence')});
  await save(result,out);
  return {result,out};
}

async function main() {
  const args=process.argv.slice(2), cmd=args[0];
  if(!cmd||has(args,'--help')||cmd==='help'){help();return;}
  if(has(args,'--version')||cmd==='--version'){console.log(VERSION);return;}
  if(cmd==='doctor'){console.log(`ReviewDNA doctor\nNode: ${process.version} ✓\nGitHub token: ${process.env.GITHUB_TOKEN?'present ✓':'not set (public anonymous mode)'}\nRuntime fetch: ${typeof fetch==='function'?'available ✓':'missing ✗'}\nOllama URL: ${process.env.REVIEWDNA_LLM_BASE_URL||process.env.REVIEWDNA_EMBEDDING_BASE_URL||'not configured'}\nRemote LLM key: ${process.env.REVIEWDNA_LLM_API_KEY?'present':'not configured'}\nRemote embedding key: ${process.env.REVIEWDNA_EMBEDDING_API_KEY?'present':'not configured'}\n`);return;}
  if(cmd==='analyze'){const repo=args[1];if(!repo)throw new Error('Missing repository. Example: reviewdna analyze owner/repo');const {result,out}=await analyzeRepository(repo,args);summary(result);console.log(`Output: ${resolve(out)}\nOpen reviewdna-report.html in your browser.`);return;}
  if(cmd==='analyze-fixture'){const file=args[1];if(!file)throw new Error('Missing fixture JSON path.');const out=flag(args,'--out','reviewdna-output')!,minEvidence=Number(flag(args,'--min-evidence','2')),records=JSON.parse(await readFile(file,'utf8')) as ReviewRecord[],repo=records[0]?.repo??'fixture/repository';let result=await discoverFromArgs(records,repo,'fixture',args,minEvidence);result=await maybeRefine(result,args);result=await maybeApplyDecisions(result,args);if(has(args,'--redact')||has(args,'--redact-evidence'))result=redactAnalysis(result,{reviewers:true,paths:true,evidenceBodies:has(args,'--redact-evidence')});await save(result,out);summary(result);return;}
  if(cmd==='watch'){
    const repo=args[1];if(!repo)throw new Error('Missing repository. Example: reviewdna watch owner/repo');
    const out=flag(args,'--out','reviewdna-watch')!,baselineFile=flag(args,'--baseline-file',resolve(out,'reviewdna.json'))!;
    let previous:AnalysisResult|undefined;try{previous=JSON.parse(await readFile(baselineFile,'utf8')) as AnalysisResult;}catch{}
    const runArgs=has(args,'--out')?args:[...args,'--out',out],{result}=await analyzeRepository(repo,runArgs);summary(result);
    const historyDir=resolve(out,'history');await mkdir(historyDir,{recursive:true});
    const stamp=result.summary.generatedAt.replace(/[:.]/g,'-');await writeFile(resolve(historyDir,`${stamp}.json`),JSON.stringify(result,null,2));
    if(baselineFile!==resolve(out,'reviewdna.json')){const parent=resolve(baselineFile,'..');await mkdir(parent,{recursive:true});await writeFile(baselineFile,JSON.stringify(result,null,2));}
    if(!previous){console.log(`Watch baseline created. Snapshot: ${resolve(historyDir,`${stamp}.json`)}`);return;}
    const delta=compareAnalysisResults(previous,result);
    await Promise.all([writeFile(resolve(out,'reviewdna-delta.json'),JSON.stringify(delta,null,2)),writeFile(resolve(out,'reviewdna-delta.md'),exportDeltaMarkdown(delta,repo))]);
    const totalChanges=delta.newRules.length+delta.removedRules.length+delta.strengthened.length+delta.weakened.length+delta.changed.length+delta.documentationChanges.length;
    console.log(`Changes: ${delta.newRules.length} new, ${delta.removedRules.length} removed, ${delta.strengthened.length} strengthened, ${delta.weakened.length} weakened, ${delta.changed.length} metadata/lifecycle changes, ${delta.documentationChanges.length} documentation changes.\nDelta: ${resolve(out,'reviewdna-delta.md')}`);
    if(has(args,'--fail-on-changes')&&totalChanges>0)process.exitCode=2;
    return;
  }
  if(cmd==='decisions-template'){
    const file=args[1];if(!file)throw new Error('Usage: reviewdna decisions-template reviewdna.json [--out reviewdna.decisions.json]');
    const result=JSON.parse(await readFile(file,'utf8')) as AnalysisResult,out=flag(args,'--out','reviewdna.decisions.json')!,template=decisionTemplate(result.rules);
    const parent=resolve(out,'..');await mkdir(parent,{recursive:true});await writeFile(out,JSON.stringify(template,null,2));
    console.log(`Human-review decision template written to ${resolve(out)}. Every entry starts as neutral "review".`);return;
  }
  if(cmd==='proposal'){
    const file=args[1];if(!file)throw new Error('Usage: reviewdna proposal reviewdna.json [--out reviewdna-proposal]');
    const result=JSON.parse(await readFile(file,'utf8')) as AnalysisResult,out=flag(args,'--out','reviewdna-proposal')!;
    await mkdir(out,{recursive:true});
    const manifest=buildKnowledgeProposalManifest(result);
    await Promise.all([
      writeFile(resolve(out,'reviewdna-proposal.json'),JSON.stringify(manifest,null,2)),
      writeFile(resolve(out,'REVIEWDNA_PROPOSAL.md'),exportKnowledgeProposal(result)),
      writeFile(resolve(out,'AGENTS.proposed.md'),exportAgents(result)),
      writeFile(resolve(out,'CONTRIBUTING.proposed.md'),exportContributing(result)),
      writeFile(resolve(out,'CLAUDE.proposed.md'),exportClaude(result)),
      writeFile(resolve(out,'cursor.proposed.mdc'),exportCursor(result))
    ]);
    console.log(`Knowledge proposal written to ${resolve(out)} with ${manifest.counts.includedRules} conventions and ${manifest.counts.evidenceLinks} evidence links. No target repository files were modified.`);return;
  }
  if(cmd==='publish-proposal'){
    const repo=args[1],dir=args[2];
    if(!repo||!dir)throw new Error('Usage: reviewdna publish-proposal owner/repo reviewdna-proposal [--branch reviewdna/proposal-id] [--base main] [--apply]');
    const files=await loadProposalFiles(dir),branch=flag(args,'--branch',defaultProposalBranch())!;
    const publisher=new GitHubProposalPublisher(process.env.GITHUB_TOKEN);
    const published=await publisher.publish({repository:repo,branch,baseBranch:flag(args,'--base'),proposalId:flag(args,'--proposal-id'),title:flag(args,'--title'),apply:has(args,'--apply')},files);
    if(!published.applied){
      console.log(`ReviewDNA proposal publish dry-run\n\nRepository: ${published.repository}\nBase: ${published.baseBranch}\nBranch: ${published.branch}\nDestination: ${published.prefix}/\nFiles: ${published.files.length}\n\nNo GitHub writes were performed. Re-run the same command with --apply to create the proposal branch and Pull Request.`);return;
    }
    console.log(`ReviewDNA proposal published.\nBranch: ${published.branch}\nCommit: ${published.commitSha}\nPull Request: ${published.pullRequestUrl}`);return;
  }
  if(cmd==='compare'){const beforeFile=args[1],afterFile=args[2];if(!beforeFile||!afterFile)throw new Error('Usage: reviewdna compare before.json after.json');const before=JSON.parse(await readFile(beforeFile,'utf8')) as AnalysisResult,after=JSON.parse(await readFile(afterFile,'utf8')) as AnalysisResult,delta=compareAnalysisResults(before,after);console.log(`ReviewDNA compare\n\nNew rules: ${delta.newRules.length}\nRemoved rules: ${delta.removedRules.length}\nStrengthened: ${delta.strengthened.length}\nWeakened: ${delta.weakened.length}\nChanged: ${delta.changed.length}\nDocumentation changes: ${delta.documentationChanges.length}\n`);for(const r of delta.newRules)console.log(`+ [${r.category}] ${r.text}`);for(const r of delta.removedRules)console.log(`- [${r.category}] ${r.text}`);for(const p of delta.strengthened)console.log(`↑ ${p.after.text} (${p.before.confidence}% → ${p.after.confidence}%)`);for(const p of delta.weakened)console.log(`↓ ${p.after.text} (${p.before.confidence}% → ${p.after.confidence}%)`);for(const p of delta.documentationChanges)console.log(`D ${p.after.text} (${p.changes.join(', ')})`);return;}
  if(cmd==='export'){const file=args[1];if(!file)throw new Error('Missing reviewdna.json path.');const format=flag(args,'--format','agents')!,result=JSON.parse(await readFile(file,'utf8')) as AnalysisResult,exporters:Record<string,(r:AnalysisResult)=>string>={agents:exportAgents,claude:exportClaude,cursor:exportCursor,contributing:exportContributing,markdown:exportMarkdown},fn=exporters[format];if(!fn)throw new Error(`Unknown format: ${format}`);process.stdout.write(fn(result));return;}
  throw new Error(`Unknown command: ${cmd}`);
}

main().catch(err=>{console.error(`\nReviewDNA error: ${err instanceof Error?err.message:String(err)}`);process.exitCode=1;});