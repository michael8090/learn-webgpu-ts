import { UniformDesc, AttributeDesc } from "../GpuResources";
import { buildUniformShaderDeclarations, buildVertexShaderDeclarations, buildBindGroupEntries, buildVertexBufferLayouts } from "./pipelineUtils";

export function makeMeshPipeline(device: GPUDevice, format: GPUTextureFormat, uniforms: readonly UniformDesc[], attributes: readonly AttributeDesc[]) {
    const uniformDeclarations = buildUniformShaderDeclarations(uniforms);
    const vertexShaderDeclarations = buildVertexShaderDeclarations(attributes);
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

            ${uniformDeclarations}

            // struct VertexInput {
            //     @location(0) position: vec3f,
            //     @location(1) normal: vec3f,
            //     @location(2) uv: vec2f,
            // }
            ${vertexShaderDeclarations}

            struct VertexOutput {
                @builtin(position) position: vec4f,
                @location(0) normal: vec3f,
                @location(1) uv: vec2f,
                @location(2) vPosition: vec3f,
            }

            @vertex
            fn mainVs(vsInput: VertexInput) -> VertexOutput {
                var vsOut: VertexOutput;
                let p = vec4f(vsInput.vertexPosition, 1.0);
                vsOut.position = projectMatrix * viewMatrix * modelMatrix * p;

                /// wgsl requires mat3x4*vec3 or vec4*mat3x4, wtf??? why use such a strange order? Does wgsl hate developers?
                /// it turns out an conversion glsl uses: @see [here](https://www.khronos.org/opengl/wiki/Data_Type_(GLSL)#:~:text=matnxm%3A%20A%20matrix%20with%20n%20columns%20and%20m%20rows%20(examples%3A%20mat2x2%2C%20mat4x3).%20Note%20that%20this%20is%20backward%20from%20convention%20in%20mathematics!)
                /// mat3x4 means 4 rows 3 columns(in math it means 3 rows 4 columns), vec3 is 3rows 1 column, so mat3x4 * vec4 mat4x1, which is vec4
                /// let's look at vec4*mat3x4.
                /// it looks like matrix of 4x1 multiplies matrix of 4x3, which is invalid
                /// but glsl has another rule: when vector is on the left of the multiplication, the column vector automatically becomes a row rector
                /// @see [here](https://en.wikibooks.org/wiki/GLSL_Programming/Vector_and_Matrix_Operations#:~:text=If%20a%20vector%20is%20multiplied%20to%20a%20matrix%20from%20the%20left%2C%20the%20result%20corresponds%20to%20multiplying%20a%20row%20vector%20from%20the%20left%20to%20the%20matrix.%20This%20corresponds%20to%20multiplying%20a%20column%20vector%20to%20the%20transposed%20matrix%20from%20the%20right%3A)
                /// so, vec4 * mat3x4 means, 1x4 * 4x3, which is 1x3, and it's a row vector, but glsl is **smart** enough to turn it into a column vector
                /// I think the rules are overcomplicated for no reason.
                /// So yes, glsl hates developers.
                vsOut.normal = (vec4f(vsInput.normal, 1) * normalMatrix).xyz;
                vsOut.uv = vsInput.uv;
                vsOut.vPosition = (modelMatrix * p).xyz;
                return vsOut;
            }

            fn isWithin(x: f32) -> bool {
                return x >= -1.0 && x <= 1.0;
            }

            fn isAllWithin(v: vec3f) -> bool {
                return isWithin(v.x) && isWithin(v.y) && isWithin(v.z);
            }

            @fragment
            fn mainFs(vsOut: VertexOutput) -> @location(0) vec4f {
                let diffuseTextureColor = textureSample(diffuseTexture, diffuseSampler, vsOut.uv).xyz;
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



                // var debugColor = vec4f(0.0, 1.0, 0.0, 1.0);
                // // if (!isAllWithin((vsOut.position / vsOut.position.w).xyz)) {
                // if (!isWithin(vsOut.position.z)) {
                //     debugColor = vec4f(0.0, 0.0, 1.0, 1.0);
                // }
                // return debugColor;

                // return vec4f(vsOut.position.x / 802.0, vsOut.position.y / 1000.0, 1.0, 1.0);
            }
        `
    });

    const pipelineDesc: GPURenderPipelineDescriptor = {
        layout: device.createPipelineLayout({bindGroupLayouts: [device.createBindGroupLayout({
            entries: buildBindGroupEntries(uniforms)
        })]}),
        vertex: {
            module: shaderModule,
            entryPoint: 'mainVs',
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