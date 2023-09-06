# The organizing method of Uniforms

```mermaid
graph LR;

uniforms(uniforms)

subgraph global_uniforms[global uniforms, UBO0]
Camera
Light
...
end

subgraph transform_related_uniforms[transform related uniforms, UBO1]
InstanceTransforms
Transform
NormalMatrix
...
end

subgraph material_related_uniforms[material related uniforms, UBO2]
PhongMaterial
...
end


uniforms --> global_uniforms
uniforms --> transform_related_uniforms
uniforms --> material_related_uniforms

```

There are 3 types of usual UBOs:

1. global uniforms
2. transform related uniforms
3. material related uniforms

We need to make each a `bindGroup`, and by merge uniforms into UBOs, we can get exact 3 UBOs:

UBO0 --- group(0) bind(0) : global uniforms

UBO1 --- group(1) bind(0): transform related uniforms

UBO2 --- group(2) bind(0): material related uniforms

## automatically merge uniforms into a UBO

We use the structure above to merge the uniforms aggressively, and use `define` to keep the uniform variable name.

Given the shader below:

```wgsl
// camera
@group(0) @binding(0) var<uniform> projectMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> cameraPosition: vec3f;


// light
struct PointLight {
  position : vec3f,
  color : vec3f,
}

struct LightStorage {
  pointCount : u32,
  point : array<PointLight>,
}
@group(1) @binding(0) var<uniform> lights : LightStorage;


// display object
@group(2) @binding(0) var<uniform> modelMatrix: mat4x4<f32>;
@group(2) @binding(1) var<uniform> normalMatrix: mat3x4<f32>;

struct PhongMaterial {
    diffuseColor: vec3f,
    emissiveColor: vec3f,
}
@group(2) @binding(2) var<uniform> phongMaterial: PhongMaterial;

@group(2) @binding(3) var ourTexture: texture_2d<f32>;
@group(2) @binding(4) var ourSampler: sampler;
```

In pipeline creating time, we merge camera and light into 1 UBO, and split the uniforms of a display object into 2 UBO2, like below:

```wgsl
// light
struct PointLight {
  position : vec3f,
  color : vec3f,
}
struct LightStorage {
  pointCount : u32,
  point : array<PointLight>,
}

// here the name `Temp0` is automatically generated
struct Temp0 {
    // camera
    projectMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
    cameraPosition: vec3f,
    
    // light
    lights: LightStorage,
}

// the name `temp0` is automatically generated
// UBO0
@group(0) @binding(0) var<uniform> temp0 : Temp0;

// to make the variable name available in the shader code below, we generate the macro defines automatically:
#define lights temp0.lights
#define projectMatrix temp0.projectMatrix
#define viewMatrix temp0.viewMatrix
#define cameraPosition temp0.cameraPosition


// display object
@group(2) @binding(0) var<uniform> modelMatrix: mat4x4<f32>;
@group(2) @binding(1) var<uniform> normalMatrix: mat3x4<f32>;

struct PhongMaterial {
    diffuseColor: vec3f,
    emissiveColor: vec3f,
}
@group(2) @binding(2) var<uniform> phongMaterial: PhongMaterial;

struct Temp1 {
    modelMatrix: mat4x4<f32>;
    normalMatrix: mat3x4<f32>;
}
// UBO1
@group(1) @binding(0) var<uniform> temp1: Temp1;

#define modelMatrix temp1.modelMatrix
#define normalMatrix temp1.normalMatrix

struct Temp1 {
    phongMaterial: PhongMaterial,
}
// UBO2
@group(2) @binding(0) var<uniform> temp2: Temp1;

#define phongMaterial temp2.phongMaterial


// textures and samplers are untouched
@group(3) @binding(0) var ourTexture: texture_2d<f32>;
@group(3) @binding(1) var ourSampler: sampler;
```

## rearrange the struct properties for smaller size

Say we have a struct as below:

```wgsl
struct A {
  y: f32
  x: vec3<f32>,
}
```

According to the std140 layout: https://www.w3.org/TR/WGSL/#alignment-and-size, the size is 32(16+16)

But if we use make the larger size come first:

```wgsl
struct A {
  x: vec3<f32>,
  y: f32
}
```

The size becomes 16: 12 for x, but x has align of 16, which leaves enough space for y.

So rearrange struct properties inside a struct can help with memory size.

Can we rearrange the properties at a higher scope, such as the parent struct?

```wgsl
struct A {
  x: vec3<f32>
  y: f32,
}
struct B {
  z: f32,
}

// normally we merge them while keeping the small struct untouched 
struct MergedAB {
  a: A,
  b: B,
}

// but we can do a `flat merge`
struct FlatMergedAB {
  A$x: vec3<f32>,
  A$y: f32,
  B$z: f32, 
}

let a: A = A {
 x: temp.A$x,
 y: temp.a$y, 
};
```

And we can rearrange the properties in the flat merged struct, make it even smaller, and we can take a step further, flat all the struct into one giant struct, making the overall memory the smallest.

When only considering the write to the buffer, the flat merge is sufficient. The problem arises when we need to read from the struct. We cannot read a block of data from flat struct, even inside the shader, that make the approach useless.

So we can only rearrange the properties inside a struct, which is a good thing, as it means we can do the rearrangement in compile time.

But as the UBO itself is small enough, we don't need to do the rearrangement at all. 

## attribute instance buffer

不在uniform里面

## 让CPU数据符合std140结构，加速写入

## 去掉cpu里的大buffer

去掉合并后的CPU里的大buffer，只提供基于schema的写入能力
