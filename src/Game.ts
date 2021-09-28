import { Scene, Components } from 'trident';
import { IPhysicsConfiguration } from 'trident/dist/esm/interfaces/IPhysicsConfiguration';

import { Player } from "./character/Player";
import { WorldShifter } from "./terrain/WorldShifter";

import { Color, AmbientLight, Fog, Vector3, Renderer, MathUtils, Quaternion } from "three";
import { Sky } from 'three/examples/jsm/objects/Sky';
import { TerrainManagerTopCamera } from "./terrain/TerrainManagerTopCamera";
import { TerrainManagerViewCamera } from "./terrain/TerrainManagerViewCamera";

import { GameObject } from "trident/dist/esm/components";
import { Multiplayer } from "./multiplayer/Multiplayer";
import { DebugPlanel } from "./misc/DebugPanel";
import { TerrainUtils } from './misc/TerrainUtils';

export class Game {
    private scene: Scene;
    
    constructor(canvasId: string) {

        const positionFromUrl = this.GetCartographicFromURL();

        if (positionFromUrl) {
            this.LoadSocialUniverse(canvasId, positionFromUrl);
        }
        else {
            TerrainUtils.IPCoordinates()
            .then(coordinates => {
                
                TerrainUtils.CartographicAltitude(coordinates.latitude, coordinates.longitude)
                .then(altitude => {
                    const worldPosition = TerrainUtils.CartographicToCartesian(
                        coordinates.latitude,
                        coordinates.longitude,
                        altitude + TerrainUtils.WORLD_RADIUS + 100 // Planetoid radius plus offset
                    );
                    
                    this.LoadSocialUniverse(canvasId, worldPosition);
                })
            })
        }

        // const worldPosition = new Vector3(-2676976, -4303036, 3861103);
        // this.LoadSocialUniverse(canvasId, worldPosition);
    }

    private GetCartographicFromURL(): Vector3 {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);

        const lat = parseFloat(urlParams.get("lat"));
        const lon = parseFloat(urlParams.get("lon"));
        const altitude = parseFloat(urlParams.get("alt"));
        if (lat && lon && altitude) {
            return TerrainUtils.CartographicToCartesian(lat, lon, altitude + TerrainUtils.WORLD_RADIUS);
        }

        http://127.0.0.1:5503/dist/index.html?lat=37.30354&lon=-121.88629&alt=52.36812048498541

        return null;
    }

    private LoadSocialUniverse(canvasId: string, worldPosition: Vector3) {
        const rendererConfig = {
            containerId: canvasId,
            targetFrameRate: 60,
        }

        const physicsConfig: IPhysicsConfiguration = {
            physxWasmURL: "./physx-js-webidl.wasm.wasm",
            gravity: {x: 0, y: 0, z: 0},
            framerate: 60,
            performanceCooking: true
        }
        
        this.scene = new Scene(rendererConfig, physicsConfig);

        // Need a delay for physicsWorld/ammo to load
        this.scene.OnLoaded = () => {

            // Scene
            const scene = this.scene.GetRenderer().scene;
            scene.background = new Color(0xc7efff);
            const light = new AmbientLight(0xffffff, 1);
            this.scene.GetRenderer().scene.add(light);


            // const testGround = new Components.GameObject(this.gameObject.scene);
            // const testGroundComponent = testGround.AddComponent(TestGround) as TestGround;

            const player = new Components.GameObject(this.scene);
            const playerComponent = player.AddComponent(Player) as Player;
            playerComponent.worldPosition = worldPosition;

            const terrainManager = new Components.GameObject(this.scene);

            const terrainManagerTopCameraComponent = terrainManager.AddComponent(TerrainManagerTopCamera) as TerrainManagerTopCamera;
            terrainManagerTopCameraComponent.topCamera = playerComponent.playerCameras.topCamera;
            terrainManagerTopCameraComponent.worldPosition = playerComponent.worldPosition;


            const terrainManagerViewCameraComponent = terrainManager.AddComponent(TerrainManagerViewCamera) as TerrainManagerViewCamera;
            terrainManagerViewCameraComponent.viewCamera = this.scene.GetActiveCamera();
            terrainManagerViewCameraComponent.worldPosition = playerComponent.worldPosition;





            const worldShifter = new Components.GameObject(this.scene);
            const worldShifterComponent = worldShifter.AddComponent(WorldShifter) as WorldShifter;
            worldShifterComponent.target = playerComponent.body.transform;
            worldShifterComponent.terrainManager = terrainManager.transform;
            worldShifterComponent.player = playerComponent;
            worldShifterComponent.worldPosition = playerComponent.worldPosition;

            // Multiplayer
            const multiplayer = new GameObject(this.scene);
            const multiplayerComponent = multiplayer.AddComponent(Multiplayer) as Multiplayer;
            multiplayerComponent.terrainManagerTop = terrainManagerTopCameraComponent;
            multiplayerComponent.player = playerComponent;


            // Debug
            const debugPanelGameobject = new GameObject(this.scene);
            const debugPanelComponent = debugPanelGameobject.AddComponent(DebugPlanel) as DebugPlanel;
            debugPanelComponent.terrainManagerTop = terrainManagerTopCameraComponent;
            debugPanelComponent.terrainManagerView = terrainManagerViewCameraComponent;
            debugPanelComponent.player = playerComponent;
            debugPanelComponent.multiplayer = multiplayerComponent;

            // this.scene.EnableGizmos();

            // this.gameObject.scene.SetActiveCamera(playerComponent.playerCameras.topCamera)


            // Pretty

            // const fog = new Fog(0xc7efff, 10, 100);
            // this.gameObject.scene.GetRenderer().scene.fog = fog;

            this.scene.Start();


            // Update url with new coordinates
            setInterval(() => {
                const queryString = window.location.search;
                const urlParams = new URLSearchParams(queryString);

                const lat = playerComponent.worldPositionCarto.latitude.toFixed(5);
                const lon = playerComponent.worldPositionCarto.longitude.toFixed(5);
                const alt = (playerComponent.worldPosition.length() - TerrainUtils.WORLD_RADIUS).toFixed(5);
                
                urlParams.set("lat", lat.toString());
                urlParams.set("lon", lon.toString());
                urlParams.set("alt", alt.toString());
                
                const url = window.location.origin + window.location.pathname + "?" + urlParams.toString();
                window.history.replaceState(null, null, url);
            }, 1000);
        };
    }
}