import{aL as a,aM as i,aN as r,aO as o,aP as l,aQ as s,aR as S,aS as g}from"./babylon-HwQtXX-h.js";const n="gaussianSplattingPixelShader",t=`#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
varying vColor: vec4f;varying vPosition: vec2f;
#define CUSTOM_FRAGMENT_DEFINITIONS
#include<gaussianSplattingFragmentDeclaration>
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
var finalColor: vec4f=gaussianColor(input.vColor,input.vPosition);
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
fragmentOutputs.color=finalColor;
#define CUSTOM_FRAGMENT_MAIN_END
}
`;a.ShadersStoreWGSL[n]||(a.ShadersStoreWGSL[n]=t);const c=[i,r,o,l,s,S,g];for(const e of c)a.IncludesShadersStoreWGSL[e.name]||(a.IncludesShadersStoreWGSL[e.name]=e.shader);const u={name:n,shader:t};export{u as gaussianSplattingPixelShaderWGSL};
