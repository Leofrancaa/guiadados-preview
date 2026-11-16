// Service worker mínimo do app GuIA Dados (demonstração): permite instalar no celular e mostra
// uma página amigável sem internet. Não guarda dados de vendas nem respostas
// da API (tudo vem sempre do servidor).
const CACHE = "guiadados-preview-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE, "/icons/icon-192.png"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

// Notificações push (resumo do dia e alertas). O conteúdo vem do servidor.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "GuIA Dados", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Só caminhos do próprio painel.
  let url = new URL(
    String(event.notification.data?.url || "/"),
    self.location.origin,
  );
  if (url.origin !== self.location.origin)
    url = new URL("/", self.location.origin);
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const aberto = list.find(
          (c) => new URL(c.url).origin === self.location.origin && "focus" in c,
        );
        if (aberto) {
          aberto.navigate?.(url.href);
          return aberto.focus();
        }
        return self.clients.openWindow(url.href);
      }),
  );
});

// O navegador trocou ou expirou a inscrição de notificações (acontece no
// Chrome do Android, por exemplo depois de limpar dados): cria uma nova com a
// chave do servidor e avisa o painel, sem esperar o app ser aberto. Usa o
// cookie de login do próprio site; se a sessão tiver expirado, a nova
// inscrição é registrada na próxima abertura do painel.
function chaveBytes(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function renovarInscricao(event) {
  let nova = event.newSubscription || null;
  if (!nova) {
    let chave = event.oldSubscription?.options?.applicationServerKey || null;
    if (!chave) {
      const resp = await fetch("/api/push", { cache: "no-store" });
      const { publicKey } = await resp.json();
      if (!resp.ok || !publicKey) return;
      chave = chaveBytes(publicKey);
    }
    nova = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chave,
    });
  }
  await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...nova.toJSON(), silencioso: true }),
  });
  const antiga = event.oldSubscription?.endpoint;
  if (antiga && antiga !== nova.endpoint)
    await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: antiga }),
    }).catch(() => {});
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(renovarInscricao(event).catch(() => {}));
});
