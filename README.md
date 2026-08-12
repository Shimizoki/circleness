# Circleness

Circleness is a small web app that grades how circular a drawn shape is. You draw on a full-viewport canvas around a center crosshair, submit, and compare several independent metrics — each with its own visualization.

Scores are on a **0–1** scale (higher = more circle-like). Click a metric on the results screen to see how that grader “sees” your shape.

## How to use

1. **Draw** a single continuous stroke around the center crosshair. A new press starts a fresh drawing (disconnected strokes are not supported).
2. **Submit** to grade the shape.
3. On the results screen, **select a metric** to inspect its overlay and supporting chart.
4. Use **Test shape** to swap in a built-in reference shape, or return to your submitted drawing.
5. **Try again** to clear and draw a new shape.

### Import / export

Use **Import / export** on the drawing screen to share shapes as JSON.

- Coordinates are centered at **(0, 0)** (the canvas crosshair).
- Shapes are scaled so the **max radius ≈ 1**.
- Paste a document like `{ "points": [{ "x": 1, "y": 0 }, ...] }` (or a bare point array), then **Load onto canvas**.
- **From drawing** / **Copy** exports your current stroke in the same format.

### Built-in shapes

Reference shapes live as JSON under [`public/shapes/`](public/shapes/). The app loads [`public/shapes/index.json`](public/shapes/index.json) at runtime — add or edit files there and refresh; no shape-code rebuild is required.

### Graders

Each grader scores the **same drawing** independently (0–1). They answer different questions about “circle-ness,” so a shape can look strong on one metric and weak on another.

#### Radial distance

**What it measures:** How steady the distance is from the **canvas center** (the crosshair) out to the stroke.

**In plain terms:** Imagine spokes from the crosshair to every point on your outline. On a perfect circle centered on that crosshair, every spoke is the same length. This grader checks how much those lengths wobble. An off-center circle, or a circle drawn around a different spot, scores poorly even if the shape itself is round.

#### Centroid radial

**What it measures:** The same “steady radius” idea, but from the shape’s **mass centroid** (the balance point of the filled area), not the crosshair.

**In plain terms:** First find where the “bulk” of the shape sits — a long thin tail barely moves that point — then ask whether the outline stays a fixed distance from *there*. A tadpole can look bad under Radial distance (crosshair in the wrong place) but better here, because the head’s center of mass is a fairer origin.

#### Curvature

**What it measures:** Whether the outline turns at a **steady angular rate** around the mass centroid — like walking once around a circle at constant speed.

**In plain terms:** On a circle, as you travel along the edge, the direction toward the center changes smoothly and evenly. This grader watches that turning rate (`dθ/ds`). Bumps, corners, and straight stretches make the rate jump around. Shapes that wind one way and then unwind the other (like a thick letter **C**) can score near zero: the turns cancel out, so it doesn’t behave like one full loop around a center.

#### Circumcircle area

**What it measures:** `area(shape) / area(smallest enclosing circle)`.

**In plain terms:** Draw the smallest circle that can fully wrap your shape (the circumcircle). A true circle fills that wrapper completely (score → 1). Spiky or skinny shapes leave a lot of empty space inside the wrapper, so the ratio drops.

#### Inscribed circle area

**What it measures:** `area(largest inside circle) / area(shape)`.

**In plain terms:** Fit the biggest circle that still fits **inside** your shape. A true circle matches that inner circle exactly. Dent-heavy or star-like shapes have a small “safe” inner circle compared with their total area, so the score falls.

#### Isoperimetric

**What it measures:** The classical **isoperimetric quotient** `4πA / P²`, where `A` is area and `P` is perimeter.

**In plain terms:** Among all shapes with a given perimeter, the **circle encloses the most area** — or equivalently, for a given area, the circle has the shortest outline. This grader computes that area-to-perimeter efficiency for your shape and compares it to a circle’s perfect ratio (which equals 1). A star or a wiggly outline has lots of perimeter for little area, so the score is low. Visually, it compares your perimeter to the perimeter of a circle with the **same area**; the score is `(P○ / P)²`.

## Development

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Extending

- **Graders** — add a module under `src/grading/`, register it in `src/grading/index.ts`. Scores appear on submit automatically.
- **Shapes** — drop a JSON file in `public/shapes/` (normalized `points`, optional `id` / `label`) and list it in `public/shapes/index.json`.
