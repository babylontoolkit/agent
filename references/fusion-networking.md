## Fusion Networking — Multiplayer For Babylon Toolkit Games

**IMPORTANT. THIS DOCUMENT IS THE ONLY NETWORKING REFERENCE. READ IT TO THE END BEFORE WRITING ANY MULTIPLAYER,
NETCODE, SESSION OR SERVER CODE.**

The Babylon Toolkit's networking is a port of the **Photon Fusion 2** programming model (Fusion 2.1.1) to TypeScript.
It runs on a **Colyseus 0.18** session server. Every Fusion game mode works: `Single`, `Shared`, `Host`, `Client`,
`Server` (a dedicated headless server) and `AutoHostOrClient`. The classes are in the `PROJECT` namespace and keep
Fusion's type names with camelCase members (`runner.spawn`, `fixedUpdateNetwork`, `object.hasStateAuthority`).
A Fusion, Netcode for GameObjects (NGO) or Mirror script ports by renaming (§15).

**This is the only networking code path.** The old Colyseus helpers were deleted with no compatibility layer:
`TOOLKIT.EntityController`, `SceneManager.ServerEndPoint`, `ColyseusGameServer`, `ColyseusNetworkEntity`,
`ColyseusNetworkAvatar`, `BABYLON.NetworkManager`, `RemoteCarController`, `NetworkCarPrediction`,
`VehicleNetworkLabel`, `RemotePlayerController` network attributes, and every `postNetworkAttributes` flag. Never
write code against them, and never write your own sockets, snapshot or interpolation code. Build every multiplayer
feature on the classes below.

| Read together with | For |
|---|---|
| `scene-components.md` | The `ScriptComponent` lifecycle every network behaviour inherits |
| `node-esm.md` / `classic.md` | ESM imports vs the UMD `PROJECT.*` globals |
| `unity-exporter-cli.md` | Attaching components in Unity from the terminal, exporting, the dev server |
| `unity-authoring-recipes.md` | Authoring the level and prefabs the network spawns |

---

## 1. What you can build

| Capability | How | Section |
|---|---|---|
| Single-player with the same code | `GameMode.Single` — no server, no transport | §3 |
| Peer-owned co-op / casual play | `GameMode.Shared` — each player owns and simulates its own objects; the room keeps their latest state for late joiners | §3 |
| Competitive play, a player hosts | `GameMode.Host` + `GameMode.Client` — the host is authoritative; clients predict and re-simulate | §3 |
| Quick match | `GameMode.AutoHostOrClient` — the first player hosts, the rest join as clients (atomic join-or-create) | §3 |
| Dedicated authoritative server | `GameMode.Server` in a headless Node process that loads the exported glTF scene with Havok | §11 |
| Networked state | `Networked.*` properties: int, float, bool, string, vector3, quaternion, enum, tick timer, player / object / behaviour refs, buttons, structs, arrays, linked lists, dictionaries | §6 |
| Tick-based input | An input struct, `onInput` → `getInput()` in `fixedUpdateNetwork` | §5 |
| Client-side prediction | Automatic in Host/Client and Server sessions: rewind to each snapshot and re-simulate | §2 |
| Smooth remote motion | `NetworkTransform` / `NetworkRigidbody`: linear or Hermite interpolation, extrapolation for vehicles, error correction, teleports | §8 |
| Networked physics | `NetworkRigidbody` over Havok; physics steps on the network tick | §8 |
| Networked animation | `NetworkMecanimAnimator` replicates the `TOOLKIT.Animator` parameters, states, layer weights and triggers | §8 |
| RPCs | `Rpc.define(...)` with Fusion's sources / targets rules, plus static RPCs | §7 |
| Change callbacks | `onChangedRender` on a property, or a `ChangeDetector` | §6 |
| Lag-compensated hits | `HitboxRoot` + `Hitbox`, `runner.lagCompensation.raycast` / `overlapSphere` / `overlapBox` at the shooter's view | §9 |
| Interest management | `useAreaOfInterest` objects + `runner.addPlayerAreaOfInterest` each tick; per-behaviour `replicateTo` | §9 |
| Large data transfer | `runner.sendReliableDataToPlayer` / `sendReliableDataToServer`, chunked | §9 |
| Networked scene loading | `runner.loadScene(SceneRef, LoadSceneMode.Single or Additive)` | §10 |
| Host migration | The room elects a new host; `onHostMigration` → restart with the token | §12 |
| Lobby and session list | `runner.joinSessionLobby()` → `onSessionListUpdated` | §4 |
| Join approval | `onConnectRequest(runner, request, token)` → `request.refuse()` | §4 |
| Diagnostics and bad-network testing | `NetworkStats.show(runner)` (F8 toggles) with latency, jitter and loss sliders | §13 |

Measured in the toolkit's own live tests: a client at 150 ms latency and 2 % loss drives with instant response and
no pops in normal driving; after a collision both screens agree within 3 mm; two clients on the dedicated server
agree within 2 cm; host migration completes in about 140–190 ms keeping every object and owner. A scene with no
networking runs at the same frame time and renders pixel-identical to the runtime before networking existed.

---

## 2. How it fits together

| Part | Where | What it does |
|---|---|---|
| Runtime | `PROJECT.*` in the toolkit runtime (ESM: `@babylonjs-toolkit/next/project`; UMD: `babylon.toolkit.js`) | Runner, tick loop, state, prediction, interpolation, RPCs, lag compensation, scenes, host migration |
| Session server | `@babylonjs-toolkit/server` — the Babylon Game Server (CLI `babylon-game-server`, image `ghcr.io/mackeyk24/babylon-game-server`; Colyseus 0.18.9, Node ≥ 22) | Rooms `fusion_session` (one per session name) and `fusion_lobby`; relay, Shared-mode store, host election, dedicated Server mode; opt-in TLS, auth and UDP |
| Browser client | `@colyseus/sdk` 0.18.5 | Never bundled by the toolkit: the exporter adds it to exported pages, ESM hosts import it (§4) |
| Unity authoring | The toolkit's Fusion kit, `Assets/[Fusion]` (menu **Babylon Toolkit → Content Components → Fusion**) | `NetworkSettings`, `NetworkObject`, `NetworkTransform`, `NetworkRigidbody`, `NetworkMecanimAnimator`, `HitboxRoot`, `Hitbox` |
| Exporter option | **Fusion Networking** (`NetworkLibrary`) | Adds the Colyseus client script to exported pages |

**The tick model.** The runner drives itself from `scene.onBeforeRenderObservable` (first observer), so every
network tick and `render()` happens before any ScriptComponent `update`. Each frame:

