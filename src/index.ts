import { Camera, CameraController } from "./Camera";
import {vec3, vec4, mat4, Vec3} from 'wgpu-matrix';
import { makeMeshPipeline } from "./pipeline";
import { Mesh } from "./Mesh";
import { makeCube } from "./shapeBuilder";
import { ImageLoader } from "./ImageLoader";
import { SpotLight } from "./SpotLight";

class Engine {
    canvas: HTMLCanvasElement;
    device: GPUDevice;
    width: number;
    height: number;

    context: GPUCanvasContext;
    format: GPUTextureFormat;

    pipeline: GPURenderPipeline;
    renderPassDesc: GPURenderPassDescriptor;
    depthTexture: GPUTexture;

    camera: Camera;
    cameraController: CameraController;
    cameraProjectionBuffer: GPUBuffer;
    cameraTransformBuffer: GPUBuffer;

    meshes: Mesh[];
    meshPositionBuffers: GPUBuffer[] = [];
    meshIndexBuffers: GPUBuffer[] = [];
    meshNormalBuffers: GPUBuffer[] = [];
    meshUvBuffers: GPUBuffer[] = [];

    meshTransformBuffers: GPUBuffer[] = [];
    meshBindGroups: GPUBindGroup[] = [];

    imageLoader = new ImageLoader();
    uploadedTextures = new WeakMap<ImageData, {texture: GPUTexture, sampler: GPUSampler}>();

    light = new SpotLight([0, 0, 0], [1, 1, 1]);
    lightBuffer: GPUBuffer;
    lightIndicator: Mesh;

    async init() {
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();

        const canvas = document.createElement('canvas');
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        document.body.appendChild(canvas);
        const context = canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();


        context.configure({
            format,
            device
        });

        this.canvas = canvas;
        this.device = device;
        this.width = width;
        this.height = height;
        this.context = context;
        this.format = format;

        this.camera = new Camera(0.1, 10000, 50, width / height, [0, 0, 0.5]);

        this.pipeline = makeMeshPipeline(device, format);
        this.initDepthTexture();

        this.renderPassDesc = {
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear' as const,
                storeOp: 'store' as const,
                clearValue: {r: 0, g: 0, b: 0, a: 1},
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                depthClearValue: 1
            }
        };

        this.initCameraBuffer();

        this.initLightBuffer();

        await this.initMeshes();


