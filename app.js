import { catalogue, catalogueMarker, cuisines, familles, ingredientKey } from './catalogue.mjs';
import { DAYS,SLOTS,EQUIPMENT,defaultSms,dinnerMessage,formatDateToLocalIso,getMondayIsoForToday,getWeekDates,planningDates,smsDates,formatWeekBoundary,shiftMonday,weekDays,recipe,shopping,sampleState,emptyState,populateIngredients,readBackup,backup,diff,fold,amount } from './modele.mjs';
import {guide} from './guide.mjs';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opt = (value,label,selected=false)=>`<option value="${esc(value)}"${selected?' selected':''}>${esc(label)}</option>`;
const portions = n=>[1,2,4].map(v=>opt(v,`${v} pers.`,n===v)).join('');
const empty = message=>`<p class="muted">${esc(message)}</p>`;
const uiButton = (action,label,id='',classes='')=>`<button type="button" data-act="${action}" data-id="${esc(id)}" class="${classes}">${esc(label)}</button>`;
const localKey = 'tableau-repas.essai.v1';
let today = formatDateToLocalIso(new Date()), weekOffset = 0;
let monday = getMondayIsoForToday(), page='planning', mode='local', remote=null, busy=false;
let state=sampleState(monday), drag=null;
const dialog=$('dialog');
function message(msg,error=false) { $('notice').textContent=msg; $('notice').classList.toggle('error',error); }
function showError(error) {
  const msg=error.message || String(error);
  if(dialog.open) $('dialogError').textContent=msg;
  else message(msg,true);
}
function openDialog(title,html) {
  $('dialogTitle').textContent=title; $('dialogBody').innerHTML=html; $('dialogError').textContent='';
  if(!dialog.open) dialog.showModal();
}
function localState() {
  const saved=localStorage.getItem(localKey);
  const local = saved ? readBackup(JSON.parse(saved)) : sampleState(getMondayIsoForToday());
  if (!local.settings[catalogueMarker]) {
    populateIngredients(local);
    localStorage.setItem(localKey,JSON.stringify(backup(local)));
  }
  return local;
}
function startLocal() {
  mode='local'; state=localState(); render();
}
async function change(edit) {
  if(busy) throw Error('Un enregistrement est déjà en cours.');
  if(mode==='loading') throw Error('Chargement des données Firebase en cours.');
  const next=structuredClone(state);
  edit(next);
  const changes=diff(state,next);
  if(!changes.length) return;
  busy=true;
  try {
    if(mode==='firebase') await remote.save(changes);
    else {
      const latest=localState();
      for(const c of changes){
        if(JSON.stringify(latest[c.kind][c.id]??null)!==JSON.stringify(c.old)) {
          state=latest; render(); throw Error('Données modifiées dans un autre onglet. Rouvre la fiche.');
        }
        if(c.value===null) delete latest[c.kind][c.id];
        else latest[c.kind][c.id]=c.value;
      }
      localStorage.setItem(localKey,JSON.stringify(backup(latest))); state=latest; render();
    }
  } finally {busy=false;}
}
function weekLabel(startDate=monday) {
  const dates=getWeekDates(startDate);
  return `Du ${formatWeekBoundary(dates[0])} au ${formatWeekBoundary(dates[6],true)}`;
}
const labels={planning:'Planning',recettes:'Recettes',ingredients:'Ingrédients',courses:'Liste de courses',guide:'Guide Air Fryer'};
function render() {
  $('title').textContent=labels[page];
  document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-current',b.dataset.page===page?'page':'false'));
  document.querySelectorAll('[data-view]').forEach(s=>s.hidden=!s.dataset.view.split(' ').includes(page));
  $('mode').textContent=({local:'Essai sur cet appareil',loading:'Connexion en cours…',firebase:'Essai Firebase synchronisé'})[mode];
  $('account').textContent=mode==='local'?'Connecter Firebase':'Quitter Firebase';
  document.querySelectorAll('.weekLabel').forEach(n=>n.textContent=weekLabel());
  if(page==='planning') drawBoard();
  if(dialog.open && $('smsRange')) refreshSms();
  if(page==='recettes'||page==='ingredients') drawRecipes();
  if(page==='courses') drawShopping();
  if(page==='guide') drawGuide();
}
const byName = new Intl.Collator('fr',{sensitivity:'base',numeric:true});
function sortedMeals(includeArchived=false) {
  const alpha=$('mealOrder').value==='alpha';
  return Object.entries(state.meals).filter(([,m])=>includeArchived||!m.archived)
    .sort(([,a],[,b])=>(alpha ? 0 : a.sortOrder-b.sortOrder) || byName.compare(a.name,b.name));
}
function visibleDates() { return planningDates(today,weekOffset); }
function periodLabel(dates) {
  if(dates.length===1) return `${dates[0].day} ${formatWeekBoundary(dates[0].date,true)}`;
  return `Du ${formatWeekBoundary(dates[0].date)} au ${formatWeekBoundary(dates.at(-1).date,true)}`;
}
function drawBoard(){
  const dates=visibleDates();
  $('planningRange').textContent=periodLabel(dates);
  $('board').innerHTML=`<div class="board-row board-head"><div>Jour</div>${Object.values(SLOTS).map(s=>`<div>${s}</div>`).join('')}</div>`+
    dates.map(({date,day,week})=>`<div class="board-row"><div class="day"${date===today?' aria-current="date"':''}><strong>${day}</strong><small>${formatWeekBoundary(date)}${date===today?" · Aujourd’hui":""}</small></div>`+
    Object.entries(SLOTS).map(([slot,label])=>`<div class="slot" data-date="${date}" data-week="${week}" data-day="${day}" data-slot="${slot}"><span class="slot-name">${label}</span>`+
      weekDays(state.weeks[week])[day][slot].filter(id=>state.meals[id]).map(id=>`<div draggable="true" class="planned" data-id="${esc(id)}">
        ${uiButton('detail',state.meals[id].name,id)}<button data-act="remove" data-id="${esc(id)}" aria-label="Retirer ${esc(state.meals[id].name)}">×</button></div>`).join('')+
      `<button class="add" data-act="pick" aria-label="Ajouter un repas, ${day} ${formatWeekBoundary(date)}, ${label}">+ Ajouter</button></div>`).join('')+'</div>').join('');
}
function drawRecipes(){
  const ingredientsOnly=page==='ingredients';
  $('filter').hidden=ingredientsOnly;
  $('cuisineFilter').hidden=!ingredientsOnly;
  $('familyFilter').hidden=!ingredientsOnly;
  const famille=ingredientsOnly ? $('familyFilter').value : '';
  const cuisine=ingredientsOnly ? $('cuisineFilter').value : '';
  const searchLabel=ingredientsOnly?'Rechercher un ingrédient':'Rechercher une recette';
  $('search').placeholder=searchLabel+'…';
  $('search').setAttribute('aria-label',searchLabel);
  const search=fold($('search').value), filter=ingredientsOnly?'':$('filter').value;
  const list=sortedMeals($('archived').checked).filter(([,m])=>(m.kind==='ingredient')===ingredientsOnly && (!filter||m.equipment.includes(filter))&&
    (!famille||catalogue.get(ingredientKey(m.name))?.famille===famille)&&
    (!cuisine||catalogue.get(ingredientKey(m.name))?.cuisines.includes(cuisine))&&
    fold([m.name,m.note,...m.ingredients.map(i=>i.name)].join(' ')).includes(search));
  $('recipes').innerHTML=list.map(([id,m])=>`<article class="card" draggable="true" data-id="${esc(id)}">
    ${uiButton('detail',m.name,id,'dish-title')}${m.archived?'<small>Archivée</small>':''}
    <div>${m.equipment.map(e=>`<span class="tag">${esc(e)}</span>`).join(' ')}</div>
    ${m.note?`<p class="note">${esc(m.note)}</p>`:''}<small>${ingredientsOnly ? (m.ingredients[0]?.qty != null ? esc([amount(m.ingredients[0].qty),m.ingredients[0].unit].filter(Boolean).join(' '))+' pour '+m.portions+' pers.' : 'Quantité libre') : m.portions+' personnes · '+m.ingredients.length+' ingrédient'+(m.ingredients.length>1?'s':'')}</small>
    <div class="actions">${uiButton('edit','Modifier',id)}${!m.archived?uiButton('plan','Planifier',id):''}${uiButton('delete','Supprimer',id,'danger')}</div></article>`).join('')||empty(ingredientsOnly?'Aucun ingrédient pour cette sélection.':'Aucune recette pour cette sélection.');
}
const ingredientText=(i,factor=1)=>i.qty===null?[i.name,i.unit].filter(Boolean).join(' · '):[amount(i.qty*factor),i.unit,'—',i.name].filter(Boolean).join(' ');
function currentShopping(){return shopping(state,monday,Number($('shoppingPortions').value));}
function shoppingHtml({items,missing}) {
  return (items.length?`<ul>${items.map(i=>`<li>${esc(ingredientText(i))}</li>`).join('')}</ul>`:empty('Aucun ingrédient renseigné pour les repas de cette semaine.'))+
    (missing.length?`<p>Ingrédients à compléter pour ${esc(missing.join(', '))}.</p>`:'');
}
function drawShopping(){ $('shopping').innerHTML=shoppingHtml(currentShopping()); }
function guideItems(){return guide.filter(row=>fold(row[0]).includes(fold($('guideSearch').value)));}
function drawGuide(){ $('guide').innerHTML=guideItems().map(([name,temp,time,note])=>`<article class="card"><h2 class="dish-title">${esc(name)}</h2>
  <span class="guide-value">${temp} °C · ${time} min</span><p>${esc(note)}</p></article>`).join('')||empty('Aucun aliment trouvé.'); }
