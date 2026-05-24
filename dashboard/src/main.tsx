import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import { App } from "./app/App";
import { DashboardProvider } from "./state/dashboard-context";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <DashboardProvider>
        <App />
      </DashboardProvider>
    </HashRouter>
  </React.StrictMode>
);
