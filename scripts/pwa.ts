import type { Plugin } from "vite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
export function pwa(): Plugin {
  return {
    name: "my-memo-pwa",
    apply: "build",
    generateBundle(_, bundle) {
      const files = [
        "/",
        "/manifest.webmanifest",
        "/icon-192.png",
        "/icon-512.png",
        "/apple-touch-icon.png",
        ...Object.keys(bundle).map((f) => "/" + f),
      ];
      const version = createHash("sha256")
        .update(
          Object.values(bundle)
            .map((v) => (v.type === "chunk" ? v.code : String(v.source)))
            .join(""),
        )
        .update(readFileSync("index.html"))
        .update(readFileSync("public/manifest.webmanifest"))
        .update(readFileSync("public/icon-192.png"))
        .update(readFileSync("public/icon-512.png"))
        .update(readFileSync("public/apple-touch-icon.png"))
        .digest("hex")
        .slice(0, 16);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const CACHE='my-memo-${version}'; const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('my-memo-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('notificationclick',event=>{if(!event.notification.tag.startsWith('my-memo-reminder:'))return;event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{const page=windows.find(w=>new URL(w.url).origin===self.location.origin);if(page)return page.focus();return self.clients.openWindow('/');}));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>response.ok?response:caches.match('/')).catch(()=>caches.match('/')));return;}
if(FILES.includes(url.pathname)){event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));}});`,
      });
    },
  };
}
