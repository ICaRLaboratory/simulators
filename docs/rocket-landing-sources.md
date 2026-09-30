# Rocket landing — sources and model scope

## Existing projects inspected

### Primary related MATLAB project

**Landing a Vehicle Using Multistage Nonlinear MPC** (MathWorks) describes a planar 3-DOF disc-shaped lander with six states: horizontal position, vertical position, tilt, horizontal velocity, vertical velocity and angular velocity.[1]
The model has independent left and right thruster forces, downward gravity and no aerodynamic drag.[1]
The example uses an offline multistage nonlinear MPC planner, then a separate multistage nonlinear MPC feedback controller to follow the planned trajectory, with MATLAB and Simulink workflows.[1]
The example's center-of-mass lower bound is 10 m and its final reference is `[0;10;0;0;0;0]`; it should not be described as a point vehicle whose center reaches y=0.[1]
This is the primary related-project URL in `definition.source`.

### Comparison project

**PID Thrust Vector Control Rocket Simulator** (`fszewczyk/tvc-simulator`) is a Python mechanical orientation simulator using angular momentum and PID-controlled thrust vectoring; its README says aerodynamics are excluded.[2]
The inspected repository root showed `MomentumSimulator.py`, README and images, with no license file visible in that listing.[2]
No source code or images were copied. Its hardware-tuning and experimental-accuracy claims were not independently validated and are not adopted here. It is a conceptual comparison, not a source for the browser's landing dynamics or controller.

## Original browser implementation

This is a civil educational soft-landing model, not an MPC solver or hardware controller. The related MATLAB project's two-thruster planar structure motivates the teaching topic; all JavaScript, controller parameters, geometry and drawing are original. The browser uses cascaded horizontal-position PD, a height-scheduled vertical-velocity loop, and attitude PD. It does not implement gimbaled thrust vectoring, trajectory optimization, fuel minimization, or claim numerical equivalence with the MATLAB example.

State order is `[x,y,theta,vx,vy,omega]` in SI units. Positive x is right, positive y is up, positive theta is clockwise from upright (nose leaning right). Mass is fixed at 1 kg, inertia at 0.5 kg·m², engine half-spacing at 0.6 m, gravity at 9.81 m/s². Independent thrusts are limited to 0–12 N each. More left thrust gives positive angular acceleration:

- `xddot = (left + right) sin(theta) / mass`
- `yddot = (left + right) cos(theta) / mass - gravity`
- `thetaddot = arm (left - right) / inertia`

Bilingual model notes contain the exact controller equations, saturation allocation and gain units. Horizontal damping and attitude gains are fixed pedagogical values; sliders expose pad location, maximum descent speed, horizontal position gain, vertical velocity gain, and a grouped signed horizontal-velocity impulse. Changing the impulse slider does not apply it; each button press adds its configured value to vx. Repeated impulses accumulate; reset restores the initial state and preserves settings; terminal states ignore disturbances.

The renderer uses a fixed-scale overview and a separately labeled fixed-scale attitude detail, a rocket nose/body, two rigid landing legs, two engines and separate flame lengths proportional to actual saturated thrust. Geometry and collision calculations use the same foot points. There is no private trajectory history and drawing does not mutate simulation state.

## Contact and numerical semantics

Held-force RK4 integrates steps no larger than 0.005 s, recomputing feedback only at step boundaries. Inputs and time increments are validated. Both pre-step and post-step boundaries are checked. A curvature-bounded chronological subdivision finds first foot contact within the held-force RK4 interval, including interior crossings whose interval endpoints are both above the ground. The contact velocities are retained—not replaced with zeros to manufacture success. The model ends airborne integration at contact and does not simulate subsequent rigid-body contact or leg compression.

A contact is successful only if pad error ≤0.8 m, |vx|≤0.5 m/s, −0.8≤vy≤0.1 m/s, |theta|≤0.12 rad and |omega|≤0.3 rad/s. `state.complete` latches this success and both engines stop. Unsafe contact, tilt ≥0.85 rad, horizontal position magnitude ≥14 m, center height ≥24 m, or flight time ≥60 s latch a named failure. Already penetrated ground states cannot be relabeled successful. Post-contact kinetic energy dissipation is outside this model.

Limitations: fixed mass, ideal independent engines, exact state feedback, no atmosphere, fuel, engine dynamics, navigation errors or hardware calibration. Corner slider settings are permitted to fail explicitly; recovery is not guaranteed. Source code is for browser teaching, not operational flight software.

## Verification scope

The rocket-specific Node tests cover analytic freefall/hover, independent angular-motion quadrature for held-force integration, torque/tilt signs, actuator saturation, default contact success, retained impact speed, pre/post boundary latches, all 32 parameter corners with impulses, finite-input rejection, deterministic reset, disturbance semantics, and pure bilingual renderer topology. Full-page integration, catalog linking, preview capture and shared lifecycle tests belong to the integrating agent.

## Sources

[1] https://www.mathworks.com/help/mpc/ug/landing-rocket-with-mpc-example.html — Landing a Vehicle Using Multistage Nonlinear MPC
[2] https://github.com/fszewczyk/tvc-simulator — PID Thrust Vector Control Rocket Simulator
