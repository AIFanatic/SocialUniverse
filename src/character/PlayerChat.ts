import { Components, Input, KeyCodes } from "trident";
import { ChatBubble } from "../misc/ChatBubble";

export class PlayerChat extends Components.Component {
    public player: Components.Transform;
    public OnMessageSent = (message: string) => {};
    public OnChatClosed = () => {};

    private input: Input;
    private chatBubble: ChatBubble;
    
    private textInputBoxElement: HTMLDivElement;
    private textInputElement: HTMLInputElement;

    public Start() {
        if (!this.player) {
            console.error("Player transform not set");
            return;
        }
        this.input = this.gameObject.scene.GetInput();
        this.chatBubble = this.gameObject.AddComponent(ChatBubble) as ChatBubble;
        this.chatBubble.target = this.player;
        this.chatBubble.upOffset = 9;

        this.textInputBoxElement = document.createElement("div");
        this.textInputBoxElement.style.position = "absolute";
        this.textInputBoxElement.style.display = "none";
        this.textInputBoxElement.style.top = "0%";
        this.textInputBoxElement.style.textAlign = "center";
        this.textInputBoxElement.style.width = "100%";
        this.textInputBoxElement.style.height = "100%";
        this.textInputBoxElement.style.background = "#00000040";

        this.textInputElement = document.createElement("input");
        this.textInputBoxElement.style.cursor = "pointer";
        this.textInputElement.style.width = "50%";
        this.textInputElement.style.fontSize = "30px";
        this.textInputElement.style.textAlign = "center";
        this.textInputElement.style.marginTop = "30%";
        this.textInputElement.style.background = "none";
        this.textInputElement.style.border = "none";
        this.textInputElement.style.borderBottom = "1px solid";
        this.textInputElement.style.outline = "none";
        this.textInputElement.style.color = "white";

        this.textInputBoxElement.appendChild(this.textInputElement);
        document.body.appendChild(this.textInputBoxElement);
    }

    public ShowChatBox(): boolean {
        if (this.textInputBoxElement.style.display == "none") {
            this.textInputBoxElement.style.display = "";
            this.textInputElement.focus();
            return true;
        }
        return false;
    }

    private HandleChat() {
        if (this.input.GetKeyDown(KeyCodes.ESCAPE)) {
            if (this.textInputBoxElement.style.display == "") {
                this.textInputElement.blur();
                this.textInputBoxElement.style.display = "none";

                this.OnChatClosed();
            }
        }
        else if (this.input.GetKeyDown(KeyCodes.RETURN)) {
            if (this.textInputBoxElement.style.display == "") {
                this.textInputElement.blur();
                this.textInputBoxElement.style.display = "none";

                const text = this.textInputElement.value;
                if (text != "") {
                    this.chatBubble.ShowText(text);
                    this.OnMessageSent(text);
                    this.textInputElement.value = "";
                }

                this.OnChatClosed();
            }
        }
    }

    public Update() {
        this.HandleChat();
    }
}