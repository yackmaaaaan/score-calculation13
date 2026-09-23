const CACHE="mahjong-complete-v23";
const CORE=["./","./index.html","./style.css?v=23","./app.js?v=23","./manifest.json?v=23","./app-icon-32-v17.png","./app-icon-192-v17.png","./app-icon-512-v17.png","./title-calculator-v9.png","./title-score-table.svg","./r5m.png","./r5p.png","./r5s.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  // 分割ONNXモデルはService Workerで処理しない。
  // respondWith(fetch(...)) にすると、iOS Safariでネットワーク取得失敗時に
  // FetchEvent.respondWith / Load failed となるため、ブラウザ本来の通信へ完全に委ねる。
  if(u.origin===self.location.origin && /\/model\/tile-detector\.part\d+$/.test(u.pathname)) return;
  // 牌画像もキャッシュに固定せず通常のネットワーク処理へ委ねる。
  if(u.origin===self.location.origin && u.pathname.endsWith(".png") && /\/tile-(?:[1-9][mps]|[1-7]z|back)\.png$/.test(u.pathname)) return;
  // 外部通信はService Workerで横取りしない。
  if(u.origin!==self.location.origin) return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
