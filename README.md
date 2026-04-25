# XNoteTouch

Eine moderne, performante Notiz-App für Desktop (Tauri + React), optimiert für Stifteingabe (z.B. Lenovo Pen) und kompatibel mit Xournal++ (.xopp).

## Features

- 🖋️ **Hochwertiges Rendering**: Druckempfindlichkeit mit Glättungs-Algorithmus für ein natürliches Schriftbild.
- 📄 **PDF-Integration**: PDF-Dokumente importieren, beschriften und exportieren.
- 層 **Ebenen-Management**: Mehrere Zeichenebenen pro Seite mit Sichtbarkeitssteuerung.
- 📑 **Multi-Page Support**: Unterstützung für beliebig viele Seiten in einem Dokument.
- ✂️ **Vektor-Lasso**: Elemente auswählen, verschieben, löschen oder als Vektor kopieren/einfügen.
- 💾 **Xournal++ Kompatibilität**: Öffnen und Speichern im .xopp Format.
- ↩️ **Undo/Redo**: Unbegrenztes Rückgängigmachen von Aktionen.
- 🚀 **Performance**: Single-Stage Rendering optimiert für flüssiges Arbeiten auch bei komplexen Skizzen.

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Canvas**: Konva.js (2D Canvas Framework)
- **Desktop**: Tauri (Rust-Backend)
- **PDF**: PDF.js (Rendering), jsPDF (Export)

## Installation & Entwicklung

### Voraussetzungen
- Node.js & npm
- Rust & Cargo (Tauri Setup)

### Dev-Server starten
```bash
npm run tauri dev
```

### Produktions-Build erstellen
```bash
npm run tauri build
```

## Status
Aktuell in Phase 16 des Implementierungsplans (PDF-Export Erweiterung).
