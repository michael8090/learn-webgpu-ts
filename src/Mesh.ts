import { mat4, Vec3 } from "wgpu-matrix";

export class Mesh {


    index: Uint32Array;
    // todo: automatic upload
    attributes: {
        position: Float32Array,
        normal: Float32Array,
        uv: Float32Array,
    };

    uniforms: {
        position: Vec3,
        rotation: Vec3,
        scale: Vec3,
        textureUrl: string,
        transform: Float32Array;
        emissiveColor: Float32Array;
    }

    constructor(index: Uint32Array, attributes: typeof Mesh.prototype.attributes, uniforms: Omit<typeof Mesh.prototype.uniforms, 'transform'>) {
        this.index = index;
        this.attributes = attributes;
        this.uniforms = {
            transform: mat4.identity() as Float32Array,
            ...uniforms
        };
        this.updateTransform();
    }

    updateTransform() {
        const {uniforms: {scale, rotation, position, transform}} = this;

        mat4.scale(mat4.identity(), scale, transform);

        mat4.rotate(transform, [1, 0, 0], rotation[0], transform);
        mat4.rotate(transform, [0, 1, 0], rotation[1], transform);
        mat4.rotate(transform, [0, 0, 1], rotation[2], transform);

        mat4.translate(transform, position, transform);
    }
}


