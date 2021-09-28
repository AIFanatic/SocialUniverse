import { MathUtils, Raycaster, Vector3 } from 'three';
import { Components, Input, KeyCodes, LayerMask } from "trident";
import { Component, GameObject, Transform } from "trident/dist/esm/components";
import { Physics } from 'trident/dist/esm/Physics';
import { CharacterState } from './CharacterStates';
import { MobileControls } from './MobileControls';

export class ThirdPersonCharacterController extends Component {
    public viewCamera: Components.Camera;
    public target: Components.Rigidbody;
    public groundTag = "Ground";
    public noClip: boolean = true;
    public moveSpeed: number = 10;
    public sprintSpeed: number = 20;
    public jumpSpeed: number = 10;
    public cameraDistance: number = 20;
    public isMovementEnabled: boolean = true;

    public facingDirection: number;
    public state: CharacterState = CharacterState.FALLING;

    private rayDistance = 1;

    private input: Input;
    private pointerLocked: boolean;
    private previousMovementHorizontal: number = 0;
    private previousMovementVertical: number = 0;

    private viewCameraTarget: GameObject;
    private viewCameraTargetLocked: GameObject;

    private previousState: CharacterState;


    private physics: Physics;
    private lineRenderer: Components.LineRenderer;

    public isMobile: boolean;
    public mobileControls: MobileControls;

    public Start() {
        if (!this.viewCamera) return console.error("ViewCamera not defined");
        if (!this.target) return console.error("Target not defined");

        this.input = this.gameObject.scene.GetInput();
        
        this.viewCameraTarget = new Components.GameObject(this.gameObject.scene);
        this.viewCameraTarget.transform.parent = this.target.transform;

        this.viewCamera.transform.parent = this.viewCameraTarget.transform;
        this.viewCamera.transform.localEulerAngles.set(0, -90, 0);
        this.viewCamera.transform.localPosition.y = 2;
        this.viewCamera.transform.localPosition.x = -this.cameraDistance;

        this.viewCameraTargetLocked = new Components.GameObject(this.gameObject.scene);
        this.viewCameraTargetLocked.transform.parent = this.target.transform;

        const canvas = this.gameObject.scene.GetRenderer().renderer.domElement;

        canvas.onclick = () => {
            if (!this.pointerLocked) {
                this.gameObject.scene.GetRenderer().renderer.domElement.requestPointerLock();
            }
        }
        document.addEventListener('pointerlockchange', (event) => {
            this.pointerLocked = !this.pointerLocked;
        }, false);


        this.physics = this.gameObject.scene.GetPhysics();

        const raycastLine = new Components.GameObject(this.gameObject.scene);
        this.lineRenderer = raycastLine.AddComponent(Components.LineRenderer);


        this.isMobile = (navigator.maxTouchPoints || 'ontouchstart' in document.documentElement) ? true : false;

        if (this.isMobile) {
            const mobileControlsGameobject = new GameObject(this.gameObject.scene);
            this.mobileControls =  mobileControlsGameobject.AddComponent(MobileControls) as MobileControls;
        }

        if (this.noClip) {
            this.state = CharacterState.NOCLIP;
        }
    }

    private GroundRayCast() {
        const raycaster = new Raycaster();
        
        const direction = this.target.transform.up.clone().multiplyScalar(-1);
        const from = this.target.transform.position.clone();
        const to = from.clone().add(direction.clone().multiplyScalar(this.rayDistance));
    
        this.lineRenderer.from.copy(from);
        this.lineRenderer.to.copy(to);

        raycaster.near = 0.3; // sphere radius is 0.3
        raycaster.far = this.rayDistance;

        raycaster.set(from, direction);

        const physicsray = this.physics.Raycast(from, direction, this.rayDistance, LayerMask.LAYER1);
        if (physicsray.hasAnyHits()) {
            this.state = CharacterState.GROUNDED;
            return;   
        }
        this.state = CharacterState.FALLING;
    }

    private HandlePointerCameraMovement() {
        if (this.pointerLocked || this.isMobile) {
            let movementHorizontal = this.input.GetAxis("Horizontal");
            let movementVertical = this.input.GetAxis("Vertical");

            if (this.isMobile) {
                movementHorizontal = this.mobileControls.panHorizontal * 10;
                movementVertical = this.mobileControls.panVertical * 10;

                // movementHorizontal = this.mobileControls.cameraJoystick.value.x * 10;
                // movementVertical = this.mobileControls.cameraJoystick.value.y * 10;
            }

            if (this.previousMovementHorizontal != movementHorizontal) {
                const rotationY = movementHorizontal / 10;
                this.viewCameraTarget.transform.localEulerAngles.y += -rotationY;
                this.previousMovementHorizontal = movementHorizontal;
            }

            if (this.previousMovementVertical != movementVertical) {
                const movement = this.viewCameraTarget.transform.localEulerAngles.z - movementVertical / 10;
                const movementClamped = MathUtils.clamp(movement, -90, 90);
                this.viewCameraTarget.transform.localEulerAngles.z = movementClamped;
                this.previousMovementVertical = movementVertical;
            }

            if (this.isMobile) {
                this.previousMovementHorizontal = 0;
                this.previousMovementVertical = 0;
            }

            this.viewCameraTargetLocked.transform.localEulerAngles.y = this.viewCameraTarget.transform.localEulerAngles.y;
        }
    }

