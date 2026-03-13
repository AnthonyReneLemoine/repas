import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const WEEK_KEYS = ['week1', 'week2'];
const WEEK_DOC_IDS = {
  week1: 'currentWeek1',
  week2: 'currentWeek2',
};
const CONFIG_KEY = 'firebaseConfig.dashboardRepas';

const INITIAL_MEAL_NAMES = [
  'fondue de poireau',
  'tarte aux poireaux',
  'Raclette',
  'moule au curry',
  'salade',
  'risotto de quinoa et courgettes',
  'risotto + blanc de poulet',
  'Soupe de tomate',
  'soupe de légumes',
  'Pizza',
  'panini',
  'quiche marie',
  'pesto',
  'Œufs au plat',
  'oeufs pochés + frites',
  'Omelette',
  'Couscous',
  'ratatouille',
  'tomates provencales + haricot + surimi',
  'lasagnes de courgettes sauce tomate',
  'gratin dauphinois',
  'gratin de choux fleur',
  'Purée de pommes de terre',
  'purée de patates douces',
  'Saumon au micro onde',
  'St-Jacques',
  'courgettes sautées au coco',
  'bowl hawaien',
  'wok de nouilles aux crevettes',
  'Croque-monsieur',
  'crêpes',
  'Galette de blé noir',
  'Sushis',
  'riz tika masala',
  'Indien',
  'valentino',
  'mache tomate chevre oeuf huile',
  'Nouilles au beurre',
  'burger',
  'Ravioli',
  'Riz à la sénégalaise',
  'soupe de poisson',
  'riz thon tabasco',
  'escargots',
  'wrap',
  'boulette de courgette',
  'gauffres',
];

const appLayoutEl = document.getElementById('appLayout');
const authCardEl = document.getElementById('authCard');
const sessionCardEl = document.getElementById('sessionCard');
const authForm = document.getElementById('authForm');
const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');
const registerBtn = document.getElementById('registerBtn');
const authMessageEl = document.getElementById('authMessage');
const logoutBtn = document.getElementById('logoutBtn');
const userEmailEl = document.getElementById('userEmail');

const daysBoardEl = document.getElementById('daysBoard');
const weekTabsEl = document.getElementById('weekTabs');
const resetWeekBtn = document.getElementById('resetWeekBtn');
const mealsListEl = document.getElementById('mealsList');
const mealForm = document.getElementById('mealForm');
const mealNameInput = document.getElementById('mealName');
const mealNoteInput = document.getElementById('mealNote');
const mealMessageEl = document.getElementById('mealMessage');
const showArchivedInput = document.getElementById('showArchived');
const mealSearchInput = document.getElementById('mealSearch');
const configDialog = document.getElementById('configDialog');
const configForm = document.getElementById('configForm');
const configInput = document.getElementById('firebaseConfigInput');

let db;
let auth;
let meals = [];
let weekPlan = makeEmptyWeek();
let mondayDateISO = getMondayIsoForToday();
let activeWeekKey = 'week1';
let unsubscribeMeals;
let unsubscribeWeek;
const dragState = {
  mealId: '',
  fromDay: '',
  fromList: false,
};

boot().catch((error) => {
  console.error(error);
  alert(`Erreur de démarrage : ${error.message}`);
});

async function boot() {
  renderDayLanes();
  updateWeekTabs();
  wireEvents();

  const config = await ensureFirebaseConfig();
  const app = initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await onSignedIn(user);
      return;
    }
    onSignedOut();
  });
}

