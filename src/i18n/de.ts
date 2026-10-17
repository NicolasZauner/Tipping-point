import type { Key } from "./en";

// Deutsche Texte. Gleiche Schlüssel wie en.ts (ein Test prüft das).
export const de: Record<Key, string> = {
  "app.eyebrow": "6 Märkte · 4 Antriebsarten · 2018 bis 2035",
  "app.title": "Tipping Point",
  "app.lead":
    "Prognostiziert Pkw-Neuzulassungen nach Antriebsart aus den Gesamtkosten gegenüber einem Verbrenner und fünf Käufergruppen mit je eigener Wechselschwelle. Claude entwirft Szenarien und erklärt Ergebnisse; das Modell rechnet jede Zahl; Sie bestätigen.",
  "app.shellNote":
    "Dies ist der Test der Build-Pipeline. Die App entsteht Bildschirm für Bildschirm.",
  "lang.toggle": "English",
  "lang.label": "Sprache",

  "runtime.heading": "Was diese Ansicht kann",
  "runtime.viewer": "Claude-Ansicht",
  "runtime.viewer.detail": "In claude.ai geöffnet statt als lokale Datei",
  "runtime.sample": "Live-KI",
  "runtime.sample.detail":
    "Szenario-Copilot und Förderregel-Leser, über Ihren eigenen Claude-Plan; fragt vor dem ersten Aufruf",
  "runtime.tools": "Seitenwerkzeuge für die KI",
  "runtime.tools.detail": "Der Copilot rechnet mit dem Modell, statt Zahlen zu raten",
  "runtime.downloads": "Downloads",
  "runtime.downloads.detail": "Annahmen-Arbeitsmappe, Szenarien und das Markt-Briefing",
  "runtime.storage": "Browserspeicher",
  "runtime.storage.detail": "Merkt sich Sprache, Darstellung und Ihre gespeicherten Szenarien",
  "runtime.worker": "Rechnen im Hintergrund",
  "runtime.worker.detail": "Monte-Carlo-Läufe in einem Web Worker, damit die Seite nie hängt",
  "state.checking": "Prüfe",
  "state.yes": "Verfügbar",
  "state.no": "Nicht hier",
  "state.fallback": "Haupt-Thread",

  "spike.heading": "Pipeline-Tests",
  "spike.worker": "Monte Carlo mit festem Seed, {draws} Ziehungen",
  "spike.workerResult": "Schätzung {estimate} gegenüber exakt {exact}, {millis} ms im {where}",
  "spike.where.worker": "Worker",
  "spike.where.main": "Haupt-Thread",
  "spike.toolsButton": "Live-KI mit Seitenwerkzeug testen",
  "spike.toolsHint":
    "Ein kurzer Aufruf über Ihren Plan. Claude muss eine Funktion der Seite aufrufen.",
  "spike.toolsRunning": "Denkt nach…",
  "spike.toolsPass": "Bestanden: Claude hat das Seitenwerkzeug genutzt und {answer} geantwortet.",
  "spike.toolsFail": "Die Antwort nutzt den Wert des Seitenwerkzeugs nicht. Antwort: {answer}",
  "spike.downloadButton": "Download testen",
  "spike.downloadHint": "Bietet eine kleine CSV-Datei zum Speichern an.",
  "spike.downloadPass": "Der Speichern-Dialog hat sich geöffnet.",
  "spike.error.not_granted":
    "Live-KI wurde für diese Seite nicht erlaubt. Sie bleibt für diesen Besuch aus.",
  "spike.error.rate_limited": "Gerade zu viele Aufrufe. Bitte in einer Minute erneut versuchen.",
  "spike.error.tools_unavailable": "Diese Ansicht kann keine Seitenwerkzeuge ausführen.",
  "spike.error.other": "Das hat nicht geklappt ({code}). Bitte später erneut versuchen.",

  "markets.heading": "Märkte",
  "market.DE": "Deutschland",
  "market.FR": "Frankreich",
  "market.ES": "Spanien",
  "market.IT": "Italien",
  "market.NL": "Niederlande",
  "market.BE": "Belgien",

  "scenarios.heading": "Sechs Demo-Szenarien",
  "scenario.S1": "Förderklippe",
  "scenario.S1.point": "Deutschland nach dem Ende des Umweltbonus im Dezember 2023",
  "scenario.S2": "Plan Auto+",
  "scenario.S2.point": "Spaniens Förderung mit Preisgrenze von 45.000 €",
  "scenario.S3": "Dienstwagen",
  "scenario.S3.point": "Belgiens Steuerregeln gegenüber der deutschen 0,25-%-Regel",
  "scenario.S4": "Preiskrieg aus China",
  "scenario.S4.point": "BEV-Preise ab 2027 15 % niedriger: wer kippt zuerst",
  "scenario.S5": "2035 abgeschwächt",
  "scenario.S5.point": "Ein 90-%-CO2-Ziel hält Plug-in-Hybride am Leben",
  "scenario.S6": "Ölschock und ETS2",
  "scenario.S6.point": "Gleiche EU-Regel, gegenteilige Wirkung in Deutschland",
};
