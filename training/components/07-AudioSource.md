# TOOLKIT.AudioSource — Agent Reference

> **Extends:** `TOOLKIT.ScriptComponent`  
> **Namespace:** `TOOLKIT`  
> **Role:** Unity-style audio source. Plays a single audio clip with optional 3D spatial audio. Supports both the legacy Babylon.js v1 `BABYLON.Sound` engine and the new v2 `BABYLON.StaticSound` engine. All settings come from Unity's `AudioSource` component Inspector and are stored in the node metadata.

---

## Quick-Start

```typescript
// Get the component
const audio: TOOLKIT.AudioSource = TOOLKIT.SceneManager.FindScriptComponent(
    node, "TOOLKIT.AudioSource"
);

// Play / stop
audio.play();
audio.stop();
audio.pause();
audio.setVolume(0.5);
```

---

## Auto-Play

If `playonawake = true` in the Unity Inspector, the audio source begins playback automatically in `start()` (or `ready()` after loading).

---

## Playback Methods

```typescript
// Start playback
play(
    startTime?: number,    // seconds offset to begin at
    audioOffset?: number,  // internal buffer offset
    audioLength?: number   // play only a sub-range of the clip
): void

// Pause (resumes from same position)
pause(): void

// Stop and reset position
stop(stopTime?: number): void    // optional ramp-down time in seconds

// Mute / unmute (preserves volume setting)
mute(muteTime?: number): void
unmute(unmuteTime?: number): void
```

---

## Volume / Pitch

```typescript
setVolume(volume: number, rampTime?: number): void   // [0..1], optional fade
getVolume(): number

// Pitch is set from metadata only (no runtime setter by default)
// To change pitch at runtime, access the raw sound:
audio.getSoundClip()  // BABYLON.Sound | BABYLON.StaticSound
```

---

## Status Queries

```typescript
audio.isPlaying(): boolean
audio.isPaused(): boolean
audio.isMuted(): boolean
audio.getSoundName(): string   // the audio clip asset name
audio.getSoundClip(): BABYLON.Sound | BABYLON.StaticSound  // raw engine sound
```

---

## Observable

```typescript
audio.onReadyObservable  // Observable<BABYLON.TransformNode> — fires when audio buffer is decoded
```

---

## Spatial Audio (3D Sound)

If Unity's `Spatial Blend` is set to 1 (full 3D), the sound automatically tracks the transform position. The rolloff curve from Unity is exported as a custom curve in metadata.

```typescript
// Properties set from metadata (read only at runtime):
audio.spatialBlend   // number [0..1] — 0 = 2D, 1 = 3D
audio.minDistance    // number — full volume distance
audio.maxDistance    // number — silence distance
audio.rolloffMode    // "linear" | "logarithmic" | "custom"
```

---

## Multi-Shot Audio Pattern

For weapons or footsteps that need rapid repeated playback, use multiple `AudioSource` components or clone the sound:

```typescript
protected awake(): void {
    // Get all AudioSources on this node (e.g. named "Gunshot1", "Gunshot2" etc.)
    this.shots = this.getComponents("TOOLKIT.AudioSource");
    this.shotIndex = 0;
}

protected fireGun(): void {
    const src = this.shots[this.shotIndex % this.shots.length];
    src.stop();
    src.play();
    this.shotIndex++;
}
```

---

## Background Music Pattern

```typescript
namespace TOOLKIT {
    export class MusicManager extends TOOLKIT.ScriptComponent {
        private bgm: TOOLKIT.AudioSource = null;
        private combatBgm: TOOLKIT.AudioSource = null;
        private inCombat: boolean = false;
        private crossfadeTime: number = 2.0;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.MusicManager");
        }

        protected start(): void {
            const all: TOOLKIT.AudioSource[] = this.getComponents("TOOLKIT.AudioSource");
            this.bgm       = all.find(a => a.getSoundName().includes("ambient")) ?? null;
            this.combatBgm = all.find(a => a.getSoundName().includes("combat")) ?? null;

            this.bgm?.play();

            TOOLKIT.SceneManager.EventBus.OnMessage("combat:start", () => this.enterCombat());
            TOOLKIT.SceneManager.EventBus.OnMessage("combat:end",   () => this.exitCombat());
        }

        private enterCombat(): void {
            if (this.inCombat) return;
            this.inCombat = true;
            this.bgm?.mute(this.crossfadeTime);
            this.combatBgm?.setVolume(0);
            this.combatBgm?.play();
            this.combatBgm?.setVolume(1.0, this.crossfadeTime);
        }

        private exitCombat(): void {
            if (!this.inCombat) return;
            this.inCombat = false;
            this.combatBgm?.mute(this.crossfadeTime);
            this.bgm?.unmute(this.crossfadeTime);
        }

        protected destroy(): void {
            this.bgm?.stop();
            this.combatBgm?.stop();
        }
    }
}
```

---

## Notes For AI Agents

1. **`play()` with no arguments** plays from the start of the clip at the inspector volume.
2. **`stop()` then `play()`** resets and restarts — safe to call rapidly on one-shot sounds.
3. **`pause()` then `play()`** resumes from where it paused.
4. **`setVolume(0.5, 2.0)`** fades volume to 0.5 over 2 seconds — useful for crossfades.
5. **`onReadyObservable`** — don't call `play()` until this fires if you need guaranteed buffer availability; otherwise the component queues it.
6. **`getSoundClip()`** — returns the raw `BABYLON.Sound` for advanced manipulation like connecting to Web Audio nodes.
