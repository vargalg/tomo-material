# tomo-material

Interactive, browser-based teaching demos for **computed tomography (CT)** concepts —
from discrete projections through the Radon transform to fan-beam and helical
cone-beam scan geometry.

Every demo is a self-contained static page. No build step, no framework, no
package manager. The only third-party dependency is [three.js](https://threejs.org/)
(bundled locally in `common/`) for the 3D scene in the helical geometry demo.

**Live site:** https://vargalg.github.io/tomo-material/

## Demos

| Demo | Folder | What it shows |
| --- | --- | --- |
| **Basic projections** | [`tomo_basic/`](tomo_basic/) | Draw on an 8×8 grid and watch the horizontal and vertical projections (pixel counts per row / column) update live. The simplest possible illustration of what a projection is. |
| **Image → sinogram** | [`image-to-sinogram/`](image-to-sinogram/) | Paint or upload an image, then compute its sinogram one projection angle at a time. Sliders control the number of angles and the number of rotations. |
| **Fan-beam & helical geometry** | [`helical-and-fan-geometry/`](helical-and-fan-geometry/) | A 2D fan-beam view (field of view, focus point, projection edges) synchronised with a 3D helical cone-beam scene — source, detector arc, ray through the selected pixel, and the helical source trajectory. Drag inside the circle, scroll or drag the slider to change the angle, and orbit the 3D view with the mouse. |

## Running locally

The demos use ES modules and import maps, so they must be served over HTTP —
opening the files directly with `file://` will not work.

```sh
# from the repository root, pick whichever you have
python -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000/>.

## Repository layout

```
.
├── index.html                  landing page (links to each demo)
├── tomo_basic/                  grid projection demo
├── image-to-sinogram/           sinogram / Radon transform demo
├── helical-and-fan-geometry/    2D + 3D scan geometry demo
└── common/                      shared assets
    ├── js-r167/                 bundled three.js r167 (build + jsm examples)
    └── dist/es-module-shims.js  import-map polyfill
```

## License

Code and content in this repository are released under the [MIT License](LICENSE) —
you may reuse, modify and redistribute them, provided the copyright notice and
license text are kept in any copy or substantial portion.

The bundled copy of **three.js** in `common/js-r167/` is the work of the
three.js authors and is distributed under its own
[MIT license](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
