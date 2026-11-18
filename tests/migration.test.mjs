import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { backup, diff, readBackup, recipe, sampleState, shopping, weekDays, normalizeMondayDate, shiftMonday } from '../modele.mjs';

const monday='2026-11-16';
test('les dîners historiques et les semaines à cheval sur deux années sont conservés',()=>{
  assert.deepEqual(weekDays({Lundi:['a','a']}).Lundi,{breakfast:[],lunch:[],dinner:['a']});
  assert.equal(normalizeMondayDate('2027-01-03'),'2026-12-28');
  assert.equal(shiftMonday('2026-12-28',1),'2027-01-04');
});
test('les courses cumulent les occurrences, les portions et les unités compatibles',()=>{
  const s=sampleState(monday);
  s.weeks[monday].Mardi.dinner=['nouilles'];
  s.meals.nouilles.ingredients.push({name:'nouilles',qty:1,unit:'sachet'});
  s.meals.ancien=recipe({name:'Ancien repas'}); s.weeks[monday].Jeudi.dinner=['ancien'];
  const {items,missing}=shopping(s,monday,4);
  assert.equal(items.find(i=>i.name==='Nouilles'&&i.unit==='g').qty,640);
  assert.equal(items.find(i=>i.unit==='sachet').qty,4);
  assert.deepEqual(missing,['Ancien repas']);
});
test('la sauvegarde conserve les archives et les plannings et rejette une semaine invalide',()=>{
  const s=sampleState(monday); s.meals.tartines.archived=true;
  assert.deepEqual(readBackup(JSON.parse(JSON.stringify(backup(s)))),s);
  assert.deepEqual(diff(s,structuredClone(s)),[]);
  assert.throws(()=>readBackup({...backup(s),weeks:{'2026-11-18':weekDays()}}));
  assert.throws(()=>readBackup({...backup(s),version:99}));
});

test('les transactions Firestore simulées isolent les données et refusent une modification concurrente',async()=>{
  // Charger le même adaptateur que le navigateur en substituant uniquement le SDK distant.
  const hooks=registerHooks({resolve(specifier,context,next){
    if(specifier.startsWith('https://www.gstatic.com/firebasejs/'))
      return {shortCircuit:true,url:new URL('./sdk-simule.mjs',import.meta.url).href};
    return next(specifier,context);
  }});
  try{
    const { connect }=await import('../firebase-store.mjs');
    const sdk=await import('./sdk-simule.mjs');
    let state,error;
    const db=connect({data:s=>{state=s;},signedOut:()=>{},error:e=>{error=e;}});
    await sdk.session('autre-compte');
    assert.match(error.message,/droits/);
    await assert.rejects(()=>db.save([]),/autorisé/);
    await sdk.session('ENgOZhuh0ca3tqeb0IbII2CCVzX2');
    assert.deepEqual(state.weeks[monday].Lundi.dinner,['original']);
    assert.equal(sdk.writes.length,0);
    const before=structuredClone(state), next=structuredClone(state);
    next.meals.original.note='Essai';next.weeks[monday].Jeudi.dinner=['original'];
    const changes=diff(before,next);
    await db.save(changes);
    assert.deepEqual(sdk.writes,['weekPlans/essai-sites-v1-meals-original','weekPlans/essai-sites-v1-weeks-'+monday]);
    assert.equal(sdk.docs.get('meals/original').note,'Origine');
    assert.deepEqual(sdk.docs.get('weekPlans/currentWeek1').days,{Lundi:['original']});
    assert.equal(state.meals.original.note,'Essai');
    assert.deepEqual(state.weeks[monday].Jeudi.dinner,['original']);
    await assert.rejects(()=>db.save(changes),/autre appareil/);
    assert.equal(sdk.writes.length,2);
    await db.logout();
    await assert.rejects(()=>db.save(changes),/autorisé/);
    db.dispose();
  }finally{hooks.deregister();}
});
