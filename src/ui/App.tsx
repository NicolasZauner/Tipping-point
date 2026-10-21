import { useState } from "react";
import { useLang, useT, type Key } from "../i18n";
import { TraceDrawer } from "./ai/TraceDrawer";
import { ChecksScreen } from "./ChecksScreen";
import { MapperScreen } from "./mapper/MapperScreen";

const SCREENS = ["mapper", "checks"] as const;
type Screen = (typeof SCREENS)[number];

export function App() {
  const t = useT();
  const { lang, setLang } = useLang();
  const [screen, setScreen] = useState<Screen>("mapper");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="mono text-xs tracking-wide text-muted uppercase">{t("app.eyebrow")}</div>
          <div className="flex items-center gap-2">
            <TraceDrawer />
            <button
              type="button"
              id="lang-toggle"
              onClick={() => setLang(lang === "en" ? "de" : "en")}
              className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-fg"
            >
              <span className="sr-only">{t("lang.label")}: </span>
              {t("lang.toggle")}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="text-xl font-semibold tracking-tight">{t("app.title")}</div>
          <nav aria-label={t("nav.label")} className="flex gap-1 rounded-lg border border-line p-1">
            {SCREENS.map((s) => (
              <button
                key={s}
                type="button"
                id={`nav-${s}`}
                aria-current={screen === s ? "page" : undefined}
                onClick={() => setScreen(s)}
                className={`rounded-md px-3 py-1 text-sm ${screen === s ? "bg-surface-2 font-medium" : "text-muted hover:text-fg"}`}
              >
                {t(`nav.${s}` as Key)}
              </button>
            ))}
          </nav>
        </div>
        <p className="max-w-prose text-sm text-muted">{t("app.lead")}</p>
      </header>
      {screen === "mapper" ? <MapperScreen /> : <ChecksScreen />}
    </main>
  );
}
