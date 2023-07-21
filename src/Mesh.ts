import { Mat4, mat4 } from "wgpu-matrix";

export class Mesh {
    vertexBufferGpu: GPUBuffer;
    indexBufferGpu: GPUBuffer;

    shaderModule: GPUShaderModule;

    constructor(
        public vertexBuffer: Float32Array,
        public vertexBufferLayout: GPUVertexBufferLayout,
        public indexBuffer: Float32Array,
        public shaderCode: string,
        public transform: Mat4 = mat4.identity()
    ) {}

    compileShader(device: GPUDevice) {
        this.shaderModule = device.createShaderModule({
            code: this.shaderCode,
        });
    }

    upload(device: GPUDevice) {
        if (!this.vertexBufferGpu) {
            this.vertexBufferGpu = device.createBuffer({
                size: this.vertexBuffer.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }

        if (!this.indexBufferGpu) {
            this.vertexBufferGpu = device.createBuffer({
                size: this.indexBuffer.byteLength,
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            });
        }

        device.queue.writeBuffer(this.vertexBufferGpu, 0, this.vertexBuffer);
        device.queue.writeBuffer(this.indexBufferGpu, 0, this.indexBuffer);
    }
}
