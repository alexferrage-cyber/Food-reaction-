/* Food Reaction Tracker — service worker
   Stratégie : RÉSEAU D'ABORD (sans cache HTTP), cache local en secours.
   -> En ligne : on va TOUJOURS chercher la toute dernière version sur le réseau
      en contournant le cache HTTP du navigateur (évite de servir un vieux fichier
      gardé par GitHub Pages pendant quelques minutes).
   -> Hors-ligne : on sert la copie mise en cache au dernier passage en ligne.
   Incrémenter le numéro de version force le nettoyage des anciens caches. */
const CACHE = "frt-shell-v17";
const SHELL = ["./", "./index.html"];

self.addEventListener("install", (e) => {
  self.skipWaiting(); // le nouveau SW prend la main sans attendre
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Ne jamais intercepter les appels IA externes (confidentialité + inutiles hors-ligne).
  if (url.hostname.endsWith("anthropic.com") || url.hostname.endsWith("openai.com") ||
      url.hostname.endsWith("googleapis.com")) return;

  // Navigations (ouverture de la page) : réseau frais d'abord, la page est
  // mise en cache sous sa propre clé "./index.html". Secours : cache.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(url.href, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match("./index.html").then((r) => r || caches.match("./"))
        )
    );
    return;
  }

  // Autres ressources même origine (ex : sw.js, futurs assets) : réseau frais,
  // mises en cache SOUS LEUR PROPRE requête (jamais sous ./index.html).
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(url.href, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
