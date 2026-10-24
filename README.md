# Watch Gallery

Un petit outil personnel pour centraliser les montres repérées en ligne, au lieu de garder des dizaines d'onglets ouverts.

- **Ajout en 1 clic** depuis n'importe quel site (boutique, Chrono24, site de marque…) grâce au favori « + Ma sélection » : photo, marque, modèle, prix, référence et diamètre sont récupérés automatiquement quand le site les fournit.
- **Suivi des essayages** : case « Essayée » (avec date et lieu), puis un verdict *Coup de cœur*, *À réfléchir* ou *Écartée*, une note sur 5 et des notes personnelles.
- **Comparatif** côte à côte : prix, verdict, note et caractéristiques (diamètre, épaisseur, corne à corne, mouvement, réserve de marche, boîtier, cadran, étanchéité, bracelet). Coche « Comparer » sur quelques montres pour n'afficher qu'elles.
- Filtres (à essayer, essayées, coups de cœur, écartées), recherche et tri par prix, note ou marque.
- Fonctionne sur ordinateur et sur mobile, s'installe comme une application (PWA), et sur Android apparaît dans le menu **Partager**.

Aucun compte, aucun serveur : c'est une page web statique, sans dépendance.

## Mise en ligne (GitHub Pages, gratuit)

1. Fusionne le code dans la branche `main`.
2. Sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, choisis `main` et le dossier `/ (root)`, puis **Save**.
3. Après une minute, l'application est disponible à l'adresse `https://<ton-utilisateur>.github.io/Watch-gallery/`.

GitHub Pages gratuit nécessite un dépôt public ; seul le code est public, tes montres restent dans ton navigateur.

## Installer le bouton « + Ma sélection »

Ouvre l'application en ligne et clique sur **Bouton « 1 clic »** : les instructions pour ordinateur, iPhone et Android y sont détaillées. Sur ordinateur, il suffit de glisser le bouton dans la barre de favoris.

Ensuite, sur la page d'une montre, clique sur le favori : une petite fenêtre s'ouvre avec la montre déjà enregistrée. Corrige ou complète si besoin, puis **Enregistrer** (la fenêtre se ferme toute seule). Si la montre est déjà dans ta sélection, elle est simplement rouverte.

## Où sont stockées mes données ?

Dans le navigateur (`localStorage`), sur l'appareil utilisé. Chaque navigateur a donc sa propre sélection :

- **Sauvegarde / transfert** : menu `⋯` → *Exporter ma sélection* (fichier `.json`), puis *Importer une sélection* sur l'autre appareil. L'import fusionne sans créer de doublons.
- Vider les données de navigation du site efface la sélection : pense à exporter de temps en temps.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page et des fenêtres (édition, installation) |
| `css/style.css` | Style, thème clair / sombre, affichage mobile |
| `js/app.js` | Données, galerie, comparatif, formulaire, import / export |
| `js/bookmarklet.js` | Code du favori : lecture de la page marchande (JSON-LD, Open Graph, image principale) |
| `manifest.webmanifest`, `sw.js` | Installation comme application et fonctionnement hors ligne |

Pour tester en local : `python3 -m http.server` dans le dossier, puis ouvrir <http://localhost:8000>.
