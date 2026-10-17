import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./ui/App";
import { useLang } from "./i18n";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
document.documentElement.lang = useLang.getState().lang;
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
