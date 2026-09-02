import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";

const isNativePlatform = Capacitor.isNativePlatform();

document.documentElement.dataset.platform = isNativePlatform ? Capacitor.getPlatform() : "web";

if (!isNativePlatform && "serviceWorker" in navigator && (window.location.protocol === "https:" || window.location.hostname === "localhost")) {
  let isReloadingForServiceWorker = false;

  const activateWaitingWorker = (worker: ServiceWorker | null | undefined) => {
    worker?.postMessage({ type: "SKIP_WAITING" });
  };

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then((registration) => {
        const refreshRegistration = () => registration.update().catch(() => undefined);

        refreshRegistration();
        activateWaitingWorker(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const nextWorker = registration.installing;
          if (!nextWorker) return;

          nextWorker.addEventListener("statechange", () => {
            if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
              activateWaitingWorker(nextWorker);
            }
          });
        });

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            refreshRegistration();
          }
        });
      })
      .catch(() => undefined);
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isReloadingForServiceWorker) return;
    isReloadingForServiceWorker = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
