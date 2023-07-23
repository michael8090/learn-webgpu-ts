export const WgslDataTypes = {
    'mat4x4<f32>': 4*4*4,
    'mat3x4<f32>': 3*4*4,
    'vec4f': 4*4,
    'vec3f': 3*4,
    'vec2f': 2*4,
};

export const WgslAttributeDataTypeAlias = {
    'vec4f': 'float32x4',
    'vec3f': 'float32x3',
    'vec2f': 'float32x2',
};

export interface BufferUniformDesc {
    name: string,
    type: 'buffer'
    dataType: keyof typeof WgslDataTypes
}

export interface SamplerUniformDesc {
    name: string,
    type: 'sampler'
}

export interface TextureUniformDesc {
    name: string,
    type: 'texture',
    dataType: 'f32'
}

export type UniformDesc = BufferUniformDesc | SamplerUniformDesc | TextureUniformDesc;

export type AttributeDesc = {
    name: string,
    dataType: keyof typeof WgslDataTypes
}