import { Components } from "trident";

import { TerrainManagerTopCamera } from "../terrain/TerrainManagerTopCamera";
import { Player } from "../character/Player";
import { Euler, MathUtils, Vector3 } from 'three';
import { NPC } from "../character/NPC";
import { GameObject } from "trident/dist/esm/components";
import { MultiplayerMQTT } from "./MultiplayerMQTT";
import { MultiplayerRTC, RTCMessage, RTCMessageActions } from "./MultiplayerRTC";

interface PlayerState {
    position: Vector3;
    rotation: Vector3;
    animation: string;
    duration: number;
}

interface NPCData {
    npc: NPC;
    lastBroadcast: number;
}

export class Multiplayer extends Components.Component {
    public terrainManagerTop: TerrainManagerTopCamera;
    public player: Player;
    private clientId: string;
    
    private multiplayerMqtt: MultiplayerMQTT;
    private multiplayerRTC: MultiplayerRTC;

    private previousHighestNodePath: string = "";

    private npcs: Map<string, NPCData> = new Map();

    private previousBroadcastTime = 0;
    private broadcastDelta = 100;
    private currentState: PlayerState;
    private previousState: PlayerState;

    private npcDisconnectTimeout = 5000;

    public Start() {
        if (!this.terrainManagerTop) {
            console.error("terrainManagerTop not set");
            return;
        }

        if (!this.player) {
            console.error("playerController not set");
            return;
        }

        this.clientId = this.uuid.substr(0, 5);

        this.multiplayerMqtt = this.gameObject.AddComponent(MultiplayerMQTT);
        this.multiplayerMqtt.clientId = this.clientId;
        this.multiplayerMqtt.HandlePlayerJoined = (playerId) => {this.HandleNewMqttPlayerJoined(playerId)};
        this.multiplayerMqtt.HandlePlayerLeft = (playerId) => {this.HandleMqttPlayerLeft(playerId)};

        this.multiplayerRTC = this.gameObject.AddComponent(MultiplayerRTC);
        this.multiplayerRTC.clientId = this.clientId;
        this.multiplayerRTC.HandleNewPlayerConnectionFailure = (playerId) => {this.HandleRTCConnectionFailure(playerId)}
        this.multiplayerRTC.HandleNewPlayerConnectionSuccess = (playerId) => {this.HandleRTCConnectionSuccess(playerId)}
        this.multiplayerRTC.HandlePlayerDataReceived = (playerId, data) => {this.HandleRTCDataReceived(playerId, data)}

        this.currentState = this.GetCurrentState();
        this.previousState = this.GetCurrentState();

        this.player.playerChat.OnMessageSent = (message) => {this.OnPlayerChatMessageSend(message)};

        // Broadcast alive message and delete timed out players
        setInterval(() => {
            this.BoardcastAlive();
            this.DeletedTimedoutNPCs();
        }, 1000);
        // console.error("TODO: HandleOctantChange: Only remove players if they are x distance away");
    }

    /* MQTT */
    private HandleNewMqttPlayerJoined(playerId: string) {
        console.log("Got new player", playerId);

        this.multiplayerRTC.ConnectToPlayer(playerId);
    }

    private HandleMqttPlayerLeft(playerId: string) {
        console.log("Player left", playerId);

        this.multiplayerRTC.DisconnectPlayer(playerId);
        this.DeleteNPC(playerId);
    }

    /* RTC */
    private HandleRTCConnectionFailure(playerId: string) {
        const currentOctant = this.terrainManagerTop.currentHighestNodePath;
        this.multiplayerMqtt.LeaveOctant(currentOctant);
        this.multiplayerRTC.DisconnectPlayer(playerId);
    }

    private HandleRTCConnectionSuccess(playerId: string) {
        console.log("HandleRTCConnectionSuccess", playerId);

        // Delay so that if its an incoming connection both players have time to setup the connection.
        setTimeout(() => {
            this.multiplayerRTC.Broadcast(playerId, {action: RTCMessageActions.STATE, data: this.currentState});
        }, 1000);
    }

    private HandleRTCDataReceived(playerId: string, message: RTCMessage) {
        if (message.action == RTCMessageActions.STATE) {
            let npcData = this.npcs.get(playerId);
            if (!npcData) {
                npcData = {
                    npc: this.CreateNPC(playerId),
                    lastBroadcast: performance.now()
                }
            }
    
            this.MoveNPC(playerId, message.data);
        }
        else if (message.action == RTCMessageActions.MESSAGE) {
            let npcData = this.npcs.get(playerId);
            if (npcData) {
                npcData.npc.chatBubble.ShowText(message.data);
            }
        }
        else if (message.action == RTCMessageActions.ALIVE) {
            let npcData = this.npcs.get(playerId);
            if (npcData) {
                npcData.lastBroadcast = performance.now();
            }
        }
    }

