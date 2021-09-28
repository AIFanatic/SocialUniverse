import { MeshBasicMaterial, TextureLoader, Vector3 } from 'three';
import { Components } from "trident";

export class TestGround extends Components.Component {
    public OnEnable() {
        const loader = new TextureLoader();
        const material = new MeshBasicMaterial({map: loader.load("./assets/materials/debug.jpg")});
        const worldPosition = new Vector3(-2677035.212674, -4303102.585957, 3861162.740689);

        const floor = new Components.GameObject(this.gameObject.scene);
        const floorGeometry = floor.AddComponent(Components.Cube) as Components.Cube;
        const floorMeshRenderer = floor.GetComponent(Components.MeshRenderer) as Components.MeshRenderer;
        floorMeshRenderer.material = material;
        floor.transform.group.lookAt(worldPosition.clone().negate());
        floor.transform.position.y = 20;
        floor.transform.localScale.set(100, 1, 100);
        floor.transform.group.rotateX(Math.PI / 2)

        const cube = new Components.GameObject(this.gameObject.scene);
        const cubeGeometry = cube.AddComponent(Components.Cube) as Components.Cube;
        const cubeMeshRenderer = cube.GetComponent(Components.MeshRenderer) as Components.MeshRenderer;
        cubeMeshRenderer.material = material;
        cube.transform.position.set(5,17,5);
        cube.transform.localScale.set(5,5,5);

        floor.transform.tag = "Ground";
        cube.transform.tag = "Ground";


        setTimeout(() => {
            console.log("destryoing cube");

            cube.Destroy();
        }, 5000);
    }
}