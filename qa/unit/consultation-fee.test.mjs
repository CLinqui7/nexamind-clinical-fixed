import test from 'node:test';
import assert from 'node:assert/strict';
import {embeddedConsultationFee,formatConsultationFee,parseConsultationFeeInput,patientDisplayName,patientConsultationFee} from '../../src/domain/consultation-fee.js';

test('consultation fees use exact integer cents',()=>{
 assert.equal(parseConsultationFeeInput('120'),12000);
 assert.equal(parseConsultationFeeInput('75,50'),7550);
 assert.equal(parseConsultationFeeInput(''),null);
 assert.throws(()=>parseConsultationFeeInput('-2'));
 assert.equal(formatConsultationFee(12000),'$120');
});

test('one historical parenthesized amount is displayed separately without mutating source',()=>{
 assert.deepEqual(embeddedConsultationFee('David ($120) Alvarenga'),{name:'David Alvarenga',cents:12000,inferred:true});
 assert.equal(patientDisplayName({name:'David Arias Argumedo (75)'}),'David Arias Argumedo');
 assert.deepEqual(patientConsultationFee({name:'David (75)',consultationFeeCents:9000}),{cents:9000,inferred:false});
 assert.deepEqual(patientConsultationFee({name:'Paciente sin monto',consultationFeeCents:null}),{cents:null,inferred:false});
 assert.equal(embeddedConsultationFee('Paciente (75) (80)').inferred,false);
});
