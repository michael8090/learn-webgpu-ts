import { UniformDesc, BufferUniformDesc, TextureUniformDesc, SamplerUniformDesc, WgslDataTypes, AttributeDesc, WgslAttributeDataTypeAlias } from "./GpuResources";

const isBufferUniform = (desc: UniformDesc): desc is BufferUniformDesc => desc.type === 'buffer';
const isTextureUniform = (desc: UniformDesc): desc is TextureUniformDesc => desc.type === 'texture';
const isSamplerUniform = (desc: UniformDesc): desc is SamplerUniformDesc => desc.type === 'sampler';

function buildBindGroupEntries(uniforms: UniformDesc[]): GPUBindGroupLayoutEntry[] {
    // sort the uniforms in alphabet order
    return uniforms.sort((a, b) => a.name < b.name ? -1 : 1).map((desc, i) => {
        if (isBufferUniform(desc)) {
            return ({
                // buffer
                binding: i,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: 'uniform' as const,
                    minBindingSize: WgslDataTypes[desc.dataType]
                }
            });
        }
        if (isTextureUniform(desc)) {
            return ({
                // texture
                binding: i,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'float' as const,
                    viewDimension: '2d' as const,
                }
            });
        }
        if (isSamplerUniform(desc)) {
            return ({
                // sampler
                binding: i,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                sampler: {
                    type: 'filtering' as const
                },
            });
        }
    });
}

function buildUniformShaderDeclarations(uniforms: UniformDesc[]) {
    // sort the uniforms in alphabet order
    return uniforms.sort((a, b) => a.name < b.name ? -1 : 1).map((desc, i) => {
        if (isBufferUniform(desc)) {
            return `@group(0) @binding(${i++}) var<uniform> ${desc.name}: ${desc.dataType}`;
        }
        if (isTextureUniform(desc)) {
            return `@group(0) @binding(${i++}) var ${desc.name}: texture_2d<${desc.dataType}>;`;
        }
        if (isSamplerUniform(desc)) {
            return `@group(0) @binding(${i++}) var ${desc.name}: sampler;`;
        }
    }).join('\n');
}

function buildVertexBufferLayouts(attributes: AttributeDesc[]): GPUVertexBufferLayout[] {
    // sort the attributes in alphabet order
    return attributes.sort((a, b) => a.name < b.name ? -1 : 1).map((desc, i) => ({
        arrayStride: WgslDataTypes[desc.dataType],
        attributes: [{
            format: WgslAttributeDataTypeAlias[desc.dataType],
            offset: 0,
            shaderLocation: i
        }]
    }))
}

function buildVertexShaderDeclarations(attributes: AttributeDesc[]) {
    return `
struct VertexInput {
    ${attributes.sort((a, b) => a.name < b.name ? -1 : 1).map((desc, i) => `@location(i) ${desc.name}: ${desc.dataType},`).join('\n    ')}
}
`;
}

