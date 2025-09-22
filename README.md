# ZipCraft — Modrinth Pack Builder

**v1.0.0** — Génère un **ZIP** de mods à partir d’URLs **Modrinth**, filtrés par version de Minecraft et loader.  
Pensé pour **Fabric** : le site rappelle d’installer Fabric et où placer les fichiers.

Visible sur : [https://zipcraft.galagain.com/](https://zipcraft.galagain.com/)

## ✨ Fonctionnalités
- Saisie d’URLs Modrinth (une par ligne) + commentaire facultatif après l’URL
- Sélection **version Minecraft** + **loader** (fabric/forge/quilt/neoforge)
- Récupération via l’API Modrinth et **ZIP unique** des JARs
- Génération des liens `?version=…&loader=…#download`
- Aide claire : copier dans **`%APPDATA%\.minecraft\mods`** (Windows), macOS et Linux
- Petits tests unitaires des helpers (exécutables depuis l’UI)

## 🧰 Prérequis (utilisateur)
1. Télécharger et installer **Fabric** : https://fabricmc.net/use/installer/  
2. Relancer le launcher et choisir le **profil Fabric** correspondant.
3. Sur ZipCraft, générer le **ZIP** puis **copier le contenu** dans :
   - **Windows** : `%APPDATA%\.minecraft\mods` (⚠️ `%APPDATA%` pointe sur `Roaming`)
   - **macOS** : `~/Library/Application Support/minecraft/mods`
   - **Linux** : `~/.minecraft/mods`

## 🗂️ Structure

```
.
├─ index.html   # page principale
├─ styles.css   # styles
├─ app.js       # logique (ZIP, liens, tests)
└─ README.md    # ce fichier
```