import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {LEARNING_CHAPTERS} from '../../src/learning-content.js';
test('Every learning chapter ships its current narrated video and Spanish captions',()=>{
 const m=JSON.parse(fs.readFileSync('public/tutorials/pages/manifest.json','utf8'));
 assert.equal(m.chapters.length,LEARNING_CHAPTERS.length);assert.equal(m.syntheticData,true);
 for(const c of LEARNING_CHAPTERS){const v=m.chapters.find(x=>x.id===c.id);assert.equal(v.sha256,crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex'),'Regenerate video '+c.id);assert.equal(v.controls,c.controls.length);assert.ok(v.seconds>60);assert.ok(fs.statSync('public'+c.video).size>10000);assert.match(fs.readFileSync('public'+c.captions,'utf8'),/^WEBVTT/)}
});