        this.cameraController = new CameraController(this.camera.transform, () => {
            this.uploadCameraState();
        });
        this.cameraController.start(this.canvas);
    }

    private getProjectedLightBuffer() {
        const l = this.light.position;
        let p = vec4.fromValues(l[0], l[1], l[2], 1);
        vec4.transformMat4(p, this.camera.transform, p);
        vec4.transformMat4(p, this.camera.projection, p);
        let ret = [];
        ret = ret.concat(Array.from(p)).concat(this.light.color).concat([0]);
        return new Float32Array(ret);
    }

    private initDepthTexture() {
        const texture = this.device.createTexture({
            size: [this.width, this.height],
            format: 'depth32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.depthTexture = texture;
    }

    private initCameraBuffer() {
        const {device} = this;
        this.cameraProjectionBuffer = device.createBuffer({
            size: this.camera.projection.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.cameraProjectionBuffer, 0, this.camera.projection);

        this.cameraTransformBuffer = device.createBuffer({
            size: this.camera.transform.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.cameraTransformBuffer, 0, this.camera.transform);
    }

    private initLightBuffer() {
        const {device} = this;
        this.lightBuffer = device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.lightBuffer, 0, this.getProjectedLightBuffer());
    }

    private async initMeshes(n = 100) {
        const {device, meshPositionBuffers, meshIndexBuffers, meshNormalBuffers, meshUvBuffers, meshTransformBuffers: meshTransforms, meshBindGroups, cameraProjectionBuffer, cameraTransformBuffer, lightBuffer} = this;

        const r = () => (Math.random() - 0.5) * n;
        const meshes = Array(n).fill(0).map((i) => {
            const s = Math.random() * n * 0.15;
            return makeCube(s, [r(), r(), r()]);
        });
        const lightMesh = makeCube(10, this.light.position);
        meshes.push(lightMesh);
        this.lightIndicator = lightMesh;

        await Promise.all(meshes.map(async m => {
            const {index, attributes: {position: vertex, normal, uv}, uniforms: {textureUrl, transform}} = m;
            const positionBuffer = device.createBuffer({
                size: vertex.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
            });
    
            device.queue.writeBuffer(positionBuffer, 0, vertex);
            meshPositionBuffers.push(positionBuffer);

            const indexBuffer = device.createBuffer({
                size: index.byteLength,
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
            });
    
            device.queue.writeBuffer(indexBuffer, 0, index);
            meshIndexBuffers.push(indexBuffer);

            const normalBuffer = device.createBuffer({
                size: normal.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
            });
    
            device.queue.writeBuffer(normalBuffer, 0, normal);
            meshNormalBuffers.push(normalBuffer);

            const uvBuffer = device.createBuffer({
                size: uv.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
            });
            device.queue.writeBuffer(uvBuffer, 0, uv);
            meshUvBuffers.push(uvBuffer);

            const imageData = await this.imageLoader.getImageData(textureUrl);
            const cached = this.uploadedTextures.get(imageData);
            let texture: GPUTexture, sampler: GPUSampler;
            if (cached) {
                texture = cached.texture;
                sampler = cached.sampler;
            } else {
                texture = device.createTexture({
                    size: [imageData.width, imageData.height],
                    format: 'rgba8unorm',
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
                });
                device.queue.writeTexture({texture}, imageData.data, {bytesPerRow: imageData.width * 4}, [imageData.width, imageData.height]);
    
                sampler = device.createSampler();
            }

            const meshTransformBuffer = device.createBuffer({
                size: transform.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            device.queue.writeBuffer(meshTransformBuffer, 0, transform);
            meshTransforms.push(meshTransformBuffer);

            meshBindGroups.push(device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [{
                    binding: 0,
                    resource: {buffer: cameraProjectionBuffer},
                },{
                    binding: 1,
                    resource: {buffer: cameraTransformBuffer},
                },{
                    binding: 2,
                    resource: {buffer: meshTransformBuffer},
                }, {
                    binding: 3,
                    resource: texture.createView()
                }, {
                    binding: 4,
                    resource: sampler
                }, {
                    binding: 5,
                    resource: {buffer: lightBuffer},
                }]
            }))
        }));

        this.meshes = meshes;
    }

    private uploadMeshUniforms() {
        const {meshes, meshTransformBuffers, device} = this;
        meshes.forEach((m, i) => {
            device.queue.writeBuffer(meshTransformBuffers[i], 0, m.uniforms.transform);
        });
    }

    private uploadCameraState() {
        this.device.queue.writeBuffer(this.cameraTransformBuffer, 0, this.camera.transform);
    }

    private t = 0;

    start = () => {
        // this.cameraState.phi += 0.01;
        // this.cameraState.theta += 0.01;

        // this.meshes.forEach(m => {
        //     m.rotation[1] += 0.01;
        //     m.update();
        // });

        this.t++;
        const phi = this.t * 0.05;
        const r = 25;
        this.light.position = [r * Math.cos(phi), 0, r * Math.sin(phi)];
        this.device.queue.writeBuffer(this.lightBuffer, 0, this.getProjectedLightBuffer());

        this.lightIndicator.uniforms.position = this.light.position;
        this.lightIndicator.updateTransform();
        this.uploadMeshUniforms();
        
        this.uploadCameraState();
        this.draw();
        requestAnimationFrame(this.start);
    }

    draw() {
        const {device, pipeline, context, meshes, meshPositionBuffers, meshNormalBuffers, meshUvBuffers, meshBindGroups, renderPassDesc} = this;
        const encoder = device.createCommandEncoder();

        renderPassDesc.colorAttachments[0].view = context.getCurrentTexture().createView();
        const pass = encoder.beginRenderPass(renderPassDesc);

        pass.setPipeline(pipeline);

        for (let i = 0, l = meshPositionBuffers.length; i < l; i++) {
            pass.setBindGroup(0, meshBindGroups[i]);
            pass.setVertexBuffer(0, meshPositionBuffers[i]);
            pass.setVertexBuffer(1, meshNormalBuffers[i]);
            pass.setVertexBuffer(2, meshUvBuffers[i]);
            pass.setIndexBuffer(this.meshIndexBuffers[i], 'uint32');
            pass.draw(meshes[i].attributes.position.length / 3);
        }

        pass.end();

        device.queue.submit([encoder.finish()]);
    }
}

async function run() {
    const app = new Engine();

    await app.init();

    app.start();
}


run();

