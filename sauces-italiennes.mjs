// Quantités de sauce pour deux personnes. Les pâtes sont choisies séparément dans le planning.
function sauce(name, accord, ingredients, steps) {
  return {name,portions:2,note:'Sauce pour pâtes italiennes · '+accord,
    ingredients:ingredients.map(([name,qty,unit])=>({name,qty,unit})),steps};
}

export const saucesItaliennes = [
  sauce('Sauce tomate au basilic','Avec des spaghettis ou des pennes.',
    [['Tomates pelées en conserve',300,'g'],['Ail',1,'gousse'],['Huile d’olive',1,'c. à soupe'],['Basilic',6,'feuilles'],['Sel',1,'pincée']],
    ['Faire revenir doucement l’ail haché dans l’huile.','Ajouter les tomates écrasées et le sel. Laisser réduire 20 minutes à feu doux.','Déchirer le basilic dans la sauce juste avant de mélanger avec les pâtes.']),
  sauce('Sauce arrabbiata','Avec des pennes.',
    [['Tomates pelées en conserve',300,'g'],['Ail',2,'gousses'],['Piment séché',1,'pincée'],['Huile d’olive',1,'c. à soupe'],['Persil',2,'brins'],['Sel',1,'pincée']],
    ['Chauffer doucement l’ail émincé et le piment émietté dans l’huile.','Ajouter les tomates écrasées et le sel. Laisser mijoter 15 à 20 minutes.','Ajouter le persil ciselé et mélanger avec les pâtes.']),
  sauce('Pesto au basilic','Avec des trofie ou des linguine.',
    [['Basilic',30,'g'],['Pignons de pin',15,'g'],['Parmesan',30,'g'],['Ail',0.5,'gousse'],['Huile d’olive',3,'c. à soupe']],
    ['Écraser l’ail et les pignons au mortier. Incorporer les feuilles de basilic par petites poignées, ou mixer par à-coups.','Ajouter le parmesan râpé et verser l’huile progressivement.','Délayer avec un peu d’eau de cuisson des pâtes et mélanger hors du feu.']),
  sauce('Sauce cacio e pepe','Avec des tonnarelli ou des spaghettis.',
    [['Pecorino romano',70,'g'],['Poivre noir',1,'c. à café']],
    ['Râper très finement le pecorino. Concasser le poivre et le chauffer brièvement à sec dans une poêle.','Prélever environ 80 ml d’eau de cuisson et laisser tiédir quelques cuillerées. Les incorporer peu à peu au fromage pour former une crème.','Mélanger les pâtes et le poivre. Hors du feu, incorporer la crème de pecorino et ajuster avec le reste d’eau.']),
  sauce('Sauce carbonara','Avec des spaghettis ou des rigatoni.',
    [['Guanciale',75,'g'],['Œufs',2,'pièces'],['Pecorino romano',40,'g'],['Poivre noir',2,'pincées']],
    ['Tailler le guanciale en bâtonnets et le faire dorer à feu moyen en partant d’une poêle froide.','Battre un œuf entier et le jaune du second avec le pecorino râpé et le poivre. Réserver le blanc pour un autre usage.','Ajouter les pâtes chaudes au guanciale. Retirer du feu et incorporer le mélange aux œufs en remuant. Détendre avec un peu d’eau de cuisson.']),
  sauce('Sauce bolognaise','Avec des tagliatelles ou des feuilles de lasagnes.',
    [['Steak haché',180,'g'],['Oignon',0.5,'pièce'],['Carotte',0.5,'pièce'],['Céleri branche',0.5,'branche'],['Tomates pelées en conserve',250,'g'],['Concentré de tomate',1,'c. à soupe'],['Huile d’olive',1,'c. à soupe'],['Sel',1,'pincée']],
    ['Hacher finement l’oignon, la carotte et le céleri. Les faire revenir 7 minutes dans l’huile.','Ajouter le bœuf et le faire dorer en l’émiettant. Incorporer le concentré, les tomates écrasées et le sel.','Couvrir à demi et laisser mijoter 1 heure à feu doux, en ajoutant un peu d’eau si nécessaire.']),
  sauce('Sauce alla norma','Avec des rigatoni.',
    [['Aubergine',1,'pièce'],['Tomates pelées en conserve',300,'g'],['Ail',1,'gousse'],['Huile d’olive',2,'c. à soupe'],['Ricotta salata',35,'g'],['Basilic',6,'feuilles']],
    ['Couper l’aubergine en petits dés. Les faire dorer dans la moitié de l’huile jusqu’à ce qu’ils soient tendres. Réserver.','Faire revenir l’ail dans le reste d’huile, ajouter les tomates écrasées et laisser réduire 15 minutes.','Incorporer les dés d’aubergine et le basilic aux pâtes et à la sauce. Râper la ricotta salata au moment de servir.']),
  sauce('Sauce aux champignons et à la crème','Avec des pappardelle.',
    [['Champignons de Paris',200,'g'],['Échalote',1,'pièce'],['Beurre',15,'g'],['Crème liquide',120,'ml'],['Persil',2,'brins'],['Poivre noir',1,'pincée']],
    ['Émincer les champignons et ciseler l’échalote. Faire revenir l’échalote dans le beurre.','Ajouter les champignons et faire sauter jusqu’à évaporation de leur eau.','Verser la crème, laisser épaissir 2 à 3 minutes et finir avec le persil et le poivre.']),
  sauce('Sauce aglio e olio','Avec des spaghettis.',
    [['Ail',3,'gousses'],['Huile d’olive',3,'c. à soupe'],['Piment séché',1,'pincée'],['Persil',2,'brins']],
    ['Émincer finement l’ail. Le faire blondir doucement avec le piment dans l’huile.','Ajouter une petite louche d’eau de cuisson des pâtes, puis les pâtes égouttées.','Remuer vivement dans la poêle pour lier l’huile et l’eau. Parsemer de persil ciselé.'])
];
