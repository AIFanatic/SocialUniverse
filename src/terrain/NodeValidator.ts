import { Frustum, Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { Components } from "trident";
import { NodeHeader } from 'earth-3d';
import { Renderer } from 'trident/dist/esm/Renderer';

export class NodeValidator {
    private projectionWH: number;

    private _frustum: Frustum = new Frustum();
    private _matrix3: Matrix3 = new Matrix3();
    private _matrix4: Matrix4 = new Matrix4();
    private _matrix41: Matrix4 = new Matrix4();
    private _v1: Vector3 = new Vector3();
    private _v2: Vector3 = new Vector3();
    private _v3: Vector3 = new Vector3();
    private _v4: Vector3 = new Vector3();
    private _v5: Vector3 = new Vector3();

    constructor(renderer: Renderer) {
        const canvas = renderer.renderer.domElement;

        // Clamp maximum nodes
        const maxSize = 512;
        const w = canvas.width < maxSize ? canvas.width : maxSize;
        const h = canvas.height < maxSize ? canvas.height : maxSize;

        this.projectionWH = w < h ? w : h;
    }

    private Classify(obb, plane) {
        // const orientation = this._matrix3.set(...obb.orientation.elements);
        const orientation = this._matrix3.set(
            obb.orientation.elements[0],
            obb.orientation.elements[1],
            obb.orientation.elements[2],
            obb.orientation.elements[3],
            obb.orientation.elements[4],
            obb.orientation.elements[5],
            obb.orientation.elements[6],
            obb.orientation.elements[7],
            obb.orientation.elements[8]
        );

        const normal = this._v2.copy(plane.normal).applyMatrix3(orientation);

        const size_x = obb.extents.x;
        const size_y = obb.extents.y;
        const size_z = obb.extents.z;

        const r = Math.abs(size_x * normal.x) + Math.abs(size_y * normal.y) + Math.abs(size_z * normal.z);

        const obb_center = this._v1.set(obb.center.x, obb.center.y, obb.center.z);
        const plane_distance = plane.constant;
        const d = obb_center.dot(plane.normal) + plane_distance;

        if (Math.abs(d) < r) {
            return 0.0;
        }
        else if (d < 0.0) {
            return d + r;
        }
        return d - r;
    }

    private Intersects(frustum, obb) {

        for (let i = 0; i < 6; ++i) {
            const side = this.Classify(obb, frustum.planes[i]);
            if (side < 0) {
                return false;
            }
        }
        return true;
    }

    public GetCameraParameters(worldPosition: Vector3, camera: Components.Camera): [Vector3, Quaternion, Matrix4] {
        const position = worldPosition;
        const quaternion = camera.transform.rotation;
        
        const m = this._matrix41.copy(camera.GetCamera().matrixWorld).setPosition(position).invert();
        const viewprojection = this._matrix4.multiplyMatrices(camera.GetCamera().projectionMatrix, m);

        return [position, quaternion, viewprojection];
    }

    private isNodeTooSmallForProjection(position: Vector3, direction: Quaternion, viewprojection: Matrix4, node: NodeHeader) {
        const eye = this._v1.copy(position);
        const obb_center = this._v2.set(node.obb.center.x, node.obb.center.y, node.obb.center.z);
        
        var _direction = this._v3.set(0,0,-1).applyQuaternion( direction );

        const node_meters_per_texel = node.meters_per_texel;

        const norm = this._v4.copy(eye).sub(obb_center).length();

        const translation = this._v5.copy(eye).add(_direction.multiplyScalar(norm));
        let t = this._matrix41.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        t.makeTranslation(translation.x, translation.y, translation.z);

        const m = this._matrix4.copy(viewprojection).multiply(t);

        const s = m.elements[15];

        const texels_per_meter = 1.0 / node_meters_per_texel;
        const wh = this.projectionWH;
        const r = (2.0*(1.0/s)) * wh;

        return texels_per_meter > r;
    }

    public isNodeIntersectingCamera(worldPosition: Vector3, camera: Components.Camera, node: NodeHeader): boolean {
        const [position, quaternion, viewprojection] = this.GetCameraParameters(worldPosition, camera);

        this._frustum.setFromProjectionMatrix(viewprojection);

        const intersects_node = this.Intersects(this._frustum, node.obb);
        const is_node_too_far = !this.isNodeTooSmallForProjection(position, quaternion, viewprojection, node);

        return intersects_node && is_node_too_far;
    }
}