import { mat3, mat4, Vec3 } from "wgpu-matrix";
import { AttributeDesc, UniformDesc } from "./GpuResources";
import { Uploader } from "./Uploader";

// function makeEngineClass(attributes: AttributeDesc[], uniforms: UniformDesc[]) {
//     return class {
//         index: Uint32Array;

//     };
// }

// /**
//  * The inner format for render engine. We can create a higher level user friendly structure above it.
//  * Loaders should generate data of this format.
//  */
// export class EngineRenderElement {
//     // the data definition should be static members
//     static attributes: AttributeDesc[];
//     static uniforms: UniformDesc[];
//     constructor(public attributes: AttributeDesc[], uniforms: UniformDesc[]) {}
// }



// maybe we can generate it automatically
export const MeshDesc = {
    attributes: [{
        name: 'vertexPosition',
        dataType: 'vec3f',
    }, {
        name: 'normal',
        dataType: 'vec3f',
    }, {
        name: 'uv',
        dataType: 'vec2f',
    }],
    uniforms: [{
        name: 'modelMatrix',
        type: 'buffer',
        dataType: 'mat4x4<f32>',
    },{
        name: 'emissiveColor',
        type: 'buffer',
        dataType: 'vec3f',
    }, {
        name: 'diffuseTexture',
        type: 'texture',
        dataType: 'f32'
    }, {
        name: 'diffuseSampler',
        type: 'sampler'
    }, {
        name: 'normalMatrix',
        type: 'buffer',
        dataType: 'mat3x4<f32>',
    }]
} as const satisfies {attributes: readonly AttributeDesc[], uniforms: readonly UniformDesc[]};

type ArrayElement<ArrayType extends readonly unknown[]> = 
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export class Mesh {
    index: Uint32Array;
    attributes: {
        position: Float32Array,
        normal: Float32Array,
        uv: Float32Array,
    };

    uniforms: {
        translate: Vec3,
        rotation: Vec3,
        scale: Vec3,
        textureUrl: string,
        transform: Float32Array;
        emissiveColor: Float32Array;
    }

    uploader = new Uploader({
        index: {
            getCpuData: () => this.index
        },
        
        attributes: [{
            desc: MeshDesc.attributes[0],
            getCpuData: () => this.attributes.position
        },{
            desc: MeshDesc.attributes[1],
            getCpuData: () => this.attributes.normal
        },{
            desc: MeshDesc.attributes[2],
            getCpuData: () => this.attributes.uv
        }],

        uniforms: [{
            desc: MeshDesc.uniforms[0],
            getCpuData: () => this.uniforms.transform
        },{
            desc: MeshDesc.uniforms[1],
            getCpuData: () => this.uniforms.emissiveColor
        },{
            desc: MeshDesc.uniforms[2],
            getCpuData: () => this.uniforms.textureUrl
        },{
            desc: MeshDesc.uniforms[3],
            getCpuData: () => null
        }, {
            desc: MeshDesc.uniforms[4],
            getCpuData: () => new Float32Array(mat3.copy(mat4.transpose(mat4.inverse(this.uniforms.transform))))
        }
    ]
    })

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
        const {uniforms: {scale, rotation, translate, transform}} = this;

        mat4.scale(mat4.identity(), scale, transform);

        mat4.rotate(transform, [1, 0, 0], rotation[0], transform);
        mat4.rotate(transform, [0, 1, 0], rotation[1], transform);
        mat4.rotate(transform, [0, 0, 1], rotation[2], transform);

        mat4.translate(transform, translate, transform);
    }

    async upload(device: GPUDevice, name: 'index' | ArrayElement<typeof MeshDesc['attributes']>['name'] | ArrayElement<typeof MeshDesc['uniforms']>['name']) {
        await this.uploader.upload(device, name);
    }

    async uploadAll(device: GPUDevice) {
        await this.uploader.uploadAll(device);
    }
}


