// Un même nom dans plusieurs sélections correspond à une seule fiche.
const selections = {
  'Française': [
    'Ail', 'Oignon', 'Échalote', 'Poireau', 'Carotte', 'Pommes de terre', 'Navet', 'Céleri branche',
    'Haricots verts', 'Champignons de Paris', 'Courgette', 'Tomate', 'Poire', 'Pomme',
    'Persil', 'Thym', 'Laurier', 'Estragon', 'Noix de muscade', 'Moutarde de Dijon',
    'Beurre', 'Crème fraîche', 'Lait', 'Œufs', 'Farine de blé', 'Lentilles vertes',
    'Fromage de chèvre', 'Comté', 'Lardons', 'Poulet', 'Bœuf', 'Moules',
    'Saumon', 'Cabillaud', 'Huile d’olive', 'Vinaigre de vin', 'Poivre noir', 'Sel'
  ],
  'Chinoise': [
    'Riz', 'Riz gluant', 'Nouilles de blé', 'Vermicelles de riz', 'Tofu', 'Porc', 'Poulet', 'Bœuf',
    'Crevettes', 'Œufs', 'Pak-choï', 'Chou chinois', 'Pousses de bambou', 'Pousses de haricot mungo',
    'Champignons shiitakés', 'Champignons noirs', 'Carotte', 'Cébette', 'Ail', 'Gingembre frais',
    'Sauce soja', 'Sauce d’huître', 'Vinaigre de riz', 'Huile de sésame', 'Vin de Shaoxing',
    'Poivre du Sichuan', 'Badiane', 'Fécule de maïs', 'Graines de sésame', 'Cacahuètes'
  ],
  'Indienne': [
    'Riz basmati', 'Pois chiches', 'Lentilles corail', 'Lentilles mungo', 'Farine de pois chiches',
    'Pommes de terre', 'Chou-fleur', 'Épinards', 'Aubergine', 'Petits pois', 'Tomate', 'Oignon',
    'Ail', 'Gingembre frais', 'Piment vert', 'Coriandre fraîche', 'Cumin', 'Graines de coriandre',
    'Curcuma', 'Cardamome verte', 'Cannelle', 'Clous de girofle', 'Graines de moutarde', 'Garam masala',
    'Feuilles de curry', 'Ghee', 'Yaourt nature', 'Paneer', 'Lait de coco', 'Tamarin', 'Poulet'
  ],
  'Américaine': [
    'Pommes de terre', 'Patate douce', 'Maïs doux', 'Farine de maïs', 'Haricots rouges', 'Haricots noirs',
    'Tomate', 'Oignon', 'Ail', 'Céleri branche', 'Poivron', 'Laitue', 'Cornichons', 'Courge butternut',
    'Bœuf', 'Poulet', 'Dinde', 'Bacon', 'Cheddar', 'Œufs', 'Lait fermenté', 'Beurre', 'Farine de blé',
    'Flocons d’avoine', 'Beurre de cacahuète', 'Noix de pécan', 'Sirop d’érable', 'Cassonade',
    'Sauce barbecue', 'Paprika fumé', 'Myrtilles'
  ],
  'Arabe': [
    'Semoule de couscous', 'Boulgour', 'Riz', 'Pois chiches', 'Fèves', 'Lentilles corail', 'Pain pita',
    'Agneau', 'Poulet', 'Yaourt nature', 'Aubergine', 'Courgette', 'Carotte', 'Navet', 'Tomate',
    'Concombre', 'Oignon', 'Ail', 'Persil', 'Menthe fraîche', 'Coriandre fraîche', 'Citron',
    'Citron confit', 'Olives vertes', 'Huile d’olive', 'Tahini', 'Cumin', 'Cannelle', 'Sumac',
    'Za’atar', 'Ras el-hanout', 'Harissa', 'Dattes', 'Amandes', 'Pignons de pin', 'Eau de fleur d’oranger'
  ]
};

export const cuisines = Object.keys(selections);
export const ingredientKey = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replaceAll('œ','oe').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const catalogue = new Map();
for (const [cuisine, names] of Object.entries(selections)) {
  for (const name of names) {
    const key = ingredientKey(name);
    if (!catalogue.has(key)) catalogue.set(key,{name,cuisines:[]});
    catalogue.get(key).cuisines.push(cuisine);
  }
}

const selectionParFamille = {
  'Fromages français': [
    'Comté', 'Fromage de chèvre', 'Camembert de Normandie', 'Brie de Meaux', 'Brie de Melun',
    'Coulommiers', 'Neufchâtel', 'Chaource', 'Brillat-savarin', 'Saint-Nectaire', 'Reblochon',
    'Morbier', 'Tomme de Savoie', 'Beaufort', 'Abondance', 'Cantal', 'Salers', 'Laguiole',
    'Ossau-Iraty', 'Olivet cendré', 'Emmental de Savoie', 'Mimolette', 'Saint-Paulin',
    'Port-Salut', 'Munster', 'Maroilles', 'Époisses', 'Pont-l’évêque', 'Livarot', 'Langres',
    'Mont d’Or', 'Roquefort', 'Bleu d’Auvergne', 'Bleu des Causses', 'Fourme d’Ambert',
    'Fourme de Montbrison', 'Sainte-maure de Touraine', 'Crottin de Chavignol', 'Valençay',
    'Pouligny-Saint-Pierre', 'Selles-sur-Cher', 'Rocamadour', 'Picodon', 'Pélardon', 'Banon',
    'Chabichou du Poitou', 'Brocciu'
  ],
  'Sodas': [
    'Cola', 'Cola sans sucres', 'Limonade', 'Limonade sans sucres', 'Soda à l’orange',
    'Soda au citron-citron vert', 'Soda au pamplemousse', 'Soda au gingembre', 'Tonic', 'Tonic sans sucres'
  ],
  'Eaux': [
    'Eau plate', 'Eau de source', 'Eau minérale plate', 'Eau gazeuse', 'Eau finement pétillante',
    'Eau minérale gazeuse', 'Eau aromatisée au citron', 'Eau aromatisée à la menthe'
  ],
  'Jus et nectars': [
    'Jus d’orange', 'Jus de pomme', 'Jus de raisin', 'Jus d’ananas', 'Jus de pamplemousse',
    'Jus de tomate', 'Jus multifruits', 'Nectar d’abricot', 'Nectar de pêche'
  ],
  'Autres boissons sans alcool': [
    'Thé glacé à la pêche', 'Thé glacé au citron', 'Citronnade', 'Diabolo menthe', 'Sirop de grenadine',
    'Sirop de menthe', 'Café', 'Café décaféiné', 'Thé noir', 'Thé vert', 'Infusion de verveine', 'Chocolat chaud'
  ]
};
export const familles = Object.keys(selectionParFamille);
export const catalogueMarker = 'catalogueV2';
for (const [famille, names] of Object.entries(selectionParFamille)) {
  for (const name of names) {
    const key = ingredientKey(name);
    if (!catalogue.has(key)) {
      catalogue.set(key,{name,cuisines:famille==='Fromages français'?['Française']:[],version:2});
    }
    catalogue.get(key).famille = famille;
  }
}
