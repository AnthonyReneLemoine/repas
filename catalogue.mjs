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
export const catalogueMarkers = ['catalogueV1','catalogueV2','catalogueV3','catalogueV4','catalogueV5'];
export const catalogueMarker = catalogueMarkers.at(-1);
export const familles = [];

function addFamily(famille,names,version,cuisine) {
  if (!familles.includes(famille)) familles.push(famille);
  for (const name of names) {
    const key=ingredientKey(name);
    const entry=catalogue.get(key) ?? {name,cuisines:[],version};
    entry.famille=famille;
    if (cuisine && !entry.cuisines.includes(cuisine)) entry.cuisines.push(cuisine);
    catalogue.set(key,entry);
  }
}

for (const [famille,names] of Object.entries(selectionParFamille)) {
  addFamily(famille,names,2,famille==='Fromages français'?'Française':null);
}

addFamily('Sauces',[
  'Mayonnaise', 'Vinaigrette', 'Béchamel', 'Sauce hollandaise', 'Sauce béarnaise',
  'Beurre blanc', 'Sauce tartare', 'Aïoli', 'Sauce au poivre', 'Sauce au roquefort',
  'Sauce à la moutarde', 'Sauce au beurre citronné', 'Sauce gribiche', 'Sauce rémoulade',
  'Sauce aux champignons'
],3,'Française');
addFamily('Sauces',['Sauce soja','Sauce d’huître','Sauce hoisin','Sauce aigre-douce'],3,'Chinoise');
addFamily('Sauces',['Sauce barbecue','Ketchup','Sauce burger','Sauce ranch','Sauce Buffalo'],3,'Américaine');
addFamily('Sauces',['Raïta','Chutney de mangue','Sauce tikka masala'],3,'Indienne');
addFamily('Sauces',['Harissa','Sauce au tahini','Toum'],3,'Arabe');
addFamily('Sauces',['Sauce tomate','Sauce bolognaise','Pesto au basilic','Sauce arrabbiata',
  'Sauce teriyaki','Sauce sriracha','Sauce nuoc-mâm','Sauce Worcestershire'],3);

// Sélection de la presqu’île de Rhuys et des criées de Quiberon et de Lorient.
addFamily('Poissons',['Bar','Dorade','Lieu jaune','Sole','Lotte','Rouget','Sardine','Maquereau',
  'Merlu','Merlan','Saint-pierre','Tacaud','Lieu noir','Julienne','Églefin'],3,'Française');
addFamily('Poissons',['Saumon','Cabillaud'],3);

addFamily('Pains',['Baguette','Baguette de tradition','Ficelle','Pain de campagne','Pain au levain',
  'Pain complet','Pain de seigle','Pain aux céréales','Pain de mie','Pain aux noix',
  'Pain au maïs','Pain de petit épeautre','Pain sans gluten','Fougasse'],3,'Française');
addFamily('Pains',['Pain pita'],3,'Arabe');
addFamily('Pains',['Naan','Chapati'],3,'Indienne');
addFamily('Pains',['Pain à burger','Pain à hot-dog','Bagel'],3,'Américaine');
addFamily('Pains',['Ciabatta','Focaccia'],3);
addFamily('Viennoiseries',['Croissant au beurre','Croissant aux amandes','Pain au chocolat','Pain aux raisins',
  'Chausson aux pommes','Pain au lait','Pain suisse','Brioche','Brioche tressée','Brioche aux pépites de chocolat',
  'Brioche feuilletée','Chouquette','Kouign-amann'],3,'Française');


