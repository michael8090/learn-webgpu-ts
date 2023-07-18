class Engine {
    canvas: HTMLCanvasElement;
    device: GPUDevice;
    width: number;
    height: number;

    context: GPUCanvasContext;
    format: GPUTextureFormat;

    pipelineDesc: GPURenderPipelineDescriptor;
    pipeline: GPURenderPipeline;
    vertexBufferLayout: GPUVertexBufferLayout;
    vertexBuffer: GPUBuffer;
    vertexData: Float32Array;
    bindGroup: GPUBindGroup;

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

        this.initVertexBuffer();

        this.initPipeline();
    }

    private initVertexBuffer() {
        const {device} = this;

        const vertexData = new Float32Array([
            -1, -1, 0,
            1, -1, 0,
            -1, 1, 0,

            1, -1, 0,
            1, 1, 0,
            -1, 1, 0,
        ]);

        const vertexBuffer = device.createBuffer({
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(vertexBuffer, 0, vertexData);

        const vertexBufferLayout: GPUVertexBufferLayout = {
            arrayStride: 12,
            attributes: [{
                format: 'float32x3' as const,
                offset: 0,
                shaderLocation: 0
            }]
        };

        this.vertexBufferLayout = vertexBufferLayout;
        this.vertexBuffer = vertexBuffer;
        this.vertexData = vertexData;
    }

    private getShaderModule() {
        const {device} = this;
        const shaderString = `
        struct VertexOutput {
            @builtin(position) position: vec4f,
            @location(0) positionNorm: vec4f,
        }

        @vertex
        fn mainVs(@location(0) pos: vec3f) -> VertexOutput {
            var vsOut: VertexOutput;
            let p = vec4f(pos, 1.0);
            vsOut.position = p;
            vsOut.positionNorm = p;
            return vsOut;
        }


        @fragment
        fn mainFs(vsOut: VertexOutput) -> @location(0) vec4f {
            let p = vsOut.positionNorm;
            return vec4f((p.xy + 1.0) * 0.5, 1.0, 1.0);
        }
        
        `;

        return device.createShaderModule({code: shaderString});
    }

    private initPipeline() {
        const {device, format, vertexBufferLayout} = this;

        const bindGroupLayout = device.createBindGroupLayout({
            entries: []
        })

        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: []
        });
        this.bindGroup = bindGroup;

        const shaderModule = this.getShaderModule();

        const pipelineDesc: GPURenderPipelineDescriptor = {
            layout: device.createPipelineLayout({bindGroupLayouts: [bindGroupLayout]}),
            vertex: {
                module: shaderModule,
                entryPoint: 'mainVs',
                buffers: [vertexBufferLayout]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'mainFs',
                targets: [{
                    format
                }]
            }
        }

        const pipeline = device.createRenderPipeline(pipelineDesc);

        this.pipelineDesc = pipelineDesc;
        this.pipeline = pipeline;
    }

    start = () => {
        this.draw();
        requestAnimationFrame(this.start);
    }

    draw() {
        const {device, vertexBuffer, vertexData, pipeline, context, bindGroup} = this;
        const encoder = device.createCommandEncoder();

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear' as const,
                storeOp: 'store' as const,
                clearValue: {r: 0, g: 0, b: 0, a: 1}
            }]
        });

        pass.setBindGroup(0, bindGroup);
        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(vertexData.length / 3);

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

