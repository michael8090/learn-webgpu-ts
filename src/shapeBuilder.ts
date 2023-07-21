import { Mesh } from "./Mesh";
import { mat4, Vec3, vec3} from "wgpu-matrix";

export function makePlane(width: number = 2, height: number = 2, position: Vec3 = vec3.zero(), rotation: Vec3 = vec3.zero(), scale: Vec3 = [1, 1, 1]): Mesh {
    const hw = width * 0.5;
    const hh = height * 0.5;

    //     -1, -1, 0,
    //     1, -1, 0,
    //     -1, 1, 0,

    //     1, -1, 0,
    //     1, 1, 0,
    //     -1, 1, 0,

    return new Mesh(
        new Float32Array([
            -hw, -hh, 0, 
            hw, -hh, 0,
            -hw, hh, 0,

            hw, -hh, 0,
            hw, hh, 0,
            -hw, hh, 0,
            // -1, -1, 0,
            // 1, -1, 0,
            // -1, 1, 0,

            // 1, -1, 0,
            // 1, 1, 0,
            // -1, 1, 0,
            // 0, -0, 0,
            // 0, 0, 0,
            // -0, 0, 0,
            // 0, -0, 0,
            // 0, 0, 0,
            // -0, 0, 0,
        ]),
        position,
        rotation,
        scale,
    );
}