function refreshSms() {
  const dates = smsDates(formatDateToLocalIso(new Date()), $('smsRange').value);
  $('smsPeriod').textContent = periodLabel(dates);
  const stored = state.settings.sms ?? defaultSms;
  const intro = $('smsIntro'), fin = $('smsFin');
  if (intro.value === intro.defaultValue && fin.value === fin.defaultValue) {
    intro.defaultValue = intro.value = stored.intro;
    fin.defaultValue = fin.value = stored.fin;
  }
  const draft = {intro:intro.value,fin:fin.value};
  $('smsSave').disabled = mode === 'loading' || (draft.intro === stored.intro && draft.fin === stored.fin);
  const text = mode === 'loading' ? '' : dinnerMessage(state,dates,draft);
  if ($('smsText').value !== text) {
    $('smsText').value = text;
    $('smsFeedback').textContent = '';
  }
  $('smsCopy').disabled = !text;
  $('smsOpen').hidden = !text;
  $('smsText').hidden = !text;
  $('smsEmpty').hidden = Boolean(text);
  $('smsEmpty').textContent = mode === 'loading' ? 'Chargement du planning…' : 'Aucun dîner prévu pour cette période.';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  $('smsOpen').href = 'sms:' + (ios ? '&' : '?') + 'body=' + encodeURIComponent(text);
  return text;
}
function openSms() {
  openDialog('Exporter les dîners par SMS',`<div class="fields sms-export">
    <strong id="smsPeriod"></strong>
    <label>Période <select id="smsRange"><option value="remaining">Reste de la semaine</option><option value="next">Semaine prochaine</option></select></label>
    <details><summary>Personnaliser le texte du SMS</summary>
      <div class="fields sms-model">
        <label>Avant les dîners<textarea id="smsIntro" rows="2"></textarea></label>
        <label>Après les dîners<textarea id="smsFin" rows="2"></textarea></label>
        <button type="button" id="smsSave">Enregistrer pour les prochains SMS</button>
      </div>
    </details>
    <textarea id="smsText" aria-label="Texte du SMS" rows="8" readonly></textarea>
    <p id="smsEmpty" role="status"></p>
    <div class="actions"><button type="button" id="smsCopy">Copier le texte</button><a id="smsOpen" class="primary">Ouvrir les SMS</a></div>
    <span id="smsFeedback" role="status"></span></div>`);
  const intro = $('smsIntro'), fin = $('smsFin');
  intro.oninput = fin.oninput = () => { $('smsFeedback').textContent=''; refreshSms(); };
  $('smsSave').onclick = guard(async () => {
    const draft = {intro:intro.value,fin:fin.value};
    await change(next=>{
      const stored = next.settings.sms ?? defaultSms;
      if (stored.intro !== intro.defaultValue || stored.fin !== fin.defaultValue)
        throw Error('Le modèle a changé sur un autre appareil. Rouvre l’export pour utiliser la dernière version.');
      next.settings.sms = draft;
    });
    if (!dialog.open || $('smsIntro') !== intro) return;
    intro.defaultValue = draft.intro;
    fin.defaultValue = draft.fin;
    refreshSms();
    $('smsFeedback').textContent='Texte enregistré pour les prochains SMS.';
  });
  $('smsRange').onchange = refreshSms;
  $('smsOpen').onclick = event => { if (!refreshSms()) event.preventDefault(); };
  $('smsCopy').onclick = async () => {
    const text = refreshSms();
    if (!text) return;
    const feedback = $('smsFeedback');
    try {
      await navigator.clipboard.writeText(text);
      feedback.textContent = 'Texte copié.';
    } catch {
      $('smsText').focus();
      $('smsText').select();
      feedback.textContent = 'Texte sélectionné. Utilise la commande Copier de ton appareil.';
    }
  };
  refreshSms();
}
function printSheet(title,html) {
  $('printArea').innerHTML=`<h1>${esc(title)}</h1>${html}`;
  if(dialog.open) dialog.close();
  window.print();
}
function download(name,data,type){
  const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');
  a.href=url; a.download=name; a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function detailBody(m,n){
  if(m.kind==='ingredient') return `<p>${esc(ingredientText(m.ingredients[0],n/m.portions))}</p>`;
  return `<div class="recipe-detail"><p>${esc(m.equipment.join(' · '))}</p>${m.note?`<p class="note">${esc(m.note)}</p>`:''}
    <h3>Ingrédients</h3>${m.ingredients.length?`<ul>${m.ingredients.map(i=>`<li>${esc(ingredientText(i,n/m.portions))}</li>`).join('')}</ul>`:empty('Aucun ingrédient renseigné.')}
    <h3>Préparation</h3>${m.steps.length?`<ol>${m.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:empty('Aucune étape renseignée.')}</div>`;
}
function detail(id,n=state.meals[id]?.portions){
  const m=state.meals[id]; if(!m) throw Error('Cette recette a été supprimée.');
  openDialog(m.name,`<label>Quantités pour <select id="scale">${portions(n)}</select></label>${detailBody(m,n)}
    <div class="actions">${uiButton('edit','Modifier',id)}<button id="printRecipe">Imprimer / PDF A4</button>
    ${uiButton('archive',m.archived?'Désarchiver':'Archiver',id)}${uiButton('delete','Supprimer',id,'danger')}</div>`);
  $('scale').onchange=()=>detail(id,Number($('scale').value));
  $('printRecipe').onclick=()=>printSheet(m.name,`<p>${n} personne${n>1?'s':''}</p>${detailBody(m,n)}`);
}
function ingredientRow(i={name:'',qty:null,unit:''}){
  return `<div class="ingredient"><input aria-label="Ingrédient" placeholder="Ingrédient" maxlength="160" value="${esc(i.name)}">
  <input type="number" step="any" min="0.000001" aria-label="Quantité" placeholder="Qté" value="${esc(i.qty??'')}">
  <input aria-label="Unité" placeholder="g, ml…" maxlength="60" value="${esc(i.unit)}">
  <button type="button" data-act="dropIngredient" aria-label="Retirer cet ingrédient">×</button></div>`;
}
function saveMeal(next,id,original,fields){
  if(id && JSON.stringify(next.meals[id])!==JSON.stringify(original)) throw Error('La fiche a changé. Rouvre-la.');
  const sortOrder=original?.sortOrder ?? Object.values(next.meals).reduce((max,m)=>Math.max(max,m.sortOrder),-1)+1;
  const key=id || crypto.randomUUID();
  next.meals[key]=recipe({...original,...fields,sortOrder});
  return key;
}
function editIngredient(id=null,target=null){
  const original=id ? state.meals[id] : null;
  const ingredient=original?.ingredients[0];
  openDialog(id?'Modifier l’ingrédient':'Nouvel ingrédient',`<form id="ingredientForm">
    <label>Nom de l’ingrédient<input name="name" placeholder="Ex. : Pommes de terre" required maxlength="160" value="${esc(original?.name)}"></label>
    <label>Quantité (facultative)<input type="number" name="qty" step="any" min="0.000001" value="${esc(ingredient?.qty)}"></label>
    <label>Unité (facultative)<input name="unit" maxlength="60" placeholder="g, pièces…" value="${esc(ingredient?.unit)}"></label>
    <label>Quantité pour<select name="portions">${portions(original?.portions ?? 2)}</select></label>
    <button class="primary">${target?'Enregistrer et ajouter au repas':'Enregistrer l’ingrédient'}</button></form>`);
  $('ingredientForm').onsubmit=guard(async event=>{
    event.preventDefault();
    const f=new FormData(event.currentTarget), name=f.get('name').trim();
    if(!name) throw Error('Renseigne le nom de l’ingrédient.');
    const qty=f.get('qty') ? Number(f.get('qty')) : null;
    await change(next=>{
      const key=saveMeal(next,id,original,{kind:'ingredient',name,portions:Number(f.get('portions')),
        ingredients:[{name,qty,unit:f.get('unit').trim()}]});
      if(target) changeSlot(next,target.week,target.day,target.slot,ids=>ids.push(key));
    });
    dialog.close();
    if(!id && !target){page='ingredients';$('search').value='';$('cuisineFilter').value='';$('familyFilter').value='';render();}
    message(target?'Ingrédient ajouté au repas.':'Ingrédient enregistré.');
  });
}
function editRecipe(id) {
  const original=id?state.meals[id]:null, m=original||recipe({name:''});
  openDialog(id?'Modifier la recette':'Nouvelle recette',`<form id="editForm">
  <label>Nom du repas<input name="name" maxlength="160" value="${esc(m.name)}" required></label>
  <label>Note<textarea name="note" rows="2" maxlength="5000">${esc(m.note)}</textarea></label>
  <label>Quantités de base<select name="portions">${portions(m.portions)}</select></label>
  <fieldset><legend>Appareils</legend>${EQUIPMENT.map(e=>`<label><input type="checkbox" name="equipment" value="${esc(e)}" ${m.equipment.includes(e)?'checked':''}> ${esc(e)}</label>`).join('')}</fieldset>
  <div class="fields"><strong>Ingrédients</strong><div class="fields" id="ingredients">${(m.ingredients.length?m.ingredients:[undefined]).map(ingredientRow).join('')}</div>
  <button type="button" id="addIngredient">+ Ajouter un ingrédient</button></div>
  <label>Étapes, une par ligne<textarea name="steps" rows="4">${esc(m.steps.join('\n'))}</textarea></label>
  <button class="primary">Enregistrer la recette</button></form>`);
  $('addIngredient').onclick=()=>{ $('ingredients').insertAdjacentHTML('beforeend',ingredientRow()); $('ingredients').lastElementChild.firstElementChild.focus(); };
  $('editForm').onsubmit=guard(async event=>{
    event.preventDefault(); const f=new FormData(event.currentTarget);
    const ingredients=[];
    for(const row of $('ingredients').children){
      const [name,q,unit]=Array.from(row.querySelectorAll('input'),i=>i.value.trim());
      if(!name && !q && !unit) continue;
      if(!name) throw Error('Renseigne le nom de chaque ingrédient.');
      ingredients.push({name,qty:q?Number(q):null,unit});
    }
    const name=f.get('name').trim(); if(!name) throw Error('Renseigne le nom du repas.');
    await change(next=>{
      saveMeal(next,id,original,{name,note:f.get('note').trim(),equipment:f.getAll('equipment'),
        portions:Number(f.get('portions')), ingredients, steps:f.get('steps').split('\n').map(s=>s.trim()).filter(Boolean)});
    });
    dialog.close();message('Recette enregistrée.');
  });
}
function changeSlot(next,key,day,slot,fn){
  const days=weekDays(next.weeks[key]); fn(days[day][slot]); next.weeks[key]=days;
}
async function assign(id,key,day,slot,from=null) {
  await change(next=>{
    if(!next.meals[id]) throw Error('Repas introuvable.');
    if(from) changeSlot(next,from.week,from.day,from.slot,ids=>{const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);});
    changeSlot(next,key,day,slot,ids=>{if(!ids.includes(id)) ids.push(id);});
  });
}
function pick({week,day,date,slot}){
  openDialog(`${day} ${formatWeekBoundary(date)} · ${SLOTS[slot]}`,`<div class="meal-picker"><input id="pickSearch" type="search" placeholder="Recette ou ingrédient…" aria-label="Rechercher une recette ou un ingrédient"><label>Trier par <select id="pickOrder"></select></label><button type="button" id="pickIngredient">+ Nouvel ingrédient</button><div class="meal-picker" id="pickList"></div></div>`);
  function update(){
    const rows=sortedMeals().filter(([,m])=>fold(m.name).includes(fold($('pickSearch').value)));
    $('pickList').innerHTML=rows.map(([id,m])=>`<button data-pick="${esc(id)}">${esc(m.name)}</button>`).join('')||empty('Aucun repas disponible.');
  }
  const order=$('pickOrder');
  order.innerHTML=$('mealOrder').innerHTML;
  order.value=$('mealOrder').value;
  order.onchange=()=>{setMealOrder(order.value);update();};
  $('pickIngredient').onclick=()=>editIngredient(null,{week,day,slot});
  $('pickSearch').oninput=update;update();
  $('pickList').onclick=guard(async e=>{const btn=e.target.closest('[data-pick]');if(!btn)return;await assign(btn.dataset.pick,week,day,slot);dialog.close();message('Repas planifié.');});
}
function plan(id){
  const dates=visibleDates();
  openDialog('Planifier le repas',`<form id="planForm"><strong>${esc(state.meals[id].name)}</strong><span>${esc(periodLabel(dates))}</span>
    <label>Jour<select name="date">${dates.map(({date,day})=>opt(date,day+' '+formatWeekBoundary(date),date===today)).join('')}</select></label>
    <label>Repas<select name="slot">${Object.entries(SLOTS).map(([k,v])=>opt(k,v,k==='dinner')).join('')}</select></label>
    <button class="primary">Ajouter au planning</button></form>`);
  $('planForm').onsubmit=guard(async e=>{e.preventDefault();const f=new FormData(e.currentTarget);
    const {week,day}=dates.find(row=>row.date===f.get('date'));
    await assign(id,week,day,f.get('slot'));dialog.close();message('Repas planifié.');});
}
function guard(fn){return async event=>{try{await fn(event);}catch(error){showError(error);}};}


const sessionKey='tableau-repas.firebase-actif';
async function configureFirebase() {
  const api=await import('./firebase-store.mjs');
  if(remote) return;
  remote=api.connect({
    data(s){
      state=s;mode='firebase';sessionStorage.setItem(sessionKey,'1');
      if(dialog.open&&$('loginForm'))dialog.close();
      render();
    },
    catalogError(error){message('Le catalogue d’ingrédients n’a pas pu être enregistré. '+error.message,true);},
    signedOut(){
      sessionStorage.removeItem(sessionKey);
      if(mode!=='local'){startLocal();message('Retour à l’essai sur cet appareil.');}
    },
    error(error){sessionStorage.removeItem(sessionKey);startLocal();showError(error);}
  });
}
async function firebaseDialog(){
  openDialog('Connexion au planning', `<p>Choisis le compte Google associé à ton planning.</p>
    <div id="loginForm" class="fields">
      <button id="googleLogin" type="button" class="primary" disabled>Continuer avec Google</button>
      <details><summary>Autre moyen de connexion</summary>
        <form id="passwordForm">
          <label>Adresse e-mail<input name="email" type="email" autocomplete="username" required></label>
          <label>Mot de passe<input name="password" type="password" autocomplete="current-password" required></label>
          <button type="submit" disabled>Se connecter par e-mail</button>
        </form>
      </details>
    </div>`);
  await configureFirebase();
  const panel = $('loginForm');
  if (!panel || !dialog.open) return;
  const buttons = panel.querySelectorAll('button');
  const disable = value => buttons.forEach(button => { button.disabled = value; });
  disable(false);
  async function signIn(action) {
    disable(true);
    $('dialogError').textContent = '';
    try {
      await action();
      if (mode !== 'firebase') { mode = 'loading'; render(); }
      if (dialog.open && $('loginForm') === panel) dialog.close();
    } catch (error) {
      if (mode === 'loading') startLocal();
      const messages = {
        'auth/unauthorized-domain': `Autorise le domaine ${location.hostname} dans Firebase Authentication, sous Paramètres puis Domaines autorisés.`,
        'auth/operation-not-allowed': 'Active la méthode de connexion choisie dans Firebase Authentication.',
        'auth/popup-closed-by-user': 'La fenêtre Google a été fermée. Tu peux réessayer.',
        'auth/popup-blocked': 'Autorise les fenêtres pop-up pour ce site, puis clique de nouveau sur « Continuer avec Google ».',
        'auth/account-exists-with-different-credential': 'Cette adresse utilise déjà un autre moyen de connexion dans Firebase.',
        'auth/invalid-credential': 'Adresse e-mail ou mot de passe incorrect.'
      };
      throw Error(messages[error.code] || error.message);
    } finally { disable(false); }
  }
  $('googleLogin').onclick = guard(() => signIn(() => remote.loginWithGoogle()));
  $('passwordForm').onsubmit = guard(event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    return signIn(() => remote.login(fields.get('email').trim(),fields.get('password')));
  });
}

document.addEventListener('click',guard(async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.page){if(page!==button.dataset.page) $('search').value='';page=button.dataset.page;message('');render();return;}
  if(button.hasAttribute('data-today')||button.dataset.shift){
    weekOffset=button.dataset.shift ? weekOffset+Number(button.dataset.shift) : 0;
    updateCalendar();render();return;
  }
  const {act,id}=button.dataset, slot=button.closest('.slot');
  switch(act){
    case 'detail': detail(id);return;
    case 'edit': if(state.meals[id]?.kind==='ingredient') editIngredient(id); else editRecipe(id);return;
    case 'plan': plan(id);return;
    case 'pick': pick(slot.dataset);return;
    case 'remove':
      await change(next=>changeSlot(next,slot.dataset.week,slot.dataset.day,slot.dataset.slot,ids=>{const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);}));
      message('Repas retiré du créneau.');return;
    case 'dropIngredient':button.closest('.ingredient').remove();return;
    case 'archive':
      await change(next=>{next.meals[id].archived=!next.meals[id].archived;});dialog.close();message('Archivage mis à jour.');return;
    case 'delete': {
      const meal=state.meals[id];
      if(!meal) throw Error('Cette recette a déjà été supprimée.');
      const fromDetail=dialog.open;
      const label=meal.kind==='ingredient'?'Supprimer l’ingrédient':'Supprimer la recette';
      openDialog(label+' ?',`<p>« ${esc(meal.name)} » disparaîtra du catalogue et de tous les repas où tu l’as ajouté.</p>
        <div class="actions"><button type="button" id="cancelDelete">Annuler</button>
        ${uiButton('confirmDelete',label,id,'danger')}</div>`);
      $('cancelDelete').onclick=()=>fromDetail && state.meals[id] ? detail(id) : dialog.close();
      $('cancelDelete').focus();return;
    }
    case 'confirmDelete':
      await change(next=>{
        delete next.meals[id];
        for(const days of Object.values(next.weeks)){
          for(const slots of Object.values(days)){
            for(const key of Object.keys(slots)) slots[key]=slots[key].filter(v=>v!==id);
          }
        }
      });
      dialog.close();message('Fiche supprimée.');return;
  }
  switch(button.id){
    case 'newIngredient':editIngredient();break;
    case 'newMeal':editRecipe();break;
    case 'close':dialog.close();break;
    case 'reset': {
      const dates=visibleDates();
      if(confirm(`Vider les déjeuners et dîners de cette période ? ${periodLabel(dates)}.`))
        await change(next=>{
          for(const {week,day} of dates) {
            if(!next.weeks[week]) continue;
            for(const slot of Object.keys(SLOTS)) next.weeks[week][day][slot]=[];
          }
        });
      break;
    }
    case 'account':
      if(mode==='local')await firebaseDialog();
      else {await remote.logout();startLocal();}
      break;
    case 'txt':{
      const {items,missing}=currentShopping();
      download(`courses-${monday}.txt`,[weekLabel(),`${$('shoppingPortions').value} personne(s) par repas`,'',
        ...items.map(i=>ingredientText(i)),...(missing.length?['','Ingrédients à compléter',...missing]:[])].join('\n'),'text/plain;charset=utf-8');break;
    }
    case 'printShop':printSheet('Liste de courses',`<p>${weekLabel()} · ${$('shoppingPortions').value} personne(s) par repas</p>${shoppingHtml(currentShopping())}`);break;
    case 'printGuide':printSheet('Guide Air Fryer',`<p>Moulinex Easy Fry Mega 7,5 L</p><ul>${guideItems().map(([n,t,m,k])=>`<li><strong>${esc(n)}</strong> · ${t} °C · ${m} min. ${esc(k)}</li>`).join('')}</ul>`);break;
    case 'smsWeek':openSms();break;
    case 'printWeek':{
      const dates=visibleDates();
      printSheet('Planning des repas',`<p>${periodLabel(dates)}</p>`+dates.map(({date,day,week})=>`<div class="print-group"><h2>${day} ${formatWeekBoundary(date)}</h2>`+
        Object.entries(SLOTS).map(([k,label])=>`<div><strong>${label}</strong> · ${weekDays(state.weeks[week])[day][k].map(id=>state.meals[id]?.name).filter(Boolean).map(esc).join(', ')||'—'}</div>`).join('')+'</div>').join(''));break;
    }
    case 'export':download(`repas-${monday}.json`,JSON.stringify(backup(state),null,2),'application/json');break;
    case 'importBtn':$('importFile').click();break;
  }
}));
$('importFile').onchange=guard(async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const incoming=readBackup(JSON.parse(await file.text()));
  const count=Object.keys(incoming.meals).length, weeks=Object.keys(incoming.weeks).length;
  if(!confirm(`Importer ${count} recette(s) et ${weeks} semaine(s) dans cet essai ? Les fiches et semaines de même identifiant seront remplacées.`))return;
  await change(next=>{Object.assign(next.meals,incoming.meals);Object.assign(next.weeks,incoming.weeks);Object.assign(next.settings,incoming.settings);});
  message('Sauvegarde importée.');
});
document.addEventListener('dragstart',e=>{
  const item=e.target.closest('[draggable=true]');if(!item)return;
  const slot=item.closest('.slot');drag={id:item.dataset.id,from:slot?{...slot.dataset}:null};
  e.dataTransfer.setData('text/plain',item.dataset.id);e.dataTransfer.effectAllowed='move';
});
document.addEventListener('dragover',e=>{
  if(!drag)return;
  const tab=e.target.closest('[data-page]');
  if(tab && ['planning','recettes','ingredients'].includes(tab.dataset.page) && tab.dataset.page!==page){page=tab.dataset.page;render();}
  const target=e.target.closest('.slot,#recipes .card,#recipes');
  if(target){e.preventDefault();target.classList.add('over');}
});
document.addEventListener('dragleave',e=>e.target.closest('.over')?.classList.remove('over'));
document.addEventListener('dragend',()=>{drag=null;document.querySelectorAll('.over').forEach(n=>n.classList.remove('over'));});
document.addEventListener('drop',guard(async e=>{
  if(!drag)return;e.preventDefault();
  const {id,from}=drag;drag=null;
  document.querySelectorAll('.over').forEach(n=>n.classList.remove('over'));
  const target=e.target.closest('.slot');
  if(target){await assign(id,target.dataset.week,target.dataset.day,target.dataset.slot,from);return;}
  if(!e.target.closest('#recipes'))return;
  if(from){await change(next=>changeSlot(next,from.week,from.day,from.slot,ids=>{const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);}));return;}
  if($('mealOrder').value==='alpha'){message('Choisis « Ordre personnalisé » pour déplacer les fiches.');return;}
  const before=e.target.closest('.card')?.dataset.id;if(!before||id===before)return;
  await change(next=>{
    const ids=sortedMeals(true).map(([k])=>k).filter(k=>k!==id);
    ids.splice(ids.indexOf(before),0,id);ids.forEach((k,i)=>{next.meals[k].sortOrder=i;});
  });
}));
const orderKey='tableau-repas.tri';
function setMealOrder(value){
  $('mealOrder').value=value;
  localStorage.setItem(orderKey,value);
  if(page==='recettes'||page==='ingredients') drawRecipes();
}
$('mealOrder').value=localStorage.getItem(orderKey)==='alpha'?'alpha':'manual';
$('mealOrder').onchange=e=>setMealOrder(e.target.value);
$('search').oninput=drawRecipes;$('filter').onchange=drawRecipes;$('archived').onchange=drawRecipes;
$('guideSearch').oninput=drawGuide;$('shoppingPortions').onchange=drawShopping;
$('cuisineFilter').innerHTML=opt('','Toutes les cuisines')+cuisines.map(c=>opt(c,c)).join('');
$('cuisineFilter').onchange=drawRecipes;
$('familyFilter').innerHTML=opt('','Toutes les familles')+familles.map(f=>opt(f,f)).join('');
$('familyFilter').onchange=drawRecipes;
$('filter').innerHTML=opt('','Tous les appareils')+EQUIPMENT.map(e=>opt(e,e)).join('');
$('shoppingPortions').innerHTML=portions(2);
function updateCalendar() {
  const now=new Date();
  today=formatDateToLocalIso(now);
  monday=shiftMonday(today,weekOffset);
  $('dateLabel').textContent=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);
}
function refreshDate() {
  if(today!==formatDateToLocalIso(new Date())) { updateCalendar();render(); }
}
function scheduleMidnight() {
  const midnight=new Date();
  midnight.setHours(24,0,0,0);
  setTimeout(()=>{refreshDate();scheduleMidnight();},midnight.getTime()-Date.now()+100);
}
updateCalendar();
scheduleMidnight();
window.addEventListener('focus',refreshDate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden) refreshDate();});
window.addEventListener('storage',guard(e=>{if(e.key===localKey && mode==='local'){state=localState();render();}}));
try{startLocal();}catch(error){render();showError(error);}


if(sessionStorage.getItem(sessionKey)){
  mode='loading';render();
  configureFirebase().catch(error=>{startLocal();showError(error);});
}
