import { Vec3 } from "wgpu-matrix";

export class SpotLight {
    buffer: Float32Array;
    constructor(public position: Vec3, public color: Vec3) {
        this.updateBuffer();
    }
    updateBuffer() {
        this.buffer = new Float32Array(Array.from(this.position).concat(0).concat(Array.from(this.color).concat(0)));
    }
}
