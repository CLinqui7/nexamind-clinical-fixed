import test from 'node:test';
import assert from 'node:assert/strict';
import {LEARNING_CHAPTERS,chapterComplete,learningForView} from '../../src/learning-content.js';
test('Every product page has a specific course, actionable controls and a quiz',()=>{
 assert.equal(new Set(LEARNING_CHAPTERS.map(c=>c.id)).size,LEARNING_CHAPTERS.length);
 for(const view of ['login','dashboard','patients','patient','notebook','agenda','analytics','alerts','payments','settings'])assert.ok(LEARNING_CHAPTERS.some(c=>c.view===view));
 for(const c of LEARNING_CHAPTERS){assert.ok(c.controls.length>=8);for(const x of c.controls){assert.ok(x.label&&x.how&&x.result)}assert.ok(c.quiz.answers[c.quiz.correct]);assert.equal(chapterComplete(c,{read:[],passed:true}),false);assert.equal(chapterComplete(c,{read:c.controls.map((_,i)=>i),passed:true}),true)}
 assert.equal(learningForView('patient','followup').id,'seguimiento');
});
