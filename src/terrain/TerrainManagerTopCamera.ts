import { Components, LayerMask } from 'trident';

import { Vector3, Matrix4, Quaternion, Mesh } from 'three';

import { TerrainUtils } from '../misc/TerrainUtils';

import { NodeManager, NodeData, NodeHeader } from 'earth-3d';
import { NodeValidator } from './NodeValidator';

import { Queue } from '../misc/Queue';
import { TerrainManagerTopNodeFilter } from './TerrainManagerTopNodeFilter';
import { NodeState } from 'earth-3d/dist/esm/node/NodeState';

interface LoadedNode {
    path: string,
    node: NodeData,
    gameObjects: Array<Components.GameObject>,
    meshes: Array<Mesh>,
    has_collider: boolean,
}

export class TerrainManagerTopCamera extends Components.Component {
    private tileManager: NodeManager;

    public topCamera: Components.Camera;
    public worldPosition: Vector3;

    public currentHighestNodePath: string;

    private loadedNodes = new Map<string, LoadedNode>();
    private currentNodeCount = 0;
    private currentColliderCount = 0;

    private nodeValidator: NodeValidator;

    private queue: Queue;

    private debugger: TerrainManagerTopNodeFilter;

    public OnEnable() {
        const options = {
            url: "../test/earth/",
            // url: "https://kh.google.com/rt/earth/",
            nodeValidationHandler: (node) => { return this.NodeValidationHandler(node) },
            rootEpoch: 897,
            workerCount: 4
        };

        this.tileManager = new NodeManager(options);

        this.queue = new Queue(10);
    }

    public Start() {
        if (!this.worldPosition) {
            console.error("No World Position was provided to TerrainManager");
        }
        if (!this.topCamera) {
            console.error("No Top Camera was provided to TerrainManager");
        }

        setInterval(() => {
            const nodes = this.tileManager.get_nodes()
            this.finishGettingNodes(nodes);
        }, 100);

        this.nodeValidator = new NodeValidator(this.gameObject.scene.GetRenderer());

        this.debugger = this.gameObject.AddComponent(TerrainManagerTopNodeFilter);
        this.debugger.camera = this.topCamera;
        this.debugger.worldPosition = this.worldPosition;
    }

    private loadNode(node: NodeData, collider: boolean): LoadedNode | null {
        const threeMeshes = TerrainUtils.NodeToTHREE(node, true);

        if (!threeMeshes) return null;

        const loadedNode: LoadedNode = {
            path: node.path,
            node: node,
            gameObjects: [],
            meshes: [],
            has_collider: false,
        }

        for (let i = 0; i < threeMeshes.length; i++) {
            const threeMesh = threeMeshes[i];
            threeMesh.renderOrder = node.level;

            const childGameObject = new Components.GameObject(this.gameObject.scene);
            childGameObject.transform.group.name = "node_" + node.path;
            childGameObject.transform.parent = this.transform;
            childGameObject.layer = LayerMask.LAYER1;

            const meshFilter = childGameObject.AddComponent(Components.MeshFilter) as Components.MeshFilter;
            meshFilter.mesh = threeMesh.geometry;

            // const meshRenderer = childGameObject.AddComponent(Components.MeshRenderer) as Components.MeshRenderer;
            // meshRenderer.material = threeMesh.material as Material;
            // // // @ts-ignore
            // // meshRenderer.material.wireframe = true;
            // meshRenderer.material = new MeshBasicMaterial({wireframe: true, color: color});
            
            const p = new Vector3();
            const q = new Quaternion();
            const s = new Vector3();

            const m = new Matrix4();
            // @ts-ignore
            m.set(...node.data.matrix_globe_from_mesh).transpose();
            m.decompose(p, q, s);

            childGameObject.transform.localPosition.copy(p);
            childGameObject.transform.localRotation.copy(q);
            childGameObject.transform.localScale.copy(s);

            loadedNode.gameObjects.push(childGameObject);
            loadedNode.meshes.push(threeMesh);
        }

        return loadedNode;
    }
    
    private SetNodeMask(loadedNode, mask: number) {
        if (mask != loadedNode.mask) {
            for (let mesh of loadedNode.meshes) {
                TerrainUtils.SetMeshOctantMask(mesh, mask);
            }
        }
    }

    private AddColliderToNode(loadedNode: LoadedNode) {
        this.currentColliderCount++;
        for (let gameObject of loadedNode.gameObjects) {
            const meshCollider = gameObject.AddComponent(Components.MeshCollider) as Components.MeshCollider;
            meshCollider.body.shape.setName(loadedNode.path);
            gameObject.transform.tag = "Ground";
        }
        loadedNode.has_collider = true;
    }

    private RemoveColliderFromNode(loadedNode: LoadedNode) {
        this.currentColliderCount--;
        for (let gameObject of loadedNode.gameObjects) {
            const meshCollider = gameObject.GetComponent(Components.MeshCollider) as Components.MeshCollider;

            if (meshCollider)
                meshCollider.Destroy();
        }
    }

    private RemoveNode(loadedNode: LoadedNode) {
        if (loadedNode.has_collider) {
            this.RemoveColliderFromNode(loadedNode);
        }
        for (let gameObject of loadedNode.gameObjects) {
            gameObject.Destroy();
        }
        this.loadedNodes.delete(loadedNode.path);
    }

    private NodeValidationHandler(node: NodeHeader) {
        try {
            if (node.path.length >= 22) return false;

            const validNodeTopNode = this.nodeValidator.isNodeIntersectingCamera(this.worldPosition.clone().add(this.topCamera.transform.position), this.topCamera, node);
            return validNodeTopNode;
        } catch (error) {
            console.error(error)
        }
    }

    private finishGettingNodes(nodes: Map<string, NodeData>) {

        let masks = this.tileManager.getMasksForNodes(nodes);

        this.currentHighestNodePath = "";
        for (let node_map of nodes) {
            const path = node_map[0];

            if (path.length <= 15 && path.length > this.currentHighestNodePath.length) this.currentHighestNodePath = path;
        }

        const intersectingNodes = this.debugger.GetIntersectingNodesForCamera(nodes);

        for (let node_map of this.loadedNodes) {
            const path = node_map[0];
            const loadedNode = node_map[1];
            const mask = masks.get(path);

            if (!intersectingNodes.has(path)) {
                this.RemoveNode(loadedNode);
                continue;
            }

            this.SetNodeMask(loadedNode, mask);
        }
        
        for (let node_map of intersectingNodes) {
            const node = node_map[1];

            if (node.state != NodeState.DECODED) continue;

            if (!this.loadedNodes.has(node.path)) {
                const loadedNode = this.loadNode(node, false);
                if (loadedNode) {
                    this.AddColliderToNode(loadedNode);
                    this.loadedNodes.set(node.path, loadedNode);
                }
            }
        }
    }

    public GetCurrentNodeCount(): number {
        return this.currentNodeCount;
    }

    public GetLoadedNodeCount(): number {
        return this.loadedNodes.size;
    }

    public GetColliderCount(): number {
        return this.currentColliderCount;
    }    
}