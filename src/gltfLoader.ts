import { Mesh } from "./Mesh";
import { GlTf } from "./gltf";

export async function loadGltf(gltfUrl: string): Promise<Mesh[]> {
    const gltf: GlTf = await (await fetch(gltfUrl)).json();
    const meshes: Mesh[] = [];
    gltf.nodes?.map(node => {
        const {translation, rotate, scale, mesh: meshIndex} = node;
        const mesh = gltf.meshes![meshIndex!];
        const textureUrl = mesh.primitives![0].
    });
    return meshes;
}
