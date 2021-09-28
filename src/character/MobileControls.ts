import { Components } from "trident";
import { Joystick } from "../misc/Joystick";

export class MobileControls extends Components.Component {
    public moveForward: boolean;
    public moveBackward: boolean;
    public moveLeft: boolean;
    public moveRight: boolean;
    public jump: boolean;
    public noClip: boolean;
    public sprint: boolean;
    public chat: boolean;

    public panHorizontal: number;
    public panVertical: number;

    private movementJoystick: Joystick;
    private cameraJoystick: Joystick;

    public OnEnable () {
        this.movementJoystick =  this.gameObject.AddComponent(Joystick) as Joystick;
        this.movementJoystick.options = {
            position: "bottom-left",
            size: 100,
            margin: 20,
            color: 0xffffff,
            noBase: false
        }

        this.cameraJoystick =  this.gameObject.AddComponent(Joystick) as Joystick;
        this.cameraJoystick.options = {
            position: "bottom-right",
            size: 50,
            margin: 75,
            color: 0xffffff,
            noBase: true
        }

        const buttonControls = document.createElement("div");
        buttonControls.style.width = "160px";
        buttonControls.style.height = "160px";
        buttonControls.style.position = "absolute";
        buttonControls.style.bottom = "20px";
        buttonControls.style.right = "20px";
        buttonControls.innerHTML = `
        <style>
            .noselect {
                -webkit-touch-callout: none; /* iOS Safari */
                -webkit-user-select: none; /* Safari */
                -khtml-user-select: none; /* Konqueror HTML */
                    -moz-user-select: none; /* Old versions of Firefox */
                    -ms-user-select: none; /* Internet Explorer/Edge */
                        user-select: none; /* Non-prefixed version, currently
                                                supported by Chrome, Edge, Opera and Firefox */
            }

            .noHighlight {
                pointer-events: none;
            }
        </style>
        <svg class="noselect" style='font-family: sans-serif; font-size: 20px; stroke-width: 0px;' width="160" height="160" xmlns="http://www.w3.org/2000/svg">
            <circle id="controlsBtnY" cx="50%" cy="16%" r="25" stroke-width="2px" stroke="#e9d311" fill="#ffffff50"/>
            <text class="noHighlight" x="50%" y="16%" text-anchor="middle" fill="#e9d311" dy=".3em">J</text>
            
            <circle id="controlsBtnA" cx="50%" cy="84%" r="25" stroke-width="2px" stroke="#69ba50" fill="#ffffff50"/>
            <text class="noHighlight" x="50%" y="84%" text-anchor="middle" fill="#69ba50" dy=".3em">C</text>

            <circle id="controlsBtnX" cx="16%" cy="50%" r="25" stroke-width="2px" stroke="#07a3e8" fill="#ffffff50"/>
            <text class="noHighlight" x="16%" y="50%" text-anchor="middle" fill="#07a3e8" dy=".3em">N</text>

            <circle id="controlsBtnB" cx="84%" cy="50%" r="25" stroke-width="2px" stroke="#e7443b" fill="#ffffff50"/>
            <text class="noHighlight" x="84%" y="50%" text-anchor="middle" fill="#e7443b" dy=".3em">S</text>
        </svg>
        `
        
        document.body.appendChild(buttonControls);

        const controlsBtnY = document.getElementById("controlsBtnY");
        const controlsBtnB = document.getElementById("controlsBtnB");
        const controlsBtnA = document.getElementById("controlsBtnA");
        const controlsBtnX = document.getElementById("controlsBtnX");

        controlsBtnY.addEventListener("touchstart", (event) => {
            this.jump = true;
            controlsBtnY.setAttribute("fill", "#00000050");
        });
        controlsBtnY.addEventListener("touchend", (event) => {
            this.jump = false;
            controlsBtnY.setAttribute("fill", "#ffffff50");
        });

        controlsBtnB.addEventListener("touchstart", (event) => {
            this.sprint = true;
            controlsBtnB.setAttribute("fill", "#00000050");
        });
        controlsBtnB.addEventListener("touchend", (event) => {
            this.sprint = false;
            controlsBtnB.setAttribute("fill", "#ffffff50");
        });

        controlsBtnA.addEventListener("touchstart", (event) => {
            this.chat = true;
            controlsBtnA.setAttribute("fill", "#00000050");
        });
        controlsBtnA.addEventListener("touchend", (event) => {
            this.chat = false;
            controlsBtnA.setAttribute("fill", "#ffffff50");
        });

        controlsBtnX.addEventListener("touchstart", (event) => {
            this.noClip = true;
            controlsBtnX.setAttribute("fill", "#00000050");
        });

        controlsBtnX.addEventListener("touchend", (event) => {
            controlsBtnX.setAttribute("fill", "#ffffff50");
        });
    }

    public Update() {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.noClip = false;
        
        if (this.movementJoystick.value.y < -0.5) this.moveForward = true;
        if (this.movementJoystick.value.y > 0.5) this.moveBackward = true;

        if (this.movementJoystick.value.x < -0.5) this.moveLeft = true;
        if (this.movementJoystick.value.x > 0.5) this.moveRight = true;



        this.panHorizontal = this.cameraJoystick.value.x;
        this.panVertical = this.cameraJoystick.value.y;
    }
}