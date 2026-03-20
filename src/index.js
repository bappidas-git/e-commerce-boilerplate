import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
// import reportWebVitals from "./reportWebVitals";

// Catch any JS errors that occur before or outside React's tree
window.onerror = function (msg, src, line, col, error) {
  const el = document.getElementById("root");
  if (el && !el.hasChildNodes()) {
    el.innerHTML =
      '<div style="color:red;padding:20px;font-family:monospace;background:#1a1a2e;min-height:100vh">' +
      "<h2>JS Error (window.onerror)</h2><pre>" +
      msg +
      "\n" +
      (error ? error.stack : "") +
      "</pre></div>";
  }
};

window.addEventListener("unhandledrejection", function (event) {
  const el = document.getElementById("root");
  if (el && !el.hasChildNodes()) {
    el.innerHTML =
      '<div style="color:orange;padding:20px;font-family:monospace;background:#1a1a2e;min-height:100vh">' +
      "<h2>Unhandled Promise Rejection</h2><pre>" +
      String(event.reason) +
      "</pre></div>";
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// reportWebVitals();
