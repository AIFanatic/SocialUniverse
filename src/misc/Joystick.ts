// Adapted from: https://www.cssscript.com/demo/touch-joystick-controller/

import { Components } from "trident";

export interface JoystickOptions {
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right",
    size: number;
    margin: number,
    color: number;
    noBase: boolean;
}

export class Joystick extends Components.Component {
    public options: JoystickOptions;
    public value: {x: number, y: number};

	private stick: HTMLDivElement;
    private dragStart;
    private touchId;
    private active: boolean;
	private maxDistance = 64;
	private deadzone = 8;

    public Start() {
        if (!this.options) {
            console.error("JoystickOptions not set");
            return;
        }

        // let maxDistance = 64;
        // let deadzone = 8;

        const element = document.createElement("div");

        // TODO: Clean
        const position = {
            top: this.options.position.includes("top") ? this.options.margin : "",
            bottom: this.options.position.includes("bottom") ? this.options.margin : "",
            left: this.options.position.includes("left") ? this.options.margin : "",
            right: this.options.position.includes("right") ? this.options.margin : "",
        }
        const baseStick = this.options.noBase ? "" :
        `
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="${this.options.size/2.5}" fill="#${this.options.color.toString(16)}50"/>
        </svg>`;

        element.innerHTML = 
        `
        <div style="width:${this.options.size}px; height: ${this.options.size}px; position: absolute; top:${position.top}px; left:${position.left}px; bottom:${position.bottom}px; right:${position.right}px">
            ${baseStick}
            <div id="stick1" style="position: absolute; left:0; top:0;width: ${this.options.size}px; height: ${this.options.size}px;">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="${this.options.noBase ? this.options.size : this.options.size/2.5/2}" fill="#${this.options.color.toString(16)}aa"/>
                </svg>
            </div>
        </div>
        `
        document.body.appendChild(element);

		this.stick = element.querySelector("div > div > div") as HTMLDivElement;

		this.value = { x: 0, y: 0 }; 

		this.stick.addEventListener('mousedown', (event) => {this.HandleDown(event)});
		this.stick.addEventListener('touchstart', (event) => {this.HandleDown(event)});
		document.addEventListener('mousemove', (event) => {this.HandleMove(event)}, {passive: false});
		document.addEventListener('touchmove', (event) => {this.HandleMove(event)}, {passive: false});
		document.addEventListener('mouseup', (event) => {this.HandleUp(event)});
		document.addEventListener('touchend', (event) => {this.HandleUp(event)});
    }

	private HandleDown(event) {
		this.active = true;

		// all drag movements are instantaneous
		this.stick.style.transition = '0s';

		// touch event fired before mouse event; prevent redundant mouse event from firing
		event.preventDefault();

		if (event.changedTouches)
			this.dragStart = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
		else
			this.dragStart = { x: event.clientX, y: event.clientY };

		// if this is a touch event, keep track of which one
		if (event.changedTouches)
			this.touchId = event.changedTouches[0].identifier;
	}

	private HandleMove(event) {
		if ( !this.active ) return;

		// if this is a touch event, make sure it is the right one
		// also handle multiple simultaneous touchmove events
		let touchmoveId = null;
		if (event.changedTouches) {
			for (let i = 0; i < event.changedTouches.length; i++) {
				if (this.touchId == event.changedTouches[i].identifier) {
					touchmoveId = i;
					event.clientX = event.changedTouches[i].clientX;
					event.clientY = event.changedTouches[i].clientY;
				}
			}

			if (touchmoveId == null) return;
		}

		const xDiff = event.clientX - this.dragStart.x;
		const yDiff = event.clientY - this.dragStart.y;
		const angle = Math.atan2(yDiff, xDiff);
		const distance = Math.min(this.maxDistance, Math.hypot(xDiff, yDiff));
		const xPosition = distance * Math.cos(angle);
		const yPosition = distance * Math.sin(angle);

		// move stick image to new position
		this.stick.style.transform = `translate3d(${xPosition}px, ${yPosition}px, 0px)`;

		// deadzone adjustment
		const distance2 = (distance < this.deadzone) ? 0 : this.maxDistance / (this.maxDistance - this.deadzone) * (distance - this.deadzone);
		const xPosition2 = distance2 * Math.cos(angle);
		const yPosition2 = distance2 * Math.sin(angle);
		const xPercent = parseFloat((xPosition2 / this.maxDistance).toFixed(4));
		const yPercent = parseFloat((yPosition2 / this.maxDistance).toFixed(4));
		
		this.value = { x: xPercent, y: yPercent };
	}

	private HandleUp(event) {
		if ( !this.active ) return;

		// if this is a touch event, make sure it is the right one
		if (event.changedTouches && this.touchId != event.changedTouches[0].identifier) return;

		// transition the joystick position back to center
		this.stick.style.transition = '.2s';
		this.stick.style.transform = `translate3d(0px, 0px, 0px)`;

		// reset everything
		this.value = { x: 0, y: 0 };
		this.touchId = null;
		this.active = false;
	}
}