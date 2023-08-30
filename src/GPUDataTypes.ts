// @see https://www.w3.org/TR/WGSL/#alignment-and-size

// the explanation is: https://gist.github.com/teoxoy/936891c16c2a3d1c3c5e7204ac6cd76c

export enum Scalar {
    i32,
    u32,
    f32,
    f16,
}

export class VecType {
    constructor(
        readonly componentCount: number,
        readonly componentType: Scalar
    ) {}
}

export const Vec = (() => {
    const vecSizes = [2, 3, 4] as const;
    return vecSizes.reduce((acc, size) => {
        Object.keys(Scalar).forEach((type) => {
            const name = size + type;
            acc[name as keyof typeof acc] = new VecType(
                size,
                Scalar[type as keyof typeof Scalar]
            );
        });
        return acc;
    }, {} as { [key in `vec${2 | 3 | 4}<${keyof typeof Scalar}>`]: VecType });
})();

export class MatrixType {
    constructor(
        readonly rowCount: number,
        readonly columnCount: number,
        readonly componentType: Scalar
    ) {}
}

export const Matrix = (() => {
    const counts = [2, 3, 4] as const;
    const componentTypes = ['f32', 'f16'] as const;

    return counts.reduce((acc, rowCount) => {
        counts.forEach((columnCount) => {
            componentTypes.forEach((componentType) => {
                const name = `mat${columnCount}x${rowCount}<${componentType}>`;
                acc[name as keyof typeof acc] = new MatrixType(
                    rowCount,
                    columnCount,
                    Scalar[componentType]
                );
            });
        });
        return acc;
    }, {} as { [key in `mat${2 | 3 | 4}x${2 | 3 | 4}<${'f16' | 'f32'}>`]: MatrixType });
})();

type LeafTypes = Scalar | VecType | MatrixType;

export class ArrayType {
    constructor(
        readonly elementType: LeafTypes | StructType,
        readonly count: number
    ) {}
}

export function Array<T extends LeafTypes | StructType>(
    elementType: T,
    count: number
) {
    return new ArrayType(elementType, count);
}

export class StructType {
    /**
     * The struct name to be generated in shader
     */
    constructor(
        readonly name: string,
        readonly properties: Array<{
            readonly name: string,
            readonly type:
                | LeafTypes
                | ArrayType
                | StructType;
        }>
    ) {}
}

const structMap = new Map<string, StructType>();
export function Struct(
    name: string,
    properties?: {
        [name: string]:
            | LeafTypes
            | ArrayType
            | StructType;
    }
) {
    const existedStruct = structMap.get(name);
    if (properties === undefined) {
        if (existedStruct === undefined) {
            throw `no struct ${name} is defined`;
        }
        return existedStruct;
    }
    if (existedStruct !== undefined) {
        throw `the struct ${name} is already defined`;
    }
    // todo: we need to sort the properties here
    const s = new StructType(name, Object.entries(properties).map(([name, type]) => ({name, type})));
    structMap.set(name, s);
    return s;
}

// full example
let s = Struct('Struct1', {
    a: Vec['vec2<f32>'],
    b: Matrix['mat2x2<f16>'],
    c: Scalar.f16,
    d: Array(Vec['vec2<f16>'], 100),
    e: Struct('Struct2', {
        a1: Scalar.f16,
    }),
    // f will reference to the defined struct, without introduce new struct type
    f: Struct('Struct2'),
});

// in shader component

type Mat4 = {};
type Vec3 = {};
class Camera {
    project: Mat4;
    
    static desc = {
        project: Matrix["mat4x4<f32>"]
    }
}
class PointLight {
    color: Vec3;
    position: Vec3;
    
    static desc = {
        color: Vec["vec3<f32>"],
        position: Vec["vec3<f32>"],
    }
}

class Lights {
    count: number;
    pointLights: Array<PointLight>
    
    static desc = {
        count: Scalar.u32,
        pointLights: Array(Struct('PointLight', PointLight.desc), 3)
    }
}

