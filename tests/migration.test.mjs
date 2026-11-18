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
    await assert.rejects(()=>db.loginWithGoogle(),/droits/);
    assert.match(error.message,/droits/);
    await assert.rejects(()=>db.save([]),/autorisé/);
    sdk.selectGoogleAccount('ENgOZhuh0ca3tqeb0IbII2CCVzX2');
    await db.loginWithGoogle();
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

test('le SMS du mercredi couvre les dîners de mercredi à dimanche inclus',async()=>{
  const {dinnerMessage}=await import('../modele.mjs');
  const s=sampleState(monday);
  s.weeks[monday].Mercredi.dinner=['tartines','inconnu','nouilles'];
  s.weeks[monday].Dimanche.dinner=['tartines'];
  const part=dinnerMessage(s,monday,'2026-11-18');
  assert.equal(part,'Dîners\nMercredi 18/11 : Tartines de chèvre chaud + Nouilles au brocoli et aux crevettes\nDimanche 22/11 : Tartines de chèvre chaud');
  assert.match(dinnerMessage(s,monday),/Lundi 16\/11/);
  assert.equal(dinnerMessage(s,monday,'2026-11-22'),'Dîners\nDimanche 22/11 : Tartines de chèvre chaud');
  assert.equal(dinnerMessage(s,monday,'2026-11-23'),'');
  assert.equal(dinnerMessage(s,monday,'2026-11-13'),dinnerMessage(s,monday));
  s.weeks[monday]={Jeudi:['nouilles']};
  assert.match(dinnerMessage(s,monday),/Jeudi 19\/11/);
});

test('les petits-déjeuners historiques restent sauvegardés et sont exclus des courses et du SMS',async()=>{
  const {dinnerMessage,SLOTS}=await import('../modele.mjs');
  const s=sampleState(monday), days=weekDays();
  days.Lundi.breakfast=['tartines'];
  days.Mercredi.lunch=['nouilles'];
  s.weeks[monday]=days;
  assert.deepEqual(Object.keys(SLOTS),['lunch','dinner']);
  assert.deepEqual(readBackup(backup(s)).weeks[monday].Lundi.breakfast,['tartines']);
  assert.equal(shopping(s,monday,2).items.some(i=>i.name==='Pain'),false);
  assert.equal(dinnerMessage(s,monday),'');
});
