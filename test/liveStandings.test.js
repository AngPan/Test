import test from 'node:test';
import assert from 'node:assert/strict';
import { projectedSideTotal, scoreToGoals } from '../src/scoring.js';

test('aggiunge 6 per ogni titolare non ancora giocato',()=>{const side={tot:16,starts:[{ptype:'U'},{ptype:'U'},{ptype:'-'},{ptype:'U'},{ptype:'-'}]};assert.deepEqual(projectedSideTotal(side),{officialTotal:16,unplayed:3,projectedTotal:34});});
test('converte i fantapunti nelle fasce gol della Scaloni League',()=>{const s={step:{stlmt:66,stgoal:[6,11,15,19]}};assert.equal(scoreToGoals(65.5,s),0);assert.equal(scoreToGoals(66,s),1);assert.equal(scoreToGoals(71.5,s),1);assert.equal(scoreToGoals(72,s),2);assert.equal(scoreToGoals(77,s),3);});
