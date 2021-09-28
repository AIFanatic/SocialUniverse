import { Components } from 'trident';
import { Quaternion, Vector3 } from 'three';

export class PlayerCameras extends Components.Component {
    // Target to be tracked, aka player
    public target: Components.Transform;
    // Real world position
    public worldPosition: Vector3;

    // Player viewing camera
    public viewCamera: Components.Camera;
    // Player top camera, used for collisions mostly
    public topCamera: Components.Camera;

    private topCameraOffset = 20;

    public OnEnable() {
        this.viewCamera = this.gameObject.scene.GetActiveCamera();

        const topCameraGameObject = new Components.GameObject(this.gameObject.scene);
        const topCameraComponent = topCameraGameObject.AddComponent(Components.Camera);
        this.topCamera = topCameraComponent;

        this.topCamera.near = 0.1;
        this.topCamera.far = this.topCameraOffset + 20;
        this.topCamera.GetCamera().fov = 90;
        this.topCamera.GetCamera().aspect = 1;
        this.topCamera.GetCamera().updateProjectionMatrix();
    }

    public Start() {
        if (!this.target) {
            console.error("Target not set");
        }

        if (!this.worldPosition) {
            console.error("World position not set");
        }

        // View camera
        const viewCameraTarget = new Components.GameObject(this.gameObject.scene);
        viewCameraTarget.transform.parent = this.target;
    }

    public Update() {
        const planet_radius = 6371010;
        const altitude = this.worldPosition.length() - planet_radius;
        const horizon = Math.sqrt( altitude * (2*planet_radius + altitude) );
        let near = horizon > 370000 ? altitude / 2 : 1;
        let far = horizon;
        if (near >= far) near = far - 1;
        if (isNaN(far) || far < near) far = near + 1;

        this.viewCamera.near = near;
        this.viewCamera.far = far;

        const gravityUp = this.worldPosition.clone().normalize();
        const localUp = this.topCamera.transform.right.clone();

        // Allign bodies up axis with the centre of planet
        const q = new Quaternion();
        q.setFromUnitVectors(localUp, gravityUp).multiply(this.topCamera.transform.rotation);
        this.topCamera.GetCamera().quaternion.copy(q);

        const offset = new Vector3(0, 0, this.topCameraOffset).applyQuaternion(q);
        this.topCamera.GetCamera().position.copy(this.target.position).add(offset)
    }
}