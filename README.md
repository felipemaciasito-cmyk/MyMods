# MyMods

Mes mods pour Claude Code.

## boussole-du-plan

![Aperçu des cartes Parcours du plan et Météo du contexte](docs/apercu-boussole.png)

Un panneau latéral « Plan & météo » qui montre :

- **Où on en est dans le plan** : l'étape en cours (« Étape 2 sur 3 »), une barre de progression et la liste des étapes (✓ terminée, ▶ en cours, ○ à venir), mise à jour à chaque fois que Claude crée ou coche une étape.
- **La météo du contexte** : le remplissage de la fenêtre de contexte, de ☀️ Grand soleil à 🌪️ Tempête, avec une jauge et les tokens utilisés.

Sur l'app desktop, VS Code et l'app mobile, le panneau est dessiné en deux cartes (SVG) :

- **Parcours du plan** : le nom de la tâche, « Étape 3 / 5 », une barre de progression, les étapes sur un chemin qui s'allume au fil du plan, l'étape en cours mise en avant avec ce que Claude y fait, et « Plan bouclé » à la fin.
- **Météo du contexte** : le ciel dessiné (soleil, nuages, pluie, orage, tornade), le pourcentage, les jetons, une jauge avec le trait rouge à 75 % (le moment de compacter) et la tendance des dernières mesures.

La base est sobre (graphite, gris neutres) et la couleur dit l’état : la météo passe du vert au jaune, à l’orange puis au rouge à mesure que le contexte se remplit ; dans le plan, le bleu marque l’étape en cours et le vert ce qui est fait, jusqu’à « Plan bouclé ».

Dans le terminal, le panneau reste en texte.

La commande `/plan-meteo` rouvre le panneau. Là où l'app n'affiche pas de panneau (l'app mobile), `/plan-meteo` dessine les deux cartes directement dans la conversation, et elles se mettent à jour d'elles-mêmes.

Une ligne courte à côté de la zone de saisie (par exemple `☀️ 9% · Grand soleil`) donne aussi la météo du contexte et se met à jour après chaque réponse de Claude.

Quand rien ne peut dessiner les cartes, `/plan-meteo` répond avec le plan et la météo sous forme de texte.

### Installation

À l'invite d'une session Claude Code dans un terminal :

```
/plugin install boussole-du-plan --marketplace felipemaciasito-cmyk/MyMods
```

Répondre `y` pour ajouter la marketplace, puis choisir une portée.

Depuis un shell :

```
claude plugin install boussole-du-plan --marketplace felipemaciasito-cmyk/MyMods
```

Dans l'app desktop : cliquer sur + à côté de la zone de saisie, puis Plugins, Add marketplace avec `felipemaciasito-cmyk/MyMods`, puis Add plugin.

## plan-ascii

Le plan et la fenêtre de contexte dessinés uniquement avec des caractères, pour l'app iOS où rien de graphique ne s'affiche.

Par défaut, c'est **Pégase** : un cheval ailé en art ASCII qui se colore de gauche à droite, du vert au rose, à mesure que le plan avance. En dessous :

- **Où on en est dans le plan** : « ETAPE 3 / 5 », la liste des étapes (`[x]` faite, `[>]` en cours avec ce que Claude y fait, `[ ]` à venir).
- **Le souffle du contexte** : une jauge `}====>` dans le même dégradé, qui s'allonge à mesure que la fenêtre de contexte se remplit, avec le trait `|` à 75 % (le moment de compacter), la météo (Grand soleil → Tempête) et les jetons utilisés.

```
>> ETAPE 3 / 5
[x] 1. Lire le mod existant
[x] 2. Dessiner les styles retro
[>] 3. Tester sur l iPad         <--
[ ] 4. Choisir le style

~~ SOUFFLE DU CONTEXTE ~~
}====================>   |       =-
Nuageux 63 % . 630k / 1000k jetons
```

Commandes :

- `/plan-ascii` ouvre le panneau (ou, sur l'app mobile, dessine Pégase dans la conversation et le tient à jour).
- `/plan-ascii demo` montre un plan d'exemple ; le bouton **Plan reel** revient au vrai plan.
- `/plan-ascii 1` à `5` : les autres styles (1 Console, 3 Démon, 4 Matrice, 5 Tour) ; `/plan-ascii 2` revient à Pégase.

### Installation

```
/plugin install plan-ascii --marketplace felipemaciasito-cmyk/MyMods
```