function wireEvents() {
  mealForm.addEventListener('submit', onCreateMeal);
  showArchivedInput.addEventListener('change', render);
  mealSearchInput.addEventListener('input', render);
  authForm.addEventListener('submit', onLogin);
  registerBtn.addEventListener('click', onRegister);
  logoutBtn.addEventListener('click', onLogout);
  weekTabsEl.addEventListener('click', onWeekTabClick);
  resetWeekBtn.addEventListener('click', onResetWeekClick);

  daysBoardEl.addEventListener('change', async (event) => {
    const mondayInput = event.target.closest('#mondayDateInput');
    if (!mondayInput) return;
    if (!auth?.currentUser) return;

    mondayDateISO = sanitizeMondayDate(mondayInput.value);
    render();
    await saveWeekPlan();
    setMealMessage('Dates de la semaine mises à jour.');
  });

  mealsListEl.addEventListener('dragover', (event) => {
    event.preventDefault();
    mealsListEl.classList.add('drag-over');

    if (!dragState.fromList || !dragState.mealId) return;
    if (mealSearchInput.value.trim()) return;

    const targetCard = event.target.closest('.meal-card');
    if (!targetCard || targetCard.dataset.mealId === dragState.mealId) return;

    const draggedCard = mealsListEl.querySelector(`.meal-card[data-meal-id="${dragState.mealId}"]`);
    if (!draggedCard) return;

    const targetRect = targetCard.getBoundingClientRect();
    const insertBefore = event.clientY < targetRect.top + targetRect.height / 2;
    mealsListEl.insertBefore(draggedCard, insertBefore ? targetCard : targetCard.nextSibling);
  });
  mealsListEl.addEventListener('dragleave', () => mealsListEl.classList.remove('drag-over'));
  mealsListEl.addEventListener('drop', async (event) => {
    event.preventDefault();
    mealsListEl.classList.remove('drag-over');

    const mealId = dragState.mealId || event.dataTransfer.getData('mealId');
    const fromDay = dragState.fromDay || event.dataTransfer.getData('fromDay');

    if (dragState.fromList && mealId) {
      if (mealSearchInput.value.trim()) {
        setMealMessage('Désactive la recherche pour réorganiser les fiches.', true);
      } else {
        await saveMealsOrderFromDom();
        setMealMessage('Ordre des fiches mis à jour.');
      }
      resetDragState();
      return;
    }

    if (!mealId || !fromDay) return;

    weekPlan[fromDay] = (weekPlan[fromDay] || []).filter((id) => id !== mealId);
    await saveWeekPlan();
    resetDragState();
  });

  daysBoardEl.addEventListener('dragover', (event) => {
    const lane = event.target.closest('.day-dropzone');
    if (!lane) return;
    event.preventDefault();
    lane.classList.add('drag-over');
  });

  daysBoardEl.addEventListener('dragleave', (event) => {
    const lane = event.target.closest('.day-dropzone');
    if (!lane) return;
    lane.classList.remove('drag-over');
  });

  daysBoardEl.addEventListener('drop', async (event) => {
    const lane = event.target.closest('.day-dropzone');
    if (!lane) return;

    event.preventDefault();
    lane.classList.remove('drag-over');
    const targetDay = lane.dataset.day;

    const mealId = dragState.mealId || event.dataTransfer.getData('mealId');
    const fromDay = dragState.fromDay || event.dataTransfer.getData('fromDay');
    if (!mealId) return;

    if (fromDay) {
      weekPlan[fromDay] = (weekPlan[fromDay] || []).filter((id) => id !== mealId);
    }

    const dayItems = weekPlan[targetDay] || [];
    if (!dayItems.includes(mealId)) {
      dayItems.push(mealId);
    }
    weekPlan[targetDay] = dayItems;

    await saveWeekPlan();
    resetDragState();
  });
}

async function onLogin(event) {
  event.preventDefault();
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  setAuthMessage('Connexion en cours...');

  try {
    await signInWithEmailAndPassword(auth, email, password);
    authForm.reset();
    setAuthMessage('');
  } catch (error) {
    setAuthMessage(`Connexion impossible : ${humanizeAuthError(error.code)}`);
  }
}

async function onRegister() {
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  if (!email || !password) {
    setAuthMessage('Saisis un email et un mot de passe (6 caractères minimum).');
    return;
  }

  setAuthMessage('Création du compte...');
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    authForm.reset();
    setAuthMessage('Compte créé et connecté.');
  } catch (error) {
    setAuthMessage(`Création impossible : ${humanizeAuthError(error.code)}`);
  }
}

async function onLogout() {
  await signOut(auth);
}

