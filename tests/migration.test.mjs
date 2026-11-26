import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { backup, diff, readBackup, recipe, sampleState, shopping, weekDays, smsDates, normalizeMondayDate, shiftMonday } from '../modele.mjs';

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
    const personnalise=structuredClone(state);
    personnalise.settings.sms={intro:'Bonjour !',fin:''};
    await db.save(diff(state,personnalise));
    assert.deepEqual(state.settings.sms,personnalise.settings.sms);
    assert.deepEqual(sdk.docs.get('weekPlans/essai-sites-v1-settings-sms').value,personnalise.settings.sms);
    await db.logout();
    await assert.rejects(()=>db.save(changes),/autorisé/);
    db.dispose();
  }finally{hooks.deregister();}
});

test('les SMS séparent les dîners restants de ceux de la semaine prochaine',async()=>{
  const {dinnerMessage,defaultSms}=await import('../modele.mjs');
  const s=sampleState(monday);
  s.weeks[monday].Mercredi.dinner=['tartines','inconnu','nouilles'];
  s.weeks[monday].Dimanche.dinner=['tartines'];
  s.weeks['2026-11-23']={Lundi:['nouilles'],Dimanche:['tartines']};
  const exportText=period=>dinnerMessage(s,smsDates('2026-11-18',period));
  assert.equal(exportText('remaining'),[defaultSms.intro,
    'Mercredi 18/11 : Tartines de chèvre chaud + Nouilles au brocoli et aux crevettes\nDimanche 22/11 : Tartines de chèvre chaud',
    defaultSms.fin].join('\n\n'));
  assert.equal(exportText('next'),[defaultSms.intro,
    'Lundi 23/11 : Nouilles au brocoli et aux crevettes\nDimanche 29/11 : Tartines de chèvre chaud',
    defaultSms.fin].join('\n\n'));
  assert.equal(dinnerMessage(s,smsDates('2026-12-01','next')),'');
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
  assert.equal(dinnerMessage(s,smsDates(monday)),'');
});

test('le modèle du SMS accepte deux textes personnels, des champs vides et les anciennes sauvegardes',async()=>{
  const {dinnerMessage}=await import('../modele.mjs');
  const s=sampleState(monday);
  const ligne='Lundi 16/11 : Nouilles au brocoli et aux crevettes';
  const ancien=backup(s);
  delete ancien.settings;
  assert.deepEqual(readBackup(ancien).settings,{});
  s.settings.sms={intro:'Ce soir\nà la maison',fin:'À table !'};
  assert.equal(dinnerMessage(s,smsDates(monday)),'Ce soir\nà la maison\n\n'+ligne+'\n\nÀ table !');
  assert.deepEqual(readBackup(backup(s)).settings,s.settings);
  assert.equal(dinnerMessage(s,smsDates(monday),{intro:'',fin:''}),ligne);
  assert.equal(dinnerMessage(s,smsDates('2026-11-19')),'');
});

test('le planning couvre aujourd’hui jusqu’au dimanche de la semaine suivante',async()=>{
  const {planningDates}=await import('../modele.mjs');
  const rows=planningDates('2026-11-26');
  assert.equal(rows.length,11);
  assert.deepEqual(rows[0],{date:'2026-11-26',day:'Jeudi',week:'2026-11-23'});
  assert.deepEqual(rows[4],{date:'2026-11-30',day:'Lundi',week:'2026-11-30'});
  assert.equal(rows.at(-1).date,'2026-12-06');
  assert.equal(planningDates('2026-11-23').length,14);
  assert.deepEqual(planningDates('2026-11-26',1),rows.slice(4));
  assert.equal(planningDates('2026-11-26',-1)[0].date,'2026-11-16');
  const sunday='2026-12-27';
  assert.equal(planningDates(sunday).length,8);
  assert.deepEqual(smsDates(sunday).map(row=>row.date),[sunday]);
  const next=smsDates(sunday,'next');
  assert.equal(next.length,7);
  assert.equal(next[0].date,'2026-12-28');
  assert.deepEqual(next.at(-1),{date:'2027-01-03',day:'Dimanche',week:'2026-12-28'});
});
