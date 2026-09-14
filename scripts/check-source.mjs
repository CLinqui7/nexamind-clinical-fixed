import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
let count=0;for(const file of [...files('src'),...files('qa/unit')].filter(f=>/\.(js|mjs)$/.test(f))){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);count++;}
for(const file of files('src').filter(f=>f.endsWith('.js'))){const body=fs.readFileSync(file,'utf8');for(const blocked of ['NexaMind2026!','Agenda2026!','Linkare2026!','doctora@nexamind.demo','secretaria@nexamind.demo','authenticateLocalUser','createSeedData'])if(body.includes(blocked)){console.error('Production source contains prohibited sample access:',file);process.exit(1);}}
console.log(`SOURCE_SYNTAX_OK ${count} files; no bundled sample access.`);
