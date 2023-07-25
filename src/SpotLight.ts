import { Vec3 } from "wgpu-matrix";
import { UniformDesc } from "./GpuResources";
import { Uploader } from "./Uploader";

export const SpotLightUniformDesc = [{
    name: 'lightPosition',
    type: 'buffer',
    dataType: 'vec3f',
}, {
    name: 'lightColor',
    type: 'buffer',
    dataType: 'vec3f',
}] as const satisfies readonly UniformDesc[];

export class SpotLight {
    buffer: Float32Array;
    constructor(public position: Vec3, public color: Vec3) {
        this.updateBuffer();
    }
    updateBuffer() {
        this.buffer = new Float32Array(Array.from(this.position).concat(0).concat(Array.from(this.color).concat(0)));
    }
    uploader = new Uploader({
        uniforms: [{
            desc: SpotLightUniformDesc[0],
            getCpuData: () => new Float32Array(this.position)
        }, {
            desc: SpotLightUniformDesc[1],
            getCpuData: () => new Float32Array(this.color)
        }]
    })
}
