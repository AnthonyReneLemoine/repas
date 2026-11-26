import { saucesItaliennes } from './sauces-italiennes.mjs';
import { catalogue, catalogueMarker, catalogueMarkers, ingredientKey } from './catalogue.mjs';

export function getMondayIsoForToday() {
  const now = new Date();
  const offset = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - offset);
  return formatDateToLocalIso(now);
}

export function sanitizeMondayDate(value, fallback = getMondayIsoForToday()) {
  if (typeof value !== 'string') return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return value;
}

export function normalizeMondayDate(value, fallback = getMondayIsoForToday()) {
  const safeValue = sanitizeMondayDate(value, fallback);
  const parsed = new Date(`${safeValue}T12:00:00`);
  const offset = (parsed.getDay() + 6) % 7;
  parsed.setDate(parsed.getDate() - offset);
  return formatDateToLocalIso(parsed);
}

export function shiftMonday(mondayIsoDate, weekOffset) {
  const dateObj = new Date(`${normalizeMondayDate(mondayIsoDate)}T12:00:00`);
  dateObj.setDate(dateObj.getDate() + weekOffset * 7);
  return formatDateToLocalIso(dateObj);
}

export function getWeekDates(startDate) {
  const base = new Date(`${sanitizeMondayDate(startDate)}T12:00:00`);
  return DAYS.map((_, index) => {
    const next = new Date(base);
    next.setDate(base.getDate() + index);
    return formatDateToLocalIso(next);
  });
}

function calendarWeek(monday) {
  return getWeekDates(monday).map((date, index) => ({date, day:DAYS[index], week:monday}));
}

export function smsDates(reference, period = 'remaining') {
  if (period === 'next') return calendarWeek(shiftMonday(reference, 1));
  return calendarWeek(normalizeMondayDate(reference)).filter(row => row.date >= reference);
}

export function planningDates(reference, weekOffset = 0) {
  if (weekOffset) return calendarWeek(shiftMonday(reference, weekOffset));
  return [...smsDates(reference), ...smsDates(reference, 'next')];
}

export function formatDateFr(isoDate) {
  const dateObj = new Date(`${sanitizeMondayDate(isoDate)}T12:00:00`);
  return dateObj.toLocaleDateString('fr-FR');
}

export function formatWeekBoundary(isoDate, includeYear = false) {
  const dateObj = new Date(`${isoDate}T12:00:00`);
  return dateObj.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

export function formatDateToLocalIso(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const SLOTS = { lunch: 'Déjeuner', dinner: 'Dîner' };
// Les sauvegardes v1 et les semaines Firebase conservent les anciens petits-déjeuners.
const storedSlots = ['breakfast', ...Object.keys(SLOTS)];
export const EQUIPMENT = ['Thermomix TM5', 'Air Fryer', 'Four', 'Faitout'];
export const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const amount = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n);
export const emptyState = () => ({ meals: {}, weeks: {}, settings: {} });

export function weekDays(source = {}) {
  return Object.fromEntries(DAYS.map(day => {
    const slots = Array.isArray(source[day]) ? { dinner: source[day] } : source[day];
    return [day, Object.fromEntries(storedSlots.map(slot => {
      const ids = slots?.[slot];
      return [slot, Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === 'string'))] : []];
    }))];
  }));
}

export const defaultSms = Object.freeze({
  intro:'Le chef Tony, Minou et Pelucho les commis, vous proposent à diner :',
  fin:'Bon appetit !'
});
export const validSms = value => typeof value?.intro === 'string' && typeof value?.fin === 'string';

export function dinnerMessage(state, dates, model = state.settings?.sms ?? defaultSms) {
  const lines = [];
  for (const {date, day, week} of dates) {
    const days = weekDays(state.weeks[week]);
    const names = days[day].dinner.map(id => state.meals[id]?.name).filter(Boolean);
    if (names.length) lines.push(day + ' ' + date.slice(8) + '/' + date.slice(5,7) + ' : ' + names.join(' + '));
  }
  if (!lines.length) return '';
  return [model.intro.trim(), lines.join('\n'), model.fin.trim()].filter(Boolean).join('\n\n');
}

export function recipe(raw) {
  return { ...(raw.kind === 'ingredient' ? {kind:'ingredient'} : {}), name: raw.name, note: raw.note || '', portions: raw.portions || 2,
    equipment: raw.equipment || [], ingredients: raw.ingredients || [], steps: raw.steps || [],
    archived: Boolean(raw.archived), sortOrder: Number.isFinite(raw.sortOrder) ? raw.sortOrder : 999999 };
}

// Le marqueur évite de recréer les fiches que l’utilisateur a supprimées ou renommées.
export function populateIngredients(state) {
  const added=[];
  if (state.settings[catalogueMarker] === true) return added;
  const existing = new Set(Object.values(state.meals)
    .filter(meal => meal.kind === 'ingredient').map(meal => ingredientKey(meal.name)));
  for (const [key,{name,version=1}] of catalogue) {
    if (state.settings[catalogueMarkers[version-1]]) continue;
    const id = 'ingredient-classique-' + key;
    if (!existing.has(key) && !state.meals[id]) {
      state.meals[id] = recipe({kind:'ingredient',name,ingredients:[{name,qty:null,unit:''}]});
      added.push({id,version});
    }
  }
  if (!state.settings.catalogueV5) {
    const existingRecipes=new Set(Object.values(state.meals).filter(m=>m.kind!=='ingredient').map(m=>ingredientKey(m.name)));
    for (const sauce of saucesItaliennes) {
      const key=ingredientKey(sauce.name), id='recette-italienne-'+key;
      if (!existingRecipes.has(key) && !state.meals[id]) {
        state.meals[id]=recipe(structuredClone(sauce));
        added.push({id,version:5});
      }
    }
  }
  for (const marker of catalogueMarkers) state.settings[marker] = true;
  return added;
}

