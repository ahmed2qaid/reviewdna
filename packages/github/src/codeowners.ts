export interface CodeOwnersSource { path:string; content:string; }

export async function fetchCodeOwners(repository:string,token?:string):Promise<CodeOwnersSource|undefined>{
  const[owner,repo]=repository.split('/');
  if(!owner||!repo)throw new Error('Repository must be in owner/name form.');
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:`Bearer ${token}`}:{})};
  for(const path of['.github/CODEOWNERS','CODEOWNERS','docs/CODEOWNERS']){
    const res=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`,{headers});
    if(res.status===404)continue;
    if(!res.ok)throw new Error(`GitHub API ${res.status} while reading ${path}: ${await res.text()}`);
    const data=await res.json() as{type:string;content?:string;encoding?:string};
    if(data.type==='file'&&data.content&&data.encoding==='base64'){
      const bytes=Uint8Array.from(atob(data.content.replace(/\n/g,'')),c=>c.charCodeAt(0));
      return{path,content:new TextDecoder().decode(bytes)};
    }
  }
  return undefined;
}
