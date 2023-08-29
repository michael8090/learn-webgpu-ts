// @see https://www.w3.org/TR/WGSL/#alignment-and-size

// the explanation is: https://gist.github.com/teoxoy/936891c16c2a3d1c3c5e7204ac6cd76c

export interface GpuDataType {
    align(): number;
    size(): number;
}

const scalarOf4Bytes: GpuDataType = {
    align() {
        return 4;
    },
    size() {
        return 4;
    },
};

const scalarOf2Bytes: GpuDataType = {
    align() {
        return 2;
    },
    size() {
        return 2;
    },
};

export enum Scalar {
    i32,
    u32,
    f32,
    f16,
}

export class VecType {
    constructor(
        protected readonly componentCount: number,
        protected readonly componentType: Scalar
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
        protected readonly rowCount: number,
        protected readonly columnCount: number,
        protected readonly componentType: Scalar
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

export class ArrayType<T extends LeafTypes | StructType> {
    constructor(
        protected readonly elementType: T,
        protected readonly count: number
    ) {}
}

export function Array<T extends LeafTypes | StructType>(
    elementType: T,
    count: number
) {
    return new ArrayType(elementType, count);
}

export class StructType {
    protected __for_nominal_type__: never;
    readonly [key: string]:
        | LeafTypes
        | ArrayType<LeafTypes | StructType>
        | StructType;
}

export function Struct(obj: {
    [name: string]: LeafTypes | ArrayType<LeafTypes | StructType> | StructType;
}) {
    return Object.assign(new StructType(), obj) as StructType;
}

let s = Struct({
    a: Vec['vec2<f16>'],
    b: Matrix['mat2x2<f16>'],
    c: Scalar.f16,
    d: Array(Vec['vec2<f16>'], 100),
    e: Struct({
        a1: Scalar.f16,
    }),
});
let a = s.a;
Vec['vec2<f16>'];
Vec['vec2<f16>'];
Vec['vec2<f16>'];
