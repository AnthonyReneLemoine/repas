import { mkdir, copyFile } from 'node:fs/promises';
const assets = ['index.html','styles.css','app.js','modele.mjs','firebase-store.mjs','guide.mjs','eat.png'];
await mkdir('dist',{recursive:true});
await Promise.all(assets.map(file=>copyFile(file,'dist/'+file)));
