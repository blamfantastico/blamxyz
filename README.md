# blam.xyz

**[blam.xyz](https://blam.xyz)** — Nightlines screensaver, hosted via GitHub Pages.

A recreation of the classic Mac After Dark bouncing lines screensaver, running in the browser. Click anywhere to show controls.

## Controls

| Control | Description |
|---|---|
| Color / B&W | Switch between color and 1-bit dithered monochrome mode |
| Shapes | Number of bouncing shapes (1–6) |
| Trail | History length — how long the trail persists |
| Vertices | Number of corners per shape (2–8) |
| Gap | Trail draw step — higher = more sparse |
| Fade | How quickly old lines fade out |
| Speed | Playback speed multiplier |
| Thickness | Line thickness |
| Wander | Auto-drift speed and thickness over time |
| FPS | Frame rate cap |
| Randomize | Pick random settings |

Click the canvas to show/hide the control panel.

## Local development

Since this is a single HTML file, any static file server works. The simplest options:

```bash
# Python (built-in, no install needed)
python3 -m http.server 8080
```

```bash
# Node (if you have npx)
npx serve .
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

## Deployment

Hosted on GitHub Pages from the `main` branch. Pushes to `main` deploy automatically.

Custom domain configured via hover.com DNS with A records pointing to GitHub Pages IPs.
