import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AnimationLab from "./AnimationLab";
import "./style.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname === "/animation-lab" ? <AnimationLab /> : <App />}
  </React.StrictMode>,
);
