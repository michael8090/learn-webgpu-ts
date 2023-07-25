import { AttributeDesc, UniformDesc } from "./GpuResources";
import { ImageLoader } from "./ImageLoader";

interface UploaderConfig {
    index?: {
        getCpuData(): Uint32Array;
    }

    attributes?: Array<{
        getCpuData(): any;
        desc: AttributeDesc;
    }>

    uniforms?: Array<{
        getCpuData(): any;
        desc: UniformDesc;
    }>

}

const imageLoader = new ImageLoader();

export class Uploader {
    gpuResources: {[key: string]: GPUBuffer | GPUTexture | GPUSampler} = {}

    constructor(public config: UploaderConfig) {

    }

    // I assume the data is immutable, so I only allocate gpu resources of a fixed sizes
    async upload(device: GPUDevice, name: string) {
        const {config} = this;
        if (name === 'index') {
            // update index buffer
            let gpuResource = this.gpuResources[name] as GPUBuffer;
            const indexData = config.index!.getCpuData();
            if (!gpuResource) {
                gpuResource = device.createBuffer({
                    size: indexData.byteLength,
                    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
                });
                this.gpuResources[name] = gpuResource;
            }
            device.queue.writeBuffer(gpuResource, 0, indexData);
            return;
        }
        const {attributes, uniforms} = config;

        const attribute = attributes?.find(ad => ad.desc.name === name);
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
            const uniform = uniforms?.find(u => u.desc.name === name);
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
                throw `${name} is not a gpu resource for current uploader. Attributes: ${JSON.stringify(attributes?.map(a => a.desc.name))} . \nUniforms: ${JSON.stringify(uniforms?.map(u => u.desc.name))}`;
            }
        }
    }

    async uploadAll(device: GPUDevice) {
        const {config: {index, attributes, uniforms}} = this;
        if (!!index) {
            await this.upload(device, 'index');
        }
        if (!!attributes) {
            for (let {desc: {name}} of attributes) {
                await this.upload(device, name);
            }
        }
        if (!!uniforms) {
            for (let {desc: {name}} of uniforms) {
                await this.upload(device, name);
            }
        }
    }
}