// auto merge
let mergedS = Struct('Temp1', {...Camera.desc, ...Lights.desc});

// generated shader:
//
// struct PointLight {
//     color: vec3<f32>,
//     position: vec3<f32>,
// }

// struct Temp1 {
//     project: mat4x4<f32>,
//     count: u32,
//     pointLights: array<PointLight, 3>

// }
const std140 = {
    alignOf(v: any) {return 1;},
    sizeOf(v: any) {return 1;},
}

let a: Exclude<string, '__offset__'> = '__offset__';

function rearrange(layout: any, s: StructType) {
    return '' as any as Schema;
}
let std140S: Schema = rearrange(std140, mergedS);
// after rearrange, the properties in the Structs are sorted
type Schema = {
    [key: Exclude<string, '__offset__' | '__size__' | '__type__'>]: Schema;
} & {
    __offset__: number;
    __size__: number;
    __type__: LeafTypes | ArrayType | StructType // the StructType is sorted
}


// write
let camera = new Camera();
camera.project = [1.0, 1.0, 1.0, 1.0, 1.0];

let lights = new Lights();
// todo: the value is determined at runtime???
lights.count = 3; 
lights.pointLights = [new PointLight(), new PointLight(), new PointLight()];

// type guards, todo
const typeCaster = {
    isScalar(v: any): v is Scalar { return true;},
    isVec(v: any): v is VecType { return true;},
    isMatrix(v: any): v is MatrixType{ return true;},
    isArray(v: any): v is ArrayType{ return true;},
    isStruct(v: any): v is StructType{ return true;},
}

// TypedArray View with cache
function getF32View(buffer: ArrayBuffer): Float32Array {return '' as any;}
function getI32View(buffer: ArrayBuffer): Int32Array {return '' as any;}
function getU32View(buffer: ArrayBuffer): Uint32Array {return '' as any;}




// todo: should the diff be inside the write or outside?
function write(buffer: ArrayBuffer,location: {__offset__: number, __size__: number, __type__: LeafTypes | ArrayType | StructType}, data: any) {
    const {__offset__: offset, __size__: size, __type__: type} = location;
    // `data` should be compatible with `__type__`
    
    if (typeCaster.isScalar(type)) {
        if (type === Scalar.f16) {
           throw `todo: how to write f16 in JS?` 
        } else if (type === Scalar.f32) {
            const view = getF32View(buffer);
            const index = offset / 4;
            view[index] = data;
        } else {
            // others are omitted
        }
    } else if (typeCaster.isVec(type)) {
        const {componentCount, componentType} = type;
        if (componentType === Scalar.f32) {
            const view = getF32View(buffer);
            const index = offset / 4;
            for (let i = 0; i < componentCount; i++) {
                view[index + i] = data[i];
            }
        } else {
            // others are omitted
        }
    } else if (typeCaster.isMatrix(type)) {
        // omitted, should not be hard
    } else if (typeCaster.isArray(type)) {
        const {count, elementType} = type;
        
        // TS doesn't like to exclude string literals from string type
        // @see https://stackoverflow.com/questions/51442157/type-for-every-possible-string-value-except
        // todo: fight the TS typing system, but not necessarily
        const schema: Schema = {
            __offset__: offset,
            __size__: std140.sizeOf(elementType),
            __type__: elementType,
        } as any;
        const align = std140.alignOf(elementType);
        for (let i = 0; i < count; i++) {
            write(buffer, schema, data[i]);
            schema.__offset__ += align; 
        }
    } else if (typeCaster.isStruct(type)) {
        // the struct is rearranged
        const {properties} = type;
        
        let currentOffset = offset;
        for (let i = 0, l = properties.length; i < l; i++) {
            
        }
    }
}

const buffer = new ArrayBuffer(std140S.__size__);
write(buffer, std140S.pointLights[1].color, lights.pointLights[1].color)

// let a = s.a;
