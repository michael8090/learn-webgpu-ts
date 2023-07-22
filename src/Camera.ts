import { mat4, Mat4, Vec3, vec3} from "wgpu-matrix";

const depthRangeRemapMatrix = mat4.identity();
depthRangeRemapMatrix[10] = -1;
depthRangeRemapMatrix[14] = 1;


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
        // reversed z
        mat4.mul(depthRangeRemapMatrix, this.projection, this.projection);
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

    constructor(public transform: Mat4, public onChange: () => void, public speed = 0.01, public cameraState: CameraState = {
        theta: 0.5 * Math.PI,
        phi: -0.5 * Math.PI,
        r: 1000,
        lookAt: vec3.create(2, 2, 2)
    }){
        this.update();
    }


    update() {
        const {transform, cameraState: {lookAt, r, theta, phi}} = this;
        const rxz = r * Math.sin(theta);
        const position = [ rxz * Math.cos(phi), r * Math.cos(theta), rxz * Math.sin(phi) ];
        mat4.lookAt(vec3.add(position, lookAt), lookAt, [0, 1, 0], transform);
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

            if (e.buttons === 1) {
                // left to rotate
                const dPhi = dx;
                const dTheta = dy;
    
                cameraState.theta = Math.min(Math.max(cameraState.theta + dTheta * speed, 0.0001), Math.PI - 0.0001);
                
                cameraState.phi += dPhi * speed;
            } else if (e.buttons === 2) {
                // right to move
                // vec3.add(cameraState.lookAt, []
            }



            this.update();

            this.lastMousePosition = {x: pageX, y: pageY};
        }
    }

    onMouseUp = (e: MouseEvent) => {
        this.isMouseDown = false;
    }

    onMouseWheel = (e: WheelEvent) => {
        let r = this.cameraState.r;
        const zoomSpeed = 1.05;
        if (e.deltaY > 0) {
          r *= zoomSpeed;
        } else {
          r /= zoomSpeed;
        }
        this.cameraState.r = r;
        this.update();
    }

    onContextMenu = (e: MouseEvent) => {
        e.preventDefault();
    }

    start(listenNode: HTMLElement) {
        listenNode.addEventListener('mousedown', this.onMouseDown);
        listenNode.addEventListener('mousemove', this.onMouseMove);
        listenNode.addEventListener('mouseup', this.onMouseUp);
        listenNode.addEventListener('mousewheel', this.onMouseWheel);
        listenNode.addEventListener('contextmenu', this.onContextMenu);

    }
}