async function onWeekTabClick(event) {
  const target = event.target.closest('.week-tab');
  if (!target) return;
  const weekKey = target.dataset.week;
  if (!WEEK_KEYS.includes(weekKey)) return;

  await setActiveWeek(weekKey);
}

async function onResetWeekClick() {
  if (!auth?.currentUser) return;
  const label = activeWeekKey === 'week1' ? 'Semaine 1' : 'Semaine 2';
  const ok = confirm(`Effacer toutes les fiches planifiées de ${label} ?`);
  if (!ok) return;

  weekPlan = makeEmptyWeek();
  await saveWeekPlan();
  setMealMessage(`${label} réinitialisée.`);
}

async function onSignedIn(user) {
  userEmailEl.textContent = user.email || 'Utilisateur';
  authCardEl.classList.add('hidden');
  sessionCardEl.classList.remove('hidden');
  appLayoutEl.classList.remove('hidden');

  await ensureWeekDocs();
  await ensureInitialMeals(user.uid);
  unsubscribeMeals?.();
  unsubscribeWeek?.();
  subscribeToMeals();
  subscribeToWeek();
}

function onSignedOut() {
  unsubscribeMeals?.();
  unsubscribeWeek?.();
  unsubscribeMeals = undefined;
  unsubscribeWeek = undefined;

  meals = [];
  weekPlan = makeEmptyWeek();
  mondayDateISO = getMondayIsoForToday();
  activeWeekKey = 'week1';
  updateWeekTabs();
  render();

  appLayoutEl.classList.add('hidden');
  sessionCardEl.classList.add('hidden');
  authCardEl.classList.remove('hidden');
  setAuthMessage('Connecte-toi pour gérer tes repas.');
  setMealMessage('');
}

function setAuthMessage(message) {
  authMessageEl.textContent = message;
}

function setMealMessage(message, isError = false) {
  mealMessageEl.textContent = message;
  mealMessageEl.classList.toggle('error', Boolean(isError));
}

function humanizeFirestoreError(code = '') {
  if (code === 'permission-denied') return 'droits insuffisants (vérifie les règles Firestore).';
  if (code === 'unauthenticated') return 'utilisateur non authentifié.';
  if (code === 'unavailable') return 'service temporairement indisponible.';
  return `erreur ${code || 'inconnue'}.`;
}

function humanizeAuthError(code = '') {
  if (code === 'auth/invalid-credential') return 'identifiants invalides.';
  if (code === 'auth/email-already-in-use') return 'cet email est déjà utilisé.';
  if (code === 'auth/invalid-email') return 'email invalide.';
  if (code === 'auth/weak-password') return 'mot de passe trop faible.';
  return `erreur ${code || 'inconnue'}.`;
}

function renderDayLanes() {
  const weekDates = getWeekDates(mondayDateISO);
  daysBoardEl.innerHTML = DAYS.map(
    (day, index) => `
      <article class="day-lane">
        <div class="day-label">
          <span class="day-name">${day}</span>
          <span class="day-date">${formatDateFr(weekDates[index])}</span>
          ${
            index === 0
              ? `<input id="mondayDateInput" class="monday-date-input" type="date" value="${weekDates[0]}" aria-label="Date du lundi" />`
              : ''
          }
        </div>
        <div class="day-dropzone" data-day="${day}"></div>
      </article>
    `,
  ).join('');
}

function updateWeekTabs() {
  weekTabsEl.querySelectorAll('.week-tab').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.week === activeWeekKey);
  });
}

function getActiveWeekDocId() {
  return WEEK_DOC_IDS[activeWeekKey] || WEEK_DOC_IDS.week1;
}

async function setActiveWeek(weekKey) {
  if (!WEEK_KEYS.includes(weekKey) || weekKey === activeWeekKey) return;
  activeWeekKey = weekKey;
  updateWeekTabs();

  weekPlan = makeEmptyWeek();
  mondayDateISO = getMondayIsoForToday();
  render();

  if (!auth?.currentUser) return;

  unsubscribeWeek?.();
  subscribeToWeek();
}

