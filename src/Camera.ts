import { mat4, Mat4, Vec3, vec3} from "wgpu-matrix";

export class Camera {
    projection = mat4.create() as Float32Array;
    transform  = mat4.create() as Float32Array;
    // bindGroup: GPUBindGroup;
    // bindGroupLayout: GPUBindGroupLayout;
    constructor(
        public near: number,
        public far: number,
        public fov: number,
        public aspect: number,
        public translate: Vec3,
    ) {
        this.updateProjection();
        this.updateTransform();
    }

    updateProjection() {
        mat4.perspective(this.fov, this.aspect, this.near, this.far, this.projection);
        // mat4.identity(this.projection);
    }

    updateTransform() {
        mat4.lookAt(this.translate, [0, 0, 0], [0, 1, 0], this.transform);
        // mat4.identity(this.transform);
        // mat4.translate(this.transform, this.translate, this.transform);
    }

}

export interface CameraState {
    theta: number,
    phi: number,
    r: number,
    lookAt: Vec3,
}

interface MousePosition {
    x: number,
    y: number,
}
export class CameraController {
    private isMouseDown = false;
    private lastMousePosition: MousePosition;

    constructor(public transform: Mat4, public onChange: () => void, public speed = 1.0, public cameraState: CameraState = {
        theta: 0.5 * Math.PI,
        phi: 0,
        r: 100,
        lookAt: vec3.zero()
    }){
        this.update();
    }


    update() {
        const {transform, cameraState: {lookAt, r, theta, phi}} = this;
        const rxz = r * Math.sin(theta);
        const position = [ rxz * Math.cos(phi),r * Math.cos(theta), rxz * Math.sin(phi) ];
        mat4.lookAt(position, lookAt, [0, 1, 0], transform);
        this.onChange();
    }

    onMouseDown = (e: MouseEvent) => {
        this.isMouseDown = true;
        this.lastMousePosition = {
            x: e.pageX,
            y: e.pageY,
        };
    }
    onMouseMove = (e: MouseEvent) => {
        if (this.isMouseDown) {
            const {lastMousePosition: mouseDownPosition, cameraState, speed} = this;
            const {pageX, pageY} = e;
            const dx = e.pageX - mouseDownPosition.x;
            const dy = e.pageY - mouseDownPosition.y;

            const dPhi = dx / cameraState.r;
            const dTheta = dy / cameraState.r;

            this.cameraState.theta += dTheta * speed;
            this.cameraState.phi += dPhi * speed;

            this.update();

            this.lastMousePosition = {x: pageX, y: pageY};
        }
    }
    onMouseUp = (e: MouseEvent) => {
        this.isMouseDown = false;
    }

    start(listenNode: HTMLElement) {
        listenNode.addEventListener('mousedown', this.onMouseDown);
        listenNode.addEventListener('mousemove', this.onMouseMove);
        listenNode.addEventListener('mouseup', this.onMouseUp);
    }
}
