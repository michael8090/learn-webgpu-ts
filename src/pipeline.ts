import { mat4 } from "wgpu-matrix";

const uselessMat4 = mat4.identity() as Float32Array;
const mat4Size = uselessMat4.byteLength;

export function makeMeshPipeline(device: GPUDevice, format: GPUTextureFormat) {
    const shaderModule = device.createShaderModule({
        code: /* wgsl */`
            @group(0) @binding(0) var<uniform> projectMatrix: mat4x4<f32>;
            @group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
            @group(0) @binding(2) var<uniform> modelMatrix: mat4x4<f32>;

            struct VertexOutput {
                @builtin(position) position: vec4f,
                @location(0) positionNorm: vec4f,
            }

            @vertex
            fn mainVs(@location(0) pos: vec3f) -> VertexOutput {
                var vsOut: VertexOutput;
                let p = vec4f(pos, 1.0);
                vsOut.position = projectMatrix * viewMatrix * modelMatrix * p;
                vsOut.positionNorm = p;
                return vsOut;
            }


            @fragment
            fn mainFs(vsOut: VertexOutput) -> @location(0) vec4f {
                let p = vsOut.positionNorm;
                return vec4f((p.xy + 1.0) * 0.5, 1.0, 1.0);
            }
        `
    });

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            // projection matrix
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {
                type: 'uniform' as const,
                minBindingSize: mat4Size
            }
        }, {
            // transform matrix
            binding: 1,
            visibility: GPUShaderStage.VERTEX,
            buffer: {
                type: 'uniform' as const,
                minBindingSize: mat4Size
            }
        }, {
            // model matrix
            binding: 2,
            visibility: GPUShaderStage.VERTEX,
            buffer: {
                type: 'uniform' as const,
                minBindingSize: mat4Size
            }
        }]
    })


    const pipelineDesc: GPURenderPipelineDescriptor = {
        layout: device.createPipelineLayout({bindGroupLayouts: [bindGroupLayout]}),
        vertex: {
            module: shaderModule,
            entryPoint: 'mainVs',
            buffers: [{
                // position
                arrayStride: 12,
                attributes: [{
                    format: 'float32x3' as const,
                    offset: 0,
                    shaderLocation: 0
                }]
            }, {
                // normal
                arrayStride: 12,
                attributes: [{
                    format: 'float32x3' as const,
                    offset: 0,
                    shaderLocation: 1
                }]
            }]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'mainFs',
            targets: [{
                format,
            }]
        },
        depthStencil: {
            format: 'depth32float',
            depthWriteEnabled: true,
            depthCompare: 'less'
        }
        // primitive: {
        //     topology: 'triangle-list'
        // }
    }

    return device.createRenderPipeline(pipelineDesc);
}