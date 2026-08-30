import type { EmbeddingProvider } from '@reviewdna/core/embeddings';

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name:string;
  readonly recommendedThreshold=.72;
  constructor(private model='nomic-embed-text',private baseUrl='http://127.0.0.1:11434',private timeoutMs=120_000){this.name=`ollama:${model}`;}
  async embed(texts:string[]):Promise<number[][]>{
    if(!texts.length)return[];
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const response=await fetch(`${this.baseUrl.replace(/\/$/,'')}/api/embed`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:this.model,input:texts}),signal:controller.signal});
      if(!response.ok)throw new Error(`Ollama embedding provider error ${response.status}: ${await response.text()}`);
      const json=await response.json() as{embeddings?:number[][]};
      if(!Array.isArray(json.embeddings))throw new Error('Ollama embedding provider returned no embeddings array.');
      return json.embeddings;
    } finally {clearTimeout(timer);}
  }
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly name:string;
  readonly recommendedThreshold=.76;
  constructor(private options:{baseUrl:string;apiKey:string;model:string;timeoutMs?:number}){this.name=`openai-compatible:${options.model}`;}
  async embed(texts:string[]):Promise<number[][]>{
    if(!texts.length)return[];
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.options.timeoutMs??60_000);
    try{
      const response=await fetch(`${this.options.baseUrl.replace(/\/$/,'')}/embeddings`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${this.options.apiKey}`},body:JSON.stringify({model:this.options.model,input:texts}),signal:controller.signal});
      if(!response.ok)throw new Error(`OpenAI-compatible embedding provider error ${response.status}: ${await response.text()}`);
      const json=await response.json() as{data?:Array<{index:number;embedding:number[]}>};
      if(!Array.isArray(json.data))throw new Error('OpenAI-compatible embedding provider returned no data array.');
      return [...json.data].sort((a,b)=>a.index-b.index).map(item=>item.embedding);
    } finally {clearTimeout(timer);}
  }
}
