import { Vec3 } from "wgpu-matrix";

export class SpotLight {
    buffer: Float32Array;
    constructor(public position: Vec3, public color: Vec3) {
    }
}
