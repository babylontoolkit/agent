# CODEWRX — 3D App Builder

AI app builders like Lovable, Bolt, Replit and Base44 proved that anyone can describe software in plain English and get working software back. The Babylon Toolkit 3D App Builder does that for **real 3D games** — because underneath the AI sits a professional, Unity-style game framework instead of a blank page.

---

## The Business Opportunity

"Vibe coding" is now a mainstream behavior: millions of non-technical people open a chat box, describe an app, and ship it. The platforms that serve them are worth billions — and every one of them builds **websites and business apps**.

Games and simulations are the largest entertainment category on earth, the most-requested "can it do…?" on every AI builder, and the category where those builders fail hardest. That failure is not a model problem. It is a **framework problem** — and we own the framework.

## Generic AI App Builders

When Lovable, Bolt, Replit and Base44 builds a website, the AI is composing mature, well-documented building blocks: HTML, CSS, React, databases. The web platform itself is the framework — that's why it works.

Ask the same AI for a game and there is no framework underneath. It must **invent your project core game mechanics from scratch, every single time**: how a character collides with the floor, how a camera follows, how animations blend, how a car's suspension behaves, how an enemy finds a path. Every generation re-derives these from first principles, differently, and badly. The result is what everyone has seen: janky physics, characters that fall through floors, demos that impress for thirty seconds and can never become a **real 3D game**.

The traditional engines don't solve this either. Unity and Unreal are real engines, but they are heavyweight native tools with installs, app stores, and licensing — not instant, not browser friendly.

## The Babylon Toolkit Framework

The Babylon Toolkit is a **professional game development framework for the web**, built on BabylonJS — the Microsoft-backed open-source 3D engine. It brings the workflow that millions of game developers already know to the platform everyone already has: **Unity-style development, browser-native delivery.**

Three things make it different in kind, not degree:

**1. Unity-style script components and lifecycle.** Game logic lives in small, reusable components attached to objects in the scene — the same mental model as Unity's MonoBehaviour, with the same lifecycle (`awake`, `start`, `update`, `destroy`). This is the most battle-tested architecture in game development, and the Toolkit implements it natively for the web.

**2. Exported interactive glTF content.** Scenes and prefabs authored in the Unity Editor export as standard glTF files that carry their **behavior with them** — physics setup, attached components, tuned properties, animation state machines. An exported car is not a 3D model of a car; it is a *drivable car*. An exported character already walks, jumps, and animates. Content stops being "art someone still has to program" and becomes **working game functionality you can ship, sell, and remix**.

**3. First-class engine systems, ready to compose.** The Toolkit ships production implementations of the systems every game needs — the same subsystem list a AAA engine ships:

| System | What you get out of the box |
|---|---|
| Character control | Physics-based character controllers — walking, jumping, slopes, stairs |
| Animation | Unity Mecanim-style state machines — blend trees, transitions, root motion |
| Physics | Havok (the engine behind countless AAA titles) — rigid bodies, joints, triggers |
| Vehicles & racing | A complete arcade racing system — suspension, gearbox, checkpoints, laps, skid marks, AI drivers |
| AI & navigation | Industry-standard pathfinding (Recast/Detour) — enemies that navigate real levels |
| Cameras | Follow cameras, first/third person rigs, split-screen, cinematic post-processing |
| Input | Keyboard, mouse, gamepad, and mobile touch joysticks |
| Audio | Spatial 3D sound and music management |
| Worlds | Terrain, water, sky, foliage, particles and effects |
| Multiplayer | Networked player and vehicle starter systems |

## Why That Makes AI Game Generation Actually Work

This is the strategic point: **an AI is only as good as what it can compose.**

On a generic platform, the AI spends its intelligence reinventing engine internals — and fails. On the Toolkit, the AI **composes proven systems** and spends its intelligence on the game itself: the fun, the levels, the look, the story. The task changes from *"build a game engine and then a game"* to *"assemble a game from working parts"* — which is exactly the kind of task today's AI is spectacular at.

We reinforce this with something no competitor has: the **Agent Reference** — documentation written *for AI agents*, not just humans. It teaches any AI the framework's real APIs, real patterns, and real examples, with a standing rule that supplied Toolkit components are first-class: **compose and tune them, never reinvent them**. The AI can't hallucinate an engine because it is handed one, with the manual.

## The 3D App Builder: Think Lovable For Games And Simulations

The CODEWRX - 3D App Builder is the hosted product that puts all of this behind a chat box at `app.codewrxai.com`:

- **Describe a game, get a game** — a real, playable 3D game running live in the browser as it's built, with the familiar chat-left / live-preview-right experience.
- **Instant distribution** — every game is a link. No install, no app store, playable on any device. Share it, put it in the public gallery, let others **remix** it.
- **Built-in art pipeline** — AI image and video generation integrated for game art, splash screens, and cinematics.
- **An asset marketplace with a difference** — because Toolkit prefabs are *interactive*, the exporter generates working functionality (a drivable car, a playable character), not raw models. Premium content drops into a project and just works.
- **Use AI generated model** - All the AI model generation tools can be used like Meshy3D, Tripo3D, etc. Simply import your AI generated content in the the Unity Exporter and export as interactive gltf content.
- **Real code, no lock-in** — every project is a genuine TypeScript codebase the user can export or sync to their own GitHub. Users own their games.
- **A credits business** — prepaid credits meter every AI text and image generation, the same proven model as the leading AI builders.

## The Moats

1. **The framework.** Years of engine engineering — physics integration, animation systems, vehicle simulation, the Unity export pipeline. This is not a weekend wrapper; it's the hard part, already built.
2. **The AI-native knowledge layer.** The Agent Reference, component documentation, declaration files, and training examples form a corpus that makes *any* frontier model competent in the Toolkit on day one — and it improves every model generation, for free.
3. **The content flywheel.** Unity Editor → interactive prefab → babylon toolkit runtime → better AI generations → more creators → more content. Creators can author sellable, working game content with tools they already own.
4. **Browser-native delivery.** The web is the only platform with zero-friction distribution on every device. Games as links is the distribution story app stores can't match.

## Who It Serves

- **Non-technical creators** — the Lovable/Bolt audience, finally able to make the thing they actually wanted to make: games and simulations
- **Game developers and studios** — the fastest path from Unity-authored content to a playable web experience; prototyping in hours instead of weeks.
- **Brands and agencies** — playable marketing, product configurators, and interactive 3D at campaign speed.
- **Educators and students** — real game development, no installs, in a school browser.

## The Bottom Line

|  | Lovable / Bolt / Base44 | **CODEWRX - 3D App Builder** |
|---|---|---|
| Builds | Websites & business apps | **Real 3D games and simulations** |
| AI composes | The web platform | **A professional game framework** |
| 3D capability | None, or raw Three.js improvisation | **BabylonJS + Havok physics + full engine systems** |
| Content | Templates & UI kits | **Interactive prefabs that ship working gameplay** |
| Output | A deployed app | **A playable, shareable, remixable game — and a real codebase** |

Everyone else lets you vibe-code an app. **We let you vibe-code a real 3D web apps and games — on a first class web game framework — and it actually plays in the browser.**
