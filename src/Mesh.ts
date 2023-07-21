import { mat4, Vec3 } from "wgpu-matrix";

export class Mesh {
    transform = mat4.identity() as Float32Array;

    constructor(public attribute: Float32Array, public position: Vec3, public rotation: Vec3, public scale: Vec3, ) {
        this.update();
    }

    update() {
        mat4.scale(mat4.identity(), this.scale, this.transform);

        mat4.rotate(this.transform, [1, 0, 0], this.rotation[0], this.transform);
        mat4.rotate(this.transform, [0, 1, 0], this.rotation[1], this.transform);
        mat4.rotate(this.transform, [0, 0, 1], this.rotation[2], this.transform);

        mat4.translate(this.transform, this.position, this.transform);
    }
}


