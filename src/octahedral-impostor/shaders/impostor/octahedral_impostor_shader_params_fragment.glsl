#include <clipping_planes_pars_fragment>

uniform float spritesPerSide;
// uniform float parallaxScale;
uniform float alphaClamp;

#ifdef EZ_USE_ORM
uniform sampler2D ormMap;
#endif

varying vec4 vSpritesWeight;
varying vec2 vSprite1;
varying vec2 vSprite2;
varying vec2 vSprite3;
varying vec2 vSpriteUV1;
varying vec2 vSpriteUV2;
varying vec2 vSpriteUV3;
// varying vec2 vSpriteViewDir1;
// varying vec2 vSpriteViewDir2;
// varying vec2 vSpriteViewDir3;

// #ifdef EZ_USE_NORMAL
// flat varying vec3 vSpriteNormal1;
// flat varying vec3 vSpriteNormal2;
// flat varying vec3 vSpriteNormal3;
// #endif

#ifdef EZ_USE_NORMAL
vec3 blendNormals(vec2 uv1, vec2 uv2, vec2 uv3) {
  vec4 normalDepth1 = texture2D(normalMap, uv1); // we're reading twice if parallax enabled
  vec4 normalDepth2 = texture2D(normalMap, uv2);
  vec4 normalDepth3 = texture2D(normalMap, uv3);

  // Fix normal if blended bad

  return normalize(normalDepth1.xyz * vSpritesWeight.x + normalDepth2.xyz * vSpritesWeight.y + normalDepth3.xyz * vSpritesWeight.z);
}
#endif

// // temporaly removed
// Function to calculate UV coordinates for sprite sampling
vec2 getUV(vec2 uv_f, vec2 frame, float frame_size) {
  uv_f = clamp(uv_f, vec2(0.0), vec2(1.0));
	vec2 uv_quad = frame_size * (frame + uv_f);
	uv_f =  frame_size * (frame + uv_f);
	return clamp(uv_f, vec2(0.0), vec2(1.0));
}