addFamily('Fruits',[
  'Pomme','Poire','Banane','Fraise','Framboise','Myrtilles','Mûre','Groseille','Cerise','Abricot',
  'Pêche','Nectarine','Prune','Mirabelle','Raisin','Raisin muscat','Figue','Melon','Pastèque','Kiwi',
  'Orange','Clémentine','Mandarine','Citron','Citron vert','Pamplemousse','Ananas','Mangue','Grenade','Dattes'
],4);
addFamily('Légumes',[
  'Pommes de terre','Patate douce','Carotte','Poireau','Navet','Betterave','Radis','Panais',
  'Céleri-rave','Céleri branche','Oignon','Échalote','Ail','Tomate','Tomates cerises','Concombre',
  'Courgette','Aubergine','Poivron','Potiron','Potimarron','Courge butternut','Brocoli','Chou-fleur',
  'Chou vert','Chou rouge','Chou chinois','Pak-choï','Choux de Bruxelles','Épinards','Blettes',
  'Laitue','Mâche','Roquette','Endive','Haricots verts','Petits pois','Artichaut','Asperges','Fenouil',
  'Champignons de Paris','Champignons shiitakés','Champignons noirs','Morilles','Maïs doux'
],4);
addFamily('Féculents et légumineuses',[
  'Riz','Riz basmati','Riz gluant','Riz à risotto','Quinoa','Boulgour','Semoule de couscous',
  'Semoule fine','Spaghettis','Pennes','Coquillettes','Tagliatelles','Feuilles de lasagnes','Vermicelles',
  'Vermicelles de riz','Nouilles de blé','Gnocchis','Lentilles vertes','Lentilles corail','Pois chiches',
  'Haricots rouges','Haricots noirs','Haricots blancs','Pois cassés','Fèves'
],4);
addFamily('Œufs et produits frais',[
  'Œufs','Lait','Lait fermenté','Beurre','Beurre demi-sel','Crème fraîche','Crème liquide',
  'Yaourt nature','Fromage blanc','Mozzarella','Mascarpone','Ricotta','Tofu'
],4);
addFamily('Viandes et charcuteries',[
  'Poulet','Dinde','Bœuf','Porc','Agneau','Steak haché','Jambon blanc','Jambon cru',
  'Lardons','Bacon','Chair à saucisse','Saucisse de Toulouse','Merguez'
],4);
addFamily('Fruits de mer',[
  'Moules','Crevettes','Huîtres','Coquilles Saint-Jacques','Palourdes','Coques','Langoustines',
  'Tourteau','Calamar','Seiche'
],4);
addFamily('Épicerie et conserves',[
  'Farine de blé','Fécule de maïs','Huile d’olive','Huile de colza','Huile de tournesol',
  'Vinaigre de vin','Vinaigre balsamique','Bouillon de légumes','Bouillon de volaille',
  'Tomates pelées en conserve','Concentré de tomate','Thon au naturel','Sardines en boîte',
  'Lait de coco','Chapelure','Pâte feuilletée','Pâte brisée','Feuilles de brick'
],4);
addFamily('Pâtisserie et petit-déjeuner',[
  'Sucre en poudre','Sucre glace','Cassonade','Sucre vanillé','Levure chimique','Levure boulangère',
  'Chocolat noir','Cacao en poudre','Pépites de chocolat','Poudre d’amandes','Miel','Confiture de fraises',
  'Flocons d’avoine','Sirop d’érable','Beurre de cacahuète'
],4);
addFamily('Herbes et épices',[
  'Persil','Thym','Laurier','Estragon','Coriandre fraîche','Menthe fraîche','Basilic','Ciboulette',
  'Aneth','Romarin','Origan','Gingembre frais','Cumin','Curcuma','Cannelle','Noix de muscade',
  'Paprika fumé','Paprika doux','Poivre noir','Poivre du Sichuan','Garam masala','Ras el-hanout','Sel'
],4);
addFamily('Légumes',['Pousses de bambou','Pousses de haricot mungo','Cébette','Piment vert'],4);
addFamily('Féculents et légumineuses',['Lentilles mungo'],4);
addFamily('Œufs et produits frais',['Ghee','Paneer','Cheddar','Surimi'],4);
addFamily('Herbes et épices',['Badiane','Graines de coriandre','Cardamome verte','Clous de girofle',
  'Graines de moutarde','Feuilles de curry','Sumac','Za’atar'],4);
addFamily('Épicerie et conserves',['Moutarde de Dijon','Vinaigre de riz','Huile de sésame','Vin de Shaoxing',
  'Farine de pois chiches','Farine de maïs','Tamarin','Cornichons','Citron confit','Olives vertes',
  'Tahini','Eau de fleur d’oranger'],4);
addFamily('Noix et graines',['Amandes','Cacahuètes','Noix','Noix de pécan','Noisettes',
  'Pistaches','Pignons de pin','Graines de sésame','Graines de courge'],4);


addFamily('Pâtes italiennes',[
  'Spaghettis','Spaghettoni','Spaghettini','Capellini','Bucatini','Linguine','Trenette','Tonnarelli',
  'Tagliatelles','Fettuccine','Pappardelle','Mafaldine','Feuilles de lasagnes','Cannelloni',
  'Pennes','Rigatoni','Mezze maniche','Macaronis','Ziti','Paccheri','Calamarata','Fusilli',
  'Farfalle','Gemelli','Casarecce','Cavatappi','Conchiglie','Conchiglioni','Orecchiette','Trofie',
  'Ditalini','Stelline','Risoni','Ravioli','Tortellini','Tortelloni','Agnolotti','Cappelletti'
],5);
addFamily('Œufs et produits frais',['Parmesan','Pecorino romano','Ricotta salata'],5);
addFamily('Viandes et charcuteries',['Guanciale'],5);
addFamily('Herbes et épices',['Piment séché'],5);