function subscribeToMeals() {
  const mealsQuery = query(collection(db, 'meals'), orderBy('createdAt', 'desc'));
  unsubscribeMeals = onSnapshot(mealsQuery, (snapshot) => {
    meals = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    render();
  });
}

function subscribeToWeek() {
  const weekRef = doc(db, 'weekPlans', getActiveWeekDocId());
  unsubscribeWeek = onSnapshot(weekRef, (snapshot) => {
    const data = snapshot.data();
    weekPlan = data?.days ? sanitizeWeek(data.days) : makeEmptyWeek();
    mondayDateISO = sanitizeMondayDate(data?.mondayDate);
    render();
  });
}

async function onCreateMeal(event) {
  event.preventDefault();

  if (!auth?.currentUser) {
    setMealMessage('Tu dois être connecté pour ajouter un repas.', true);
    return;
  }

  const name = mealNameInput.value.trim();
  const note = mealNoteInput.value.trim();
  if (!name) {
    setMealMessage('Le nom du repas est obligatoire.', true);
    return;
  }

  setMealMessage('Ajout en cours...');
  try {
    await addDoc(collection(db, 'meals'), {
      name,
      note,
      archived: false,
      sortOrder: getNextSortOrder(),
      createdAt: serverTimestamp(),
      ownerUid: auth.currentUser.uid,
    });

    mealForm.reset();
    mealNameInput.focus();
    setMealMessage('Repas ajouté ✅');
  } catch (error) {
    console.error(error);
    setMealMessage(`Ajout impossible : ${humanizeFirestoreError(error.code)}`, true);
  }
}

function render() {
  renderDayLanes();
  renderMealsList();
  renderWeek();
}

function renderMealsList() {
  const showArchived = showArchivedInput.checked;
  const searchTerm = normalizeMealName(mealSearchInput.value || '');
  const visibleMeals = getMealsOrderedBySort()
    .filter((meal) => (showArchived ? true : !meal.archived))
    .filter((meal) => {
      if (!searchTerm) return true;
      const haystack = normalizeMealName(`${meal.name} ${meal.note || ''}`);
      return haystack.includes(searchTerm);
    });

  if (!visibleMeals.length) {
    mealsListEl.innerHTML = '<p class="empty">Aucun repas disponible.</p>';
    return;
  }

  mealsListEl.innerHTML = visibleMeals
    .map((meal) => {
      const escapedNote = meal.note ? `<p class="meal-note">${escapeHtml(meal.note)}</p>` : '';
      return `
        <li class="meal-card" draggable="true" data-meal-id="${meal.id}">
          <div class="meal-header">
            <h3 class="meal-name">${escapeHtml(meal.name)}</h3>
            <small>${meal.archived ? 'Archivé' : 'Actif'}</small>
          </div>
          ${escapedNote}
          <div class="meal-actions">
            <button class="action" data-action="edit" data-id="${meal.id}" type="button">Modifier</button>
            <button class="action" data-action="archive" data-id="${meal.id}" type="button">${meal.archived ? 'Désarchiver' : 'Archiver'}</button>
            <button class="action delete" data-action="delete" data-id="${meal.id}" type="button">Supprimer</button>
          </div>
        </li>
      `;
    })
    .join('');

  mealsListEl.querySelectorAll('.meal-card').forEach((item) => {
    item.addEventListener('dragstart', (event) => {
      dragState.mealId = item.dataset.mealId || '';
      dragState.fromDay = '';
      dragState.fromList = true;
      event.dataTransfer.setData('mealId', item.dataset.mealId);
      event.dataTransfer.setData('fromDay', '');
      event.dataTransfer.setData('fromList', 'true');
    });
    item.addEventListener('dragend', resetDragState);
  });

  mealsListEl.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', onMealAction);
  });
}

