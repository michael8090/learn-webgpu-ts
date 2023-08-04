import { UniformDesc, BufferUniformDesc, TextureUniformDesc, SamplerUniformDesc, WgslDataTypes, AttributeDesc, WgslAttributeDataTypeAlias } from "../GpuResources";

const isBufferUniform = (desc: UniformDesc): desc is BufferUniformDesc => desc.type === 'buffer';
const isTextureUniform = (desc: UniformDesc): desc is TextureUniformDesc => desc.type === 'texture';
const isSamplerUniform = (desc: UniformDesc): desc is SamplerUniformDesc => desc.type === 'sampler';

export function buildBindGroupEntries(uniforms: readonly UniformDesc[]): GPUBindGroupLayoutEntry[] {
    // sort the uniforms in alphabet order
    return uniforms.concat([]).sort((a, b) => a.name < b.name ? -1 : 1).map((desc, i) => {
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
        throw `invalid type ${desc}`;
    });
}

export function buildUniformShaderDeclarations(uniforms: readonly UniformDesc[]) {
    // sort the uniforms in alphabet order
    return uniforms.concat([]).sort((a, b) => a.name < b.name ? -1 : 1).map((desc, i) => {
        if (isBufferUniform(desc)) {
            return `@group(0) @binding(${i++}) var<uniform> ${desc.name}: ${desc.dataType};`;
        }
        if (isTextureUniform(desc)) {
            return `@group(0) @binding(${i++}) var ${desc.name}: texture_2d<${desc.dataType}>;`;
        }
        if (isSamplerUniform(desc)) {
            return `@group(0) @binding(${i++}) var ${desc.name}: sampler;`;
        }
    }).join('\n');
}

export function buildVertexBufferLayouts(attributes: readonly AttributeDesc[]): GPUVertexBufferLayout[] {
    // sort the attributes in alphabet order
    return attributes.concat([]).sort((a, b) => a.name < b.name ? -1 : 1).map((desc, i) => ({
        arrayStride: WgslDataTypes[desc.dataType],
        attributes: [{
            format: (WgslAttributeDataTypeAlias as any)[desc.dataType],
            offset: 0,
            shaderLocation: i
        }]
    }))
}

export function buildVertexShaderDeclarations(attributes: readonly AttributeDesc[]) {
    return `
struct VertexInput {
    ${attributes.concat([]).sort((a, b) => a.name < b.name ? -1 : 1).map((desc, i) => `@location(${i}) ${desc.name}: ${desc.dataType},`).join('\n    ')}
}
`;
}