import { Components } from "trident";
import { Transform } from "trident/dist/esm/components";
import { Texture, LinearFilter, SpriteMaterial, Sprite } from "three";

export class ChatBubble extends Components.Component {
    public target: Transform;
    public upOffset: number;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private texture: Texture;
    private mesh: Sprite;

    private timer;

    public Start() {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        
        this.canvas.width = 512;
        this.canvas.height = 512;

        this.texture = new Texture(this.canvas);
        this.ctx.font = '20pt Arial';
        this.ctx.fillStyle = 'black';
        this.ctx.textAlign = "center";
        this.ctx.scale(1, 2)

        this.texture.generateMipmaps = false;
        this.texture.minFilter = LinearFilter;
        this.texture.needsUpdate = true;
        
        var material = new SpriteMaterial({ map: this.texture });
        this.mesh = new Sprite(material);
        this.mesh.scale.set(10,5,1)

        this.transform.group.add(this.mesh);
        this.transform.parent = this.target;
        this.transform.localPosition.copy(
            this.target.up
        ).multiplyScalar(this.upOffset)
    }

    public ShowText(text: string) {
        if (this.mesh.visible) {
            clearTimeout(this.timer);
        }
        this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        this.ctx.fillStyle = 'white';

        const chunks = text.length > 40 ? text.match(/.{40}/g).reverse() : [text];

        let cH = this.ctx.measureText("M").width + 20;

        let s = this.canvas.height-cH - 256;

        for (let chunk of chunks) {
            this.ctx.fillText(chunk, this.canvas.width / 2, s);
            s-=cH;
        }

        this.texture.needsUpdate = true;

        this.mesh.visible = true;
        this.timer = setTimeout(() => {
            this.mesh.visible = false;
        }, 10000);
    }

    public Destroy() {
        this.transform.group.remove(this.mesh);
        this.gameObject.RemoveComponent(this);
    }
}