    private CanMove(): boolean {
        return (this.state == CharacterState.GROUNDED || this.state == CharacterState.MOVING || this.state == CharacterState.RUNNING);
    }

    private HandleMovement() {
        if (!this.CanMove()) return;

        const moveTarget = this.viewCameraTargetLocked.transform;
        let moveDirection: Vector3 = null;
        let sprinting: boolean = false;

        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.W) || (this.isMobile && this.mobileControls.moveForward)) {
            moveDirection = moveTarget.forward
            this.facingDirection = moveTarget.localEulerAngles.y + 0;
        }
        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.S) || (this.isMobile && this.mobileControls.moveBackward)) {
            moveDirection = moveTarget.forward.clone().negate();
            this.facingDirection = moveTarget.localEulerAngles.y + -180;
        }
        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.A) || (this.isMobile && this.mobileControls.moveLeft)) {
            moveDirection = moveTarget.right.multiplyScalar(-1);
            this.facingDirection = moveTarget.localEulerAngles.y + 90;
        }
        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.D) || (this.isMobile && this.mobileControls.moveRight)) {
            moveDirection = moveTarget.right;
            this.facingDirection = moveTarget.localEulerAngles.y + -90;
        }
        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.SHIFT) || (this.isMobile && this.mobileControls.sprint)) {
            sprinting = true;
        }

        if (moveDirection == null) {
            return;
        }

        this.target.MovePosition(
            this.target.transform.position.clone().add(
                moveDirection.clone().multiplyScalar(sprinting ? this.sprintSpeed : this.moveSpeed)
            )
        );

        if (sprinting) {
            this.state = CharacterState.RUNNING;
        }
        else {
            this.state = CharacterState.MOVING;
        }
    }

    private HandleJump() {
        if (!this.CanMove()) return;

        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.SPACE) || (this.isMobile && this.mobileControls.jump)) {
            const moveDirection = this.target.transform.up.clone().add(this.target.velocity).normalize();
            
            this.target.MovePosition(
                this.target.transform.position.clone().add(
                    moveDirection.clone().multiplyScalar(this.jumpSpeed)
                )
            );
            this.state = CharacterState.JUMPING;
            setTimeout(() => {
                this.state = CharacterState.FALLING;
            }, 450);
        }
    }

    private HandleNoclip() {
        if (this.input.GetKeyDown(KeyCodes.N) || (this.isMobile && this.mobileControls.noClip)) {
            if (this.noClip) {
                this.target.isKinematic = false;
                this.noClip = false;
                this.state = CharacterState.FALLING;
            }
            else {
                this.target.isKinematic = true;
                this.noClip = true;
                this.state = CharacterState.NOCLIP;
            }
        }

        if (!this.noClip) return;

        let moveDirection: Vector3 = null;
        let sprinting = false;
        const moveTarget: Transform = this.viewCameraTarget.transform;

        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.W) || (this.isMobile && this.mobileControls.moveForward)) {
            moveDirection = moveTarget.forward;
            this.facingDirection = moveTarget.localEulerAngles.y + 0;
        }
        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.S) || (this.isMobile && this.mobileControls.moveBackward)) {
            moveDirection = moveTarget.forward.clone().negate();
            this.facingDirection = moveTarget.localEulerAngles.y + -180;
        }
        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.A) || (this.isMobile && this.mobileControls.moveLeft)) {
            moveDirection = moveTarget.right.clone().multiplyScalar(-1);
            this.facingDirection = moveTarget.localEulerAngles.y + 90;
        }
        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.D) || (this.isMobile && this.mobileControls.moveRight)) {
            moveDirection = moveTarget.right;
            this.facingDirection = moveTarget.localEulerAngles.y + -90;
        }
        if (this.gameObject.scene.GetInput().GetKey(KeyCodes.SHIFT) || (this.isMobile && this.mobileControls.sprint)) {
            sprinting = true;
        }

        if (moveDirection !== null) {
            let speed = this.moveSpeed * 0.1;
            if (sprinting) speed *= this.sprintSpeed;
            this.target.transform.position.add(
                moveDirection.clone().multiplyScalar(speed)
            )
        }
    }

    // Adds drag when movement is stopped in order to prevent drifting
    private HandleStateChanges() {
        if (this.previousState != this.state) {
            if (this.previousState == CharacterState.MOVING && this.state == CharacterState.GROUNDED) {
                this.target.drag = 10;
            }

            if (
                (this.previousState == CharacterState.GROUNDED || this.previousState == CharacterState.MOVING) 
                && 
                (this.state == CharacterState.JUMPING || this.state == CharacterState.FALLING)
            ) {
                this.target.drag = 0.5;
            }

            if (this.state == CharacterState.NOCLIP) {
                this.target.drag = 0.5;
            }
            this.previousState = this.state;
        }
    }

    public FixedUpdate() {
        if (!this.noClip) {
            this.GroundRayCast();
        }

        this.HandlePointerCameraMovement();

        if (this.isMovementEnabled) {
            this.HandleMovement();
            this.HandleJump();
            this.HandleNoclip();
        }
        this.HandleStateChanges();
    }
}