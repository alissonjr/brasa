import{aL as a,b0 as r,b1 as o,b2 as l,b3 as t,b4 as s,b5 as c,b6 as g}from"./babylon-HwQtXX-h.js";const n="gaussianSplattingPixelShader",i=`#include<clipPlaneFragmentDeclaration>
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
