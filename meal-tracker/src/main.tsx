import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
    });
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() => {
          if (!("caches" in window)) return undefined;
          return caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
        })
        .catch(() => undefined);
    });
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
