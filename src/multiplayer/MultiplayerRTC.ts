import { Components } from "trident";

import Peer from 'peerjs';

export enum RTCMessageActions {
    STATE,
    MESSAGE,
    ALIVE
}

export interface RTCMessage {
    action: RTCMessageActions;
    data: any;
}

export class MultiplayerRTC extends Components.Component {
    public clientId: string;
    private peerjs: Peer;

    private connections: Map<string, Peer.DataConnection> = new Map();

    public HandleNewPlayerConnectionSuccess = (playerId: string) => {};
    public HandleNewPlayerConnectionFailure = (playerId: string) => {};
    public HandlePlayerDataReceived = (playerId: string, data: RTCMessage) => {};

    public Start() {
        if (!this.clientId) {
            console.error("Client id not set");
            return;
        }

        this.peerjs = new Peer(this.clientId);
        this.peerjs.on("open", () => {this.OnServerConnection()});
        this.peerjs.on("connection", (connection) => {this.OnIncomingConnection(connection)});
        this.peerjs.on("error", (error) => {
            console.error(error);
            // Only way to get the peer id? connection.on("error") doesnt trigger
            const message = error.message;
            const playerId = message.split("Could not connect to peer ")[1];

            this.DisconnectPlayer(playerId);

            this.HandleNewPlayerConnectionFailure(playerId);
        });
    }

    public isConnected(): boolean {
        return !this.peerjs.disconnected;
    }

    public GetConnectionsCount(): number {
        return this.connections.size;
    }

    private OnServerConnection() {
        console.log("Connected to PeerJS");
    }

    private OnIncomingConnection(connection: Peer.DataConnection) {
        console.log("Got new connection", this.clientId, connection.peer);
        this.connections.set(connection.peer, connection);
        this.HandleNewPlayerConnectionSuccess(connection.peer);

        connection.on("data", (data) => {
            this.HandlePlayerDataReceived(connection.peer, data);
        })
    }

    public ConnectToPlayer(playerId: string) {
        if (this.clientId == playerId) return console.error("Trying to connect to itself");
        if (this.peerjs.disconnected) return console.error("Client is not connected to PeerJS");

        console.log("Trying to connect to", this.clientId, playerId);

        const connection = this.peerjs.connect(playerId);
        
        connection.on("open", () => {
            console.log("connceted!!!")
            this.OnIncomingConnection(connection);
        })
    }

    public DisconnectPlayer(playerId: string) {
        console.log("DisconnectPlayer", this.clientId, playerId)
        if (this.connections.has(playerId)) {
            const connection = this.connections.get(playerId);
            connection.close();
            this.connections.delete(playerId);
        }
    }

    public DisconnectAll() {
        for (let connection_map of this.connections) {
            this.DisconnectPlayer(connection_map[1].peer);
        }
    }    

    public Broadcast(playerId: string, data: RTCMessage) {
        if (this.connections.has(playerId)) {
            const connection = this.connections.get(playerId);
            if (!connection.open) {
                console.error("Connection to", playerId, "is not open");
                return;
            }

            connection.send(data);
        }
    }

    public BroadcastToAll(data: RTCMessage) {
        for (let connection_map of this.connections) {
            this.Broadcast(connection_map[1].peer, data);
        }
    }
}