import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const tests=fs.readdirSync('qa/unit').filter(f=>f.endsWith('.test.mjs')).map(f=>'qa/unit/'+f);
const r=spawnSync(process.execPath,['--test',...tests],{stdio:'inherit'});process.exit(r.status===0?0:1);
