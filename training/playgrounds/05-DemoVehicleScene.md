# DemoVehicleScene Script Component

This script loads a physics enabled sample scene and drivable vehicle. It demonstrates initializing the playground.babylon.js editor, enabling havok physics, loading interactive scene content and attaching a script component to the vehicle model.

> ## ⚠️ THE ASSETS IN THIS EXAMPLE ARE DEMO ASSETS — DO NOT SHIP THEM
>
> `openterrain.gltf` and `riggedmustang.gltf` are fixtures hosted in the shared playground repo so
> this page has something concrete to wire up. **They are here to show the WIRING, not to be the car
> and the track in a game you build.**
>
> Copy the technique: load your assets, find the script component on the vehicle node, configure it.
> Do **not** copy the two filenames into a user's project unless they explicitly asked for that car or
> that terrain. A request for a kart racer, a rally game or a hover racer is not a request for a Ford
> Mustang on a grey test map — build or source the vehicle and the track the game actually calls for.
>
> The same applies to `samplescene.gltf` in the sibling player-controller example.
>
> `StandardCarController` also ships **simulation defaults** (6-speed gearbox, Ackermann steering,
> tyre slip). For arcade or kart handling see *"Tuning toward arcade / kart handling"* in
> `13-RacingSystem` — the controller is highly tunable and usually worth keeping.

```
class Playground {
    public static async CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): Promise<BABYLON.Scene> {
        // This creates a basic Babylon Scene object (non-mesh)
        var scene = new BABYLON.Scene(engine);

        // This creates and positions a debug camera (non-mesh)
        var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
        camera.setTarget(BABYLON.Vector3.Zero());

        // This loads the demo starter assets scene
        await DemoScene.Load(scene);

        return scene;
    }
}

class DemoScene {
    private static ScriptBundleUrl:string = TOOLKIT.SceneManager.PlaygroundCdn + "default.playground.js";

    public static async Load(scene:BABYLON.Scene): Promise<void> {
        
        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // STEP 1 - Initializes the runtime and global scene properties
        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        await TOOLKIT.SceneManager.InitializePlayground(scene.getEngine(), { showDefaultLoadingScreen: true, hideLoadingUIWithEngine: false });
        globalThis.SCRIPTBUNDLE_JS = globalThis.SCRIPTBUNDLE_JS || await BABYLON.Tools.LoadScriptAsync(DemoScene.ScriptBundleUrl);
        
        // @ts-ignore - This initializes fresh physics for this scene
        globalThis.HK = await HavokPhysics();
        globalThis.HKP = new BABYLON.HavokPlugin(false);
        scene.enablePhysics(new BABYLON.Vector3(0,-9.81,0), globalThis.HKP);

        // This cleans up globals when the scene is disposed
        const cleanupGlobals = () => {
            if (globalThis["HKP"]) delete globalThis["HKP"];
            if (globalThis["HK"]) delete globalThis["HK"];
        };
        scene.onDisposeObservable.addOnce(cleanupGlobals);
        
        ////////////////////////////////////////////////////////////////////////////////////////////////////////
        // STEP 2 - The loads the open terrain & rigged mustang exported from the unity playground project
        ////////////////////////////////////////////////////////////////////////////////////////////////////////
        const openTerrain = "openterrain.gltf";
        const mustangPrefab = "riggedmustang.gltf";
        const playgroundRepo = "https://repo.babylontoolkit.com/playground/";
        const assetsManager = new BABYLON.AssetsManager(scene);
        assetsManager.addMeshTask(openTerrain, null, playgroundRepo, openTerrain);
        assetsManager.addMeshTask(mustangPrefab, null, playgroundRepo, mustangPrefab);
        await TOOLKIT.SceneManager.LoadRuntimeAssets(assetsManager, [openTerrain, mustangPrefab], ()=> {

            /////////////////////////////////////////////////////////////////////////////////////////////////////
            // STEP 3 - Setup vehicle controller componentnds
            /////////////////////////////////////////////////////////////////////////////////////////////////////
            try {
                const mustang = scene.getNodeByName("RiggedMustang") as BABYLON.TransformNode;
                if (mustang != null) {
                    const standardCarController:PROJECT.StandardCarController = TOOLKIT.SceneManager.FindScriptComponent(mustang, "PROJECT.StandardCarController");
                    if (standardCarController != null) {
                        standardCarController.topEngineSpeed = 200;
                        standardCarController.powerCoefficient = 2.0;
                    }
                    const vehicleInputController:PROJECT.VehicleInputController = TOOLKIT.SceneManager.FindScriptComponent(mustang, "PROJECT.VehicleInputController");
                    if (vehicleInputController != null) {
                        vehicleInputController.enableInput = true;
                    }
                    const vehicleCameraManager:PROJECT.VehicleCameraManager = TOOLKIT.SceneManager.FindScriptComponent(mustang, "PROJECT.VehicleCameraManager");
                    if (vehicleCameraManager != null) {
                        vehicleCameraManager.enableCamera = true;
                        vehicleCameraManager.autoAttachCamera = true;
                        vehicleCameraManager.followTarget = false;
                    }
                }
            } catch (e) {
                console.error("Failed to setup vehicle controller", e);
            } finally {
                TOOLKIT.SceneManager.HideLoadingScreen(scene.getEngine());
                TOOLKIT.SceneManager.FocusRenderCanvas(scene);
            }
        });
    }
}

export default Playground
```
