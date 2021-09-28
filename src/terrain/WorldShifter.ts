import { Components, Input, KeyCodes } from 'trident';

import { Player } from '../character/Player';
import { Vector3 } from 'three';

export class WorldShifter extends Components.Component {
    public target: Components.Transform;
    public worldPosition: Vector3;
    public terrainManager: Components.Transform;

    public player: Player;

    private input: Input;

    public Start() {
        if (!this.target || !this.worldPosition) {
            console.error("Target and world camera not set");
        }
        
        this.input = this.gameObject.scene.GetInput();
        
        this.terrainManager.position.sub(this.worldPosition);
    }

    public Update() {

        if (this.input.GetKeyDown(KeyCodes.Q)) {
            console.log("Shifting world");
            const offset = this.target.position.clone();
            console.log("offset", offset)

            this.terrainManager.position.sub(offset);
            this.target.position.sub(offset)

            this.player.AddToWorldPositionOffset(offset);
        }
    }
}