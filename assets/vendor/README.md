# Three.js vendor

- Package: `three@0.187.0` (MIT).
- Source: https://registry.npmjs.org/three/-/three-0.187.0.tgz
- `three.js` exports Three.js and its official `OrbitControls` addon as one local ES module.
- Build: `esbuild@0.28.2`, ES2022, minified, ASCII output; upstream license is preserved in `THREE-LICENSE.txt`.
- Package integrity and output SHA-256 are recorded in `three-manifest.json`.
- No runtime CDN requests or build step are required. Only experiment pages import the renderer.

Regenerate from an external development directory, not by installing dependencies into the published tree:

```bash
npm install --prefix "$THREE_DEPS" --no-save --package-lock=false --ignore-scripts --no-audit --no-fund three@0.187.0 esbuild@0.28.2
THREE_DEPS="$THREE_DEPS" node scripts/vendor-three.mjs
```

The laboratory homepage keeps the same files and uses `tools/vendor-three.mjs` instead. When changing the pinned version, update both scripts, regenerate both bundles, verify matching SHA-256 values, and run the actual WebGL/fallback tests in both repositories. The vendored library is not a physics engine; model equations and integration remain in the existing simulator modules.
