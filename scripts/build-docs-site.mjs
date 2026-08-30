import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';

const root = resolve('.');
const docsDir = resolve('docs');
const outDir = resolve('_docs');

const rootDocs = ['README.md', 'ARCHITECTURE.md', 'ROADMAP.md', 'SECURITY.md', 'CONTRIBUTING.md'];
const docEntries = (await readdir(docsDir, { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
  .map(entry => `docs/${entry.name}`);
const sources = [...rootDocs, ...docEntries].sort((a, b) => a.localeCompare(b));

function esc(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

function slug(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'section';
}

function pageName(source) {
  if (source === 'README.md') return 'index.html';
  const stem = basename(source, extname(source)).toLowerCase().replace(/_/g, '-');
  return `${stem}.html`;
}

function resolveMarkdownHref(href) {
  if (/^(?:https?:|mailto:|#)/i.test(href)) return href;
  const [path, fragment = ''] = href.split('#');
  if (!path) return `#${fragment}`;
  if (path.endsWith('.md')) {
    const name = pageName(path);
    return `${name}${fragment ? `#${fragment}` : ''}`;
  }
  return href;
}

function inline(text) {
  let output = esc(text);
  output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawHref) => {
    const href = resolveMarkdownHref(rawHref.trim());
    const external = /^https?:/i.test(href);
    return `<a href="${esc(href)}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/_([^_]+)_/g, '<em>$1</em>');
  return output;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const headings = [];
  let paragraph = [];
  let listType = null;
  let code = null;
  let codeLang = '';

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };
  const closeCode = () => {
    if (code === null) return;
    html.push(`<pre><code${codeLang ? ` class="language-${esc(codeLang)}"` : ''}>${esc(code.join('\n'))}</code></pre>`);
    code = null;
    codeLang = '';
  };

  for (const line of lines) {
    const fence = line.match(/^```\s*([^\s]*)/);
    if (fence) {
      if (code === null) {
        flushParagraph(); closeList(); code = []; codeLang = fence[1] ?? '';
      } else closeCode();
      continue;
    }
    if (code !== null) { code.push(line); continue; }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length;
      const text = heading[2].replace(/\s+#+\s*$/, '').trim();
      const id = slug(text);
      headings.push({ level, text, id });
      html.push(`<h${level} id="${esc(id)}">${inline(text)}<a class="anchor" href="#${esc(id)}" aria-label="Link to ${esc(text)}">#</a></h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const target = unordered ? 'ul' : 'ol';
      if (listType !== target) { closeList(); listType = target; html.push(`<${target}>`); }
      html.push(`<li>${inline((unordered ?? ordered)[1])}</li>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph(); closeList(); html.push(`<blockquote>${inline(quote[1])}</blockquote>`); continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph(); closeList(); html.push('<hr>'); continue;
    }

    if (!line.trim()) { flushParagraph(); closeList(); continue; }
    paragraph.push(line.trim());
  }

  flushParagraph(); closeList(); closeCode();
  return { html: html.join('\n'), headings };
}

function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return (match?.[1] ?? fallback).replace(/[`*_]/g, '').trim();
}

function extractDescription(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const value = line.trim();
    if (!value || value.startsWith('#') || value.startsWith('```') || value.startsWith('- ') || value.startsWith('>')) continue;
    return value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*_]/g, '').slice(0, 220);
  }
  return '';
}

const documents = [];
for (const source of sources) {
  try {
    const markdown = await readFile(resolve(source), 'utf8');
    const title = extractTitle(markdown, basename(source));
    const description = extractDescription(markdown);
    const rendered = renderMarkdown(markdown);
    documents.push({ source, page: pageName(source), title, description, markdown, ...rendered });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const navigation = documents.map(doc => `<a data-doc="${esc(`${doc.title} ${doc.description}`.toLowerCase())}" class="nav-link" href="${esc(doc.page)}">${esc(doc.title)}</a>`).join('\n');
const searchIndex = documents.map(doc => ({
  title: doc.title,
  description: doc.description,
  page: doc.page,
  text: doc.markdown.toLowerCase().replace(/\s+/g, ' ').slice(0, 12000)
}));

const style = `
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark;background:#0b0d12;color:#edf2f7}*{box-sizing:border-box}body{margin:0}.shell{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;overflow:auto;padding:24px;border-right:1px solid #252b38;background:#0f131c}.brand{font-weight:800;font-size:20px}.tagline{color:#98a2b3;font-size:13px;margin:6px 0 18px}.search{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #303746;background:#10151f;color:#fff;margin-bottom:14px}.nav{display:grid;gap:4px}.nav-link{display:block;padding:8px 10px;border-radius:8px;color:#cbd5e1;text-decoration:none;font-size:14px}.nav-link:hover,.nav-link.active{background:#202738;color:#fff}.main{min-width:0}.topbar{display:flex;justify-content:space-between;gap:16px;padding:18px 36px;border-bottom:1px solid #202632;background:#0b0d12;position:sticky;top:0;z-index:2}.topbar a{color:#9cc2ff;text-decoration:none}.content{max-width:940px;padding:42px 48px 80px}.content h1{font-size:42px;line-height:1.15;margin:0 0 26px}.content h2{font-size:28px;margin-top:46px;border-bottom:1px solid #252b38;padding-bottom:8px}.content h3{font-size:21px;margin-top:34px}.content h4{font-size:17px;margin-top:26px}.content p,.content li{line-height:1.72;color:#d8dee9}.content a{color:#8ec5ff}.content code{background:#1b2230;border:1px solid #2b3445;border-radius:5px;padding:.12em .38em}.content pre{background:#0e121a;border:1px solid #252d3a;border-radius:12px;padding:18px;overflow:auto}.content pre code{border:0;background:transparent;padding:0}.content blockquote{border-left:3px solid #7c5cff;margin:20px 0;padding:8px 16px;background:#121723;color:#b9c2d0}.content hr{border:0;border-top:1px solid #252b38;margin:34px 0}.anchor{opacity:0;margin-left:8px;text-decoration:none;font-size:.7em}.content h1:hover .anchor,.content h2:hover .anchor,.content h3:hover .anchor,.content h4:hover .anchor{opacity:.65}.meta{color:#8b96a8;font-size:13px;margin-bottom:26px}.search-results{display:none;position:absolute;top:62px;left:36px;right:36px;max-width:900px;background:#111722;border:1px solid #303849;border-radius:12px;padding:8px;box-shadow:0 18px 60px rgba(0,0,0,.4)}.search-results.open{display:block}.result{display:block;padding:10px;border-radius:8px;text-decoration:none;color:#fff}.result:hover{background:#202738}.result small{display:block;color:#98a2b3;margin-top:3px}.footer{color:#7f8999;font-size:12px;margin-top:58px;border-top:1px solid #252b38;padding-top:20px}@media(max-width:860px){.shell{grid-template-columns:1fr}.sidebar{position:relative;height:auto;border-right:0;border-bottom:1px solid #252b38}.nav{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}.topbar{position:relative;padding:14px 20px}.content{padding:28px 20px 60px}.content h1{font-size:34px}.search-results{left:20px;right:20px}}
`;

function pageHtml(doc) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(doc.description)}"><title>${esc(doc.title)} · ReviewDNA Docs</title><style>${style}</style></head><body><div class="shell"><aside class="sidebar"><div class="brand">ReviewDNA 🧬</div><div class="tagline">Evidence-backed engineering knowledge</div><input id="navSearch" class="search" type="search" placeholder="Filter documentation…" aria-label="Filter documentation"><nav class="nav">${navigation}</nav></aside><main class="main"><div class="topbar"><div><a href="index.html">Documentation</a> · ${esc(doc.title)}</div><div><a href="../index.html">Demo</a> · <a href="https://github.com/ahmed2qaid/reviewdna" target="_blank" rel="noreferrer">GitHub</a></div><div id="results" class="search-results"></div></div><article class="content"><div class="meta">Source: ${esc(doc.source)} · generated locally from repository Markdown</div>${doc.html}<div class="footer">ReviewDNA documentation is generated without a server or telemetry. Pre-1.0 behavior is documented conservatively; generated rules are evidence, not policy.</div></article></main></div><script>const INDEX=${JSON.stringify(searchIndex).replace(/</g, '\\u003c')};const input=document.getElementById('navSearch'),links=[...document.querySelectorAll('.nav-link')],results=document.getElementById('results');for(const link of links){if(link.getAttribute('href')===${JSON.stringify(doc.page)})link.classList.add('active')}input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();for(const link of links)link.hidden=Boolean(q&&!link.dataset.doc.includes(q));if(q.length<2){results.classList.remove('open');results.innerHTML='';return}const found=INDEX.filter(item=>item.title.toLowerCase().includes(q)||item.description.toLowerCase().includes(q)||item.text.includes(q)).slice(0,8);results.innerHTML=found.map(item=>'<a class="result" href="'+item.page+'"><strong>'+escapeHtml(item.title)+'</strong><small>'+escapeHtml(item.description)+'</small></a>').join('')||'<div class="result"><small>No matching documentation.</small></div>';results.classList.add('open')});function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}</script></body></html>`;
}

for (const doc of documents) await writeFile(join(outDir, doc.page), pageHtml(doc));
await writeFile(join(outDir, 'search-index.json'), `${JSON.stringify(searchIndex, null, 2)}\n`);
await writeFile(join(outDir, '.nojekyll'), '');
console.log(`ReviewDNA docs site built at ${outDir} with ${documents.length} pages.`);
