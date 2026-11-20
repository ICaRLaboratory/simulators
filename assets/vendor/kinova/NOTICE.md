# Kinova Gen3 geometry

Link dimensions, frames, and CAD are derived from **Kinova Inc.**'s `GEN3_FOR_URDF_ARM_V11_MOD`, distributed with its own [Kinova copyright and redistribution terms](LICENSE.txt) in the [MathWorks reference project (pinned revision)](https://github.com/mathworks/Robotic-Arm-Impedance-Control/tree/397a9615291ab7cee6f10a6dd7186a4db769fb59/URDFFiles/GEN3_FOR_URDF_ARM_V11_MOD). The site does not redistribute or execute the MATLAB live script or Simulink models. The web controller and renderer are implemented independently.

`mesh-data.js` contains reduced indexed triangle meshes in URDF link-local coordinates (metres, positions stored in units of 10 µm). Rebuild from the pinned source with NumPy 2.5.4 and fast-simplification 0.2.0:

```
python3 scripts/build-gen3-meshes.py /path/to/URDFFiles/GEN3_FOR_URDF_ARM_V11_MOD
```

These build-time packages and the source checkout are not needed to run the site. No CAD is fetched from a third party at runtime.
