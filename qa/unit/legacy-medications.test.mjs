import test from 'node:test';
import assert from 'node:assert/strict';
import {extractHistoricalMedicationMentions} from '../../scripts/lib/legacy-medication-extractor.mjs';

test('historical dose headings become review candidates without inventing active treatment',()=>{
  const text='Raíz de San Juan 300 mg\nTomar 1 comprimido cada mañana.\nLasea 80 mg\nTomar 1 cada noche.\nOzempic Dualdose 2Mg X 1 Pluma De 1.5Ml\n0.25mg cada semana por 1 mes, luego aplicar 0.50mg';
  const mentions=extractHistoricalMedicationMentions(text);
  assert.equal(mentions.length,3);
  assert.deepEqual(mentions.map(item=>item.name),['Raíz de San Juan','Lasea','Ozempic Dualdose']);
  assert.equal(mentions[2].strengthText,'2Mg');
  assert.match(mentions[2].instructionText,/0\.25mg cada semana/);
  assert.ok(mentions.every(item=>item.status==='historical_unverified'));
  assert.ok(mentions.every(item=>!Object.hasOwn(item,'active')&&!Object.hasOwn(item,'startDate')));
});

test('clinical narrative, vitals and dosage instructions are not treated as medicine names',()=>{
  const text='Paciente refiere mejoría con Sertralina 50 mg.\nPeso 80 kg\nGlucosa 100 mg\nTomar 2 mg cada noche\nSertralina 50 mg\nTomar 1 tableta cada mañana';
  const mentions=extractHistoricalMedicationMentions(text);
  assert.deepEqual(mentions.map(item=>item.name),['Sertralina']);
  assert.equal(mentions[0].sourceLine,5);
});

test('empty or unstructured notes remain verbatim-only and are not guessed',()=>{
  assert.deepEqual(extractHistoricalMedicationMentions('Paciente relata cambios de ánimo y problemas de sueño.'),[]);
  assert.deepEqual(extractHistoricalMedicationMentions(null),[]);
});
