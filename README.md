# Crew Day Briefing — version locale sans IA, V2

Application HTML/CSS/JS pour GitHub Pages.

## Changements V2

- Suppression de toute logique d'IA.
- Suppression des alertes et affichages liés à l'avion / version cabine.
- Suppression de l'amplitude horaire dans les métriques principales.
- Synthèse locale recentrée sur :
  - départ maison ;
  - départ navette ;
  - routing ;
  - TTM à surveiller ;
  - équipage et changement équipage ;
  - météo METAR/TAF aux arrivées.
- Ajout d'un proxy météo Cloudflare Worker optionnel, sans clé API, sans IA.

## Données

L'application lit Google Calendar en lecture seule. Les noms d'équipage restent dans le navigateur. Aucun appel Claude/OpenAI.

Pour la météo, deux modes existent :

1. **Direct AviationWeather depuis le navigateur** : peut être bloqué par CORS selon navigateur/réseau.
2. **Proxy météo Cloudflare Worker** : recommandé. Le proxy reçoit uniquement un code ICAO, par exemple `LFPG`. Il ne reçoit ni calendrier, ni équipage, ni routing complet.

## Installation GitHub Pages

1. Dézipper le dossier.
2. Copier les fichiers à la racine du dépôt GitHub Pages :
   - `index.html`
   - `style.css`
   - `app.js`
   - `manifest.webmanifest`
   - `.nojekyll`
3. Activer GitHub Pages sur la branche principale.
4. Ouvrir l'URL GitHub Pages.

## Google OAuth

Dans Google Cloud :

- App type : Web application.
- Authorized JavaScript origins :
  - `https://TON-PSEUDO.github.io`
- Scope :
  - `https://www.googleapis.com/auth/calendar.events.readonly`
- Activer :
  - `Google Calendar API`
- Ajouter ton compte en Test user si l'app est en mode Testing.

Dans l'app :

- Calendar ID : `primary` ou l'adresse de l'agenda, par exemple `ferrageairfrance@gmail.com`.

## Proxy météo Cloudflare Worker

Le dossier `worker/` contient un proxy météo simple :

- `worker/weather-proxy.js`
- `worker/wrangler.toml`

### Déploiement rapide

1. Créer un compte Cloudflare si nécessaire.
2. Installer Wrangler :

```bash
npm install -g wrangler
```

3. Se connecter :

```bash
wrangler login
```

4. Depuis le dossier `worker/`, déployer :

```bash
wrangler deploy
```

5. Cloudflare donne une URL du type :

```text
https://crew-weather-proxy.xxx.workers.dev
```

6. Dans l'app, ouvrir **Paramètres** et mettre :

```text
https://crew-weather-proxy.xxx.workers.dev/weather
```

7. Enregistrer, puis cliquer sur **METAR/TAF**.

### Sécuriser CORS

Dans `worker/wrangler.toml`, remplace :

```toml
ALLOWED_ORIGIN = "*"
```

par ton origine GitHub Pages :

```toml
ALLOWED_ORIGIN = "https://alexferrage-cyber.github.io"
```

Puis redéploie :

```bash
wrangler deploy
```

## Limites

- Le décodage METAR/TAF est volontairement simple et indicatif.
- L'application ne remplace pas le briefing officiel compagnie, les NOTAM, les dossiers perfo ou les procédures.
- Le parser dépend du format des événements Google Calendar. Si CrewMobile change le format, il faudra ajuster les regex.
