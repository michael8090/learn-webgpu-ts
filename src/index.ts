import { Camera, CameraController, CameraUniformDesc } from "./Camera";
import { makeMeshPipeline } from "./pipeline";
import { Mesh, MeshDesc } from "./Mesh";
import { makeCube } from "./shapeBuilder";
import { SpotLight, SpotLightUniformDesc } from "./SpotLight";
import { AttributeDesc, UniformDesc } from "./GpuResources";

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

    meshes: Mesh[];
    meshBindGroups: GPUBindGroup[] = [];

    light = new SpotLight([0, 0, 0], [1, 1, 1]);
    lightIndicator: Mesh;
    renderTexture: GPUTexture;
    renderTextureView: GPUTextureView;
    uniformDesc: UniformDesc[];
    attributeDesc: readonly AttributeDesc[];

    async init() {
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter!.requestDevice();

        const canvas = document.createElement("canvas");
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        document.body.appendChild(canvas);
        const context = canvas.getContext("webgpu")!;
        const format = navigator.gpu.getPreferredCanvasFormat();

        context.configure({
            format,
            device,
        });

        this.canvas = canvas;
        this.device = device;
        this.width = width;
        this.height = height;
        this.context = context;
        this.format = format;

        this.camera = new Camera(0.1, 100000, 50, width / height, [0, 0, 0.5]);

        this.initRenderTarget();

        this.uniformDesc = ([] as UniformDesc[])
            .concat(SpotLightUniformDesc)
            .concat(CameraUniformDesc)
            .concat(MeshDesc.uniforms)
            .sort((a, b) => (a.name < b.name ? -1 : 1));
        this.attributeDesc = MeshDesc.attributes
            .concat([])
            .sort((a, b) => (a.name < b.name ? -1 : 1));

        this.pipeline = makeMeshPipeline(
            device,
            format,
            this.uniformDesc,
            this.attributeDesc
        );
        this.initDepthTexture();

        this.renderPassDesc = {
            colorAttachments: [
                {
                    view: this.renderTextureView,
                    resolveTarget: context.getCurrentTexture().createView(),
                    loadOp: "clear" as const,
                    storeOp: "store" as const,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                },
            ],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 0,
            },
        };

        await this.camera.uploader.uploadAll(device);
        await this.light.uploader.uploadAll(device);

        await this.initMeshes();

        this.cameraController = new CameraController(
            this.camera.transform,
            () => {
                this.uploadCameraState();
            }
        );
        this.cameraController.start(this.canvas);
    }

    private initRenderTarget() {
        const { device, width, height, format } = this;
        const texture = device.createTexture({
            size: [width, height],
            sampleCount: 4,
            format: format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.renderTexture = texture;
        this.renderTextureView = texture.createView();
    }

    private initDepthTexture() {
        const texture = this.device.createTexture({
            size: [this.width, this.height],
            format: "depth32float",
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
            sampleCount: 4,
        });
        this.depthTexture = texture;
    }

    private async initMeshes(n = 100) {
        const { device, meshBindGroups } = this;

        const r = () => (Math.random() - 0.5) * n;
        const meshes = Array(n)
            .fill(0)
            .map((i) => {
                const s = Math.random() * n * 0.15;
                return makeCube(s, [r(), r(), r()]);
            });
        const lightMesh = makeCube(2, this.light.position);
        lightMesh.uniforms.textureUrl = "/assets/light.jpg";
        lightMesh.uniforms.emissiveColor = new Float32Array(this.light.color);
        meshes.push(lightMesh);
        this.lightIndicator = lightMesh;

        const groundMesh = makeCube(
            2000,
            [-1000, 5000, -1000],
            [0, 0, 0],
            [1, 0.02, 1]
        );
        groundMesh.uniforms.textureUrl = "/assets/ground.webp";
        meshes.push(groundMesh);

        const load = async (m: Mesh) => {
            await m.uploadAll(device);

            const bindGroupEntries = [this.light, this.camera, m]
                .reduce((acc, item) => {
                    const entry = item.uploader.config.uniforms!.map((u) => {
                        const name = u.desc.name;
                        const uploadedResource =
                            item.uploader.gpuResources[name];
                        const type = u.desc.type;
                        if (type === "buffer") {
                            return {
                                _name: name,
                                binding: 0,
                                resource: {
                                    buffer: uploadedResource as GPUBuffer,
                                },
                            };
                        } else if (type === "texture") {
                            return {
                                _name: name,
                                binding: 0,
                                resource: (
                                    uploadedResource as GPUTexture
                                ).createView(),
                            };
                        } else if (type === "sampler") {
                            return {
                                _name: name,
                                binding: 0,
                                resource: uploadedResource as GPUSampler,
                            };
                        }
                        throw `unknown type: ${type}`;
                    });
                    acc = acc.concat(entry);
                    return acc;
                }, [] as Array<GPUBindGroupEntry & { _name: string }>)
                .sort((a, b) => (a._name < b._name ? -1 : 1))
                .map((e, i) => ({ binding: i, resource: e.resource }));

            meshBindGroups.push(
                device.createBindGroup({
                    layout: this.pipeline.getBindGroupLayout(0),
                    entries: bindGroupEntries,
                })
            );
        };

        for (let mesh of meshes) {
            await load(mesh);
        }
        this.meshes = meshes;
    }

    private uploadMeshUniforms() {
        const { meshes, device } = this;
        meshes.forEach((m) => {
            m.upload(device, "modelMatrix");
        });
    }

    private uploadCameraState() {
        this.camera.uploader.uploadAll(this.device);
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
        const phi = this.t * 0.01;
        const r = 25;
        this.light.position = [r * Math.cos(phi), 0, r * Math.sin(phi)];
        this.light.updateBuffer();
        this.light.uploader.uploadAll(this.device);

        this.lightIndicator.uniforms.translate = this.light.position;
        this.lightIndicator.updateTransform();
        this.uploadMeshUniforms();

        this.uploadCameraState();
        this.draw();
        requestAnimationFrame(this.start);
    };

    draw() {
        const {
            device,
            pipeline,
            context,
            meshes,
            meshBindGroups,
            renderPassDesc,
        } = this;
        const encoder = device.createCommandEncoder();

        (renderPassDesc.colorAttachments as any)[0].view =
            this.renderTexture.createView();
        (renderPassDesc.colorAttachments as any)[0].resolveTarget = context
            .getCurrentTexture()
            .createView();

        const pass = encoder.beginRenderPass(renderPassDesc);

        pass.setPipeline(pipeline);

        for (let i = 0, l = meshes.length; i < l; i++) {
            const mesh = meshes[i];
            pass.setBindGroup(0, meshBindGroups[i]);
            this.attributeDesc.forEach(({ name }, i) => {
                pass.setVertexBuffer(
                    i,
                    mesh.uploader.gpuResources[name] as GPUBuffer
                );
            });

            pass.setIndexBuffer(
                mesh.uploader.gpuResources.index as GPUBuffer,
                "uint32"
            );
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
