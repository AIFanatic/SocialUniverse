import { Mesh, Vector3, MeshBasicMaterial } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Components } from "trident";
import { ChatBubble } from "../misc/ChatBubble";

interface MoveQueue {
    startPosition: Vector3;
    position: Vector3;
    startRotation: Vector3;
    rotation: Vector3;
    startAnimation: string;
    endAnimation: string;
    duration: number;
}

export class NPC extends Components.Component {
    public gltfModelUrl: string;
    public color: number = 0xffffff;
    public chatBubble: ChatBubble;
    
    private animation: Components.Animation;
    private currentAnimation: string;

    private moveQueue: MoveQueue[] = [];
    private moveQueueTimer: number = 0;


    public Start() {
        if (!this.gltfModelUrl) {
            console.error("Model not provided");
            return;
        }

        this.CreateModel(this.gltfModelUrl, this.color);

        const chatBubbleGameobject = new Components.GameObject(this.gameObject.scene);
        this.chatBubble = chatBubbleGameobject.AddComponent(ChatBubble) as ChatBubble;
        this.chatBubble.target = this.transform;
        this.chatBubble.upOffset = 3;
    }

    private CreateModel(modelUrl: string, color: number) {
        const modelMeshRenderer = this.gameObject.AddComponent(Components.MeshRenderer) as Components.MeshRenderer;
        const modelMeshFilter = this.gameObject.AddComponent(Components.MeshFilter) as Components.MeshFilter;
        const modelAnimation = this.gameObject.AddComponent(Components.Animation) as Components.Animation;;

        const loader = new GLTFLoader();
        loader.load(modelUrl, (gltf) => {
            const mesh = gltf.scene.children[0] as Mesh;
            mesh.material = new MeshBasicMaterial();
            mesh.rotateY(Math.PI / 2) // TODO: Why does the model need to be rotated?
            mesh.traverse(function(child){
                if(child instanceof Mesh){
                    child.material.color.setHex(color);
                }
            });

            modelMeshRenderer.mesh = mesh;

            // @ts-ignore
            // TODO: Dodgy, fix
            modelAnimation.OnMeshChanged();

            for (let clip of gltf.animations) {
                modelAnimation.AddClip(clip, clip.name);
            }
        })

        this.animation = modelAnimation;
    }

    public Move(position: Vector3, rotation: Vector3, startAnimation: string, endAnimation: string, duration: number) {
        let startPosition = this.transform.position.clone();
        if (this.moveQueue.length > 0) startPosition = this.moveQueue[this.moveQueue.length-1].position;

        let startRotation = this.transform.eulerAngles.clone();
        if (this.moveQueue.length > 0) startRotation = this.moveQueue[this.moveQueue.length-1].rotation;
        

        this.moveQueue.push({
            startPosition: startPosition,
            position: position,
            startRotation: startRotation,
            rotation: rotation,
            startAnimation: startAnimation,
            endAnimation: endAnimation,
            duration: duration
        });
    }
    
    private HandleAnimation(currentMove: MoveQueue, elapsedTime: number) {
        if (elapsedTime >= currentMove.duration) {
            this.animation.Play(currentMove.endAnimation);
            this.currentAnimation = "";
            return;
        }

        if (this.currentAnimation == currentMove.startAnimation) return;

        this.animation.Play(currentMove.startAnimation);
        this.currentAnimation = currentMove.startAnimation;
    }

    public Update() {
        if (this.moveQueue.length > 0) {
            if (this.moveQueueTimer == 0) this.moveQueueTimer = performance.now();

            const currentTime = performance.now();
            const elapsedTime = currentTime - this.moveQueueTimer;
            
            const currentMove = this.moveQueue[0];
            
            this.HandleAnimation(currentMove, elapsedTime);

            const alpha = elapsedTime / currentMove.duration;

            this.transform.position.lerpVectors(currentMove.startPosition, currentMove.position, alpha);
            this.transform.eulerAngles.copy(currentMove.rotation);

            if (elapsedTime >= currentMove.duration) {
                this.transform.position.copy(currentMove.position);
                this.transform.eulerAngles.copy(currentMove.rotation);
                this.moveQueue.shift();
                this.moveQueueTimer = 0;
            }
        }
    }
}