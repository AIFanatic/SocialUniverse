export class Queue {
    private data: Array<any>;
    private ids = {};
    private popsFrequencyMilis: number;

    private previousTime: number;

    constructor(popsFrequencyMilis) {
        this.data = new Array();
        this.popsFrequencyMilis = popsFrequencyMilis;

        this.previousTime = performance.now();
    }

    public Push(id: string, data: any) {
        this.ids[id] = true;
        this.data.push({id: id, data: data});
    }

    public Pop(): any {
        if (this.CanProvideData()) {
            const data = this.data.pop();
            if (!data) {
                return false;
            }
            delete this.ids[data.id];
            this.previousTime = performance.now();
            return data.data;
        }
        return false;
    }

    public Has(id: string): boolean {
        return this.ids[id] ? true : false;
    }
    
    public Size(): number {
        return this.data.length;
    }

    private CanProvideData(): boolean {
        const currentTime = performance.now();
        const elapsedTime = currentTime - this.previousTime;
        if (elapsedTime >= this.popsFrequencyMilis) {
            return true;
        }
        return false;
    }

}