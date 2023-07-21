import { Camera, CameraController } from "./Camera";
import {vec3, mat4, Vec3} from 'wgpu-matrix';
import { makeMeshPipeline } from "./pipeline";
import { Mesh } from "./Mesh";
import { makePlane } from "./shapeBuilder";

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
    meshBuffers: GPUBuffer[] = [];
    meshTransformBuffers: GPUBuffer[] = [];
    meshBindGroups: GPUBindGroup[] = [];

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

        this.camera = new Camera(0.1, 1000, 50, width / height, [0, 0, 0.5]);

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

        this.initMeshes();


        this.cameraController = new CameraController(this.camera.transform, () => {
            this.uploadCameraState();
        });
        this.cameraController.start(this.canvas);
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

    private initMeshes(n = 10) {
        const {device, meshBuffers, meshTransformBuffers: meshTransforms, meshBindGroups, cameraProjectionBuffer, cameraTransformBuffer} = this;

        const r = () => Math.random() * 5;
        const meshes = Array(n).fill(0).map((i) => {
            const s = Math.random() * 5;
            return makePlane(s, s, [r(), r(), r()]);
        });

        meshes.forEach(m => {
            const {attribute, transform} = m;
            const vertexBuffer = device.createBuffer({
                size: attribute.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
            });
    
            device.queue.writeBuffer(vertexBuffer, 0, attribute);
            meshBuffers.push(vertexBuffer);


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
                },]
            }))
        });

        this.meshes = meshes;
    }

    private uploadMeshUniforms() {
        const {meshes, meshTransformBuffers, device} = this;
        meshes.forEach((m, i) => {
            device.queue.writeBuffer(meshTransformBuffers[i], 0, m.transform);
        });
    }

    private uploadCameraState() {
        this.device.queue.writeBuffer(this.cameraTransformBuffer, 0, this.camera.transform);
    }

    start = () => {
        // this.cameraState.phi += 0.01;
        // this.cameraState.theta += 0.01;

        this.meshes.forEach(m => {
            // m.rotation[1] += 0.01;
            m.update();
        });

        this.uploadMeshUniforms();
        
        this.uploadCameraState();
        this.draw();
        requestAnimationFrame(this.start);
    }

    draw() {
        const {device, pipeline, context, meshes, meshBuffers, meshBindGroups, renderPassDesc} = this;
        const encoder = device.createCommandEncoder();

        renderPassDesc.colorAttachments[0].view = context.getCurrentTexture().createView();
        const pass = encoder.beginRenderPass(renderPassDesc);

        pass.setPipeline(pipeline);

        for (let i = 0, l = meshBuffers.length; i < l; i++) {
            pass.setBindGroup(0, meshBindGroups[i]);
            pass.setVertexBuffer(0, meshBuffers[i]);
            pass.draw(meshes[i].attribute.length / 3);
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

