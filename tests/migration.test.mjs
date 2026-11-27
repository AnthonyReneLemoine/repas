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
    let ready;
    const catalogueReady=new Promise(resolve=>{ready=resolve;});
    const db=connect({data:s=>{state=s;if(s.settings.catalogueV1) ready();},signedOut:()=>{},error:e=>{error=e;}});
    await assert.rejects(()=>db.loginWithGoogle(),/droits/);
    assert.match(error.message,/droits/);
    await assert.rejects(()=>db.save([]),/autorisé/);
    sdk.selectGoogleAccount('ENgOZhuh0ca3tqeb0IbII2CCVzX2');
    await db.loginWithGoogle();
    await catalogueReady;
    assert.deepEqual(state.weeks[monday].Lundi.dinner,['original']);
    assert.equal(state.meals['ingredient-classique-tahini'].name,'Tahini');
    assert.ok(sdk.writes.every(path=>path.startsWith('weekPlans/essai-sites-v1-')));
    const seedWrites=sdk.writes.length;
    const before=structuredClone(state), next=structuredClone(state);
    next.meals.original.note='Essai';next.weeks[monday].Jeudi.dinner=['original'];
    const changes=diff(before,next);
    await db.save(changes);
    assert.deepEqual(sdk.writes.slice(seedWrites),['weekPlans/essai-sites-v1-meals-original','weekPlans/essai-sites-v1-weeks-'+monday]);
    assert.equal(sdk.docs.get('meals/original').note,'Origine');
    assert.deepEqual(sdk.docs.get('weekPlans/currentWeek1').days,{Lundi:['original']});
    assert.equal(state.meals.original.note,'Essai');
    assert.deepEqual(state.weeks[monday].Jeudi.dinner,['original']);
    await assert.rejects(()=>db.save(changes),/autre appareil/);
    assert.equal(sdk.writes.length,seedWrites+2);
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

test('un ingrédient seul est conservé, planifiable et compté dans les courses',async()=>{
  const {dinnerMessage}=await import('../modele.mjs');
  const s=sampleState(monday);
  const name='Pommes de terre';
  s.meals.pdt=recipe({kind:'ingredient',name,ingredients:[{name,qty:400,unit:'g'}]});
  s.weeks[monday].Jeudi.dinner=['pdt'];
  const restored=readBackup(backup(s));
  assert.equal(restored.meals.pdt.kind,'ingredient');
  assert.equal(restored.meals.tartines.kind,undefined);
  assert.equal(shopping(restored,monday,4).items.find(i=>i.name===name).qty,800);
  assert.match(dinnerMessage(restored,smsDates(monday)),/Jeudi 19\/11 : Pommes de terre/);
  s.meals.pdt.ingredients[0].qty=null;
  assert.equal(shopping(readBackup(backup(s)),monday,2).items.find(i=>i.name===name).qty,null);
});

test('le catalogue complète les anciennes données une fois et respecte les fiches personnelles',async()=>{
  const {populateIngredients}=await import('../modele.mjs');
  const {catalogue,cuisines}=await import('../catalogue.mjs');
  const s=sampleState(monday);
  const original=recipe({kind:'ingredient',name:'ÉCHALOTE',ingredients:[{name:'ÉCHALOTE',qty:2,unit:'pièces'}]});
  s.meals.perso=original;
  populateIngredients(s);
  assert.deepEqual(s.meals.perso,original);
  assert.equal(s.meals['ingredient-classique-echalote'],undefined);
  assert.equal(Object.values(s.meals).filter(m=>m.kind==='ingredient').length,catalogue.size);
  assert.equal(catalogue.get('ail').cuisines.length,cuisines.length);
  delete s.meals['ingredient-classique-tahini'];
  const restored=readBackup(backup(s));
  populateIngredients(restored);
  assert.deepEqual(restored,s);
});

test('les nouveaux fromages et boissons complètent le premier catalogue sans rétablir les fiches supprimées',async()=>{
  const {populateIngredients}=await import('../modele.mjs');
  const {catalogue,catalogueMarker}=await import('../catalogue.mjs');
  const state=sampleState(monday);
  state.settings.catalogueV1=true;
  state.meals.eau=recipe({kind:'ingredient',name:'EAU PLATE',ingredients:[{name:'EAU PLATE',qty:1,unit:'L'}]});
  populateIngredients(state);
  assert.equal(state.meals['ingredient-classique-comte'],undefined);
  assert.equal(state.meals['ingredient-classique-eau-plate'],undefined);
  assert.equal(state.meals.eau.ingredients[0].qty,1);
  assert.equal(state.meals['ingredient-classique-roquefort'].name,'Roquefort');
  assert.deepEqual(catalogue.get('roquefort').cuisines,['Française']);
  assert.equal(catalogue.get('comte').famille,'Fromages français');
  assert.equal(catalogue.get('cola').famille,'Sodas');
  assert.equal(catalogue.get('eau-gazeuse').famille,'Eaux');
  delete state.meals['ingredient-classique-roquefort'];
  const restored=readBackup(backup(state));
  populateIngredients(restored);
  assert.equal(restored.settings[catalogueMarker],true);
  assert.deepEqual(restored,state);
});

