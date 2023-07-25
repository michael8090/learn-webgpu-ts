import { mat4, Vec3 } from "wgpu-matrix";
import { AttributeDesc, UniformDesc } from "./GpuResources";
import { ImageLoader } from "./ImageLoader";

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

interface UploaderConfig {
    index: {
        getCpuData(): Uint32Array;
    }

    attributes: Array<{
        getCpuData(): any;
        desc: AttributeDesc;
    }>

    uniforms: Array<{
        getCpuData(): any;
        desc: UniformDesc;
    }>

}
class Uploader {
    gpuResources: {[key: string]: GPUBuffer | GPUTexture | GPUSampler} = {}

    constructor(public config: UploaderConfig) {

    }

    // I assume the data is immutable, so I only allocate gpu resources of a fixed sizes
    async upload(device: GPUDevice, name: string) {
        const {config} = this;
        if (name === 'index') {
            // update index buffer
            let gpuResource = this.gpuResources[name] as GPUBuffer;
            const indexData = config.index.getCpuData();
            if (!gpuResource) {
                gpuResource = device.createBuffer({
                    size: indexData.byteLength,
                    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
                });
                this.gpuResources[name] = gpuResource;
            }
            device.queue.writeBuffer(gpuResource, 0, indexData);
        }
        const {attributes, uniforms} = config;

        const attribute = attributes.find(ad => ad.desc.name === name);
        if (!!attribute) {
            // upload attribute
            const attributeData = attribute.getCpuData() as Float32Array;
            let gpuResource = this.gpuResources[name] as GPUBuffer;
            if (!gpuResource) {
                gpuResource = device.createBuffer({
                    size: attributeData.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
                });
                this.gpuResources[name] = gpuResource;
                device.queue.writeBuffer(gpuResource, 0, attributeData);
            }

        } else {
            const uniform = uniforms.find(u => u.desc.name === name);
            if (!!uniform) {
                // upload uniform

                if (uniform.desc.type === 'buffer') {
                    const uniformData =  uniform.getCpuData() as Float32Array;
                    let gpuResource = this.gpuResources[name] as GPUBuffer;
                    if (!gpuResource) {
                        gpuResource = device.createBuffer({
                            size: uniformData.byteLength,
                            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
                        });
                        this.gpuResources[name] = gpuResource;
                    }
                    device.queue.writeBuffer(gpuResource, 0, uniformData);
                } else if (uniform.desc.type === 'sampler') {
                    let gpuResource = this.gpuResources[name] as GPUSampler;
                    if (!gpuResource) {
                        gpuResource = device.createSampler();
                        this.gpuResources[name] = gpuResource;
                    }
                } else if (uniform.desc.type === 'texture') {
                    // const uniformPropertyName = name + 'Url';
                    // const url = this.uniforms[uniformPropertyName] as string;
                    const url = uniform.getCpuData() as string;
                    const imageData = await imageLoader.getImageData(url);

                    let gpuResource = this.gpuResources[name] as GPUTexture;
                    if (!gpuResource) {
                        gpuResource = device.createTexture({
                            size: [imageData.width, imageData.height],
                            format: 'rgba8unorm',
                            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
                        });
                        this.gpuResources[name] = gpuResource;
                    }
                    device.queue.writeTexture({texture: gpuResource}, imageData.data, {bytesPerRow: imageData.width * 4}, [imageData.width, imageData.height]);
                }
            } else {
                throw `${name} is not a gpu resource for current uploader. Attributes: ${JSON.stringify(.attributes.map(a => a.desc.name))} . \nUniforms: ${JSON.stringify(uniforms.map(u => u.desc.name))}`;
            }
        }
    }

    async uploadAll(device: GPUDevice) {
        const {config: {index, attributes, uniforms}} = this;
        await this.upload(device, 'index');
        for (let {desc: {name}} of attributes) {
            await this.upload(device, name);
        }
        for (let {desc: {name}} of uniforms) {
            await this.upload(device, name);
        }
    }
}

const imageLoader = new ImageLoader();


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
        name: 'transform',
        type: 'buffer',
        dataType: 'mat4x4<f32>',
    },{
        name: 'emissiveColor',
        type: 'buffer',
        dataType: 'vec3f',
    }, {
        name: 'texture',
        type: 'texture',
        dataType: 'f32'
    }, {
        name: 'sampler',
        type: 'sampler'
    }]
} as const satisfies {attributes: readonly AttributeDesc[], uniforms: readonly UniformDesc[]};

type ArrayElement<ArrayType extends readonly unknown[]> = 
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export class Mesh {
    index: Uint32Array;
    // todo: automatic upload
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

    // I assume the data is immutable, so I only allocate gpu resources of a fixed sizes
    async upload(device: GPUDevice, name: 'index' | ArrayElement<typeof MeshDesc['attributes']>['name'] | ArrayElement<typeof MeshDesc['uniforms']>['name']) {
        await this.uploader.upload(device, name);
    }

    async uploadAll(device: GPUDevice) {
        await this.uploader.uploadAll(device);
    }
}