function renderWeek() {
  DAYS.forEach((day) => {
    const lane = daysBoardEl.querySelector(`.day-dropzone[data-day="${day}"]`);
    if (!lane) return;

    const cards = (weekPlan[day] || [])
      .map((mealId) => meals.find((meal) => meal.id === mealId))
      .filter(Boolean)
      .map(
        (meal) => `
          <article class="meal-card" draggable="true" data-meal-id="${meal.id}" data-from-day="${day}">
            <h4 class="meal-name">${escapeHtml(meal.name)}</h4>
            ${meal.note ? `<p class="meal-note">${escapeHtml(meal.note)}</p>` : ''}
          </article>
        `,
      )
      .join('');

    lane.innerHTML = cards || '<p class="empty">Dépose un repas ici</p>';

    lane.querySelectorAll('.meal-card').forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        dragState.mealId = card.dataset.mealId || '';
        dragState.fromDay = card.dataset.fromDay || '';
        dragState.fromList = false;
        event.dataTransfer.setData('mealId', card.dataset.mealId);
        event.dataTransfer.setData('fromDay', card.dataset.fromDay || '');
      });
      card.addEventListener('dragend', resetDragState);
    });
  });
}

function getMealsOrderedBySort() {
  return [...meals].sort((a, b) => {
    const orderA = Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB, 'fr');
  });
}

function getNextSortOrder() {
  const orders = meals.map((meal) => meal.sortOrder).filter((value) => Number.isFinite(value));
  return orders.length ? Math.max(...orders) + 1 : 0;
}

async function saveMealsOrderFromDom() {
  const domIds = [...mealsListEl.querySelectorAll('.meal-card')].map((card) => card.dataset.mealId).filter(Boolean);
  if (!domIds.length) return;

  const allOrderedIds = getMealsOrderedBySort().map((meal) => meal.id);
  const remainingIds = allOrderedIds.filter((id) => !domIds.includes(id));
  const nextIds = [...domIds, ...remainingIds];

  await Promise.all(
    nextIds.map((mealId, index) => updateDoc(doc(db, 'meals', mealId), { sortOrder: index })),
  );
}

function resetDragState() {
  dragState.mealId = '';
  dragState.fromDay = '';
  dragState.fromList = false;
}

async function onMealAction(event) {
  const button = event.currentTarget;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const meal = meals.find((item) => item.id === id);
  if (!meal) return;

  if (action === 'edit') {
    const name = prompt('Nouveau nom du repas :', meal.name)?.trim();
    if (!name) return;
    const note = prompt('Nouvelle note :', meal.note || '') ?? '';
    await updateDoc(doc(db, 'meals', id), { name, note: note.trim() });
  }

  if (action === 'archive') {
    await updateDoc(doc(db, 'meals', id), { archived: !meal.archived });
  }

  if (action === 'delete') {
    const ok = confirm(`Supprimer définitivement "${meal.name}" ?`);
    if (!ok) return;

    await deleteDoc(doc(db, 'meals', id));
    DAYS.forEach((day) => {
      weekPlan[day] = (weekPlan[day] || []).filter((mealId) => mealId !== id);
    });
    await saveWeekPlan();
  }
}

async function ensureInitialMeals(ownerUid) {
  const mealsRef = collection(db, 'meals');
  const existingMeals = await getDocs(query(mealsRef, limit(300)));

  const existingNames = new Set(
    existingMeals.docs
      .map((docSnap) => docSnap.data()?.name)
      .filter((name) => typeof name === 'string')
      .map((name) => normalizeMealName(name)),
  );

  const missingNames = INITIAL_MEAL_NAMES.filter((name) => !existingNames.has(normalizeMealName(name)));
  if (!missingNames.length) return;

  const existingOrders = existingMeals.docs
    .map((docSnap) => docSnap.data()?.sortOrder)
    .filter((value) => Number.isFinite(value));
  const startOrder = existingOrders.length ? Math.max(...existingOrders) + 1 : 0;

  await Promise.all(
    missingNames.map((name, index) =>
      addDoc(mealsRef, {
        name,
        note: '',
        archived: false,
        sortOrder: startOrder + index,
        createdAt: serverTimestamp(),
        ownerUid,
      }),
    ),
  );
}

