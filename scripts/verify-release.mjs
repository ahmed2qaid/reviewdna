import { access, readFile } from 'node:fs/promises';

const version=(await readFile('VERSION','utf8')).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error(`VERSION must be x.y.z, received: ${version}`);

const pkg=JSON.parse(await readFile('package.json','utf8'));
if(pkg.version!==version)throw new Error(`package.json version ${pkg.version} does not match VERSION ${version}`);

const changelog=await readFile('CHANGELOG.md','utf8');
const escaped=version.replace(/\./g,'\\.');
if(!new RegExp(`^## ${escaped} - \\d{4}-\\d{2}-\\d{2}$`,'m').test(changelog)){
  throw new Error(`CHANGELOG.md must contain a dated heading for ${version}`);
}

const notesPath=`releases/${version}.md`;
await access(notesPath);
const notes=(await readFile(notesPath,'utf8')).trim();
if(notes.length<120)throw new Error(`${notesPath} is unexpectedly short`);
if(!notes.includes(`ReviewDNA v${version}`))throw new Error(`${notesPath} must name ReviewDNA v${version}`);

const action=await readFile('action/action.yml','utf8');
if(!/^name:\s*ReviewDNA Analyze\s*$/m.test(action))throw new Error('action/action.yml does not look like the ReviewDNA composite Action');
if(!/using:\s*composite/m.test(action))throw new Error('action/action.yml must remain a composite Action for this release');

console.log(`ReviewDNA release metadata verified for v${version}.`);