1. A client applies the newest server snapshot and re-simulates up to its predicted tick.
2. Forward ticks run at the tick rate (60 Hz default, at most 8 per frame): collect input → `beforeTick` →
   `fixedUpdateNetwork` on every behaviour (ascending network id, then behaviour order) → physics step → `afterTick`.
3. Packets go out (snapshots at the server send rate, 30 Hz; inputs or Shared state at the client send rate, 60 Hz).
4. `beforeUpdate` → `onChangedRender` callbacks → `render()` on every behaviour → transforms write their drawn
   pose → `afterUpdate`.

**Who simulates what.**

| Mode | Authority | What peers send |
|---|---|---|
| Host / Server | The host or server owns all state | The server sends each client a delta against that client's last acknowledged tick; clients send inputs |
| Client | None; predicts **everything** and re-simulates from every snapshot | Inputs (last 3 ticks per packet) plus snapshot acks |
| Shared | Each object's state authority (by default its spawner) | The owner sends its objects' full state; the room stores it for late joiners |

Objects this peer simulates authoritatively render between ticks (`localAlpha`). All others render from snapshots,
delayed by an adaptive interpolation delay (33–250 ms). A client draws remote objects on the timeline its snapshots
arrive on.

**Transport facts.** Reliable WebSocket; when the server enables UDP, unreliable frames ride WebTransport datagrams.
`RpcChannel.Unreliable` frames (snapshots, inputs, acks, unreliable RPCs) then travel as datagrams for browsers that
connect over HTTP/3 (frames over 1000 bytes stay on the reliable stream); everyone else, and every reliable frame,
uses the WebSocket, and both kinds of player share one session. Without UDP, unreliable frames are only dropped by the
network conditions simulator, in tests and from the stats overlay. The stats overlay names the active link. There are no Photon Cloud features — no regions, NAT punch-through or relay choice; every peer is relayed
by the session server.

---

## 3. Choose the game mode

| The game is… | Use |
|---|---|
| Offline only, or offline first with multiplayer later | `Single` — the same behaviours run with no server |
| Casual co-op, party game, a shared world where cheating does not matter | `Shared` |
| Competitive, physics-heavy (karts, shooters), small player counts, no server budget | `Host` / `Client`, or `AutoHostOrClient` for one-button matchmaking |
| Competitive with a trusted authority, players come and go, or the host must never be a player | `Server` (dedicated) + `Client` |

Decide this yourself from the brief and state it — only ask when the user's request leaves the authority model
genuinely open (the **asking rule** lists "multiplayer authority" as an architectural decision). Lag compensation
needs Host/Client or Server; it is not available in Shared mode, as in Fusion.

---

## 4. Set it up

### 4.1 Unity: author the networked level and prefabs

Attach the kit components from the terminal like any `EditorScriptComponent` (`unity-exporter-cli.md`), then export.