    private OnPlayerChatMessageSend(message: string) {
        this.multiplayerRTC.BroadcastToAll({action: RTCMessageActions.MESSAGE, data: message});
    }



    private HandleOctantChange(previousPath:string, currentPath: string) {
        if (!this.multiplayerMqtt.isConnected()) {
            console.error("Client is not connected to MQTT");
            return;
        }

        if (previousPath.length != 0) {
            // Delete client from previous octant
            this.multiplayerMqtt.LeaveOctant(previousPath);
            this.multiplayerRTC.DisconnectAll();

            for (let npc_map of this.npcs) {
                this.DeleteNPC(npc_map[0]);
            }
        }

        // Broadcast to new octant
        this.multiplayerMqtt.JoinOctant(currentPath);

        console.log("Joining octant", currentPath)
    }

    private GetCurrentState(): PlayerState {
        const rotE = new Euler().setFromQuaternion(this.player.model.transform.group.worldRotation);
        const rot = rotE.toVector3().multiplyScalar(MathUtils.RAD2DEG);

        return {
            position: this.player.characterController.target.transform.position,
            rotation: rot,
            animation: this.player.currentAnimation,
            duration: 0
        }
    }


    private HasStateChanged(): boolean {
        if (this.previousState.position.distanceToSquared(this.currentState.position) > 0.01) return true;
        if (this.previousState.rotation.distanceToSquared(this.currentState.rotation) > 0.01) return true;
        if (this.previousState.animation != this.currentState.animation) return true;

        return false;
    }

    private BroadcastPlayer(previousTime: number, currentTime: number) {
        const hasStateChanged = this.HasStateChanged();

        if (hasStateChanged) {
            // TODO: Figure out duration
            this.currentState.duration = currentTime - previousTime;
            this.multiplayerRTC.BroadcastToAll({action: RTCMessageActions.STATE, data: this.currentState});

            this.previousState = {
                position: this.currentState.position.clone(),
                rotation: this.currentState.rotation.clone(),
                animation: this.currentState.animation,
                duration: this.currentState.duration
            }
        }
    }

    private BoardcastAlive() {
        this.multiplayerRTC.BroadcastToAll({action: RTCMessageActions.ALIVE, data: ""});
    }

    private DeletedTimedoutNPCs() {
        const currentTime = performance.now();
        for (let npcDataMap of this.npcs) {
            const npcData = npcDataMap[1];
            if (currentTime - npcData.lastBroadcast > this.npcDisconnectTimeout) {
                const npcId = npcDataMap[0];
                this.multiplayerRTC.DisconnectPlayer(npcId);
                this.DeleteNPC(npcId);
            }
        }
    }

    private CreateNPC(npcId: string): NPC {
        const npcGameobject = new GameObject(this.gameObject.scene);
        const npc = npcGameobject.AddComponent(NPC) as NPC;
        npc.gltfModelUrl = "./assets/models/boxman.glb";
        npc.color = 0xff0000;
        this.npcs.set(npcId, {
            npc: npc,
            lastBroadcast: performance.now()
        });
        return npc;
    }

    private DeleteNPC(npcId: string) {
        if (this.npcs.has(npcId)) {
            const npcData = this.npcs.get(npcId);
            npcData.npc.gameObject.Destroy();
            this.npcs.delete(npcId);
        }
    }

    private MoveNPC(npcId: string, state: PlayerState) {
        if (this.npcs.has(npcId)) {
            const npcData = this.npcs.get(npcId);
            npcData.npc.Move(state.position, state.rotation, state.animation, state.animation, state.duration);
        }
    }

    public GetClientId(): string {
        return this.clientId;
    }

    public GetCurrentOctant(): string {
        return this.terrainManagerTop.currentHighestNodePath;
    }

    public GetNPCCount(): number {
        return this.npcs.size;
    }

    public GetRTCConnectionsCount(): number {
        return this.multiplayerRTC.GetConnectionsCount();
    }

    public IsMQTTConnected(): boolean {
        return this.multiplayerMqtt.isConnected();
    }
    
    public IsRTCConnected(): boolean {
        return this.multiplayerRTC.isConnected();
    }

    public Update() {
        const currentHighestNodePath = this.terrainManagerTop.currentHighestNodePath;

        if (currentHighestNodePath && currentHighestNodePath.length > 0) {
            if (this.previousHighestNodePath != currentHighestNodePath) {
                this.HandleOctantChange(this.previousHighestNodePath, currentHighestNodePath);
                this.previousHighestNodePath = currentHighestNodePath;
            }
        }

        const currentTime = performance.now();
        const elapsedTime = currentTime - this.previousBroadcastTime;

        if (elapsedTime > this.broadcastDelta) {
            this.BroadcastPlayer(this.previousBroadcastTime, currentTime);
            this.previousBroadcastTime = currentTime;
        }

        this.currentState = this.GetCurrentState();
    }
}