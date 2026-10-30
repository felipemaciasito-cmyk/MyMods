# MyMods

Mes mods pour Claude Code.

## boussole-du-plan

Un panneau latéral « Plan & météo » qui montre :

- **Où on en est dans le plan** : l'étape en cours (« Étape 2 sur 3 »), une barre de progression et la liste des étapes (✓ terminée, ▶ en cours, ○ à venir), mise à jour à chaque fois que Claude crée ou coche une étape.
- **La météo du contexte** : le remplissage de la fenêtre de contexte, de ☀️ Grand soleil à 🌪️ Tempête, avec une jauge et les tokens utilisés.

La commande `/plan-meteo` rouvre le panneau.

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
