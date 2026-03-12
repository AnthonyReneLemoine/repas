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
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const WEEK_DOC_ID = 'currentWeek';
const CONFIG_KEY = 'firebaseConfig.dashboardRepas';

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
const mealsListEl = document.getElementById('mealsList');
const mealForm = document.getElementById('mealForm');
const mealNameInput = document.getElementById('mealName');
const mealNoteInput = document.getElementById('mealNote');
const showArchivedInput = document.getElementById('showArchived');
const configDialog = document.getElementById('configDialog');
const configForm = document.getElementById('configForm');
const configInput = document.getElementById('firebaseConfigInput');

let db;
let auth;
let meals = [];
let weekPlan = makeEmptyWeek();
let unsubscribeMeals;
let unsubscribeWeek;

boot().catch((error) => {
  console.error(error);
  alert(`Erreur de démarrage : ${error.message}`);
});

async function boot() {
  renderDayLanes();
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
  authForm.addEventListener('submit', onLogin);
  registerBtn.addEventListener('click', onRegister);
  logoutBtn.addEventListener('click', onLogout);

  mealsListEl.addEventListener('dragover', (event) => {
    event.preventDefault();
    mealsListEl.classList.add('drag-over');
  });
  mealsListEl.addEventListener('dragleave', () => mealsListEl.classList.remove('drag-over'));
  mealsListEl.addEventListener('drop', async (event) => {
    event.preventDefault();
    mealsListEl.classList.remove('drag-over');

    const mealId = event.dataTransfer.getData('mealId');
    const fromDay = event.dataTransfer.getData('fromDay');
    if (!mealId || !fromDay) return;

    weekPlan[fromDay] = (weekPlan[fromDay] || []).filter((id) => id !== mealId);
    await saveWeekPlan();
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

    const mealId = event.dataTransfer.getData('mealId');
    const fromDay = event.dataTransfer.getData('fromDay');
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

async function onSignedIn(user) {
  userEmailEl.textContent = user.email || 'Utilisateur';
  authCardEl.classList.add('hidden');
  sessionCardEl.classList.remove('hidden');
  appLayoutEl.classList.remove('hidden');

  await ensureWeekDoc();
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
  render();

  appLayoutEl.classList.add('hidden');
  sessionCardEl.classList.add('hidden');
  authCardEl.classList.remove('hidden');
  setAuthMessage('Connecte-toi pour gérer tes repas.');
}

function setAuthMessage(message) {
  authMessageEl.textContent = message;
}

function humanizeAuthError(code = '') {
  if (code === 'auth/invalid-credential') return 'identifiants invalides.';
  if (code === 'auth/email-already-in-use') return 'cet email est déjà utilisé.';
  if (code === 'auth/invalid-email') return 'email invalide.';
  if (code === 'auth/weak-password') return 'mot de passe trop faible.';
  return `erreur ${code || 'inconnue'}.`;
}

function renderDayLanes() {
  daysBoardEl.innerHTML = DAYS.map(
    (day) => `
      <article class="day-lane">
        <div class="day-label">${day}</div>
        <div class="day-dropzone" data-day="${day}"></div>
      </article>
    `,
  ).join('');
}

function subscribeToMeals() {
  const mealsQuery = query(collection(db, 'meals'), orderBy('createdAt', 'desc'));
  unsubscribeMeals = onSnapshot(mealsQuery, (snapshot) => {
    meals = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    render();
  });
}

function subscribeToWeek() {
  const weekRef = doc(db, 'weekPlans', WEEK_DOC_ID);
  unsubscribeWeek = onSnapshot(weekRef, (snapshot) => {
    const data = snapshot.data();
    weekPlan = data?.days ? sanitizeWeek(data.days) : makeEmptyWeek();
    render();
  });
}

async function onCreateMeal(event) {
  event.preventDefault();
  const name = mealNameInput.value.trim();
  const note = mealNoteInput.value.trim();
  if (!name) return;

  await addDoc(collection(db, 'meals'), {
    name,
    note,
    archived: false,
    createdAt: serverTimestamp(),
  });

  mealForm.reset();
  mealNameInput.focus();
}

function render() {
  renderMealsList();
  renderWeek();
}

function renderMealsList() {
  const showArchived = showArchivedInput.checked;
  const visibleMeals = meals.filter((meal) => (showArchived ? true : !meal.archived));

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
      event.dataTransfer.setData('mealId', item.dataset.mealId);
      event.dataTransfer.setData('fromDay', '');
    });
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
        event.dataTransfer.setData('mealId', card.dataset.mealId);
        event.dataTransfer.setData('fromDay', card.dataset.fromDay || '');
      });
    });
  });
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

async function ensureWeekDoc() {
  const weekRef = doc(db, 'weekPlans', WEEK_DOC_ID);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) {
    await setDoc(weekRef, { days: makeEmptyWeek() });
  }
}

async function saveWeekPlan() {
  await setDoc(doc(db, 'weekPlans', WEEK_DOC_ID), { days: sanitizeWeek(weekPlan) }, { merge: true });
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

async function ensureFirebaseConfig() {
  const existing = localStorage.getItem(CONFIG_KEY);
  if (existing) {
    return JSON.parse(existing);
  }

  configDialog.showModal();
  const result = await waitDialogClose(configDialog);
  if (result === 'cancel') {
    throw new Error('Configuration Firebase manquante.');
  }

  const raw = configInput.value.trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Le JSON de configuration Firebase est invalide. Recharge la page pour réessayer.');
  }

  localStorage.setItem(CONFIG_KEY, JSON.stringify(parsed));
  return parsed;
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
