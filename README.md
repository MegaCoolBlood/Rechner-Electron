# Rechner-Electron

[![CI Status](https://github.com/MegaCoolBlood/Rechner-Electron/actions/workflows/ci.yml/badge.svg)](https://github.com/MegaCoolBlood/Rechner-Electron/actions/workflows/ci.yml)

Ein moderner Taschenrechner als Electron-Desktop-Anwendung mit deutscher Lokalisierung, beliebiger Präzision und anpassbarer Oberfläche.

## Features

- ✨ **Beliebige Präzision**: Verwendet Decimal.js für exakte Berechnungen ohne Rundungsfehler
- 🇩🇪 **Deutsche Lokalisierung**: Komma als Dezimaltrennzeichen, Leerzeichen als Tausendertrennzeichen
- 🎨 **Modernes Design**: Frameless Window mit benutzerdefinierter Titelleiste
- ⌨️ **Vollständige Tastaturunterstützung**: Alle Funktionen über Tastatur bedienbar
- 📊 **Live-Ergebnis**: Vorschau des Ergebnisses während der Eingabe
- 📜 **Verlauf**: Speichert die letzten 50 Berechnungen
- 🔢 **Erweiterte Funktionen**: Potenzierung, Wurzel, Quadrat, Kehrwert, Prozent
- ✏️ **Bearbeitbare Ausdrücke**: Direkte Textbearbeitung mit Cursor-Positionierung

## Installation

1. Repository klonen:
   ```bash
   git clone https://github.com/MegaCoolBlood/Rechner-Electron.git
   cd Rechner-Electron
   ```

2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```

3. Anwendung starten:
   ```bash
   npm start
   ```

## Taschenrechner-Taste einrichten

Um die Calculator-Taste auf deiner Tastatur so zu konfigurieren, dass sie diesen Rechner startet:

### Methode 1: calc.exe Ersetzung (Empfohlen)

**Schritt 1: Launcher kompilieren**
```powershell
.\compile-launcher.ps1
```

**Schritt 2: Windows calc.exe ersetzen (als Administrator)**
```powershell
.\replace-calc-exe.ps1
```

**Schritt 3: Testen**
Drücke die Calculator-Taste → Dein Electron-Rechner startet!

**Wiederherstellung:**
```powershell
.\restore-calc-exe.ps1
```

### Alternative: Tastenkombination

1. Erstelle eine Verknüpfung zu `start-calculator.bat`
2. Rechtsklick → Eigenschaften → Tastenkombination: `Ctrl + Alt + C`

## Verwendung

### Tastaturkürzel

- **Zahlen & Operatoren**: `0-9`, `+`, `-`, `*`, `/`
- **Dezimaltrennzeichen**: `.` oder `,`
- **Potenzierung**: `^` (wird zu `**`)
- **Berechnen**: `Enter` oder `=`
- **Löschen**: `Escape` oder `Delete`
- **Rücktaste**: `Backspace`
- **Klammern**: `(` und `)`

### Intelligente Operatoren

- Automatisches Ersetzen: `5 + /` → `5 /`
- Smart Backspace: Löscht Operatoren mit Leerzeichen in einem Schritt
- Keine ungültigen Kombinationen wie `++` oder `+/`

## Technologie

- **Electron**: v39.2.7
- **Decimal.js**: v10.6.0 (Arbitrary precision arithmetic)
- **Node.js**: CommonJS modules
- **Präzision**: 50 Dezimalstellen

## Projektstruktur

```
Rechner-Electron/
├── src/
│   ├── main.js          # Electron Hauptprozess
│   ├── preload.js       # Preload Script für IPC
│   ├── index.html       # UI Struktur
│   ├── styles.css       # Styling
│   └── calculator.js    # Calculator Logik
├── package.json
├── .gitignore
├── start-calculator.bat
└── Calculator-Key Setup Scripts
    ├── compile-launcher.ps1
    ├── replace-calc-exe.ps1
    ├── restore-calc-exe.ps1
    ├── setup-calculator-key.ps1
    └── restore-windows-calculator.ps1
```

## Entwicklung

### Code-Struktur

- **Expression Parser**: Recursive descent parser für mathematische Ausdrücke
- **Token System**: Tokenizer für Zahlen, Operatoren, Klammern
- **Formatierung**: Echtzeit-Formatierung mit Cursor-Erhaltung
- **History Management**: FIFO-Speicher mit 50-Item-Limit

### Änderungen committen

```bash
git add .
git commit -m "Deine Nachricht"
git push origin main
```

## Lizenz

Dieses Projekt ist Open Source.

## Autor

MegaCoolBlood
