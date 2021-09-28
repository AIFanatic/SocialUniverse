import { Components, LayerMask } from 'trident';

import { Vector3, Matrix4, Quaternion, Mesh, MeshBasicMaterial, Material, BoxHelper } from 'three';

import { TerrainUtils } from '../misc/TerrainUtils';

import { NodeManager, NodeData, NodeHeader } from 'earth-3d';
import { NodeValidator } from './NodeValidator';

import { Queue } from '../misc/Queue';
import { GameObject } from 'trident/dist/esm/components';
import { NodeState } from 'earth-3d/dist/esm/node/NodeState';

interface LoadedNode {
    path: string,
    node: NodeData,
    mask: number,
    gameObjects: Array<Components.GameObject>,
    meshes: Array<Mesh>,
    has_collider: boolean
}

export class TerrainManagerViewCamera extends Components.Component {
    private tileManager: NodeManager;

    public viewCamera: Components.Camera;
    public worldPosition: Vector3;

    private loadedNodes = new Map<string, LoadedNode>();
    private currentNodeCount = 0;

    private nodeValidator: NodeValidator;

    private queue: Queue;

    private tileHolder: GameObject;

    public OnEnable() {
        this.nodeValidator = new NodeValidator(this.gameObject.scene.GetRenderer());
        const options = {
            // url: "../test/earth/",
            url: "https://kh.google.com/rt/earth/",
            nodeValidationHandler: (node) => { return this.NodeValidationHandler(node) },
            // rootEpoch: 897,
            workerCount: 4
        };

        this.tileManager = new NodeManager(options);

        this.queue = new Queue(10);
    }

    public Start() {
        if (!this.worldPosition) {
            console.error("No World Position was provided to TerrainManager");
        }
        if (!this.viewCamera) {
            console.error("No View Camera was provided to TerrainManager");
        }

        setInterval(() => {
            const nodes = this.tileManager.get_nodes()
            this.finishGettingNodes(nodes);
        }, 100);

        this.tileHolder = new Components.GameObject(this.gameObject.scene);
        this.tileHolder.transform.parent = this.transform;
    }

    private loadNode(node: NodeData): LoadedNode | null {
        const threeMeshes = TerrainUtils.NodeToTHREE(node, false);

        if (!threeMeshes) return null;

        const loadedNode: LoadedNode = {
            path: node.path,
            node: node,
            mask: 0,
            gameObjects: [],
            meshes: [],
            has_collider: false,
        }

        for (let i = 0; i < threeMeshes.length; i++) {
            const threeMesh = threeMeshes[i];

            // if (this.tileHolder) {
            //     const p = new Vector3();
            //     const q = new Quaternion();
            //     const s = new Vector3();
    
            //     const m = new Matrix4();
            //     // @ts-ignore
            //     m.set(...node.data.matrix_globe_from_mesh).transpose();
            //     m.decompose(p, q, s);
    
            //     threeMesh.position.copy(p);
            //     threeMesh.quaternion.copy(q);
            //     threeMesh.scale.copy(s);
            //     threeMesh.name = "node_" + node.path;

            //     this.tileHolder.transform.group.add(threeMesh);
            //     // loadedNode.gameObjects.push(threeMesh as any);
            //     loadedNode.meshes.push(threeMesh);

            //     return loadedNode;
            // }

            const childGameObject = new Components.GameObject(this.gameObject.scene);
            childGameObject.transform.group.name = "node_" + node.path;
            childGameObject.transform.parent = this.transform;

            const meshFilter = childGameObject.AddComponent(Components.MeshFilter) as Components.MeshFilter;
            meshFilter.mesh = threeMesh.geometry;

            const meshRenderer = childGameObject.AddComponent(Components.MeshRenderer) as Components.MeshRenderer;
            meshRenderer.material = threeMesh.material as Material;

            const p = new Vector3();
            const q = new Quaternion();
            const s = new Vector3();

            const m = new Matrix4();
            // @ts-ignore
            m.set(...node.data.matrix_globe_from_mesh).transpose();
            m.decompose(p, q, s);

            // console.log(node.path, p.x, p.y, p.z)
            // console.log(`${node.obb.center.x}, ${node.obb.center.y}, ${node.obb.center.z}`)
            childGameObject.transform.localPosition.copy(p);
            childGameObject.transform.localRotation.copy(q);
            childGameObject.transform.localScale.copy(s);

            loadedNode.gameObjects.push(childGameObject);
            loadedNode.meshes.push(threeMesh);
        }

        return loadedNode;
    }
    
    private SetNodeMask(loadedNode: LoadedNode, mask: number) {
        if (mask != loadedNode.mask) {
            for (let mesh of loadedNode.meshes) {
                TerrainUtils.SetMeshOctantMask(mesh, mask);
            }
            loadedNode.mask = mask;
        }
    }

    private RemoveNode(loadedNode: LoadedNode) {
        for (let gameObject of loadedNode.gameObjects) {
            gameObject.Destroy();
        }
        this.loadedNodes.delete(loadedNode.path);
    }

    private NodeValidationHandler(node: NodeHeader) {
        try {
            const validViewNode = this.nodeValidator.isNodeIntersectingCamera(this.worldPosition, this.viewCamera, node);
            return validViewNode;
        } catch (error) {
            console.error(error)
        }
    }
    
    private finishGettingNodes(nodes: Map<string, NodeData>) {
        this.currentNodeCount = nodes.size;
        
        for (let node_map of this.loadedNodes) {
            const path = node_map[0];
            const node = node_map[1];

            if (!nodes.has(path)) {
                this.RemoveNode(node);
            }
        }

        const masks = this.tileManager.getMasksForNodes(nodes);
        for (let node_map of nodes) {
            const node = node_map[1];
            const path = node.path;
            // if (!node.data || !node.decodedData) continue;
            // if (!top_nodes.has(node.path)) continue;

            if (node.state != NodeState.DECODED) continue;

            if (this.loadedNodes.has(path)) {
                this.SetNodeMask(this.loadedNodes.get(path), masks[path]);
            }
            else {
                const loadedNode = this.loadNode(node);
                this.loadedNodes.set(node.path, loadedNode);
            }
        }
    }

    public GetCurrentNodeCount(): number {
        return this.currentNodeCount;
    }

    public GetLoadedNodeCount(): number {
        return this.loadedNodes.size;
    }

    public Update() {
        const pendingNode = this.queue.Pop();

        if (pendingNode) {
            const loadedNode = this.loadNode(pendingNode);
            this.loadedNodes.set(pendingNode.path, loadedNode);
        }
    }
}