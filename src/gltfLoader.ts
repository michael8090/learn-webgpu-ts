import { Mesh } from "./Mesh";
import { GlTf } from "./gltf";
import { makeCube } from "./shapeBuilder";

export async function loadGltf(gltfUrl: string): Promise<Mesh[]> {
    const gltf: GlTf = await (await fetch(gltfUrl)).json();
    const meshes: Mesh[] = [];
    gltf.nodes?.map(node => {
        const {translation, rotate, scale, mesh: meshIndex} = node;
        const mesh = gltf.meshes![meshIndex!];
        const primitives = mesh.primitives;
        for (let primitive of primitives) {
            const {material: materialIndex, attributes: attributeMap, indices: indicesIndex} = primitive;
            const mesh = makeCube(); // mesh placeholder
            if (materialIndex !== undefined) {
                const material = gltf.materials![materialIndex];
            }
        }
    });
    return meshes;
}
