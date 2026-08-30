import { access, readFile } from 'node:fs/promises';

const version=(await readFile('VERSION','utf8')).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error(`VERSION must be x.y.z, received: ${version}`);

const manifests=[
  'package.json',
  'apps/cli/package.json',
  'packages/core/package.json',
  'packages/exporters/package.json',
  'packages/github/package.json',
  'packages/gitlab/package.json',
  'packages/plugin-sdk/package.json',
  'packages/providers/package.json',
  'packages/report/package.json',
  'packages/schema/package.json'
];

const internalNames=new Set([
  'reviewdna',
  '@reviewdna/core',
  '@reviewdna/exporters',
  '@reviewdna/github',
  '@reviewdna/gitlab',
  '@reviewdna/plugin-sdk',
  '@reviewdna/providers',
  '@reviewdna/report',
  '@reviewdna/schema'
]);

for(const path of manifests){
  const pkg=JSON.parse(await readFile(path,'utf8'));
  if(pkg.version!==version){
    throw new Error(`${path} version ${pkg.version} does not match VERSION ${version}`);
  }

  for(const field of ['dependencies','devDependencies','peerDependencies','optionalDependencies']){
    for(const [name,range] of Object.entries(pkg[field]??{})){
      if(internalNames.has(name)&&range!==version){
        throw new Error(`${path} ${field}.${name}=${range} must equal release version ${version}`);
      }
    }
  }
}

const changelog=await readFile('CHANGELOG.md','utf8');
const escaped=version.replace(/\./g,'\\.');
if(!new RegExp(`^## ${escaped} - \\d{4}-\\d{2}-\\d{2}$`,'m').test(changelog)){
  throw new Error(`CHANGELOG.md must contain a dated heading for ${version}`);
}

const notesPath=`releases/${version}.md`;
await access(notesPath);
const notes=(await readFile(notesPath,'utf8')).trim();
if(notes.length<500)throw new Error(`${notesPath} is unexpectedly short`);
if(!notes.includes(`ReviewDNA v${version}`))throw new Error(`${notesPath} must name ReviewDNA v${version}`);

const action=await readFile('action/action.yml','utf8');
if(!/^name:\s*ReviewDNA Analyze\s*$/m.test(action))throw new Error('action/action.yml does not look like the ReviewDNA composite Action');
if(!/using:\s*composite/m.test(action))throw new Error('action/action.yml must remain a composite Action for this release');

const readme=await readFile('README.md','utf8');
if(!readme.includes(`ahmed2qaid/reviewdna/action@v${version}`)){
  throw new Error(`README.md must show the stable Action reference @v${version}`);
}

console.log(`ReviewDNA release metadata verified for v${version} across ${manifests.length} manifests.`);
