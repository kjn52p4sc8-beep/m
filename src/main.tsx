import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import "./refresh.css";
import "./simple.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import { registerPwa } from "./pwa";
if (import.meta.env.PROD)
  window.addEventListener("load", () => {
    void registerPwa().catch(() => {
      /* Settings offers retry/status without disrupting editing. */
    });
  });