| Component (C# `BabylonToolkit.Fusion.X` → `PROJECT.X`) | Put it on | Fields (exported names) |
|---|---|---|
| `NetworkSettings` | One GameObject in the scene | `tickRate` 60, `serverSendRate` 30, `clientSendRate` 60, `physicsSimulation` (`SimulateAlways` / `SimulateForward` / `Disabled`), `lagCompensationBufferMs` 500, `interpolationDelayMinimumMs` 33, `interpolationDelayMaximumMs` 250, `prefabContainers` (exported asset-container `.gltf` files holding the network prefabs, in load order), `sceneFiles` (networked scene `.gltf` files; `SceneRef` index i is entry i), `serverUrl` (`ws://localhost:2567`) |
| `NetworkObject` | The root of every networked prefab and every networked scene-placed object | `allowStateAuthorityOverride` true, `isMasterClientObject` false, `destroyWhenStateAuthorityLeaves` false, `useAreaOfInterest` false. `prefabGuid` and `sceneObjectGuid` are filled at export |
| `NetworkTransform` | A moving object without a physics body | `interpolationTarget` (a child to draw instead of the root), `interpolationMode` (`Linear` / `Hermite`), `renderMode` (`Interpolate` / `Extrapolate`), `maxExtrapolationSeconds` 0.25, `teleportDistance` 4, `syncScale`, `syncParent` |
| `NetworkRigidbody` | An object with a Rigidbody (Havok body) | Same fields; `interpolationMode` defaults to `Hermite` |
| `NetworkMecanimAnimator` | Beside an Animator | `syncParameters`, `syncStates`, `syncLayerWeights`, `applyTiming` (all true) |
| `HitboxRoot` | The root of a hittable object | `broadRadius` 2, `offset` |
| `Hitbox` | Children of a `HitboxRoot` | `type` (`Box` / `Sphere`), `sphereRadius` 0.5, `boxExtents` (0.5, 0.5, 0.5), `offset`, `layer` |

Rules:

- **Network prefabs ship in asset containers.** Export the prefabs as an asset container and list its `.gltf` in
  `NetworkSettings.prefabContainers`. The prefab table is the set of nodes carrying a `NetworkObject` inside those
  containers, sorted by prefab GUID, so it is identical on every peer. A prefab outside a listed container cannot be
  spawned (`spawn` throws `NetworkError`, and the runner warns at start). A table mismatch between peers shuts the
  joiner down with `ShutdownReason.IncompatibleConfiguration` — re-export and reload every peer.
- **Put every network behaviour on the prefab in Unity.** An object collects its behaviours once, when it spawns,
  and its state layout is fixed from then on. Behaviours under a child that has its own `NetworkObject` belong to that
  nested object.
- **Keep spawn points, cameras and the launcher in the level**, not in the prefab.
- **Turn on the exporter's Fusion Networking option** so exported pages load the Colyseus client. On a live Editor
  (`unity-exporter-internals.md` §13):

  ```csharp
  CanvasToolsInfo.Instance.NetworkLibrary = (int)EditorNetworkLibrary.FusionNetworking;   // 0 = Disabled, 1 = FusionNetworking
  CanvasToolsInfo.SaveSettings();
  return "ok";
  ```

  It is saved as `"NetworkLibrary": 1` in `Assets/[Config]/settings.json`. Leave it off for games without networking.

### 4.2 Web app: load the Colyseus client

- **Exported pages (UMD `engine.html`)** — nothing to do once the Fusion Networking option is on: the page loads
  `scripts/colyseus.js` (global `Colyseus`).
- **ESM web apps** — install the browser client and hand it to the transport before the first `startGame`:

  ```bash
  npm install @colyseus/sdk@0.18.5
  ```
  ```typescript
  import { ColyseusTransport } from '@babylonjs-toolkit/next/project';

  /** Hands the Colyseus browser client to the toolkit transport (it is never bundled by the toolkit). */
  async function loadNetworkClient(): Promise<void> {
      ColyseusTransport.ClientModule = await import('@colyseus/sdk');
  }
  ```

  Without it, `startGame` resolves `{ ok: false }` with `"Colyseus client not loaded …"`. `Single` mode needs no
  client.
- **Imports.** ESM: every class in this document comes from `'@babylonjs-toolkit/next/project'` with no `PROJECT.`
  prefix (`import { NetworkRunner, NetworkBehaviour, Networked, GameMode } from '@babylonjs-toolkit/next/project'`).
  UMD and Unity-attached scripts: `PROJECT.NetworkRunner`, `PROJECT.Networked`, …

### 4.3 The session server

The server is the Babylon Game Server, `@babylonjs-toolkit/server` (Node ≥ 22), on npm and as a Docker image once
published. It loads the toolkit's UMD runtime, so its session rules and its dedicated runner are the same code as the
browser's. It holds no game code: never write a session server — run this one.

```bash
npx @babylonjs-toolkit/server                              # Babylon Game Server <version> listening on ws://localhost:2567
docker run -p 2567:2567 ghcr.io/mackeyk24/babylon-game-server
npx babylon-game-server init                               # config file, .env.example, Dockerfile, deployment recipes
```

Settings come from flags > `GAME_SERVER_*` environment variables > `babylon-game-server.config.(mjs|js|json)` >
defaults; the package README lists every option. Three are opt-in and **off by default**:

- **TLS** — `--tls` with `--tls-cert-file`/`--tls-key-file` (reloaded on renewal), PEM text in
  `GAME_SERVER_TLS_CERT_PEM`/`_KEY_PEM`, or `--tls-dev-cert` for local work (mkcert; refused in production). Leave it
  off when the platform edge or a proxy terminates TLS.
- **Auth** — `--auth --auth-mode shared-secret|jwt|webhook|custom` (`GAME_SERVER_AUTH_*`). Every join must carry a
  token the server verifies at matchmaking; the game passes it as `startGame({ authToken })` (§5).
- **UDP** — `--udp` (needs `--tls`): WebTransport over HTTP/3 on the same port number, UDP beside TCP. It needs the
  port open for UDP and a host that forwards inbound UDP (VMs, Kubernetes, AWS NLB with `TCP_QUIC`); Fly.io, Railway,
  Render, DigitalOcean App Platform and Heroku run WebSocket only.

It also serves `/game-server/health`, `/game-server/ready`, `/game-server/info` and `/metrics`, applies abuse limits
(`GAME_SERVER_ALLOWED_ORIGINS` for production origins, join rate, session and message caps), drains on `SIGTERM` and
scales out over Redis.

Point the game at it with `NetworkSettings.serverUrl` (authored in Unity) or `startGame({ config: { serverUrl } })`.
Keep the URL in one place in game code: `ws://localhost:2567` while developing, the user's hosted `wss://` address for
production. A `localhost` server cannot be reached by anyone else — ask the user for the hosted address before they
publish. A page served over `https` needs a `wss://` server URL.

---

## 5. Start a session — the launcher

One `NetworkRunner` per Babylon scene. A launcher is an ordinary script component in the level that creates the
runner, is its callback object (every `INetworkRunnerCallbacks` method is optional), provides input and spawns
players. ESM form:

```typescript
import { TransformNode, Scene, Quaternion } from '@babylonjs/core';
import { ScriptComponent, InputController, SceneManager } from '@babylonjs-toolkit/next';
import {
    NetworkRunner, NetworkObject, NetworkInput, NetworkButtons, Networked, PlayerRef, GameMode, StartGameArgs,
    StartGameResult, INetworkRunnerCallbacks, NetworkedStructDefinition, ShutdownReason
} from '@babylonjs-toolkit/next/project';

/** Button bits of the player input struct. */
export const BUTTON_JUMP: number = 0;
export const BUTTON_FIRE: number = 1;
/** Key codes read by the launcher. */
const KEY_SPACE: number = 32;
const KEY_F: number = 70;
const KEY_A: number = 65;
const KEY_D: number = 68;
/** Players a session accepts, and the spawn points (Spawns/Spawn0 … Spawn3) in the level. */
const SESSION_PLAYER_COUNT: number = 8;
const SPAWN_POINT_COUNT: number = 4;

/** The player input struct, as a Fusion INetworkInput. */
export interface PlayerInput {
    /** Jump and fire bits. */
    buttons: NetworkButtons;
    /** Strafe from -1 (left) to 1 (right). */
    strafe: number;
}

/** The input struct's networked fields — identical on every peer. */
export const PLAYER_INPUT_DEFINITION: NetworkedStructDefinition = { buttons: Networked.buttons(), strafe: Networked.float() };
// A dedicated server starts runners without a launcher; this is how it decodes client input.
NetworkRunner.setDefaultInputDefinition(PLAYER_INPUT_DEFINITION);

/** Starts the game's network session and spawns one avatar per player. */
export class GameLauncher extends ScriptComponent implements INetworkRunnerCallbacks {
    /** The running session, or null before start. */
    private runner: NetworkRunner = null;

    constructor(transform: TransformNode, scene: Scene, properties: any = {}, alias: string = "MY.GameLauncher") {
        super(transform, scene, properties, alias);
    }

    /** Starts a Host/Client quick match. */
    protected start(): void {
        this.startRunner({ gameMode: GameMode.AutoHostOrClient, sessionName: "arena" })
            .catch((error: unknown) => console.error("startGame threw", error));
    }

    /** Leaves the session with the scene. */
    protected destroy(): void {
        if (this.runner != null) void this.runner.shutdown();
        this.runner = null;
    }

    /**
     * Reads this tick's input (called on forward ticks of the peer that provides input).
     * @param runner The runner.
     * @param input The tick's input to fill.
     */
    public onInput(runner: NetworkRunner, input: NetworkInput): void {
        const buttons: NetworkButtons = new NetworkButtons(0)
            .set(BUTTON_JUMP, InputController.GetKeyboardInput(KEY_SPACE))
            .set(BUTTON_FIRE, InputController.GetKeyboardInput(KEY_F));
        const strafe: number = (InputController.GetKeyboardInput(KEY_D) ? 1 : 0) - (InputController.GetKeyboardInput(KEY_A) ? 1 : 0);
        const playerInput: PlayerInput = { buttons: buttons, strafe: strafe };
        input.set(playerInput);
    }

    /**
     * Spawns the joined player's avatar: the server spawns everyone's; in Shared mode each peer spawns its own.
     * @param runner The runner.
     * @param player The player who joined.
     */
    public onPlayerJoined(runner: NetworkRunner, player: PlayerRef): void {
        const spawnsOwn: boolean = runner.gameMode === GameMode.Shared && player.equals(runner.localPlayer);
        if (!runner.isServer && !spawnsOwn) return;
        const spawnPoint: TransformNode = SceneManager.FindGameObject(this.scene, "Spawns/Spawn" + ((player.playerId - 1) % SPAWN_POINT_COUNT));
        const rotation: Quaternion = (spawnPoint.rotationQuaternion != null) ? spawnPoint.rotationQuaternion.clone() : Quaternion.Identity();
        const avatar: NetworkObject = runner.spawn("PlayerAvatar", spawnPoint.position.clone(), rotation, player);
        runner.setPlayerObject(player, avatar);
    }

    /**
     * Removes a leaving player's avatar on the server.
     * @param runner The runner.
     * @param player The player who left.
     */
    public onPlayerLeft(runner: NetworkRunner, player: PlayerRef): void {
        if (!runner.isServer) return;
        const avatar: NetworkObject | null = runner.getPlayerObject(player);
        if (avatar != null) runner.despawn(avatar);
    }

    /**
     * Creates the runner with this launcher as its callback object and starts it.
     * @param args Mode, session and (after a host migration) the token and resume callback.
     */
    private async startRunner(args: StartGameArgs): Promise<void> {
        this.runner = new NetworkRunner(this.scene);
        this.runner.addCallbacks(this);
        const startArgs: StartGameArgs = Object.assign({ playerCount: SESSION_PLAYER_COUNT, inputDefinition: PLAYER_INPUT_DEFINITION }, args);
        const result: StartGameResult = await this.runner.startGame(startArgs);
        if (!result.ok) console.error("startGame failed: " + ShutdownReason[result.shutdownReason] + " " + result.errorMessage);
    }
}
SceneManager.RegisterClass("MY.GameLauncher", GameLauncher);
```

`startGame` fields (a plain object; only `gameMode` is required): `sessionName`, `playerCount` (8), `sessionProperties`,
`isOpen`, `isVisible`, `scene` (`SceneRef`), `sceneManager`, `objectProvider`, `config` (a partial
`NetworkProjectConfig` laid over `NetworkSettings`), `connectionToken` (`Uint8Array`), `authValues`, `authToken`,
`transportPreference`, `inputDefinition`, `transport`, `hostMigrationToken`, `hostMigrationResume`. Sessions are found
by name: the same `sessionName` joins the same room.

- `authToken` — the token the server verifies when it enables auth (a JWT from the game's identity provider, a shared
  secret, or a session token the auth webhook checks). It is sent with every matchmaking call, the lobby included, and
  ignored when auth is off.
- `transportPreference` — `NetworkTransportPreference.Auto` (default: WebTransport when the server offers it and the
  browser supports it, else WebSocket), `WebSocket`, or `WebTransport` (fails with `ConnectionRefused` when it cannot
  be used).

`spawn(prefab, position?, rotation?, inputAuthority?, onBeforeSpawned?, flags?)` is **synchronous** and returns the
`NetworkObject`. `prefab` is the prefab node name, its prefab GUID, its prefab id or a `NetworkObject`. Spawn on the
peer that has authority to: the server/host in Host/Client and Server sessions (clients never spawn there), each
player for its own objects in Shared mode. `NetworkSpawnFlags.DontDestroyOnLoad` keeps an object across scene loads.

Other runner members you will use: `isRunning`, `isServer`, `isClient`, `isPlayer`, `gameMode`, `localPlayer`,
`activePlayers`, `tick`, `deltaTime`, `isForward`, `isResimulation`, `getPlayerRtt(player)` (seconds),
`findObject(id)`, `getAllBehaviours(Klass)`, `exists`, `despawn`, `setPlayerObject` / `getPlayerObject` /
`tryGetPlayerObject`, `shutdown(destroyObjects = true, reason)`, static `NetworkRunner.instances`.

**Lobby and approval.** `runner.joinSessionLobby()` lists sessions through `onSessionListUpdated(runner, sessions)`
(each `SessionInfo` has `name`, `playerCount`, `maxPlayers`, `isOpen`, `isVisible`, `properties`). The host approves
joiners in `onConnectRequest(runner, request, token)`: call `request.refuse()` to turn one away; an unanswered request
is accepted. With server auth on, `request.authIdentity` is the server-verified `{ userId, claims }` (`null` when auth
is off) — trust it, never a client-sent name. There is no kick: refuse at join time.

---

## 6. Write a network behaviour

A `NetworkBehaviour` is a normal script component (`awake` / `update` still work) with networked state. **No
decorators**: networked properties are `declare` fields plus a `protected static getNetworkedProperties()`, and RPCs
come from a `protected static getRpcDefinitions()`. The runtime installs the accessors and RPC senders the first time
the class is constructed.

```typescript
import { TransformNode, Scene, PhysicsBody, Vector3 } from '@babylonjs/core';
import { SceneManager } from '@babylonjs-toolkit/next';
import {
    NetworkBehaviour, Networked, NetworkedPropertyDefinitions, RpcDefinitions, Rpc, RpcSources, RpcTargets, RpcInfo,
    TickTimer, NetworkButtons, NetworkArray, ChangeDetector, ChangeDetectorSource
} from '@babylonjs-toolkit/next/project';
import { PlayerInput, BUTTON_JUMP } from './GameLauncher';

/** Jump impulse in m/s and the jump cooldown in seconds. */
const JUMP_SPEED: number = 6;
const JUMP_COOLDOWN_SECONDS: number = 0.8;
/** Strafe speed in m/s. */
const STRAFE_SPEED: number = 5;

/** A networked player avatar: health, a score history, a jump cooldown and a name set by RPC. */
export class PlayerAvatar extends NetworkBehaviour {
    /** Health from 0 to 100; its change updates the health bar on every peer. */
    public declare health: number;
    /** The last five round scores. */
    public declare roundScores: NetworkArray<number>;
    /** Runs while the jump cools down. */
    public declare jumpTimer: TickTimer;
    /** The previous tick's buttons, so presses are detected the same way during re-simulation. */
    public declare previousButtons: NetworkButtons;
    /** The display name, at most 16 characters. */
    public declare playerName: string;
    /** Finds playerName changes once per rendered frame. */
    private changeDetector: ChangeDetector = null;

    constructor(transform: TransformNode, scene: Scene, properties: any = {}, alias: string = "MY.PlayerAvatar") {
        super(transform, scene, properties, alias);
    }

    /** Networked state ([Networked] properties). */
    protected static getNetworkedProperties(): NetworkedPropertyDefinitions {
        return {
            health: Networked.int({ defaultValue: 100, onChangedRender: "onHealthChanged" }),
            roundScores: Networked.array(Networked.int(), 5),
            jumpTimer: Networked.tickTimer(),
            previousButtons: Networked.buttons(),
            playerName: Networked.string(16),
        };
    }

    /** RPCs ([Rpc] methods): the owning player names its avatar on the state authority. */
    protected static getRpcDefinitions(): RpcDefinitions {
        return {
            rpcSetPlayerName: Rpc.define({ sources: RpcSources.InputAuthority, targets: RpcTargets.StateAuthority }, [Networked.string(16)]),
        };
    }

    /** Runs once the object is in the session (awake has already run). */
    public spawned(): void {
        this.changeDetector = this.getChangeDetector(ChangeDetectorSource.SimulationState);
        if (this.hasInputAuthority) this.rpcSetPlayerName("Player" + this.runner.localPlayer.playerId);
    }

    /** One simulation tick — runs on forward ticks and on every re-simulated tick. */
    public fixedUpdateNetwork(): void {
        const input: PlayerInput | null = this.getInput<PlayerInput>();
        if (input == null) return;
        const body: PhysicsBody = this.transform.physicsBody;
        if (body == null) return;
        const velocity: Vector3 = body.getLinearVelocity();
        velocity.x = input.strafe * STRAFE_SPEED;
        const jumpPressed: boolean = input.buttons.wasPressed(this.previousButtons, BUTTON_JUMP);
        if (jumpPressed && this.jumpTimer.expiredOrNotRunning(this.runner)) {
            velocity.y = JUMP_SPEED;
            this.jumpTimer = TickTimer.createFromSeconds(this.runner, JUMP_COOLDOWN_SECONDS);
        }
        body.setLinearVelocity(velocity);
        this.previousButtons = input.buttons;
    }

    /** Once per rendered frame, after the ticks. */
    public render(): void {
        for (const change of this.changeDetector.detectChanges(this)) {
            if (change === "playerName") this.updateNameLabel(this.playerName);
        }
    }

    /**
     * Receives the name on the state authority. Calling this.rpcSetPlayerName(name) elsewhere SENDS the RPC.
     * @param name The display name.
     * @param info Who sent it, and on which tick.
     */
    public rpcSetPlayerName(name: string, info?: RpcInfo): void {
        this.playerName = name;
    }

    /** onChangedRender callback for health. */
    public onHealthChanged(): void {
        // Update the health bar here (render-only work).
    }

    /**
     * Shows the name above the avatar.
     * @param name The display name.
     */
    private updateNameLabel(name: string): void {
        // ...
    }
}
SceneManager.RegisterClass("MY.PlayerAvatar", PlayerAvatar);
```

UMD and Unity-attached scripts use the same class inside `namespace MY { … }` with `PROJECT.`-prefixed types (the
exporter compiles Unity-attached scripts into the project bundle, `unity-exporter-cli.md` §8.2). The class name
registered with `RegisterClass` must match the `klass` the Unity component exports.

**Property factories** (each takes optional `{ defaultValue, onChangedRender, precision }`):
`Networked.int()`, `float()`, `bool()`, `string(capacity)`, `vector3()`, `quaternion()`, `enumeration()`,
`tickTimer()`, `playerRef()`, `objectRef()`, `behaviourRef()`, `buttons()`, `struct({ field: Networked.x(), … })`,
`array(element, capacity)`, `linkedList(element, capacity)`, `dictionary(key, value, capacity)`. `precision` p > 0
sends a float as a rounded integer of `value / p` (smaller packets). Collections have fixed capacity: `add` / `set`
return `false` when full; a string longer than its capacity is cut (with a warning).

**Rules that keep prediction and re-simulation correct:**

- **Only the state authority (or a predicting client) writes networked properties.** A proxy write is ignored with
  a one-time `console.warn("[Fusion] <Class>.<prop> written without state authority")`.
- **All gameplay state lives in networked properties.** Plain fields are not rewound, so a plain field changed in
  `fixedUpdateNetwork` drifts on re-simulation. Keep render-only values (labels, particles, UI) out of state and
  update them in `render()`, `onChangedRender` callbacks or a change detector.
- **Simulate in `fixedUpdateNetwork`, present in `render()`.** Never move networked objects or apply forces in
  `update()`. Read time with `this.runner.deltaTime` and `this.runner.tick`, never the frame delta.
- **Detect presses against networked previous buttons** (`wasPressed(previousButtons, bit)`), as above, so a
  re-simulated tick sees the same press as the server.
- **`getInput()` returns `null`** on peers without input for that object (proxies on a client). The server gets
  each player's input for the tick.
- **Gate one-shot effects** (sounds, spawned VFX) on `this.runner.isForward`, or move them to `onChangedRender`, so
  re-simulated ticks do not replay them. Server-only logic checks `this.runner.isServer`; `isPlayer` is false on a
  dedicated server (no screen, no GUI).
- **Hooks:** `spawned()`, `despawned(runner, hasState)`, `fixedUpdateNetwork()`, `render()`, and optional
  `playerJoined`, `playerLeft`, `afterSpawned`, `beforeTick`, `afterTick`, `beforeUpdate`, `afterUpdate`,
  `stateAuthorityChanged`, `inputAuthorityLost`. A behaviour that wants runner callbacks calls
  `this.runner.addCallbacks(this)` in `spawned()`.
- **Pooling:** a pooled instance gets `resetState()` (defaults written) before `spawned()`. To pool, subclass
  `NetworkObjectProviderDefault` and override `instantiatePrefab` / `destroyPrefabInstance`; pass it as
  `startGame({ objectProvider })`.
- **Authority and flags:** `object.hasStateAuthority`, `hasInputAuthority`, `isProxy`, `inputAuthority`,
  `stateAuthority`, `assignInputAuthority(player)`, and in Shared mode `requestStateAuthority()` /
  `releaseStateAuthority()` (the room enforces `allowStateAuthorityOverride`).
- A `SimulationBehaviour` (no networked state) also ticks with the runner; it must sit on a node with a
  `NetworkObject`.

---

## 7. RPCs

`Rpc.define({ sources, targets, invokeLocal?, channel?, hostMode?, tickAligned?, targetPlayerParameter? }, [argument definitions])`.
The method with the RPC's name is the **receiver**; calling it on a behaviour **sends**. The receiver always gets an
`RpcInfo` (`tick`, `source`, `channel`, `isInvokeLocal`) after its declared arguments.

| Intent (Fusion / NGO / Mirror) | `sources` → `targets` |
|---|---|
| Client asks the authority (`[ServerRpc]`, `[Command]`) | `RpcSources.InputAuthority` → `RpcTargets.StateAuthority` |
| Authority tells everyone (`[ClientRpc]`) | `RpcSources.StateAuthority` → `RpcTargets.All` |
| Authority tells the owner | `RpcSources.StateAuthority` → `RpcTargets.InputAuthority` |
| One player only (`[TargetRpc]`, `[RpcTarget]`) | `targetPlayerParameter: true` — the first argument is the target `PlayerRef` (not encoded) |

An RPC whose source rule fails is dropped with a warning on the sender. Static RPCs (Fusion's
`[Rpc] static void X(NetworkRunner runner, …)`) are `runner.registerStaticRpc` / `runner.invokeStaticRpc`. Prefer
networked properties for anything that must survive a late join; RPCs are one-shot events. In Host mode the host does
not relay a client's RPC on to other clients' roles — send the request to the state authority and let it set state or
send its own RPC.

---

## 8. Motion, physics and animation

- **`NetworkTransform`** replicates position, rotation (and optionally scale / parent) of a non-physics object.
  **`NetworkRigidbody`** does the same for a Havok body and takes over `TOOLKIT.RigidbodyInterpolator` for it.
  Physics runs **on the network tick** (`physicsSimulation`, default `SimulateAlways`); re-simulated ticks step physics
  without firing `step` / `fixed` hooks, so non-network scripts see each tick once.
- **`interpolationTarget`**: put the visuals on a child and name it there. The root holds the simulated pose and the
  child is drawn smoothly — attach cameras, labels and effects to the child (`networkRigidbody.interpolationTarget`),
  never to the root.
- **Interpolation** (`interpolationMode`): `Linear`, or `Hermite` (default for rigidbodies; uses replicated velocity).
  **`renderMode: Extrapolate`** predicts proxies to the present from replicated velocity (up to
  `maxExtrapolationSeconds`) — turn it on for vehicles and fast movers so remote karts are drawn where they are now.
- **Error correction** hides authoritative jumps with an offset that decays with a 0.1 s half-life; jumps past
  `teleportDistance` (4 m) or 90° snap. For a deliberate jump (respawn, portal) call `teleport(position, rotation)` on
  the `NetworkTransform` / `NetworkRigidbody` — interpolation never crosses a teleport.
- **`NetworkMecanimAnimator`** replicates the `TOOLKIT.Animator` beside it. Drive the animator on the state authority;
  call **`networkAnimator.setTrigger(name)`** instead of the animator's own `setTrigger` so proxies fire it too.
- A behaviour's `NetworkObject.renderTimeframe` is `Auto` (Local for objects this peer simulates, Remote otherwise),
  or forced `Local` / `Remote`.

---

## 9. Lag compensation, interest and reliable data

**Lag compensation** (Host/Client and Server only). The server records every `HitboxRoot` each tick for
`lagCompensationBufferMs`; each client input carries the view the player rendered. Queries run where the shooter saw
the targets:

```typescript
// In fixedUpdateNetwork: a hitscan shot, resolved on the server from this player's view.
// HitOptions, LagCompensatedHit and NetworkObject come from '@babylonjs-toolkit/next/project'.
if (this.runner.isServer && input.buttons.isSet(BUTTON_FIRE)) {
    const options: HitOptions = HitOptions.SubtickAccuracy | HitOptions.IgnoreInputAuthority;
    const hit: LagCompensatedHit | null = this.runner.lagCompensation.raycast(muzzle, forward, SHOT_RANGE, this.object.inputAuthority, options);
    if (hit != null && hit.hitbox != null) {
        const target: NetworkObject = hit.hitbox.root.object;
        // Apply damage to the target's networked health.
    }
}
```

`raycast` returns the closest `LagCompensatedHit` (`point`, `normal`, `distance`, `hitbox`, `node`, `type`) or `null`;
`raycastAll`, `overlapSphere` and `overlapBox` fill a results array and return the count. `HitOptions.IncludePhysics`
also tests Havok colliders at the current state; a `layerMask` argument filters `Hitbox.layer`. Hitboxes are boxes and
spheres (no capsules). A client may run the same query for aim previews; only the server's result is authoritative.

**Interest management.** Objects with `useAreaOfInterest` are only replicated to players whose area contains them;
all others are always relevant. Each server tick, call `runner.addPlayerAreaOfInterest(player, position, radius)`
(areas clear after every tick); `object.setPlayerAlwaysInterested(player, true)` overrides it. An object leaving a
client's interest is despawned there (`despawned(runner, false)`) and re-spawned with full state on entry; the server
raises `onObjectEnterAOI` / `onObjectExitAOI`. Override `replicateTo(player): boolean` on a behaviour to hide just
that behaviour from a player.

**Reliable data** for blobs (custom maps, replays, avatars): `runner.sendReliableDataToPlayer(player, key, bytes)` /
`sendReliableDataToServer(key, bytes)`, where `key` is a `ReliableKey` (4 numbers) and `bytes` a `Uint8Array`.
Receivers get `onReliableDataReceived` and `onReliableDataProgress`.

---

## 10. Networked scenes

List the networked scene files in `NetworkSettings.sceneFiles`. The scene authority calls
`await runner.loadScene(SceneRef.fromIndex(1), LoadSceneMode.Single)` (or `SceneRef.fromPath("level2.gltf")`); every
peer follows. A Single load disposes the current Babylon scene, loads the glTF in the same page, runs the normal
post-load steps, re-binds the runner and registers the new scene's `NetworkObject`s by their exported scene GUIDs.
`LoadSceneMode.Additive` appends into slots 1–15; `runner.unloadScene` removes one. Callbacks:
`onSceneLoadStart` / `onSceneLoadDone`. Never use `SceneChange.RequestScene` (a page reload) in a networked game — it
destroys the runner. To customise loading, subclass `NetworkSceneManagerDefault` and override the async `loadScene`.

---

## 11. Dedicated server (Server mode)

The server process can host headless `Server`-mode runners. Each loads the same exported scene the browsers load, on a
Babylon `NullEngine` with Havok and no materials or textures. Browsers join with `GameMode.Client` and the session name.

Dedicated scenes are allow-listed in the server config file; only their `sceneRoot` and `projectScripts` locations are
ever loaded:

```js
// babylon-game-server.config.mjs
export default {
    dedicated: {
        scenes: [{ name: "arena", sceneRoot: "https://cdn.example.com/arena/", sceneFile: "Level01.gltf", projectScripts: [], maxPlayers: 8, onDemand: true, idleSeconds: 60 }],
        boot: [{ sessionName: "arena-1", sceneName: "arena" }]
    }
};
```

| Starts | How |
|---|---|
| At boot | Each `dedicated.boot` entry; it never closes |
| From the admin API | `POST /game-server/admin/dedicated` `{ sceneName, sessionName }` with `Authorization: Bearer <GAME_SERVER_ADMIN_TOKEN>` |
| On demand | A `Client` join with `sessionProperties: { dedicatedScene: "arena" }` for a scene with `onDemand: true`; it closes once empty for the reconnect grace plus `idleSeconds` |

`sceneRoot` is an `http(s)://` URL or a folder on the server (the exporter's dev server while developing).
`limits.maxDedicatedSessions` (default 4) caps them per process. The legacy single-session flags still work and become
one scene plus one boot entry:

```bash
npx babylon-game-server --dedicated arena \
  --scene-root https://localhost:4444/scenes/ \
  --scene Level01.gltf
```

| Flag | Meaning | Default |
|---|---|---|
| `--dedicated <sessionName>` | Hosts a Server-mode session clients join by this name | none |
| `--scene-root <url>` | Folder URL or path the exported scene is served from | `http://localhost:8877/scenes/` |
| `--scene <file>` | Exported scene file (required with `--dedicated`) | none |
| `--project-script <url>` | Extra script bundle to load first (repeatable); the scene's own project bundle auto-loads | none |
| `--players <n>` | Most players accepted | 8 |

Requirements for code that runs on a dedicated server:

- The game's script bundle calls `NetworkRunner.setDefaultInputDefinition(...)` at load (§5) — no launcher starts the
  dedicated runner.
- A launcher that also sits in the scene must adopt the session's runner instead of starting its own: in `start()`,
  find `NetworkRunner.instances.find(runner => runner.scene === this.scene && runner.isRunning)`, `addCallbacks(this)`,
  and call `onPlayerJoined` for `runner.activePlayers` already present. Return early when `typeof window === "undefined"`.
- No DOM, GUI, audio or input on the server: guard presentation code with `this.runner.isPlayer`.

---

## 12. Host migration

In Host sessions the host uploads a full snapshot every 2 s. When the host leaves, the room elects the connected
player with the lowest player id and every remaining peer gets `onHostMigration(runner, token)`. Restart with the
token:

```typescript
// Launcher methods. Imports add HostMigrationToken and HostMigrationObject from '@babylonjs-toolkit/next/project'.
/** The host left: shut this runner down and restart as the new host or as a client. */
public onHostMigration(runner: NetworkRunner, token: HostMigrationToken): void {
    this.restartAfterHostMigration(runner, token).catch((error: unknown) => console.error("host migration failed", error));
}

/** Restarts from the token; the new host re-spawns the old host's objects (minus the old host's own). */
private async restartAfterHostMigration(oldRunner: NetworkRunner, token: HostMigrationToken): Promise<void> {
    await oldRunner.shutdown(true, ShutdownReason.HostMigration);
    await this.startRunner({
        gameMode: token.gameMode, sessionName: token.sessionName, hostMigrationToken: token,
        hostMigrationResume: (runner: NetworkRunner) => {
            for (let i = 0; i < token.getObjectCount(); i++) {
                const stored: HostMigrationObject = token.getObject(i);
                if (!stored.isSceneObject && stored.inputAuthority === token.previousHostPlayerId) continue;
                runner.spawnFromMigration(null, stored.prefabId, token, i);
            }
        }
    });
}
```

- Shut down with **`destroyObjects = true`** (not Fusion's `false`): the resume re-spawns every object from the
  snapshot, so kept objects would duplicate.
- Player ids survive the migration. Call `setPlayerObject` again for re-spawned player objects, and have
  `onPlayerJoined` skip players whose object the resume already restored.
- Scene objects take their saved state automatically. State changed in the last ≤ 2 s before the host left is lost.

---

## 13. Test and debug

- **Stats overlay:** `NetworkStats.show(runner)` (F8 toggles) shows ping, ticks, bytes, re-simulations and
  corrections, with sliders for simulated latency, jitter and loss. From code:
  `runner.transport.conditions.latencyMs / jitterMs / lossPercent`. Always test at 150 ms and 2 % loss.
- **Live check:** start the server, open the exported page in two headless browser pages with the same session name
  (one per player), drive both, and screenshot both. Compare positions numerically (`runner.findObject(id)` from
  page script) — "both screens agree" is the pass condition. Use the user's headless browser rule; never a visible
  browser the user may be playing in.
- **Unit tests without a server:** `LoopbackHub` runs several runners in one process —
  `startGame({ gameMode, transport: hub.createTransport() })` per runner on `NullEngine` scenes, then advance the hub
  and each scene's frames deterministically.
- **The kit's sample** (`Assets/[Fusion]/Samples`): the `NetworkTestBed` scene, a `NetworkSampleKart` prefab (input,
  boost, a lag-compensated zap, animator trigger, name RPC) and a launcher that reads
  `?fusionMode=&fusionSession=&fusionServer=&fusionStats=1&fusionToken=&fusionTransport=&fusionDedicatedScene=` from
  the page URL (`fusionServer` URL-encoded). Start from it when building a
  networked vehicle or character.
- **Common failures:**

| Symptom | Cause |
|---|---|
| `startGame` → `Colyseus client not loaded` | Fusion Networking option off (exported page) or `ColyseusTransport.ClientModule` not set (ESM) |
| `IncompatibleConfiguration` on join | Peers have different prefab tables — re-export and reload every page and the dedicated server |
| `spawn` throws `NetworkError` | The prefab is not in a `prefabContainers` asset container, or this peer may not spawn (a client in Host/Client) |
| `[Fusion] … written without state authority` | Gameplay code runs on a proxy — check `hasStateAuthority` / move it into `fixedUpdateNetwork` |
| Remote objects stutter | Visuals not on the `interpolationTarget` child, or code moving the object in `update()` |
| Effects play twice / jitter on a client | One-shot work in `fixedUpdateNetwork` without an `isForward` gate |
| Dedicated server ignores input | No `setDefaultInputDefinition` in the game bundle |
| `InvalidAuthentication: no token was sent` / `…: the token is not valid…` | Server auth is on: pass `startGame({ authToken })` with a token the server's auth mode accepts (check the JWT's issuer, audience and key) |
| `AuthenticationTicketExpired: the token has expired` | Fetch a fresh token from the identity provider, then start again |
| `IncompatibleConfiguration: … network protocol …` | The server and the game's runtime speak different `NETWORK_PROTOCOL_VERSION`s — update the side the message names |
| `ConnectionRefused: the origin … is not allowed` | Add the page's origin to the server's `GAME_SERVER_ALLOWED_ORIGINS` |
| `ConnectionRefused: too many join requests …` | Over the per-address join rate; behind a shared proxy set `GAME_SERVER_TRUST_PROXY`, else stop the retry loop |
| `ConnectionRefused: the game server does not offer WebTransport…` | `transportPreference: WebTransport` without server UDP (or the browser lacks WebTransport) — use `Auto` |

---

## 14. Not supported (use the alternative)

| Fusion feature | Instead |
|---|---|
| Photon Cloud: regions, NAT punch-through, cloud connection, `CustomPhotonAppSettings` | The Babylon Game Server (`serverUrl`); every peer is relayed |
| Several runners in one page (`PeerMode.Multiple`) | One runner per page; `LoopbackHub` in tests |
| Area-of-interest cell grid, gizmos | Radius areas (`addPlayerAreaOfInterest`) |
| Capsule hitboxes, BVH tuning | Box and sphere hitboxes; `broadRadius` broad phase |
| Kick, forced rejoin, master client reassignment | Refuse joiners in `onConnectRequest`; the room elects the master client |
| Send priorities, `SessionInfo.UpdateCustomProperties`, runner singletons, `SinglePlayerPause` | Every relevant changed object is sent each snapshot; set properties at `startGame`; plain fields or a scene `ScriptComponent` |
| Addressable scenes | `NetworkSettings.sceneFiles` glTF files |
| `[Networked]` / `[Rpc]` attributes, the weaver | `getNetworkedProperties()` / `getRpcDefinitions()` |

Known gaps: host migration has no timeout (if the elected host never rejoins, the room waits); at 150 ms a client's
own vehicle can jolt for a few frames during a collision before both screens agree; the stats overlay over-counts
corrections for extrapolated remote objects and its sliders do not redraw when conditions are set from code.

---

## 15. Porting Fusion, NGO and Mirror scripts

**Naming rules.** Types keep Fusion's names; members are camelCase (`Runner.Spawn` → `runner.spawn`,
`Object.HasStateAuthority` → `object.hasStateAuthority`, `Runner`/`Object` → `this.runner`/`this.object`). C# `out`
parameters become return values (`TryGetPlayerObject(p, out o)` → `const o = runner.tryGetPlayerObject(p)`, `null`
when missing). Nested types become top-level (`ChangeDetector.Source` → `ChangeDetectorSource`,
`NetworkRunnerCallbackArgs.ConnectRequest` → `NetworkConnectRequestArgs`). `Tick`, `NetworkId` and `NetworkPrefabId`
are numbers, `NetworkBool` is `boolean`, `NetworkString<_N>` is a `string` (`Networked.string(N)`); `PlayerRef`,
`SceneRef`, `TickTimer` and `NetworkButtons` stay classes. Times are seconds unless a name ends in `Ms`. `nameof(Lap)`
becomes the string `"lap"`. Positions are `BABYLON.Vector3`, rotations `BABYLON.Quaternion`.

