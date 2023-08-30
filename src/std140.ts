// @see https://www.w3.org/TR/WGSL/#alignment-and-size

// the explanation is: https://gist.github.com/teoxoy/936891c16c2a3d1c3c5e7204ac6cd76c
import {
    Scalar,
    VecType,
    MatrixType,
    StructType,
    ArrayType,
} from './GPUDataTypes';

function roundUp(k: number, n: number) {
    return k * Math.ceil(n / k);
}
function po2(n: number) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
}
function max(arr: number[]) {
    let max = -Infinity;
    for (const a of arr) {
        if (max < a) {
            max = a;
        }
    }
    return max;
}

function sizeOfScalar(s: Scalar) {
    switch (s) {
        case Scalar.i32:
        case Scalar.u32:
        case Scalar.f32:
            return 4;
        case Scalar.f16:
            return 2;
    }
}
function alignOfScalar(s: Scalar) {
    switch (s) {
        case Scalar.i32:
        case Scalar.u32:
        case Scalar.f32:
            return 4;
        case Scalar.f16:
            return 2;
    }
}

function sizeOfVecType(s: VecType) {
    return s.componentCount * sizeOfScalar(s.componentType);
}
function alignOfVecType(s: VecType) {
    return po2(sizeOfVecType(s));
}

function sizeOfMatrixType(s: MatrixType) {
    return alignOfMatrixType(s) * s.columnCount;
}
function alignOfMatrixType(s: MatrixType) {
    return roundUp(16, sizeOfScalar(s.componentType) * s.rowCount);
}

function sizeOfArrayType(s: ArrayType) {
    return roundUp(alignOfArrayType(s), sizeOf(s.elementType)) * s.count;
}
function alignOfArrayType(s: ArrayType) {
    return roundUp(16, alignOf(s.elementType));
}

interface Property {
    name: string;
    type: Scalar | VecType | MatrixType | StructType | ArrayType;
    size: number,
    align: number,
    offset: number,
}

class InternalStruct {
    properties: Array<Property>;
    updatePropertySizeAndAlign() {
        this.properties.forEach(p => {
            const {type} = p;
            p.size = sizeOf(type);            
            p.align = alignOf(type);
        })
    }
    sort() {
        // descending to minimize the total buffer size
        this.properties.sort((a, b) => a.size - b.size)
    }
    offset() {
        let currentOffset = 0;
        for (let p of this.properties) {
            currentOffset = roundUp(alignOf(p.type), currentOffset);
            p.offset = currentOffset;
            currentOffset += sizeOf(p.type);
        }
        return currentOffset;
    }
}

// roundUp(alignOf(self), offsetOf(MN) + sizeOf(MN))
function sizeOfStructType(s: StructType) {
    let offset = 0;
    for (const p of s.properties) {
    }

    return roundUp(alignOfStructType(s));
}
