export const KNOWLEDGE_PROPOSAL_FILES = [
  'reviewdna-proposal.json',
  'REVIEWDNA_PROPOSAL.md',
  'AGENTS.proposed.md',
  'CONTRIBUTING.proposed.md',
  'CLAUDE.proposed.md',
  'cursor.proposed.mdc'
] as const;

export interface KnowledgeProposalFile {
  name: string;
  content: string;
}

export interface KnowledgeProposalPublishOptions {
  repository: string;
  branch: string;
  token?: string | undefined;
  baseBranch?: string | undefined;
  proposalId?: string | undefined;
  title?: string | undefined;
  body?: string | undefined;
  apply?: boolean | undefined;
}

export interface KnowledgeProposalPublishPlan {
  repository: string;
  branch: string;
  baseBranch: string;
  proposalId: string;
  prefix: string;
  files: string[];
  apply: boolean;
}

export interface KnowledgeProposalPublishResult extends KnowledgeProposalPublishPlan {
  applied: boolean;
  commitSha?: string | undefined;
  pullRequestUrl?: string | undefined;
  pullRequestNumber?: number | undefined;
}

interface RepoMetadata { default_branch: string; }
interface RefResponse { object: { sha: string }; }
interface CommitResponse { sha: string; tree: { sha: string }; }
interface BlobResponse { sha: string; }
interface TreeResponse { sha: string; }
interface CreatedCommit { sha: string; }
interface PullResponse { number: number; html_url: string; }

const repoPattern=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const branchPattern=/^reviewdna\/[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/;
const proposalIdPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const requiredNames=new Set<string>(KNOWLEDGE_PROPOSAL_FILES);

function encodeRef(ref:string){return ref.split('/').map(encodeURIComponent).join('/');}

function validateBranch(branch:string){
  if(!branchPattern.test(branch)||branch.includes('..')||branch.includes('//')||branch.endsWith('/')){
    throw new Error('Proposal branch must start with reviewdna/ and contain only safe Git ref characters.');
  }
}

function validateFiles(files:KnowledgeProposalFile[]){
  const seen=new Set<string>();
  for(const file of files){
    if(!requiredNames.has(file.name))throw new Error(`Unsupported proposal file: ${file.name}`);
    if(seen.has(file.name))throw new Error(`Duplicate proposal file: ${file.name}`);
    if(typeof file.content!=='string')throw new Error(`Proposal file ${file.name} must contain UTF-8 text.`);
    seen.add(file.name);
  }
  const missing=KNOWLEDGE_PROPOSAL_FILES.filter(name=>!seen.has(name));
  if(missing.length)throw new Error(`Proposal bundle is incomplete. Missing: ${missing.join(', ')}`);
}

export function planKnowledgeProposalPublish(options:KnowledgeProposalPublishOptions,files:KnowledgeProposalFile[]):KnowledgeProposalPublishPlan{
  if(!repoPattern.test(options.repository))throw new Error('Repository must be in owner/name form.');
  validateBranch(options.branch);
  validateFiles(files);
  const proposalId=options.proposalId??options.branch.slice('reviewdna/'.length).replace(/\//g,'-');
  if(!proposalIdPattern.test(proposalId)||proposalId.includes('..'))throw new Error('Proposal id contains unsupported characters.');
  const baseBranch=options.baseBranch?.trim()||'(repository default)';
  const prefix=`.reviewdna/proposals/${proposalId}`;
  return{
    repository:options.repository,
    branch:options.branch,
    baseBranch,
    proposalId,
    prefix,
    files:files.map(file=>`${prefix}/${file.name}`),
    apply:options.apply===true
  };
}

export class GitHubProposalPublisher {
  private readonly token:string|undefined;
  constructor(token?:string){this.token=token;}

  private headers(){return {Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','content-type':'application/json',...(this.token?{Authorization:`Bearer ${this.token}`}:{})};}

  private async request<T>(method:string,url:string,body?:unknown):Promise<T>{
    const init:RequestInit={method,headers:this.headers()};
    if(body!==undefined)init.body=JSON.stringify(body);
    const res=await fetch(url,init);
    if(!res.ok)throw new Error(`GitHub API ${method} ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private async exists(url:string):Promise<boolean>{
    const res=await fetch(url,{method:'GET',headers:this.headers()});
    if(res.status===404)return false;
    if(!res.ok)throw new Error(`GitHub API GET ${res.status}: ${await res.text()}`);
    return true;
  }

  async publish(options:KnowledgeProposalPublishOptions,files:KnowledgeProposalFile[]):Promise<KnowledgeProposalPublishResult>{
    const plan=planKnowledgeProposalPublish(options,files);
    if(!plan.apply)return{...plan,applied:false};
    if(!this.token)throw new Error('Publishing requires a GitHub token. Set GITHUB_TOKEN and pass --apply explicitly.');

    const [owner,repo]=options.repository.split('/') as [string,string];
    const root=`https://api.github.com/repos/${owner}/${repo}`;
    const metadata=await this.request<RepoMetadata>('GET',root);
    const baseBranch=options.baseBranch?.trim()||metadata.default_branch;
    if(!baseBranch)throw new Error('Could not determine repository default branch.');

    const branchUrl=`${root}/git/ref/heads/${encodeRef(options.branch)}`;
    if(await this.exists(branchUrl))throw new Error(`Refusing to overwrite existing proposal branch: ${options.branch}`);

    const baseRef=await this.request<RefResponse>('GET',`${root}/git/ref/heads/${encodeRef(baseBranch)}`);
    const baseCommit=await this.request<CommitResponse>('GET',`${root}/git/commits/${baseRef.object.sha}`);
    const treeEntries:Array<{path:string;mode:'100644';type:'blob';sha:string}>=[];
    for(const file of files){
      const blob=await this.request<BlobResponse>('POST',`${root}/git/blobs`,{content:file.content,encoding:'utf-8'});
      treeEntries.push({path:`${plan.prefix}/${file.name}`,mode:'100644',type:'blob',sha:blob.sha});
    }
    const tree=await this.request<TreeResponse>('POST',`${root}/git/trees`,{base_tree:baseCommit.tree.sha,tree:treeEntries});
    const commit=await this.request<CreatedCommit>('POST',`${root}/git/commits`,{
      message:`docs(reviewdna): add knowledge proposal ${plan.proposalId}`,
      tree:tree.sha,
      parents:[baseRef.object.sha]
    });
    await this.request<unknown>('POST',`${root}/git/refs`,{ref:`refs/heads/${options.branch}`,sha:commit.sha});
    const title=options.title?.trim()||`ReviewDNA knowledge proposal: ${plan.proposalId}`;
    const body=options.body?.trim()||`## ReviewDNA knowledge proposal\n\nThis Pull Request contains an evidence-backed ReviewDNA proposal bundle under \`${plan.prefix}/\`.\n\nIt does **not** overwrite AGENTS.md, CONTRIBUTING.md, CLAUDE.md, Cursor rules, or other repository policy files. Review the proposal and its evidence links before adopting any guidance.`;
    const pull=await this.request<PullResponse>('POST',`${root}/pulls`,{title,head:options.branch,base:baseBranch,body});
    return{...plan,baseBranch,applied:true,commitSha:commit.sha,pullRequestUrl:pull.html_url,pullRequestNumber:pull.number};
  }
}