| Fusion 2 (C#) | Toolkit |
|---|---|
| `[Networked] public int Lap { get; set; }` | `public declare lap: number;` + `lap: Networked.int()` |
| `[Networked, Capacity(5)] NetworkArray<int>` | `Networked.array(Networked.int(), 5)` → `get` / `set` / `toArray` |
| `[OnChangedRender(nameof(OnLap))]` | `Networked.int({ onChangedRender: "onLap" })` |
| `[Rpc(RpcSources.X, RpcTargets.Y)] void RPC_A(int v, RpcInfo info = default)` | `rpcA: Rpc.define({ sources: RpcSources.X, targets: RpcTargets.Y }, [Networked.int()])` + `public rpcA(v: number, info?: RpcInfo)` |
| `INetworkInput` struct, `input.Set(data)`, `GetInput(out data)` | `StartGameArgs.inputDefinition` (`Networked.struct` fields), `input.set(data)`, `this.getInput<T>()` |
| `Spawned` / `Despawned` / `FixedUpdateNetwork` / `Render` | `spawned` / `despawned` / `fixedUpdateNetwork` / `render` |
| `TickTimer.CreateFromSeconds(Runner, s)`, `.Expired(Runner)` | `TickTimer.createFromSeconds(this.runner, s)`, `.expired(this.runner)` |
| `GetChangeDetector(ChangeDetector.Source.SimulationState)` | `this.getChangeDetector(ChangeDetectorSource.SimulationState)` → `detectChanges(this)` returns names |
| `NetworkRigidbody3D.Rigidbody` | `networkRigidbody.rigidbody` (the Havok `PhysicsBody`) |
| `NetworkObjectProviderDefault` / `NetworkSceneManagerDefault` subclasses | Same classes; override `instantiatePrefab` / `destroyPrefabInstance` / async `loadScene` |
| `Runner.LagCompensation.Raycast(..., out hit, ...)` | `const hit = runner.lagCompensation.raycast(...)` |
| `RunnerSimulatePhysics3D` component | Not needed — physics steps on the tick |

| NGO / Mirror | Toolkit |
|---|---|
| `NetworkVariable<T>`, `[SyncVar]` | A networked property (`Networked.int()` …) |
| `NetworkList<T>`, `SyncList<T>`, `SyncDictionary` | `Networked.array` / `linkedList` / `dictionary` (fixed capacity) |
| `OnValueChanged`, `[SyncVar(hook)]` | `onChangedRender` or a `ChangeDetector` |
| `NetworkObject.Spawn()`, `NetworkServer.Spawn`, `SpawnWithOwnership` | `runner.spawn(prefab, position, rotation, player)` |
| `IsOwner`, `isLocalPlayer` | `hasInputAuthority` |
| `IsServer` / `IsClient` / `IsHost` | `runner.isServer` / `runner.isClient` / `isServer && isPlayer` |
| `OnNetworkSpawn`, `OnStartClient` | `spawned()` |
| `NetworkManager.StartHost / StartServer / StartClient` | `runner.startGame({ gameMode: GameMode.Host / Server / Client })` |
| `OnClientConnectedCallback` / `OnClientDisconnectCallback` | `onPlayerJoined` / `onPlayerLeft` |
| `ConnectionApprovalCallback` | `onConnectRequest` |
| `NetworkTransform`, `NetworkRigidbody`, `NetworkAnimator` | The Fusion kit components (§4.1, §8) |
| `NetworkManager.SceneManager.LoadScene`, `ServerChangeScene` | `runner.loadScene` |

Exact signatures for every class are in the toolkit typings (ESM `@babylonjs-toolkit/next/project` →
`project.d.ts`; UMD `babylon.toolkit.d.ts`). Read them before using a member this document does not show.
