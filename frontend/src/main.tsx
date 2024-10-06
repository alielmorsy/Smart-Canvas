import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Canvas from "./canvas/canvas.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Canvas />
  </StrictMode>,
);
