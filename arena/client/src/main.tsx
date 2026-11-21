import React from "react";
import ReactDOM from "react-dom/client";
import CameraSample from "./CameraSample";
import App from "./App";
import AnimationLab from "./AnimationLab";
import "./style.css";
import "./styles/game-hud.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname === "/camera-sample" ? (
      <CameraSample />
    ) : window.location.pathname === "/animation-lab" ? (
      <AnimationLab />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
