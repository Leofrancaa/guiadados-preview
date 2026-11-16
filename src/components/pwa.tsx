"use client";

import { useEffect } from "react";

/** Registra o service worker (instalação no celular e página sem internet). */
export function Pwa() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => {});
  }, []);
  return null;
}