test('les sauces, poissons, pains et viennoiseries complètent un catalogue V2 déjà personnalisé',async()=>{
  const {populateIngredients}=await import('../modele.mjs');
  const {catalogue,ingredientKey}=await import('../catalogue.mjs');
  const s=sampleState(monday);
  s.settings={catalogueV1:true,catalogueV2:true};
  s.meals.perso=recipe({kind:'ingredient',name:'Baguette',ingredients:[{name:'Baguette',qty:1,unit:'pièce'}]});
  populateIngredients(s);
  for(const [name,famille] of [['Sauce hollandaise','Sauces'],['Lieu jaune','Poissons'],
    ['Pain de seigle','Pains'],['Pain au chocolat','Viennoiseries']]){
    const key=ingredientKey(name);
    assert.equal(s.meals['ingredient-classique-'+key].name,name);
    assert.equal(catalogue.get(key).famille,famille);
  }
  for(const key of ['baguette','cola','saumon','sauce-soja','pain-pita']) assert.equal(s.meals['ingredient-classique-'+key],undefined);
  assert.equal(catalogue.get('pain-pita').famille,'Pains');
  assert.equal(catalogue.get('sauce-soja').famille,'Sauces');
  assert.equal(s.meals.perso.ingredients[0].qty,1);
  delete s.meals['ingredient-classique-lieu-jaune'];
  const restored=readBackup(backup(s));
  populateIngredients(restored);
  assert.deepEqual(restored,s);
});

test('les pâtes et les recettes de sauces complètent un catalogue V4 sans écraser les fiches de même nom',async()=>{
  const {populateIngredients}=await import('../modele.mjs');
  const {catalogue,ingredientKey}=await import('../catalogue.mjs');
  const {saucesItaliennes}=await import('../sauces-italiennes.mjs');
  const s=sampleState(monday);
  s.settings={catalogueV1:true,catalogueV2:true,catalogueV3:true,catalogueV4:true};
  s.meals.pesto=recipe({name:'Pesto au basilic',note:'Ma recette'});
  s.meals.sauce=recipe({kind:'ingredient',name:'Sauce arrabbiata',ingredients:[{name:'Sauce arrabbiata',qty:null,unit:''}]});
  const added=populateIngredients(s);
  assert.ok(added.every(entry=>entry.version>=5));
  assert.equal(s.meals['ingredient-classique-spaghettis'],undefined);
  assert.equal(catalogue.get('spaghettis').famille,'Pâtes italiennes');
  assert.equal(s.meals['ingredient-classique-farfalle'].kind,'ingredient');
  assert.equal(s.meals['recette-italienne-pesto-au-basilic'],undefined);
  assert.equal(s.meals.pesto.note,'Ma recette');
  for(const sauce of saucesItaliennes.filter(r=>r.name!==s.meals.pesto.name)){
    const fiche=s.meals['recette-italienne-'+ingredientKey(sauce.name)];
    assert.equal(fiche.kind,undefined);
    assert.equal(fiche.portions,2);
    assert.ok(fiche.steps.length>=2);
    assert.ok(fiche.ingredients.every(i=>catalogue.has(ingredientKey(i.name))&&i.qty>0&&i.unit));
  }
  s.weeks[monday].Jeudi.dinner=['recette-italienne-sauce-arrabbiata'];
  assert.ok(shopping(s,monday,2).items.some(i=>i.name==='Piment séché'));
  delete s.meals['recette-italienne-sauce-carbonara'];
  const restored=readBackup(backup(s));
  assert.deepEqual(populateIngredients(restored),[]);
  assert.deepEqual(restored,s);
});

test('le complément poissonnerie et condiments respecte les ingrédients personnels et les anciennes suppressions',async()=>{
  const {populateIngredients}=await import('../modele.mjs');
  const {catalogue,ingredientKey}=await import('../catalogue.mjs');
  const s=sampleState(monday);
  s.settings={catalogueV1:true,catalogueV2:true,catalogueV3:true,catalogueV4:true,catalogueV5:true};
  s.meals.perso=recipe({kind:'ingredient',name:'Capres',ingredients:[{name:'Capres',qty:2,unit:'c. à café'}]});
  const added=populateIngredients(s);
  assert.ok(added.length>0 && added.every(entry=>entry.version===6));
  assert.equal(catalogue.get(ingredientKey('capres')).famille,'Épicerie et conserves');
  assert.equal(s.meals['ingredient-classique-capres'],undefined);
  assert.equal(s.meals.perso.ingredients[0].qty,2);
  assert.equal(s.meals['ingredient-classique-aile-de-raie'].name,'Aile de raie');
  assert.equal(s.meals['ingredient-classique-cabillaud'],undefined);
  assert.deepEqual(populateIngredients(readBackup(backup(s))),[]);
});
