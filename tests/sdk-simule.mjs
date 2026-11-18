export const docs=new Map([['meals/original',{name:'Soupe',note:'Origine'}],
  ['weekPlans/currentWeek1',{mondayDate:'2026-11-16',days:{Lundi:['original']}}]]);
export const writes=[];
const auth={currentUser:null},listeners=new Map();
let authListener;
export const initializeApp=()=>({});
export const getAuth=()=>auth;
export const getFirestore=()=>({});
export const doc=(_,kind,id)=>kind+'/'+id;
export const collection=(_,kind)=>kind;
export function onAuthStateChanged(_,listener){authListener=listener;return ()=>{authListener=null;};}
export async function session(uid){auth.currentUser=uid?{uid}:null;await authListener(auth.currentUser);}
export const signOut=()=>session(null);
export const signInWithEmailAndPassword=()=>{throw Error('Utiliser session pour ce test.');};
function snapshot(key){return {id:key.split('/')[1],exists:()=>docs.has(key),data:()=>structuredClone(docs.get(key))};}
function notify(kind){
  const rows=[...docs.keys()].filter(path=>path.startsWith(kind+'/')).map(snapshot);
  listeners.get(kind)?.({docs:rows});
}
export function onSnapshot(kind,listener){listeners.set(kind,listener);notify(kind);return ()=>listeners.delete(kind);}
export async function runTransaction(_,operation){
  const staged=new Map();
  await operation({get:async key=>snapshot(key),set:(key,value)=>staged.set(key,value)});
  for(const [k,v] of staged){docs.set(k,v);writes.push(k);}
  notify('weekPlans');
}
