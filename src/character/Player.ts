import { Components, KeyCodes } from 'trident';

import { Vector3, Mesh, Quaternion, MeshBasicMaterial } from 'three';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

import { PlayerCameras } from './PlayerCameras';
import { RigidbodyConstraints } from 'trident/dist/esm/enums/RigidbodyConstraints';
import {ThirdPersonCharacterController } from './ThirdPersonCharacterController';
import { CharacterState } from './CharacterStates';
import { PlayerChat } from './PlayerChat';
import { Cartographic, TerrainUtils } from '../misc/TerrainUtils';

export class Player extends Components.Component {

    public playerCameras: PlayerCameras;
    public worldPosition: Vector3;
    public worldPositionCarto: Cartographic;
    private worldPositionOffset: Vector3;

    public model: Components.GameObject;
    private animation: Components.Animation;

    public body: Components.Rigidbody;

    public currentAnimation: string;

    public characterController: ThirdPersonCharacterController;

    public playerChat: PlayerChat;

    public OnEnable() {
        // // // Globe
        // this.worldPosition = new Vector3(-8210972.242081825, -13198253.794543255, 11842683.708113309)
        
        // SD Park
        // 37.30354138653455, -121.8864374203026
        // this.worldPosition = new Vector3(-2677035.212674, -4303102.585957, 3861162.740689);

        // this.worldPosition = new Vector3(-2676976, -4303036, 3861103);
        // this.worldPositionOffset = new Vector3().copy(this.worldPosition);

        // // NYC
        // this.worldPosition = new Vector3(1329866.230289, -4643494.267515, 4154677.131562);
        // this.worldPositionOffset = new Vector3().copy(this.worldPosition);

        this.body = this.CreateBody() as Components.Rigidbody;
        this.model = this.CreateModel() as Components.GameObject;
        this.model.transform.parent = this.body.transform;
        this.model.transform.localPosition.y -= 1.5;

        const playerCameras = this.gameObject.AddComponent(PlayerCameras) as PlayerCameras;
        playerCameras.target = this.body.transform;
        playerCameras.worldPosition = this.worldPosition;

        this.playerCameras = playerCameras;

        this.characterController = this.gameObject.AddComponent(ThirdPersonCharacterController) as ThirdPersonCharacterController;
        this.characterController.viewCamera = this.gameObject.scene.GetActiveCamera();
        this.characterController.target = this.body;

        const playerChatGameobject = new Components.GameObject(this.gameObject.scene);
        this.playerChat = playerChatGameobject.AddComponent(PlayerChat) as PlayerChat;
        this.playerChat.player = this.body.transform;
        this.playerChat.OnChatClosed = () => { this.OnChatClosed(); }
    }

    public Start() {
        if (!this.worldPosition) {
            return console.error("WorldPosition not set");
        }

        this.worldPositionOffset = new Vector3().copy(this.worldPosition);

        this.playerCameras.worldPosition = this.worldPosition;
    }

    public AddToWorldPositionOffset(offset: Vector3) {
        this.worldPositionOffset.add(offset);
    }

    private CreateModel(): Components.GameObject {
        const modelGameObject = new Components.GameObject(this.gameObject.scene);
        const modelMeshRenderer = modelGameObject.AddComponent(Components.MeshRenderer) as Components.MeshRenderer;
        const modelMeshFilter = modelGameObject.AddComponent(Components.MeshFilter) as Components.MeshFilter;
    
        const modelAnimation = modelGameObject.AddComponent(Components.Animation) as Components.Animation;;

        const loader = new GLTFLoader();
        loader.load("./assets/models/boxman.glb", (gltf) => {
            const mesh = gltf.scene.children[0] as Mesh;
            mesh.rotateY(Math.PI / 2) // TODO: Why does the model need to be rotated?
            modelMeshRenderer.mesh = mesh;

            // @ts-ignore
            // TODO: Dodgy, fix
            modelAnimation.OnMeshChanged();

            for (let clip of gltf.animations) {
                modelAnimation.AddClip(clip, clip.name);
            }

            this.animation.Play(this.currentAnimation);
        })

        this.animation = modelAnimation;

        return modelGameObject;
    }

    private CreateBody(): Components.Rigidbody {
        const gameObject = new Components.GameObject(this.gameObject.scene);
        const geometry = gameObject.AddComponent(Components.Sphere) as Components.Sphere;
        const collider = gameObject.GetComponent(Components.SphereCollider) as Components.SphereCollider;
        const meshRenderer = gameObject.GetComponent(Components.MeshRenderer) as Components.MeshRenderer;
        const material = new MeshBasicMaterial({color: 0xff0000, transparent: true, opacity: 0});
        meshRenderer.material = material;

        const rigidbody = gameObject.AddComponent(Components.Rigidbody) as Components.Rigidbody;
        rigidbody.mass = 1;
        rigidbody.constraints = RigidbodyConstraints.FreezeRotation;
        gameObject.transform.localScale.set(0.3,0.3,0.3);

        return rigidbody;
    }

    public HandleAnimations() {
        let animationName = this.currentAnimation;

        if (this.characterController.state == CharacterState.GROUNDED) {
            animationName = "idle";
        }
        else if (this.characterController.state == CharacterState.JUMPING) {
            animationName = "jump_idle";
        }
        else if (this.characterController.state == CharacterState.MOVING) {
            animationName = "run";
        }
        else if (this.characterController.state == CharacterState.FALLING) {
            animationName = "falling";
        }
        else if (this.characterController.state == CharacterState.RUNNING) {
            animationName = "sprint";
        }
        else if (this.characterController.state == CharacterState.NOCLIP) {
            animationName = "levitate";
        }

        if (this.currentAnimation != animationName) {
            this.animation.Play(animationName);
            this.currentAnimation = animationName;
        }
        
        this.model.transform.localEulerAngles.y = this.characterController.facingDirection;
    }

    private HandleChat() {
        if (!this.characterController.isMovementEnabled) return;

        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.Y) || (this.characterController.isMobile && this.characterController.mobileControls.chat)) {
            const hasOpenedChat = this.playerChat.ShowChatBox();

            if (hasOpenedChat) {
                this.characterController.isMovementEnabled = false;
            }
        }
    }

    private OnChatClosed() {
        this.characterController.isMovementEnabled = true;
    }

    public Update() {
        this.HandleAnimations();
        this.HandleChat();

        const worldDirection = this.worldPosition.clone().normalize();

        // Gravity
        if (!this.characterController.noClip) {
            this.body.AddForce(worldDirection.clone().multiplyScalar(-9.82 * this.body.mass));
        }

        const localUp = this.body.transform.up.clone();
		
        // Allign bodies up axis with the centre of planet
        const q = new Quaternion();
        q.setFromUnitVectors(localUp, worldDirection).multiply(this.body.transform.rotation);
		this.body.transform.rotation = q;

        this.worldPosition.copy(this.worldPositionOffset.clone().add(this.body.transform.position));
        
        this.worldPositionCarto = TerrainUtils.CartesianToCartographic(this.worldPosition.x, this.worldPosition.y, this.worldPosition.z);

    }
    


}