export function shopping(state, monday, portions) {
  const totals = new Map(), missing = new Set();
  const days = weekDays(state.weeks[monday]);
  for (const slots of Object.values(days)) for (const slot of Object.keys(SLOTS)) for (const id of slots[slot]) {
    const meal = state.meals[id];
    if (!meal) continue;
    if (!meal.ingredients.length) missing.add(meal.name);
    for (const { name, unit, qty } of meal.ingredients) {
      const key = JSON.stringify([fold(name), fold(unit), qty === null]);
      const item = totals.get(key) || { name, unit, qty: qty === null ? null : 0 };
      if (qty !== null) item.qty += qty * portions / meal.portions;
      totals.set(key, item);
    }
  }
  return { items: [...totals.values()].sort((a,b) => a.name.localeCompare(b.name, 'fr')),
    missing: [...missing].sort() };
}

export function sampleState(monday) {
  const meals = {
    nouilles: recipe({name:'Nouilles au brocoli et aux crevettes', equipment:['Faitout'], ingredients:[
      { name:'Nouilles', qty:160, unit:'g' }, { name:'Brocoli', qty:250, unit:'g' }, { name:'Crevettes cuites', qty:160, unit:'g' }
    ], steps:['Cuire les nouilles et le brocoli.','Égoutter, puis faire sauter avec les crevettes.']}),
    tartines: recipe({name:'Tartines de chèvre chaud', equipment:['Air Fryer'], ingredients:[
      { name:'Pain', qty:4, unit:'tranches' }, { name:'Fromage de chèvre', qty:80, unit:'g' }
    ], steps:['Garnir le pain de fromage.','Passer au Air Fryer à 180 °C pendant 4 minutes.']})
  };
  const days = weekDays();
  days.Lundi.dinner.push('nouilles');
  days.Mercredi.lunch.push('tartines');
  return { meals, weeks:{[monday]:days}, settings:{} };
}

const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const textField = (v, max) => typeof v === 'string' && v.length <= max;
const safeId = id => typeof id === 'string' && /^[\w-]{1,180}$/.test(id) && !(id in Object.prototype);

export function readBackup(raw) {
  const fail = () => { throw Error('Sauvegarde incompatible ou données invalides.'); };
  if (raw?.format !== 'tableau-repas' || raw.version !== 1 || !plain(raw.meals) || !plain(raw.weeks)) fail();
  const state = emptyState();
  for (const marker of catalogueMarkers) {
    if (raw.settings?.[marker] === true) state.settings[marker] = true;
  }
  if (raw.settings?.sms !== undefined) {
    if (!validSms(raw.settings.sms)) fail();
    state.settings.sms = {intro:raw.settings.sms.intro,fin:raw.settings.sms.fin};
  }
  for (const [id,m] of Object.entries(raw.meals)) {
    if (!safeId(id) || !plain(m) || !textField(m.name,160) || !m.name.trim() || !textField(m.note,5000) ||
      ![1,2,4].includes(m.portions) || !Array.isArray(m.equipment) || !m.equipment.every(x=>EQUIPMENT.includes(x)) ||
      !Array.isArray(m.steps) || !m.steps.every(x=>textField(x,5000)) || !Array.isArray(m.ingredients) ||
      !m.ingredients.every(i => plain(i) && textField(i.name,160) && i.name.trim() && textField(i.unit,60) &&
        (i.qty === null || Number.isFinite(i.qty) && i.qty > 0)) || typeof m.archived !== 'boolean' || !Number.isFinite(m.sortOrder)) fail();
    if (m.kind === 'ingredient' && (m.ingredients.length !== 1 || m.ingredients[0].name !== m.name)) fail();
    state.meals[id] = recipe(m);
  }
  for (const [monday,days] of Object.entries(raw.weeks)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(monday) || normalizeMondayDate(monday) !== monday || !plain(days)) fail();
    for (const day of DAYS) for (const slot of storedSlots) {
      const ids = days[day]?.[slot];
      if (!Array.isArray(ids) || !ids.every(safeId)) fail();
    }
    state.weeks[monday] = weekDays(days);
  }
  return state;
}

export function backup(state) { return {format:'tableau-repas',version:1,...state}; }
export function diff(before, after) {
  const changes = [];
  for (const kind of ['meals','weeks','settings']) {
    for (const id of new Set([...Object.keys(before[kind] || {}), ...Object.keys(after[kind] || {})])) {
      const old = before[kind]?.[id] ?? null, value = after[kind]?.[id] ?? null;
      if (JSON.stringify(old) !== JSON.stringify(value)) changes.push({kind,id,old,value});
    }
  }
  return changes;
}