function normalizeMealName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function ensureWeekDocs() {
  await Promise.all(
    WEEK_KEYS.map(async (weekKey) => {
      const weekRef = doc(db, 'weekPlans', WEEK_DOC_IDS[weekKey]);
      const snap = await getDoc(weekRef);
      if (!snap.exists()) {
        await setDoc(weekRef, { days: makeEmptyWeek(), mondayDate: getMondayIsoForToday() });
        return;
      }

      const data = snap.data() || {};
      if (typeof data.mondayDate !== 'string' || !data.mondayDate) {
        await setDoc(weekRef, { mondayDate: getMondayIsoForToday() }, { merge: true });
      }
    }),
  );
}

async function saveWeekPlan() {
  await setDoc(
    doc(db, 'weekPlans', getActiveWeekDocId()),
    { days: sanitizeWeek(weekPlan), mondayDate: sanitizeMondayDate(mondayDateISO) },
    { merge: true },
  );
}

function makeEmptyWeek() {
  return Object.fromEntries(DAYS.map((day) => [day, []]));
}

function sanitizeWeek(rawWeek) {
  const safe = makeEmptyWeek();
  DAYS.forEach((day) => {
    const values = Array.isArray(rawWeek?.[day]) ? rawWeek[day] : [];
    safe[day] = [...new Set(values.filter((value) => typeof value === 'string' && value))];
  });
  return safe;
}

function getMondayIsoForToday() {
  const now = new Date();
  const offset = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - offset);
  return formatDateToLocalIso(now);
}

function sanitizeMondayDate(value) {
  if (typeof value !== 'string') return getMondayIsoForToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return getMondayIsoForToday();
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return getMondayIsoForToday();
  return value;
}

function getWeekDates(mondayIsoDate) {
  const base = new Date(`${sanitizeMondayDate(mondayIsoDate)}T12:00:00`);
  return DAYS.map((_, index) => {
    const next = new Date(base);
    next.setDate(base.getDate() + index);
    return formatDateToLocalIso(next);
  });
}

function formatDateFr(isoDate) {
  const dateObj = new Date(`${sanitizeMondayDate(isoDate)}T12:00:00`);
  return dateObj.toLocaleDateString('fr-FR');
}

function formatDateToLocalIso(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function ensureFirebaseConfig() {
  const existing = localStorage.getItem(CONFIG_KEY);
  if (existing) {
    try {
      return validateFirebaseConfig(JSON.parse(existing));
    } catch {
      localStorage.removeItem(CONFIG_KEY);
    }
  }

  configDialog.showModal();
  const result = await waitDialogClose(configDialog);
  if (result === 'cancel') {
    throw new Error('Configuration Firebase manquante.');
  }

  const parsed = parseFirebaseConfigInput(configInput.value.trim());
  localStorage.setItem(CONFIG_KEY, JSON.stringify(parsed));
  return parsed;
}

function parseFirebaseConfigInput(rawValue) {
  if (!rawValue) {
    throw new Error('Configuration Firebase vide.');
  }

  try {
    return validateFirebaseConfig(JSON.parse(rawValue));
  } catch {
    // Continue avec parsing objet JS
  }

  const firstBrace = rawValue.indexOf('{');
  const lastBrace = rawValue.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Configuration Firebase invalide : objet introuvable.');
  }

  const objectLiteral = rawValue.slice(firstBrace, lastBrace + 1);
  let parsedObject;
  try {
    parsedObject = Function(`"use strict"; return (${objectLiteral});`)();
  } catch {
    throw new Error('Le format de la configuration Firebase est invalide.');
  }

  return validateFirebaseConfig(parsedObject);
}

function validateFirebaseConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration Firebase invalide.');
  }

  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = requiredKeys.filter((key) => typeof config[key] !== 'string' || !config[key].trim());
  if (missing.length) {
    throw new Error(`Configuration Firebase incomplète : ${missing.join(', ')}`);
  }

  return config;
}

function waitDialogClose(dialog) {
  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      resolve(dialog.returnValue);
    };
    dialog.addEventListener('close', onClose);
  });
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

configForm.addEventListener('submit', (event) => {
  event.preventDefault();
  configDialog.close('default');
});
