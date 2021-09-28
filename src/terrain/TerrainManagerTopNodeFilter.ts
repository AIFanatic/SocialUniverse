import { NodeData } from "earth-3d";
import { Components } from "trident";
import { Vector3 } from 'three';
import { TerrainManagerTopNodeFilterDebugger } from "./TerrainManagerTopNodeFilterDebugger";

class Box {
    x1: number;
    y1: number;
    w: number;
    h: number;
}
export class TerrainManagerTopNodeFilter extends Components.Component {
    public currentNodes: Map<string, NodeData> = new Map(); // Debug
    public currentIntersectingNodes: Map<string, NodeData> = new Map(); // Debug
    public currentCameraRects: Box[] = []; // Debug;

    public camera: Components.Camera;
    public worldPosition: Vector3;

    private debugger: TerrainManagerTopNodeFilterDebugger;
    
    public OnEnable() {
        if (this.gameObject.scene.HasGizmosEnabled()) {
            this.debugger = new TerrainManagerTopNodeFilterDebugger(this);
        }
    }

    private CartesianToCarto(position: Vector3): {lon: number, lat: number, height: number} {
        const x = position.x;
        const y = position.y;
        const z = position.z;
        const lon = Math.atan2(y, x) * 180 / Math.PI;
        const lat = Math.atan2(z, Math.sqrt(x*x + y*y)) * 180 / Math.PI;
        const height = Math.sqrt(x * x + y * y + z * z);

        return {lon: lon, lat: lat, height: height};
    }

    private intersectBox(a: Box, b: Box) {
        const aminX = a.x1;
        const amaxX = a.x1+a.w;
        const aminY = a.y1;
        const amaxY = a.y1+a.h;

        const bminX = b.x1;
        const bmaxX = b.x1+b.w;
        const bminY = b.y1;
        const bmaxY = b.y1+b.h;
        return (aminX <= bmaxX && amaxX >= bminX) &&
                (aminY <= bmaxY && amaxY >= bminY) //&&
                // (a.minZ <= b.maxZ && a.maxZ >= b.minZ);
    }
    
    private GetNodeBox(node: NodeData): Box {
        const latlonbox = node.latLonBox;
    
        // Probably something wrong here, x1,y1 should be the other way around?
        // but that leads to a mirrored image
        let w = latlonbox.e - latlonbox.w;
        let h = latlonbox.n - latlonbox.s;

        let x1 = latlonbox.n - h;
        let y1 = latlonbox.e - w;

        return {x1: x1, y1: y1, w: w, h: h};
    }

    // Get camera subdivisions in cartographic coordinates
    private GetCameraRects(worldPosition: Vector3, camera: Components.Camera): Box[] {
        // Camera rects
        const position = worldPosition;

        const _camera = camera.GetCamera();
        const hFar = 2 * Math.tan(_camera.fov * Math.PI / 180 / 2) * _camera.far;
        const wFar = hFar * _camera.aspect;

        const wVec = new Vector3(wFar/2,0,0).applyQuaternion(_camera.quaternion);
        const west = this.CartesianToCarto(position.clone().sub(wVec));
        const east = this.CartesianToCarto(position.clone().add(wVec));
        const wCarto = east.lat - west.lat;

        const cameraCarto = this.CartesianToCarto(position);

        let mouseRects: Box[] = [];
        const w = wCarto * 2;
        const x1 = cameraCarto.lat-wCarto;
        const y1 = cameraCarto.lon-wCarto;
        
        const step = w / 10;
        for (let x = 0; x < w; x+=step) {
            for (let y = 0; y < w; y+=step) {
                mouseRects.push({
                    x1: x1+x,
                    y1: y1+y,
                    w: step,
                    h: step
                })
            }
        }

        return mouseRects;
    }

    private GetCameraIntersectingNodes(cameraRects: Box[], nodes: Map<string, NodeData>): Map<string, NodeData> {
        let intersectionNodes: Map<string, NodeData> = new Map();

        for (let mouseRect of cameraRects) {
            let smallestNodeIntersection: NodeData = null;
            for (let node_map of nodes) {
                const node = node_map[1];

                const nodeBox = this.GetNodeBox(node);
                const intersects = this.intersectBox(mouseRect, nodeBox);

                if (intersects) {
                    if (!smallestNodeIntersection) {
                        smallestNodeIntersection = node;
                        continue;
                    }
                    if (node.path.length > smallestNodeIntersection.path.length) {
                        smallestNodeIntersection = node;
                    }
                }
            }

            if (smallestNodeIntersection) {
                intersectionNodes.set(smallestNodeIntersection.path, smallestNodeIntersection);
            }
        }

        return intersectionNodes;
    }

    public GetIntersectingNodesForCamera(nodes: Map<string, NodeData>): Map<string, NodeData> {
        const cameraRects = this.GetCameraRects(this.worldPosition, this.camera);
        const intersectionNodes = this.GetCameraIntersectingNodes(cameraRects, nodes);
        
        this.currentNodes = nodes;
        this.currentIntersectingNodes = intersectionNodes;
        this.currentCameraRects = cameraRects;

        return intersectionNodes;
    }
}