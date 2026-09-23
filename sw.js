const CACHE="mahjong-complete-v17";
const CORE=["./","./index.html","./style.css?v=17","./app.js?v=17","./manifest.json?v=17","./app-icon-32-v17.png","./app-icon-192-v17.png","./app-icon-512-v17.png","./title-calculator-v9.png","./title-score-table.svg","./r5m.png","./r5p.png","./r5s.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(u.pathname.endsWith(".png") && /\/tile-(?:[1-9][mps]|[1-7]z|back)\.png$/.test(u.pathname)){
    e.respondWith(fetch(e.request,{cache:"no-store"})); return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
