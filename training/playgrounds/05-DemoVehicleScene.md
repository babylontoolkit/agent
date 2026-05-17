# DemoSampleScene Script Component

This script loads a physics enabled sample scene and playable character. It demonstrates initializing the playground.babylon.js editor, enabling havok physics, loading interactive scene content and attaching a script component to the player armature model.

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
