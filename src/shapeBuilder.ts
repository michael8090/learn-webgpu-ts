import { Mesh } from "./Mesh";
import { mat4, Vec3, vec3} from "wgpu-matrix";

// export function makePlane(width: number = 2, height: number = 2, position: Vec3 = vec3.zero(), rotation: Vec3 = vec3.zero(), scale: Vec3 = [1, 1, 1]): Mesh {
//     const hw = width * 0.5;
//     const hh = height * 0.5;

//     //     -1, -1, 0,
//     //     1, -1, 0,
//     //     -1, 1, 0,

//     //     1, -1, 0,
//     //     1, 1, 0,
//     //     -1, 1, 0,

//     return new Mesh(
//         new Float32Array([
//             -hw, -hh, 0, 
//             hw, -hh, 0,
//             -hw, hh, 0,

//             hw, -hh, 0,
//             hw, hh, 0,
//             -hw, hh, 0,
//             // -1, -1, 0,
//             // 1, -1, 0,
//             // -1, 1, 0,

//             // 1, -1, 0,
//             // 1, 1, 0,
//             // -1, 1, 0,
//             // 0, -0, 0,
//             // 0, 0, 0,
//             // -0, 0, 0,
//             // 0, -0, 0,
//             // 0, 0, 0,
//             // -0, 0, 0,
//         ]),
//         position,
//         rotation,
//         scale,
//     );
// }

export function makeCube(size = 2, position = vec3.zero(), rotation = vec3.zero(), scale = [1, 1, 1]): Mesh {
    const cube = getBox(size);
    return new Mesh(cube.vertexes, cube.indices, cube.normals, position, rotation, scale);
}

const computeNormal = (function() {
  const v0 = vec3.create();
  const v1 = vec3.create();
  const n = vec3.create();
  const p0 = vec3.create();
  const p1 = vec3.create();
  const p2 = vec3.create();
  return function(vertexes: Float32Array, indices: Uint32Array) {
    const vertexNormalMap: {
      [vidx: number]: Vec3;
    } = {};
    // get the normal of every triangle

    for (let i = 0, l = indices.length; i < l; i += 3) {
      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];

      const ai0 = i0 * 3;
      const ai1 = i1 * 3;
      const ai2 = i2 * 3;

      vec3.set(vertexes[ai0], vertexes[ai0 + 1], vertexes[ai0 + 2], p0);
      vec3.set(vertexes[ai1], vertexes[ai1 + 1], vertexes[ai1 + 2], p1);
      vec3.set(vertexes[ai2], vertexes[ai2 + 1], vertexes[ai2 + 2], p2);

      vec3.sub(p1, p0, v0);
      vec3.sub(p2, p0, v1);
      vec3.cross(v0, v1, n);
      vec3.normalize(n, n);
      const idxs = [i0, i1, i2];
      for (let i = 0, l = idxs.length; i < l; i++) {
        const idx = idxs[i];
        let normal = vertexNormalMap[idx];
        if (normal === undefined) {
          vertexNormalMap[idx] = vec3.clone(n);
        } else {
          // it should never be here
          vec3.add(normal, n, normal);
        }
      }
    }
    const normals = new Float32Array(vertexes.length);
    // console.log(vertexNormalMap);
    for (let key in vertexNormalMap) {
      const idx = parseInt(key, 10);
      const normal = vertexNormalMap[idx];
      vec3.normalize(normal, normal);
      const ai = idx * 3;
      normals[ai] = normal[0];
      normals[ai + 1] = normal[1];
      normals[ai + 2] = normal[2];
    }
    // console.log(normals);
    return normals;
  };
})();

function getBox(size: number) {
  const indicesForSharedVertexes = new Uint16Array([
    4,
    5,
    6,

    6,
    7,
    4, // front

    0,
    3,
    2,

    2,
    1,
    0, // back

    2,
    3,
    7,

    7,
    6,
    2, // top

    0,
    1,
    5,

    5,
    4,
    0, // bottom

    0,
    4,
    7,

    7,
    3,
    0, // left

    1,
    2,
    6,

    6,
    5,
    1 // right
  ]);

  const sharedVertexes = new Float32Array([
    0,
    0,
    0,

    size,
    0,
    0,

    size,
    size,
    0,

    0,
    size,
    0,

    0,
    0,
    size,

    size,
    0,
    size,

    size,
    size,
    size,

    0,
    size,
    size
  ]);

  const vertexes = new Float32Array(
    indicesForSharedVertexes.reduce(
      (acc, idx) => {
        const ai = idx * 3;
        acc.push(
          sharedVertexes[ai],
          sharedVertexes[ai + 1],
          sharedVertexes[ai + 2]
        );
        return acc;
      },
      [] as number[]
    )
  );

  const idxes: number[] = [];
  for (let i = 0, l = indicesForSharedVertexes.length; i < l; i++) {
    idxes[i] = i;
  }

  const indices = new Uint32Array(idxes);

  return {
    vertexes,
    indices,
    normals: computeNormal(vertexes, indices)
  };
}