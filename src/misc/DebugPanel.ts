import { Component } from "trident/dist/esm/components";

import { FolderApi, Pane } from 'tweakpane';
import { TerrainManagerTopCamera } from "../terrain/TerrainManagerTopCamera";
import { TerrainManagerViewCamera } from "../terrain/TerrainManagerViewCamera";
import { Player } from "../character/Player";
import { Multiplayer } from "../multiplayer/Multiplayer";
import { Renderer } from "trident/dist/esm/Renderer";
import { TerrainUtils } from "./TerrainUtils";

// TODO: ADD terrain manager gameobject position
interface PaneParams {
    RENDER: {
        fps: number;
        frameTime: number;
        objects: number;
    },
    TERRAINTOP: {
        position: {x: number, y: number, z: number};
        nodes: number;
        loadedNodes: number;
        colliders: number;
    },
    TERRAINVIEW: {
        position: {x: number, y: number, z: number};
        nodes: number;
        loadedNodes: number;
    },
    PLAYER: {
        worldPositionCarto: string;
        worldPosition: {x: number, y: number, z: number};
        localPosition: {x: number, y: number, z: number};
        state: number;
        noClip: boolean;
    },
    MULTIPLAYER: {
        id: string;
        currentOctant: string;
        mqttConnected: boolean;
        peerJSConnected: boolean;
        rtcConnections: number;
        npcs: number;
    }
}

export class DebugPlanel extends Component {
    public terrainManagerTop: TerrainManagerTopCamera;
    public terrainManagerView: TerrainManagerViewCamera;
    public player: Player;
    public multiplayer: Multiplayer;
    
    private pane: Pane;
    private rendererScene: Renderer;

    private previousFrameTime = 0;

    private paneParams: PaneParams = {
        RENDER: {
            fps: 0,
            frameTime: 0,
            objects: 0
        },
        TERRAINTOP: {
            position: {x: 0, y: 0, z: 0},
            nodes: 0,
            loadedNodes: 0,
            colliders: 0
        },
        TERRAINVIEW: {
            position: {x: 0, y: 0, z: 0},
            nodes: 0,
            loadedNodes: 0,
        },
        PLAYER: {
            worldPositionCarto: "",
            worldPosition: {x: 0, y: 0, z: 0},
            localPosition: {x: 0, y: 0, z: 0},
            state: 0,
            noClip: false
        },
        MULTIPLAYER: {
            id: "",
            currentOctant: "",
            mqttConnected: false,
            peerJSConnected: false,
            rtcConnections: 0,
            npcs: 0
        }
    }
    
    public Start() {
        if (!this.terrainManagerTop) return console.error("TerrainManagerTop not set");
        if (!this.terrainManagerView) return console.error("TerrainManagerView not set");
        if (!this.player) return console.error("Player not set");
        if (!this.multiplayer) return console.error("Multiplayer not set");

        this.rendererScene = this.gameObject.scene.GetRenderer();

        const pane = new Pane({
            title: "Debug Panel",
            expanded: false
        });

        // Render
        const renderFolder = pane.addFolder({ title: 'Render', expanded: true});
        this.AddInputsToFolder(renderFolder, this.paneParams.RENDER);

        // TerrainTop
        const terrainTopFolder = pane.addFolder({ title: 'Terrain Top', expanded: true});
        this.AddInputsToFolder(terrainTopFolder, this.paneParams.TERRAINTOP);

        // TerrainView
        const terrainViewFolder = pane.addFolder({ title: 'Terrain View', expanded: true});
        this.AddInputsToFolder(terrainViewFolder, this.paneParams.TERRAINVIEW);

        // Player
        const playerFolder = pane.addFolder({ title: 'Player', expanded: true});
        this.AddInputsToFolder(playerFolder, this.paneParams.PLAYER);

        // Multiplayer
        const multiplayerFolder = pane.addFolder({ title: 'Multiplayer', expanded: true});
        this.AddInputsToFolder(multiplayerFolder, this.paneParams.MULTIPLAYER);

        this.pane = pane;


        // // @ts-ignore
        // const paneDfwv: HTMLDivElement = pane.containerElem_;

        // paneDfwv.style.overflow = "scroll";
        // paneDfwv.style.bottom = "0";

        setInterval(() => {
            this.RefreshPaneParams();
        }, 500);
    }

    private AddInputsToFolder(folder: FolderApi, params: object) {
        const keys = Object.keys(params);

        for (let key of keys) {
            folder.addInput(params, key);
        }
    }

    private RefreshPaneParams() {
        if (!this.pane.expanded) return;

        // Render
        let objectCount = 0
        this.rendererScene.scene.traverse(child => {
            objectCount++;
        })
        this.paneParams.RENDER.objects = objectCount;

        // TerrainTop
        this.paneParams.TERRAINTOP.position = this.player.playerCameras.topCamera.transform.position;
        this.paneParams.TERRAINTOP.nodes = this.terrainManagerTop.GetCurrentNodeCount();
        this.paneParams.TERRAINTOP.loadedNodes = this.terrainManagerTop.GetLoadedNodeCount();
        this.paneParams.TERRAINTOP.colliders = this.terrainManagerTop.GetColliderCount();

        // TerrainView
        this.paneParams.TERRAINVIEW.position = this.player.playerCameras.viewCamera.transform.position;
        this.paneParams.TERRAINVIEW.nodes = this.terrainManagerView.GetCurrentNodeCount();
        this.paneParams.TERRAINVIEW.loadedNodes = this.terrainManagerView.GetLoadedNodeCount();

        // Player
        this.paneParams.PLAYER.worldPositionCarto = this.player.worldPositionCarto.latitude.toFixed(5) + "," + this.player.worldPositionCarto.longitude.toFixed(5);
        this.paneParams.PLAYER.worldPosition = this.player.worldPosition;
        this.paneParams.PLAYER.localPosition = this.player.body.transform.position;
        this.paneParams.PLAYER.state = this.player.characterController.state;
        this.paneParams.PLAYER.noClip = this.player.characterController.noClip;

        // Multiplayer
        this.paneParams.MULTIPLAYER.id = this.multiplayer.GetClientId();
        this.paneParams.MULTIPLAYER.currentOctant = this.multiplayer.GetCurrentOctant();
        this.paneParams.MULTIPLAYER.mqttConnected = this.multiplayer.IsMQTTConnected();
        this.paneParams.MULTIPLAYER.peerJSConnected = this.multiplayer.IsRTCConnected();
        this.paneParams.MULTIPLAYER.npcs = this.multiplayer.GetNPCCount();
        this.paneParams.MULTIPLAYER.rtcConnections = this.multiplayer.GetRTCConnectionsCount();

        this.pane.refresh();
    }

    public Update() {
        const currentTime = performance.now();

        const elapsedTime = currentTime - this.previousFrameTime;

        this.paneParams.RENDER.frameTime = elapsedTime;
        this.paneParams.RENDER.fps = Math.round(1000 / elapsedTime);

        this.previousFrameTime = currentTime;
    }
}