import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {LEARNING_CHAPTERS} from '../../src/learning-content.js';
import {timedLearningScenes,readingSeconds} from '../../src/domain/learning-scenes.js';
test('Every chapter ships current reading video, all control text, timed captions and original instrumental music',()=>{
 const m=JSON.parse(fs.readFileSync('public/tutorials/pages/manifest.json','utf8'));
 assert.equal(m.chapters.length,LEARNING_CHAPTERS.length);assert.equal(m.syntheticData,true);
 assert.equal(m.version,2);assert.equal(m.narration,false);assert.equal(m.mode,'reading-music');assert.equal(m.music.original,true);
 assert.equal(m.music.sha256,crypto.createHash('sha256').update(fs.readFileSync('public'+m.music.file)).digest('hex'));
 for(const c of LEARNING_CHAPTERS){const v=m.chapters.find(x=>x.id===c.id);assert.equal(v.sha256,crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex'),'Regenerate video '+c.id);assert.equal(v.controls,c.controls.length);assert.ok(v.seconds>60);assert.ok(fs.statSync('public'+c.video).size>10000);assert.match(fs.readFileSync('public'+c.captions,'utf8'),/^WEBVTT/);
  const copy=JSON.parse(fs.readFileSync(`public/tutorials/pages/${c.id}.json`,'utf8'));const expected=timedLearningScenes(c).map(({narration,...s})=>s);
  assert.equal(copy.id,c.id);assert.deepEqual(copy.scenes,expected);assert.equal(v.scenes,c.controls.length+3);assert.equal(v.seconds,copy.scenes.at(-1).end);
  c.controls.forEach((control,i)=>assert.equal(copy.scenes[i+2].text,control.how+' '+control.result));
  for(const [i,s] of copy.scenes.entries()){assert.equal(s.start,i?copy.scenes[i-1].end:0);assert.ok(s.end-s.start>=12);assert.equal(s.end-s.start,readingSeconds(s));}
 }
});
