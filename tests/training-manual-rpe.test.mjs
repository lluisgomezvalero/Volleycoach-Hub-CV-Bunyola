import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preferredManualEvent} from '../assets/manual-player-rpe-20261022.js';
const now=Date.parse('2026-10-27T20:00:00Z'),event={id:'session',starts_at:'2026-10-27T17:00:00Z',ends_at:'2026-10-27T19:00:00Z'},present={event_id:'session',player_id:'one',official_status:'present'};
test('training form selects the current completed session for a validated player; partial participation is eligible',()=>{
 for(const official_status of ['present','late'])assert.equal(preferredManualEvent('session','one',[event],[{...present,official_status}],[],now),'session');
});
test('pending or absent attendance, future or unknown end, cancellation, and another player never become a default team RPE',()=>{
 for(const official_status of [null,'justified','unjustified'])assert.equal(preferredManualEvent('session','one',[event],[{...present,official_status}],[],now),'');
 for(const e of [{...event,ends_at:null},{...event,ends_at:'2026-10-28T19:00:00Z'},{...event,status:'cancelled'}])assert.equal(preferredManualEvent('session','one',[e],[present],[],now),'');
 assert.equal(preferredManualEvent('session','other',[event],[present],[],now),'');
});
test('player-submitted responses are protected; a staff-entered response can still be corrected through the existing RPC',()=>{
 assert.equal(preferredManualEvent('session','one',[event],[present],[{event_id:'session',player_id:'one',source:'player'}],now),'');
 assert.equal(preferredManualEvent('session','one',[event],[present],[{event_id:'session',player_id:'one',source:'coach_for_player'}],now),'session');
});
test('staff registration is in training detail while the player read-only history stays in wellbeing',()=>{
 const source=readFileSync('assets/index-evolution-20261019.js','utf8'),wellness=source.slice(source.indexOf('function _N('),source.indexOf('function CN('));
 assert.ok(!wellness.includes('i.jsx(ManualPlayerRpe,{identity:a,players:x,events:E,attendance:O'));
 assert.ok(wellness.includes('readOnly:true'));
 const training=source.slice(source.indexOf('function tN('),source.indexOf('function nN('));
 assert.ok(training.includes('m?i.jsx(TrainingManualRpe'));
 assert.ok(training.indexOf('i.jsx(TrainingManualRpe')>training.indexOf('title:"Después de la sesión"'));
});
