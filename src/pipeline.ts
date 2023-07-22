import { mat4 } from "wgpu-matrix";

const uselessMat4 = mat4.identity() as Float32Array;
const mat4Size = uselessMat4.byteLength;

export function makeMeshPipeline(device: GPUDevice, format: GPUTextureFormat) {
    const shaderModule = device.createShaderModule({
        code: /* wgsl */`
            struct Light {
                position: vec4f,
                color: vec3f,
            }

            @group(0) @binding(0) var<uniform> projectMatrix: mat4x4<f32>;
            @group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
            @group(0) @binding(2) var<uniform> modelMatrix: mat4x4<f32>;
            @group(0) @binding(3) var ourTexture: texture_2d<f32>;
            @group(0) @binding(4) var ourSampler: sampler;
            @group(0) @binding(5) var<uniform> light: Light;


            struct VertexOutput {
                @builtin(position) position: vec4f,
                @location(0) normal: vec3f,
                @location(1) uv: vec2f,
            }

            @vertex
            fn mainVs(@location(0) pos: vec3f, @location(1) normal: vec3f,  @location(2) uv: vec2f) -> VertexOutput {
                var vsOut: VertexOutput;
                let p = vec4f(pos, 1.0);
                vsOut.position = projectMatrix * viewMatrix * modelMatrix * p;
                vsOut.normal = normal;
                vsOut.uv = uv;
                return vsOut;
            }


            @fragment
            fn mainFs(vsOut: VertexOutput) -> @location(0) vec4f {
                let diffuseTextureColor = textureSample(ourTexture, ourSampler, vsOut.uv).xyz;
                // return vec4f((p.xy + 1.0) * 0.5, 1.0, 1.0);
                let spotLightPosition = (light.position).xyz;
                let lightColor = light.color;
                let position = vsOut.position.xyz;

                let lightD = position - spotLightPosition;
                let lightDirection = normalize(lightD);
                // let lightDistance = length(lightD);
                // let sl = lightDistance * lightDistance;
                let normal = normalize(vsOut.normal);
                
                // ambient
                let ambientColor = 0.1 * diffuseTextureColor;
              
                // diffuse
                let diffuse = max(dot(-lightDirection, normal), 0.0);
                let diffuseColor = lightColor * diffuse;
              
                // // specular
                // let specularStrength = 0.5;
                // let reflectDirection = normalize(reflect(lightDirection, normal));
                // let cameraPosition = vec
                // let eyeDirection = normalize(u_eye_pos - position);
                // let specular = pow(max(dot(reflectDirection, eyeDirection), 0.0), 256.0); 
                // let specularColor = lightColor * specularStrength * specular;
                return vec4f(ambientColor + diffuseColor, 1.0);

                // return vec4f(position * 0.5 + 0.5, 1.0);
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
        }, {
            // texture
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
                sampleType: 'float' as const,
                viewDimension: '2d' as const,
            }
        }, {
            // sampler
            binding: 4,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {
                type: 'filtering' as const
            },
        }, {
            // light color & position, 12 + 12, but as there is padding, so we need 16 + 16
            binding: 5,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {
                type: 'uniform' as const,
                minBindingSize: 32
            }
        }]
    })


    const pipelineDesc: GPURenderPipelineDescriptor = {
        layout: device.createPipelineLayout({bindGroupLayouts: [bindGroupLayout]}),
        vertex: {
            module: shaderModule,
            entryPoint: 'mainVs',
            buffers: [{
                // position, todo: perspective normal
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
            }, {
                // uv
                arrayStride: 8,
                attributes: [{
                    format: 'float32x2' as const,
                    offset: 0,
                    shaderLocation: 2
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