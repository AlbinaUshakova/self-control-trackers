import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import GoalAutomation from "./GoalAutomation";
import "./index.css";

const isNativePlatform = Capacitor.isNativePlatform();

document.documentElement.dataset.platform = isNativePlatform ? Capacitor.getPlatform() : "web";

if (!isNativePlatform && "serviceWorker" in navigator && (window.location.protocol === "https:" || window.location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <GoalAutomation />
  </React.StrictMode>
);