export function makeMeshPipeline(device: GPUDevice, format: GPUTextureFormat, uniforms: UniformDesc[], attributes: AttributeDesc[]) {
    const shaderModule = device.createShaderModule({
        code: /* wgsl */`
            // struct Light {
            //     position: vec4f,
            //     color: vec3f,
            // }

            // @group(0) @binding(0) var<uniform> projectMatrix: mat4x4<f32>;
            // @group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
            // @group(0) @binding(2) var<uniform> modelMatrix: mat4x4<f32>;
            // @group(0) @binding(3) var ourTexture: texture_2d<f32>;
            // @group(0) @binding(4) var ourSampler: sampler;
            // @group(0) @binding(5) var<uniform> light: Light;
            // @group(0) @binding(6) var<uniform> cameraPosition: vec3f;
            // @group(0) @binding(7) var<uniform> emissiveColor: vec3f;
            // @group(0) @binding(8) var<uniform> normalMatrix: mat3x4<f32>;

            ${buildUniformShaderDeclarations(uniforms)}

            // struct VertexInput {
            //     @location(0) pos: vec3f,
            //     @location(1) normal: vec3f,
            //     @location(2) uv: vec2f,
            // }
            ${buildVertexShaderDeclarations(attributes)}

            struct VertexOutput {
                @builtin(position) position: vec4f,
                @location(0) normal: vec3f,
                @location(1) uv: vec2f,
                @location(2) vPosition: vec3f,
            }

            @vertex
            fn mainVs(vsInput: VertexInput) -> VertexOutput {
                var vsOut: VertexOutput;
                let p = vec4f(vsInput.pos, 1.0);
                vsOut.position = projectMatrix * viewMatrix * modelMatrix * p;

                // wgsl requires mat3x4*vec3 or vec4*mat3x4, wtf??? why use such a strange order? wgsl hates developers?
                vsOut.normal = (vec4f(vsInput.normal, 1) * normalMatrix).xyz;
                vsOut.uv = vsInput.uv;
                vsOut.vPosition = (modelMatrix * p).xyz;
                return vsOut;
            }

            fn isWithin(x: f32) -> bool {
                return x > -1.0 && x < 1.0;
            }

            fn isAllWithin(v: vec3f) -> bool {
                return isWithin(v.x) && isWithin(v.y) && isWithin(v.z);
            }

            @fragment
            fn mainFs(vsOut: VertexOutput) -> @location(0) vec4f {
                let diffuseTextureColor = textureSample(ourTexture, ourSampler, vsOut.uv).xyz;
                // return vec4f((p.xy + 1.0) * 0.5, 1.0, 1.0);
                let spotLightPosition = (lightPosition).xyz;
                // let spotLightPosition = (light.position).xyz / light.position.w;

                // let lightColor = light.color;
                let position = vsOut.vPosition.xyz;

                let lightD = position - spotLightPosition;
                let lightDirection = normalize(lightD);
                // let lightDistance = length(lightD);
                // let sl = lightDistance * lightDistance;
                let normal = normalize(vsOut.normal);

                let moderatedColor = lightColor * diffuseTextureColor;
                
                // ambient
                let ambientColor = 0.1 * diffuseTextureColor;
              
                // diffuse
                let diffuse = max(dot(-lightDirection, normal), 0.0);
                let diffuseColor = moderatedColor * diffuse;
              
                // specular
                let specularStrength = 1.0;
                var specular = 0.0;
                if (dot(-lightDirection, normal) > 0.0) {
                    let reflectDirection = normalize(reflect(lightDirection, normal));
                    let cameraDirection = normalize(cameraPosition - position);
                    specular = pow(max(dot(reflectDirection, cameraDirection), 0.0), 128.0); 
                }

                let specularColor = moderatedColor * specularStrength * specular;

                // return vec4f(specularColor, 1.0);
                return vec4f(ambientColor + diffuseColor + specularColor + emissiveColor, 1.0);




                // let isWithinBox = isWithin(position.x) && isWithin(position.y) && isWithin(position.z);

                // var debugColor = vec4f(0.0, 1.0, 0.0, 1.0);
                // if (!isAllWithin(position / vsOut.position.w)) {
                //     debugColor = vec4f(0.0, 0.0, 1.0, 1.0);
                // }
                // return debugColor;

                // return vec4f(position  * 0.5 + 0.5, 1.0);
            }
        `
    });

    const bindGroupLayout = device.createBindGroupLayout({
        // entries: [{
        //     // projection matrix
        //     binding: 0,
        //     visibility: GPUShaderStage.VERTEX,
        //     buffer: {
        //         type: 'uniform' as const,
        //         minBindingSize: mat4Size
        //     }
        // }, {
        //     // transform matrix
        //     binding: 1,
        //     visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        //     buffer: {
        //         type: 'uniform' as const,
        //         minBindingSize: mat4Size
        //     }
        // }, {
        //     // model matrix
        //     binding: 2,
        //     visibility: GPUShaderStage.VERTEX,
        //     buffer: {
        //         type: 'uniform' as const,
        //         minBindingSize: mat4Size
        //     }
        // }, {
        //     // texture
        //     binding: 3,
        //     visibility: GPUShaderStage.FRAGMENT,
        //     texture: {
        //         sampleType: 'float' as const,
        //         viewDimension: '2d' as const,
        //     }
        // }, {
        //     // sampler
        //     binding: 4,
        //     visibility: GPUShaderStage.FRAGMENT,
        //     sampler: {
        //         type: 'filtering' as const
        //     },
        // }, {
        //     // light color & position, 12 + 12, but as there is padding, so we need 16 + 16
        //     binding: 5,
        //     visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        //     buffer: {
        //         type: 'uniform' as const,
        //         minBindingSize: 32
        //     }
        // }, {
        //     // camera position
        //     binding: 6,
        //     visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        //     buffer: {
        //         type: 'uniform' as const,
        //         minBindingSize: 12
        //     }
        // }, {
        //     // emissive color
        //     binding: 7,
        //     visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        //     buffer: {
        //         type: 'uniform' as const,
        //         minBindingSize: 12
        //     }
        // }, {
        //     // normal matrix
        //     binding: 8,
        //     visibility: GPUShaderStage.VERTEX,
        //     buffer: {
        //         type: 'uniform' as const,
        //         minBindingSize: 48,
        //     }
        // }]
        entries: buildBindGroupEntries(uniforms)
    })


    const pipelineDesc: GPURenderPipelineDescriptor = {
        layout: device.createPipelineLayout({bindGroupLayouts: [bindGroupLayout]}),
        vertex: {
            module: shaderModule,
            entryPoint: 'mainVs',
            // buffers: [{
            //     // position, todo: perspective normal
            //     arrayStride: 12,
            //     attributes: [{
            //         format: 'float32x3' as const,
            //         offset: 0,
            //         shaderLocation: 0
            //     }]
            // }, {
            //     // normal
            //     arrayStride: 12,
            //     attributes: [{
            //         format: 'float32x3' as const,
            //         offset: 0,
            //         shaderLocation: 1
            //     }]
            // }, {
            //     // uv
            //     arrayStride: 8,
            //     attributes: [{
            //         format: 'float32x2' as const,
            //         offset: 0,
            //         shaderLocation: 2
            //     }]
            // }]
            buffers: buildVertexBufferLayouts(attributes)
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
            depthCompare: 'greater'
        },
        multisample: {
            count: 4
        }
        // primitive: {
        //     topology: 'triangle-list'
        // }
    }

    return device.createRenderPipeline(pipelineDesc);
}