import { NodeData } from "earth-3d";
import { TerrainManagerTopNodeFilter } from "./TerrainManagerTopNodeFilter";

class Box {
    x1: number;
    y1: number;
    w: number;
    h: number;
}
export class TerrainManagerTopNodeFilterDebugger {
    private terrainManagerFilter: TerrainManagerTopNodeFilter;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D; 

    private fullScale = 1;
    private xform: DOMMatrix;

    constructor(terrainManagerFilter: TerrainManagerTopNodeFilter) {
        this.terrainManagerFilter = terrainManagerFilter;
        this.canvas = document.createElement("canvas");
        this.canvas.style.position = "absolute";
        this.canvas.style.top = "0";
        this.canvas.style.left = "0";
        this.canvas.style.width = "128px";
        this.canvas.style.height = "128px";
        this.canvas.width = 128;
        this.canvas.height = 128;

        document.body.appendChild(this.canvas);

        this.ctx = this.canvas.getContext("2d");

        const ctx = this.ctx;
        var svg = document.createElementNS("http://www.w3.org/2000/svg",'svg');
        this.xform = svg.createSVGMatrix();
        
        var scale = ctx.scale;
        ctx.scale = (sx,sy) => {
            this.xform = this.xform.scaleNonUniform(sx,sy);
            return scale.call(ctx,sx,sy);
        };
        var translate = ctx.translate;
        ctx.translate = (dx,dy) => {
            this.xform = this.xform.translate(dx,dy);
            return translate.call(ctx,dx,dy);
        };
        var pt  = svg.createSVGPoint();
        // @ts-ignore
        ctx.transformedPoint = (x,y) => {
            pt.x=x; pt.y=y;
            return pt.matrixTransform(this.xform.inverse());
        }
        
        var scaleFactor = 1.1;
        var zoom = (clicks) => {
            var lastX=this.canvas.width/2, lastY=this.canvas.height/2;
            // @ts-ignore
            var pt = this.ctx.transformedPoint(lastX,lastY);
            this.ctx.translate(pt.x,pt.y);
            var factor = Math.pow(scaleFactor,clicks);
            this.fullScale *= factor;
            this.ctx.scale(factor,factor);
            this.ctx.translate(-pt.x,-pt.y);
        }

        zoom(120);

        setInterval(() => {
            this.Render();
        }, 100);
    }

    private moveCanvasToCoordinate(x, y) {
        const px = this.canvas.width/2-x*this.xform.a;
        const py = this.canvas.height/2-y*this.xform.a;

        // @ts-ignore
        const p = this.ctx.transformedPoint(px, py);
        this.ctx.translate(p.x, p.y);
    }

    private simpleHash(s) {
        /* Simple hash function. */
        var a = 1, c = 0, h, o;
        if (s) {
            a = 0;
            /*jshint plusplus:false bitwise:false*/
            for (h = s.length - 1; h >= 0; h--) {
                o = s.charCodeAt(h);
                a = (a<<6&268435455) + o + (o<<14);
                c = a & 266338304;
                a = c!==0?a^c>>21:a;
            }
        }
        let aStr = parseInt(String(a)).toString(16);
        if (aStr.length < 6) {
            const r = this.simpleHash(aStr);
            aStr += r;
        }
        return aStr.substr(0,6);
    };

    private DrawNodes(nodes: Map<string, NodeData>, intersectingNodes: Map<string, NodeData>) {
        for (let node_map of nodes) {
            const node = node_map[1];
            const latlonbox = node.latLonBox;
            
            // Probably something wrong here, x1,y1 should be the other way around?
            // but that leads to a mirrored image
            let w = latlonbox.e - latlonbox.w;
            let h = latlonbox.n - latlonbox.s;

            let x1 = latlonbox.n - h;
            let y1 = latlonbox.e - w;
            
            this.ctx.beginPath();
            this.ctx.lineWidth = 1/this.fullScale;
            this.ctx.rect(x1, y1, w, h);

            // hash path to ensure deterministic color
            this.ctx.strokeStyle = "#" + this.simpleHash(node.path);
            this.ctx.fillStyle = "#" + this.simpleHash(node.path);

            this.ctx.stroke();

            if (intersectingNodes.has(node.path)) {
                this.ctx.fill()
            }
        }
    }

    private DrawCameraRects(cameraRects: Box[]) {
        // Move canvas to the center of the cameraRects
        if (cameraRects.length > 0) {
            const cameraRect = cameraRects[0];
            this.moveCanvasToCoordinate(cameraRect.x1 + (cameraRect.w * 5), cameraRect.y1 + (cameraRect.h * 5));
        }
        
        for (let mouseRect of cameraRects) {
            this.ctx.beginPath();
            this.ctx.rect(mouseRect.x1, mouseRect.y1, mouseRect.w, mouseRect.h);
            this.ctx.strokeStyle = `black`;
            this.ctx.stroke();
        }
    }

    private Render() {
        // @ts-ignore
        var p1 = this.ctx.transformedPoint(0,0);
        // @ts-ignore
        var p2 = this.ctx.transformedPoint(this.canvas.width, this.canvas.height);
        this.ctx.clearRect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y);

        this.DrawNodes(this.terrainManagerFilter.currentNodes, this.terrainManagerFilter.currentIntersectingNodes);
        this.DrawCameraRects(this.terrainManagerFilter.currentCameraRects);

    }
}