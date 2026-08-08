# Agent Training Reference (1.0.0)

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL AGENT TRAINING REFERENCES. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

This page is the front-end directory for the training examples in this repository.
Use it as the first context block when an AI agent is asked to generate or update Babylon Toolkit code.

* Always reference the `Babylon Toolkit Component Reference` at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/README.md for details regarding the script component model api.

---

## Purpose

- Route the agent quickly to the right example content.
- Keep generated code aligned with repository conventions.
- Reduce hallucination by anchoring responses to known sample patterns.

## Source Directory

- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/README.md: Root index for all examples.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/playgrounds/README.md: Playground focused examples.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/playgrounds/01-DemoRotator.md: Minimal ScriptComponent rotation pattern.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/playgrounds/02-DemoBobber.md: Parameterized ScriptComponent motion pattern.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/playgrounds/03-DemoUserInput.md: Input driven movement and optional mouse look pattern.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/playgrounds/04-DemoPlayerScene.md: Async scene load + physics + player controller WIRING pattern. Teaches the loading sequence, not a game — its scene/character are demo fixtures, never ship them.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/playgrounds/05-DemoVehicleScene.md: Async scene load + physics + vehicle controller WIRING pattern. Teaches the loading sequence, not a game — its car and terrain are demo fixtures, never ship them. For vehicle TUNING and the full racing stack use 13-RacingSystem.md.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/declarations/README.md: Declaration focused index for toolkit and project class surface.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/declarations/babylon.toolkit.d.ts: Babylon Toolkit type and API declarations.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/declarations/default.playground.d.ts: Default playground project declarations.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/projects/README.md: Project level examples.

## Quick Routing Guide

Use this lookup before generating code:

- Need a simple component lifecycle demo (`start`, `update`): use `01-DemoRotator.md`.
- Need tunable public fields and time-based animation: use `02-DemoBobber.md`.
- Need input-driven movement, configurable speed, or optional mouse look: use `03-DemoUserInput.md`.
- Need async loading, runtime initialization, physics, or character control: use `04-DemoPlayerScene.md`.
- Need async loading, runtime initialization, physics, or vehicle control: use `05-DemoVehicleScene.md` (loading pattern only — for car handling, drift, laps or AI use `13-RacingSystem.md`).
- Need to discover available classes, properties, and methods before writing code: use `training/declarations/babylon.toolkit.d.ts` and `training/declarations/default.playground.d.ts`.
- Need broad sample discovery context: start with `training/README.md` and `training/playgrounds/README.md`.

## Declaration File Discovery

- Start with declaration files when implementing new behavior against toolkit/runtime APIs.
- Glean class availability, constructor signatures, property names, and method contracts directly from `.d.ts` definitions.
- Prioritize declared camera systems, player controllers, input systems, and scene helper classes before inventing new abstractions.
- Use declarations to validate compatibility between generated code and existing Babylon Toolkit runtime surface.

---

**Use these training examples as references when generating code**