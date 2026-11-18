import { DAYS,SLOTS,EQUIPMENT,dinnerMessage,formatDateToLocalIso,getMondayIsoForToday,getWeekDates,formatWeekBoundary,shiftMonday,weekDays,recipe,shopping,sampleState,emptyState,readBackup,backup,diff,fold,amount } from './modele.mjs';
import {guide} from './guide.mjs';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opt = (value,label,selected=false)=>`<option value="${esc(value)}"${selected?' selected':''}>${esc(label)}</option>`;
const portions = n=>[1,2,4].map(v=>opt(v,`${v} pers.`,n===v)).join('');
const empty = message=>`<p class="muted">${esc(message)}</p>`;
const uiButton = (action,label,id='',classes='')=>`<button type="button" data-act="${action}" data-id="${esc(id)}" class="${classes}">${esc(label)}</button>`;
const localKey = 'tableau-repas.essai.v1';
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
  return saved ? readBackup(JSON.parse(saved)) : sampleState(getMondayIsoForToday());
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
function weekLabel() {
  const dates=getWeekDates(monday);
  return `Du ${formatWeekBoundary(dates[0])} au ${formatWeekBoundary(dates[6],true)}`;
}
const labels={planning:'Planning',recettes:'Recettes',courses:'Liste de courses',guide:'Guide Air Fryer'};
function render() {
  $('title').textContent=labels[page];
  document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-current',b.dataset.page===page?'page':'false'));
  document.querySelectorAll('[data-view]').forEach(s=>s.hidden=s.dataset.view!==page);
  $('mode').textContent=({local:'Essai sur cet appareil',loading:'Connexion en cours…',firebase:'Essai Firebase synchronisé'})[mode];
  $('account').textContent=mode==='local'?'Connecter Firebase':'Quitter Firebase';
  document.querySelectorAll('.weekLabel').forEach(n=>n.textContent=weekLabel());
  if(page==='planning') drawBoard();
  if(dialog.open && $('smsRange')) refreshSms();
  if(page==='recettes') drawRecipes();
  if(page==='courses') drawShopping();
  if(page==='guide') drawGuide();
}
function sortedMeals(includeArchived=false) {
  return Object.entries(state.meals).filter(([,m])=>includeArchived||!m.archived)
    .sort((a,b)=>a[1].sortOrder-b[1].sortOrder||a[1].name.localeCompare(b[1].name,'fr'));
}
function drawBoard(){
  const days=weekDays(state.weeks[monday]), dates=getWeekDates(monday);
  $('board').innerHTML=`<div class="board-row board-head"><div>Jour</div>${Object.values(SLOTS).map(s=>`<div>${s}</div>`).join('')}</div>`+
    DAYS.map((day,i)=>`<div class="board-row"><div class="day"><strong>${day}</strong><small>${formatWeekBoundary(dates[i])}</small></div>`+
    Object.entries(SLOTS).map(([slot,label])=>`<div class="slot" data-day="${day}" data-slot="${slot}"><span class="slot-name">${label}</span>`+
      days[day][slot].filter(id=>state.meals[id]).map(id=>`<div draggable="true" class="planned" data-id="${esc(id)}">
        ${uiButton('detail',state.meals[id].name,id)}<button data-act="remove" data-id="${esc(id)}" aria-label="Retirer ${esc(state.meals[id].name)}">×</button></div>`).join('')+
      `<button class="add" data-act="pick" aria-label="Ajouter un repas, ${day}, ${label}">+ Ajouter</button></div>`).join('')+'</div>').join('');
}
function drawRecipes(){
  const search=fold($('search').value), filter=$('filter').value;
  const list=sortedMeals($('archived').checked).filter(([,m])=>(!filter||m.equipment.includes(filter))&&
    fold([m.name,m.note,...m.ingredients.map(i=>i.name)].join(' ')).includes(search));
  $('recipes').innerHTML=list.map(([id,m])=>`<article class="card" draggable="true" data-id="${esc(id)}">
    ${uiButton('detail',m.name,id,'dish-title')}${m.archived?'<small>Archivée</small>':''}
    <div>${m.equipment.map(e=>`<span class="tag">${esc(e)}</span>`).join(' ')}</div>
    ${m.note?`<p class="note">${esc(m.note)}</p>`:''}<small>${m.portions} personnes · ${m.ingredients.length} ingrédient${m.ingredients.length>1?'s':''}</small>
    <div class="actions">${uiButton('edit','Modifier',id)}${!m.archived?uiButton('plan','Planifier',id):''}</div></article>`).join('')||empty('Aucune recette pour cette sélection.');
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
  const from = $('smsRange').value === 'remaining' ? formatDateToLocalIso(new Date()) : '';
  const text = mode === 'loading' ? '' : dinnerMessage(state,monday,from);
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
    <strong>${esc(weekLabel())}</strong>
    <label>Période <select id="smsRange"><option value="week">Toute la semaine</option><option value="remaining">À partir d’aujourd’hui</option></select></label>
    <textarea id="smsText" aria-label="Texte du SMS" rows="8" readonly></textarea>
    <p id="smsEmpty" role="status"></p>
    <div class="actions"><button type="button" id="smsCopy">Copier le texte</button><a id="smsOpen" class="primary">Ouvrir les SMS</a></div>
    <span id="smsFeedback" role="status"></span></div>`);
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
      if(id && JSON.stringify(next.meals[id])!==JSON.stringify(original)) throw Error('La recette a changé. Rouvre sa fiche.');
      const order=Object.values(next.meals).reduce((max,r)=>Math.max(max,r.sortOrder),-1);
      next.meals[id||crypto.randomUUID()]=recipe({...m,name,note:f.get('note').trim(),equipment:f.getAll('equipment'),
        portions:Number(f.get('portions')), ingredients, steps:f.get('steps').split('\n').map(s=>s.trim()).filter(Boolean),
        sortOrder:id?m.sortOrder:order+1});
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
    if(from) changeSlot(next,key,from.day,from.slot,ids=>{const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);});
    changeSlot(next,key,day,slot,ids=>{if(!ids.includes(id)) ids.push(id);});
  });
}
function pick(day,slot){
  const week=monday;
  openDialog(`${day} · ${SLOTS[slot]}`,`<div class="meal-picker"><input id="pickSearch" type="search" placeholder="Rechercher un repas…" aria-label="Rechercher un repas"><div class="meal-picker" id="pickList"></div></div>`);
  function update(){
    const rows=sortedMeals().filter(([,m])=>fold(m.name).includes(fold($('pickSearch').value)));
    $('pickList').innerHTML=rows.map(([id,m])=>`<button data-pick="${esc(id)}">${esc(m.name)}</button>`).join('')||empty('Aucun repas disponible.');
  }
  $('pickSearch').oninput=update;update();
  $('pickList').onclick=guard(async e=>{const btn=e.target.closest('[data-pick]');if(!btn)return;await assign(btn.dataset.pick,week,day,slot);dialog.close();message('Repas planifié.');});
}
function plan(id){
  const week=monday;
  openDialog('Planifier le repas',`<form id="planForm"><strong>${esc(state.meals[id].name)}</strong><span>${esc(weekLabel())}</span>
    <label>Jour<select name="day">${DAYS.map(d=>opt(d,d)).join('')}</select></label>
    <label>Repas<select name="slot">${Object.entries(SLOTS).map(([k,v])=>opt(k,v,k==='dinner')).join('')}</select></label>
    <button class="primary">Ajouter au planning</button></form>`);
  $('planForm').onsubmit=guard(async e=>{e.preventDefault();const f=new FormData(e.currentTarget);
    await assign(id,week,f.get('day'),f.get('slot'));dialog.close();message('Repas planifié.');});
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
  if(button.dataset.page){page=button.dataset.page;message('');render();return;}
  if(button.hasAttribute('data-today')||button.dataset.shift){monday=button.dataset.shift?shiftMonday(monday,Number(button.dataset.shift)):getMondayIsoForToday();render();return;}
  const {act,id}=button.dataset, slot=button.closest('.slot');
  switch(act){
    case 'detail': detail(id);return;
    case 'edit': editRecipe(id);return;
    case 'plan': plan(id);return;
    case 'pick': pick(slot.dataset.day,slot.dataset.slot);return;
    case 'remove':
      await change(next=>changeSlot(next,monday,slot.dataset.day,slot.dataset.slot,ids=>{const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);}));
      message('Repas retiré du créneau.');return;
    case 'dropIngredient':button.closest('.ingredient').remove();return;
    case 'archive':
      await change(next=>{next.meals[id].archived=!next.meals[id].archived;});dialog.close();message('Archivage mis à jour.');return;
    case 'delete':
      if(!confirm(`Supprimer « ${state.meals[id].name} » et ses occurrences dans le planning d’essai ?`))return;
      await change(next=>{delete next.meals[id];for(const days of Object.values(next.weeks))
        for(const slots of Object.values(days))for(const key of Object.keys(slots))slots[key]=slots[key].filter(v=>v!==id);});
      dialog.close();message('Recette supprimée de cet essai.');return;
  }
  switch(button.id){
    case 'newMeal':editRecipe();break;
    case 'close':dialog.close();break;
    case 'reset':
      if(confirm(`Vider le planning d’essai pour la semaine du ${formatWeekBoundary(monday,true)} ?`))
        await change(next=>{
          const days=weekDays(next.weeks[monday]);
          for(const day of DAYS) for(const slot of Object.keys(SLOTS)) days[day][slot]=[];
          next.weeks[monday]=days;
        });
      break;
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
      const days=weekDays(state.weeks[monday]);
      printSheet('Planning des repas',`<p>${weekLabel()}</p>`+DAYS.map(day=>`<div class="print-group"><h2>${day}</h2>`+
        Object.entries(SLOTS).map(([k,label])=>`<div><strong>${label}</strong> · ${days[day][k].map(id=>state.meals[id]?.name).filter(Boolean).map(esc).join(', ')||'—'}</div>`).join('')+'</div>').join(''));break;
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
  await change(next=>{Object.assign(next.meals,incoming.meals);Object.assign(next.weeks,incoming.weeks);});
  message('Sauvegarde importée.');
});
document.addEventListener('dragstart',e=>{
  const item=e.target.closest('[draggable=true]');if(!item)return;
  const slot=item.closest('.slot');drag={id:item.dataset.id,week:monday,from:slot?{...slot.dataset}:null};
  e.dataTransfer.setData('text/plain',item.dataset.id);e.dataTransfer.effectAllowed='move';
});
document.addEventListener('dragover',e=>{
  if(!drag)return;
  const tab=e.target.closest('[data-page]');
  if(tab && ['planning','recettes'].includes(tab.dataset.page) && tab.dataset.page!==page){page=tab.dataset.page;render();}
  const target=e.target.closest('.slot,#recipes .card,#recipes');
  if(target){e.preventDefault();target.classList.add('over');}
});
document.addEventListener('dragleave',e=>e.target.closest('.over')?.classList.remove('over'));
document.addEventListener('dragend',()=>{drag=null;document.querySelectorAll('.over').forEach(n=>n.classList.remove('over'));});
document.addEventListener('drop',guard(async e=>{
  if(!drag)return;e.preventDefault();
  const {id,from,week}=drag;drag=null;
  document.querySelectorAll('.over').forEach(n=>n.classList.remove('over'));
  const target=e.target.closest('.slot');
  if(target){await assign(id,week,target.dataset.day,target.dataset.slot,from);return;}
  if(!e.target.closest('#recipes'))return;
  if(from){await change(next=>changeSlot(next,week,from.day,from.slot,ids=>{const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);}));return;}
  const before=e.target.closest('.card')?.dataset.id;if(!before||id===before)return;
  await change(next=>{
    const ids=sortedMeals(true).map(([k])=>k).filter(k=>k!==id);
    ids.splice(ids.indexOf(before),0,id);ids.forEach((k,i)=>{next.meals[k].sortOrder=i;});
  });
}));
$('search').oninput=drawRecipes;$('filter').onchange=drawRecipes;$('archived').onchange=drawRecipes;
$('guideSearch').oninput=drawGuide;$('shoppingPortions').onchange=drawShopping;
$('filter').innerHTML=opt('','Tous les appareils')+EQUIPMENT.map(e=>opt(e,e)).join('');
$('shoppingPortions').innerHTML=portions(2);
$('dateLabel').textContent=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
window.addEventListener('storage',guard(e=>{if(e.key===localKey && mode==='local'){state=localState();render();}}));
try{startLocal();}catch(error){render();showError(error);}


if(sessionStorage.getItem(sessionKey)){
  mode='loading';render();
  configureFirebase().catch(error=>{startLocal();showError(error);});
}
