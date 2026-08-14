import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { TelemetryToastProvider } from "./context/TelemetryToastContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TelemetryToastProvider>
          <App />
        </TelemetryToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
