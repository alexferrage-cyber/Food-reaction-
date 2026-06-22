/* Food Reaction Tracker — service worker
   Stratégie : RÉSEAU D'ABORD, cache en secours.
   -> En ligne, on récupère toujours la dernière version (pas de blocage sur une vieille copie).
   -> Hors-ligne, on sert la copie mise en cache au dernier passage en ligne.
   Pour forcer un rafraîchissement du cache après une grosse mise à jour,
   il suffit d'incrémenter le numéro de version ci-dessous. */
const CACHE = "frt-shell-v1";
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

  // Ne jamais intercepter les appels IA externes (confidentialité + ils n'ont pas de sens hors-ligne).
  if (url.hostname.endsWith("anthropic.com") || url.hostname.endsWith("openai.com")) return;

  // Page / ressources même origine : réseau d'abord, cache en secours.
  if (req.mode === "navigate" || url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match("./index.html") || caches.match("./"))
        )
    );
  }
});
