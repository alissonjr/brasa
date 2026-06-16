import{aL as e,aT as n,aU as s}from"./babylon-HwQtXX-h.js";const t="volumetricLightingRenderVolumeVertexShader",r=`#include<sceneUboDeclaration>
#include<meshUboDeclaration>
attribute position : vec3f;varying vWorldPos: vec4f;@vertex
fn main(input : VertexInputs)->FragmentInputs {let worldPos=mesh.world*vec4f(vertexInputs.position,1.0);vertexOutputs.vWorldPos=worldPos;vertexOutputs.position=scene.viewProjection*worldPos;}
`;e.ShadersStoreWGSL[t]||(e.ShadersStoreWGSL[t]=r);const a=[n,s];for(const o of a)e.IncludesShadersStoreWGSL[o.name]||(e.IncludesShadersStoreWGSL[o.name]=o.shader);const c={name:t,shader:r};export{c as volumetricLightingRenderVolumeVertexShaderWGSL};
