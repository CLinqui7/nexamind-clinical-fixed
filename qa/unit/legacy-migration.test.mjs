import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('legacy migration dry-run reports quality, maps IDs consistently and performs no import',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'linkare-legacy-')),input=path.join(dir,'input.json'),one=path.join(dir,'one.json'),two=path.join(dir,'two.json'),org='20000000-0000-4000-8000-000000000001';
 fs.writeFileSync(input,JSON.stringify({patients:[{legacy_id:'P-1',name:' Ana  Pérez '},{legacy_id:'P-1',name:'Duplicada'},{legacy_id:'P-2',name:''}],appointments:[{legacy_id:'A-1',patient_legacy_id:'P-1'}]}));
 const run=output=>spawnSync(process.execPath,['scripts/legacy-migration.mjs','--input',input,'--organization',org,'--source','qa','--output',output],{encoding:'utf8'});const first=run(one),second=run(two);assert.equal(first.status,0,first.stderr);assert.equal(second.status,0,second.stderr);
 const a=JSON.parse(fs.readFileSync(one)),b=JSON.parse(fs.readFileSync(two));assert.equal(a.mode,'dry-run');assert.equal(a.totalSource,4);assert.equal(a.valid,2);assert.equal(a.invalid,1);assert.equal(a.duplicates,1);assert.equal(a.imported,0);assert.equal(a.skipped,4);assert.equal(a.mappingPreview[0].new_id,b.mappingPreview[0].new_id);assert.match(a.mappingPreview[0].new_id,/^[a-f0-9-]{36}$/);
 fs.rmSync(dir,{recursive:true,force:true});
});
