import Paho from 'paho-mqtt';
import { Components } from 'trident';

interface PlayerConnectMessage {
    status: "connected" | "disconnected";
    playerId: string;
}

export class MultiplayerMQTT extends Components.Component {
    public clientId: string;
    
    public HandlePlayerJoined = (string) => {};
    public HandlePlayerLeft = (string) => {};

    private client: Paho.Client;
    private mqttBase = "f34h5hy34tg54";

    public Start() {
        if (!this.clientId) {
            console.error("Client id not set");
            return;
        }

        // wss://test.mosquitto.org:8081
        this.client = new Paho.Client("test.mosquitto.org", 8081, this.clientId);
        
        // set callback handlers
        this.client.onConnectionLost = (error) => {this.OnConnectionLost(error)};
        this.client.onMessageArrived = (message) => {this.OnMessageArrived(message)};
        
        // connect the client
        this.client.connect({
            onSuccess: () => { this.OnServerConnection()},
            useSSL: true
        });
    }

    private OnServerConnection() {
        console.log("Connected to MQTT");
    }

    private OnConnectionLost(responseObject: Paho.MQTTError) {
        if (responseObject.errorCode !== 0) {
            console.log("onConnectionLost:"+responseObject.errorMessage);
        }
    }

    private OnMessageArrived(message: Paho.Message) {
        try {
            const player = JSON.parse(message.payloadString) as PlayerConnectMessage;
            console.log("received", player)
            if (player.playerId == this.clientId) return;
            
            if (player.status == "connected") {
                console.log("HandlePlayerJoined", player)
                this.HandlePlayerJoined(player.playerId);    
            }
            else if (player.status == "disconnected") {
                this.HandlePlayerLeft(player.playerId);    
            }
        } catch (error) {
            console.error("OnMessageArrived", error);
        }
    }

    private SendMessage(topic: string, message: string) {
        const mqttMessage = new Paho.Message(message);
        mqttMessage.destinationName = `${this.mqttBase}/${topic}`;
        this.client.send(mqttMessage);
    }

    public LeaveOctant(octant: string) {
        console.log("deleting", this.clientId, "from", octant);

        // Unsubscribe from previous octant
        this.client.unsubscribe(`${this.mqttBase}/${octant}`);
        
        // Broadcast leaving octant
        this.SendMessage(`${octant}`, JSON.stringify({
            status: "disconnected",
            playerId: this.clientId
        }));
    }

    public JoinOctant(octant: string) {
        console.log("joining", this.clientId, "to", octant);

        this.SendMessage(`${octant}`, JSON.stringify({
            status: "connected",
            playerId: this.clientId
        }));

        // Subscribe to new octant
        this.client.subscribe(`${this.mqttBase}/${octant}`);
    }

    public isConnected(): boolean {
        return this.client.isConnected();
    }
}