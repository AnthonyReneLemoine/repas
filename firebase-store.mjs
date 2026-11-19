import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { collection, doc, getFirestore, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { validSms, emptyState, recipe, weekDays, normalizeMondayDate, shiftMonday, getMondayIsoForToday } from './modele.mjs';
const ALLOWED_UID = 'ENgOZhuh0ca3tqeb0IbII2CCVzX2';
const PREFIX = 'essai-sites-v1-';
const overlayId = (kind,id) => PREFIX + kind + '-' + id;

function readSource(mealDocs, weekDocs) {
  const state = emptyState();
  for (const snap of mealDocs) state.meals[snap.id] = recipe(snap.data());
  let previous = '';
  for (const [index, id] of ['currentWeek1','currentWeek2'].entries()) {
    const legacy = weekDocs.find(s => s.id === id)?.data();
    if (!legacy) continue;
    let monday = normalizeMondayDate(legacy.mondayDate,shiftMonday(getMondayIsoForToday(),index));
    if (monday === previous) monday = shiftMonday(monday,1);
    state.weeks[monday] = weekDays(legacy.days);
    previous = monday;
  }
  for (const snap of weekDocs) {
    if (/^week-\d{4}-\d{2}-\d{2}$/.test(snap.id)) state.weeks[snap.id.slice(5)] = weekDays(snap.data().days);
  }
  return state;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}

const firebaseConfig = {
  apiKey: 'AIzaSyByRDnDYVJveGvVCvQtIFu5wyfGFs2ohlo',
  authDomain: 'repas-70a80.firebaseapp.com',
  projectId: 'repas-70a80',
  storageBucket: 'repas-70a80.firebasestorage.app',
  messagingSenderId: '726974600317',
  appId: '1:726974600317:web:d99ff0a1c11c1fed9f0d14'
};

export function connect(callbacks) {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app), auth = getAuth(app);
  let stops = [], source = emptyState(), active = false;
  function stop() { active = false; stops.forEach(unsub=>unsub()); stops = []; }
  const unwatch = onAuthStateChanged(auth, async user => {
    stop();
    if (!user) { callbacks.signedOut(); return; }
    if (user.uid !== ALLOWED_UID) {
      await signOut(auth);
      callbacks.error(Error('Ce compte ne dispose pas des droits requis.'));
      return;
    }
    let mealDocs, weekDocs;
    function publish() {
      if (!mealDocs || !weekDocs) return;
      source = readSource(mealDocs,weekDocs);
      const state = structuredClone(source);
      for (const snap of weekDocs) {
        if (!snap.id.startsWith(PREFIX)) continue;
        const {kind,id,value} = snap.data();
        if (kind === 'settings' && id === 'sms' && snap.id === overlayId(kind,id)) {
          if (validSms(value)) state.settings.sms = {intro:value.intro,fin:value.fin};
          continue;
        }
        if (!['weeks','meals'].includes(kind) || snap.id !== overlayId(kind,id) || id in Object.prototype) continue;
        if (value == null) delete state[kind][id];
        else state[kind][id] = kind === 'meals' ? recipe(value) : weekDays(value);
      }
      active = true;
      callbacks.data(state);
    }
    const failed = async error => { stop(); await signOut(auth); callbacks.error(error); };
    stops.push(onSnapshot(collection(db,'meals'), s=>{mealDocs=s.docs; publish();}, failed));
    stops.push(onSnapshot(collection(db,'weekPlans'), s=>{weekDocs=s.docs; publish();}, failed));
  });
  return {
    async loginWithGoogle() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result.user.uid !== ALLOWED_UID) throw Error('Ce compte Google ne dispose pas des droits sur ce planning.');
    },
    async login(email,password) {
      const result = await signInWithEmailAndPassword(auth,email,password);
      if (result.user.uid !== ALLOWED_UID) throw Error('Ce compte ne dispose pas des droits requis.');
    },
    dispose() { unwatch(); stop(); },
    logout: () => signOut(auth),
    async save(changes) {
      if (!active || auth.currentUser?.uid !== ALLOWED_UID) throw Error('Connecte le compte autorisé.');
      if (changes.length > 450) throw Error('Cette opération dépasse la limite de 450 documents par enregistrement.');
      await runTransaction(db, async tx => {
        const records = await Promise.all(changes.map(async c=>{
          const ref = doc(db,'weekPlans',overlayId(c.kind,c.id));
          const snap = await tx.get(ref);
          const current = snap.exists() ? snap.data().value : source[c.kind][c.id] ?? null;
          if (JSON.stringify(canonical(current)) !== JSON.stringify(canonical(c.old)))
            throw Error('Ces données ont changé sur un autre appareil. Réessaie avec la version affichée.');
          return {ref,kind:c.kind,id:c.id,value:c.value};
        }));
        for (const {ref,...data} of records) tx.set(ref,data);
      });
    }
  };
}
