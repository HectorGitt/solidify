# QA list: final polish pass

Issues found while reviewing scenes in the browser. Fix them in a polish pass once every scene is built.

- [ ] **elements/springs-welds:** the default camera frames the spring too far right, so it is partly hidden behind the panel. Re-centre the target.
- [ ] **Global:** switching scenes logs the React warning "Attempted to synchronously unmount a root while React was already rendering". It probably comes from drei `<Html>` labels or the chart unmounting during a render. Defer the unmount, or key the Stage.
- [ ] **Global:** check the default camera framing of every scene at a narrow (side panels open) and a wide viewport.
- [ ] **Global:** the first CSG build of some scenes takes about 4–5 s (cv-joints, four-stroke). Consider a progress note on the loading screen.
- [ ] **Known limitations reported by builders, to revisit if time allows:**
  - the crossed belt has no half-twist;
  - the rope winch has no 3D model;
  - Tracta is approximated as a double Hooke's joint;
  - ball-ramp grooves are not modelled;
  - the hydrostatic loop has no charge pump.
- [ ] **src/tractor:** the frame is right-handed, so +Z is the tractor's RIGHT, not its left as dims.ts says. As a result `ackermann()` gives the larger angle to the outer wheel. Fix the sign and the doc comment. Consider adding per-wheel steer/toe to TractorPose; steering/linkage currently overrides the knuckle angles itself.
- [ ] **Tractor:** the rendered track width ignores the track-width setting.
