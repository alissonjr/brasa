import{aK as a,a$ as r,b0 as o,b1 as l,b2 as t,b3 as s,b4 as c,b5 as g}from"./babylon-C8afoLCT.js";const n="gaussianSplattingPixelShader",i=`#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
varying vec4 vColor;varying vec2 vPosition;
#define CUSTOM_FRAGMENT_DEFINITIONS
#include<gaussianSplattingFragmentDeclaration>
void main () {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
vec4 finalColor=gaussianColor(vColor);
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
gl_FragColor=finalColor;
#define CUSTOM_FRAGMENT_MAIN_END
}
`;a.ShadersStore[n]||(a.ShadersStore[n]=i);const d=[r,o,l,t,s,c,g];for(const e of d)a.IncludesShadersStore[e.name]||(a.IncludesShadersStore[e.name]=e.shader);const F={name:n,shader:i};export{F as gaussianSplattingPixelShader};
