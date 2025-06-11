Hier ist die `README.md` in Markdown formatiert:

-----

# 🏗️ Traversen-Anschlag Tool 🏗️

Ein interaktives 3D-Tool zur Berechnung und Visualisierung von Längen und Winkeln bei Traversenanschlägen. Ziehen Sie die Punkte einfach in der 3D-Ansicht oder geben Sie die Koordinaten manuell ein, um sofortige Ergebnisse zu erhalten.

-----

## ✨ Features

  * **Interaktive 3D-Visualisierung:** Sehen Sie Ihre Punkte und Traversenlinien in Echtzeit in einer 3D-Umgebung.
  * **Intuitive Steuerung:** Bewegen Sie die Anker- und Anschlagpunkte direkt in der 3D-Ansicht per Drag-and-Drop.
  * **Manuelle Koordinateneingabe:** Präzise Anpassung der Punktpositionen über dedizierte X-, Y-, Z-Input-Felder.
  * **Echtzeit-Berechnungen:** Sofortige Anzeige der Längen der Traversen und relevanter Winkel (Neigungswinkel zur Vertikalen und Öffnungswinkel zwischen den Traversen).
  * **Responsives Design:** Passt sich elegant an verschiedene Bildschirmgrößen an, von Mobilgeräten bis zum Desktop.
  * **Reset-Funktion:** Setzen Sie alle Punkte jederzeit auf ihre Ausgangspositionen zurück.

-----

## 🚀 Erste Schritte

### Voraussetzungen

Stellen Sie sicher, dass Sie [Node.js](https://nodejs.org/de) und [npm](https://www.npmjs.com/) (Node Package Manager) installiert haben.

### Installation

1.  **Repository klonen (oder Projekt herunterladen):**

    ```bash
    git clone https://github.com/SDVHD/traversen-tool.git
    cd traversen-anschlag-tool
    ```

2.  **Abhängigkeiten installieren:**

    ```bash
    npm install
    ```

    Dies installiert alle notwendigen Pakete, einschließlich Three.js und Vite.

### Entwicklungsserver starten

Um das Tool lokal zu entwickeln und zu testen:

```bash
npm run dev
```

Der Entwicklungsserver startet normalerweise auf `http://localhost:5173/`. Öffnen Sie diese URL in Ihrem Browser.

### Für die Produktion bauen

Wenn Sie das Tool für den Einsatz auf einem Webserver vorbereiten möchten:

```bash
npm run build
```

Dieser Befehl erstellt einen `dist/`-Ordner mit allen optimierten und gebündelten Dateien. Der Inhalt dieses Ordners kann direkt auf einem statischen Webserver gehostet werden.

-----

## 🛠️ Technologie-Stack

  * **[Three.js](https://threejs.org/)**: Für die Erstellung der 3D-Szene und Interaktionen.
  * **[Vite](https://vitejs.dev/)**: Ein schneller und schlanker Build-Tool für moderne Webprojekte.
  * **HTML, CSS, JavaScript**: Standard-Webtechnologien für Struktur, Styling und Logik.

-----

## 🤝 Mitwirken

Dieses Projekt ist Open Source. Wenn Sie Ideen für Verbesserungen haben oder Fehler finden, zögern Sie nicht, ein Issue zu öffnen oder einen Pull Request einzureichen.

-----

## 📄 Lizenz

Dieses Projekt ist unter der **Apache Lizenz 2.0** lizenziert – siehe die [LICENSE](./LICENSE) Datei für Details.

Copyright (c) **2025** SwissDaVinci.io

-----

## Kontakt

Haben Sie Fragen oder Feedback?
SwissDaVinci – me@swissdavinci.io