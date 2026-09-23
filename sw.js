const CACHE="mahjong-complete-v20";
const CORE=["./","./index.html","./style.css?v=20","./app.js?v=20","./manifest.json?v=20","./app-icon-32-v17.png","./app-icon-192-v17.png","./app-icon-512-v17.png","./title-calculator-v9.png","./title-score-table.svg","./r5m.png","./r5p.png","./r5s.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(u.pathname.endsWith(".png") && /\/tile-(?:[1-9][mps]|[1-7]z|back)\.png$/.test(u.pathname)){
    e.respondWith(fetch(e.request,{cache:"no-store"})); return;
  }
  e.respondWith(caches.match(e.request).then(async r=>{
    if(r) return r;
    const res=await fetch(e.request);
    if(u.pathname.endsWith('/models/tile-detector.onnx') && res.ok){
      const cache=await caches.open(CACHE);
      cache.put(e.request,res.clone()).catch(()=>{});
    }
    return res;
  }));
});
