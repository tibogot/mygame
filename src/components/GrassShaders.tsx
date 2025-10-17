/**
 * GrassShaders - Extracted Shader Definitions for Grass System
 *
 * This component contains all the shader definitions that were previously
 * embedded in SimonDevGrass11. This separation makes the main component
 * much cleaner and easier to debug.
 */

export const grassVertexShader = `
  precision highp float;
  
  uniform float time;
  uniform float windStrength;
  uniform vec2 windDirection;
  uniform float grassDensity;
  uniform float windSpeed;
  uniform float windFrequency;
  uniform float windAmplitude;
  uniform float windTurbulence;
  uniform float flappingIntensity;
  uniform vec3 playerPosition;
  uniform float highDetailDistance;
  uniform float mediumDetailDistance;
  uniform mat4 viewMatrixInverse;
  uniform bool enableViewThickening;
  uniform float grassBaseLean;
  uniform float bladeCurveAmount;
  uniform bool enablePlayerInteraction;
  uniform float playerInteractionRadius;
  uniform float playerInteractionStrength;
  uniform bool playerInteractionRepel; // true = repel (bend away), false = attract (bend toward)
  
  attribute vec3 offset;
  attribute float scale;
  attribute float rotation;
  attribute float windInfluence;
  attribute float grassType;
  attribute vec3 colorVariation;
  attribute vec3 tipColorVariation;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vGrassColour;
  varying float vHeight;
  varying float vGrassType;
  varying float vWindInfluence;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;
  varying float vThickness;
  varying vec3 vColorVariation;
  varying vec3 vTipColorVariation;
  varying vec3 vReflect;
  varying vec3 vViewDir;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  
  // Optimized noise functions
  float hash12(vec2 p) {
    vec2 p2 = fract(p * vec2(443.8975, 397.2973));
    p2 += dot(p2.xy, p2.yx + 19.19);
    return fract(p2.x * p2.y);
  }
  
  float noise12(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
  }
  
  float remap(float v, float inMin, float inMax, float outMin, float outMax) {
    return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);
  }
  
  float easeIn(float x, float t) {
    return pow(x, t);
  }
  
  float easeOut(float x, float t) {
    return 1.0 - pow(1.0 - x, t);
  }
  
  float saturate(float x) {
    return clamp(x, 0.0, 1.0);
  }
  
  mat2 rotate2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }
  
  // 3D rotation matrices (like Quick_Grass) - maintains blade length!
  mat3 rotateX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
      1.0, 0.0, 0.0,
      0.0, c, -s,
      0.0, s, c
    );
  }
  
  mat3 rotateZ(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
      c, -s, 0.0,
      s, c, 0.0,
      0.0, 0.0, 1.0
    );
  }
  
  mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
      c, 0.0, s,
      0.0, 1.0, 0.0,
      -s, 0.0, c
    );
  }
  
  // Rotate around arbitrary axis (for wind) - like Quick_Grass!
  // Manual outer product construction (outerProduct() not in GLSL ES 1.0)
  mat3 rotateAxis(vec3 axis, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    // Manually construct outer product: axis * axis^T * oc
    float x = axis.x;
    float y = axis.y;
    float z = axis.z;
    
    return mat3(
      x*x*oc + c,    x*y*oc - z*s,  x*z*oc + y*s,
      x*y*oc + z*s,  y*y*oc + c,    y*z*oc - x*s,
      x*z*oc - y*s,  y*z*oc + x*s,  z*z*oc + c
    );
  }
  
  void main() {
    vUv = uv;
    vHeight = position.y + 0.5;
    vGrassType = grassType;
    vWindInfluence = windInfluence;
    vColorVariation = colorVariation;
    vTipColorVariation = tipColorVariation;
    
    // Calculate distance from player for LOD (use offset directly)
    float distToPlayer = length(offset.xz - playerPosition.xz);
    
    // Shader-based LOD scaling - GENTLE transitions, NEVER disappear!
    // The chunk system handles visibility - shader only provides subtle scaling
    float lodScale = 1.0;
    if (distToPlayer > highDetailDistance) {
      // Far: scale down to 85% (subtle, never disappear!)
      lodScale = mix(1.0, 0.85, smoothstep(highDetailDistance, mediumDetailDistance, distToPlayer));
    }
    // Close: lodScale = 1.0 (full size)
    
    // Apply instance scale with LOD
    vec3 pos = position * scale * lodScale;
    
    // Apply instance rotation (Y-axis - around vertical)
    float cos_r = cos(rotation);
    float sin_r = sin(rotation);
    mat2 rotationMatrix = mat2(cos_r, -sin_r, sin_r, cos_r);
    pos.xz = rotationMatrix * pos.xz;
    
    // Natural forward lean (ROTATION, not offset - maintains blade length!)
    // Applied AFTER Y-rotation so clusters lean together in same world direction
    // easeIn makes base straight, tip curves more (quadratic)
    float easedHeight = uv.y * uv.y; // Same as easeIn(uv.y, 2.0)
    float leanAngle = grassBaseLean * easedHeight; // Angle in radians
    pos = rotateX(leanAngle) * pos; // Rotate around X-axis (pitch forward)
    
    // Grass blade S-curve (ROTATION, not offset - maintains blade length!)
    // Side-to-side curve for variety
    float curveAngle = pow(uv.y, 2.0) * bladeCurveAmount;
    pos = rotateZ(curveAngle) * pos; // Rotate around Z-axis (roll sideways)
    
    // Wind system - ROTATION-BASED (no stretching!) like Quick_Grass
    vec3 worldPos = pos + offset;
    
    // Main wind direction and intensity
    float windDir = noise12(worldPos.xz * windFrequency + time * windSpeed * 0.5);
    float windNoiseSample = noise12(worldPos.xz * windFrequency * 2.5 + time * windSpeed);
    float windLeanAngle = remap(windNoiseSample, -1.0, 1.0, 0.25, 1.0);
    windLeanAngle = easeIn(windLeanAngle, 2.0) * 1.25 * windTurbulence * windAmplitude * windStrength; // NOW respects windStrength!
    vec3 windAxis = vec3(cos(windDir), 0.0, sin(windDir));
    
    // Height factor - wind affects tips more than base
    float heightFactor = pow(uv.y, 1.5);
    
    // Multi-layer wind angles (not offsets!)
    float wind1 = noise12(worldPos.xz * windFrequency + time * windSpeed * 0.8) * windStrength * windInfluence * windAmplitude * 0.3;
    float wind2 = noise12(worldPos.xz * windFrequency * 2.0 + time * windSpeed * 1.2) * windStrength * windInfluence * windAmplitude * 0.18;
    float wind3 = noise12(worldPos.xz * windFrequency * 0.5 + time * windSpeed * 0.3) * windStrength * windInfluence * windAmplitude * 0.12;
    
    // Flapping (high-frequency oscillation)
    float flapping = sin(time * windSpeed * 2.0 + worldPos.x * windFrequency + worldPos.z * windFrequency) * windStrength * windInfluence * windAmplitude * 0.12 * flappingIntensity;
    
    // Total wind lean angle (scaled by height)
    float totalWindAngle = (wind1 + wind2 + wind3 + flapping) * windTurbulence * heightFactor;
    windLeanAngle = windLeanAngle * heightFactor + totalWindAngle;
    
    // Apply wind as ROTATION (no stretching!)
    pos = rotateAxis(windAxis, windLeanAngle) * pos;
    
    // Small twist rotation for variety
    float windTwist = noise12(worldPos.xz * windFrequency * 1.5 + time * windSpeed * 0.6) * windStrength * heightFactor * windInfluence * windAmplitude * 0.1 * windTurbulence;
    pos = rotateY(windTwist) * pos;
    
    // PLAYER INTERACTION - Grass bends away from OR toward player!
    if (enablePlayerInteraction) {
      vec3 grassBladePos = worldPos;  // Current blade position in world space
      // Full 3D distance calculation
      float distToPlayer3D = distance(grassBladePos, playerPosition);
      // Separate Y-distance for height threshold
      float heightDiff = abs(grassBladePos.y - playerPosition.y);
      
      // Only affect grass if player is within reasonable height range (3 units = player height + jump)
      float heightFalloff = smoothstep(3.0, 0.0, heightDiff);
      // Regular distance falloff (now in 3D)
      float distanceFalloff = smoothstep(playerInteractionRadius, playerInteractionRadius * 0.4, distToPlayer3D);
      // Combine both falloffs
      float playerFalloff = distanceFalloff * heightFalloff;
      
      if (playerFalloff > 0.01) {
        // Calculate direction in 3D, but keep lean axis horizontal
        vec3 grassToPlayer = normalize(playerPosition - grassBladePos);
        // Project onto horizontal plane for consistent sideways bending
        vec3 grassToPlayerHorizontal = normalize(vec3(grassToPlayer.x, 0.0, grassToPlayer.z));
        // Create perpendicular axis (90° rotated) - grass leans sideways
        vec3 playerLeanAxis = vec3(grassToPlayerHorizontal.z, 0.0, -grassToPlayerHorizontal.x);
        
        // Lean angle increases with proximity and height
        float playerLeanAngle = playerFalloff * playerInteractionStrength * heightFactor;
        
        // REPEL (bend away) or ATTRACT (bend toward)
        if (!playerInteractionRepel) {
          playerLeanAngle = -playerLeanAngle;  // Negate = attract instead of repel
        }
        
        // Apply rotation - grass bends! 🏃🌿
        pos = rotateAxis(playerLeanAxis, playerLeanAngle) * pos;
      }
    }
    
    pos += offset;
    
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
    vViewPosition = (modelViewMatrix * vec4(pos, 1.0)).xyz;
    vNormal = normalize(normalMatrix * normal);
    
    // Tangent space for anisotropy
    vec3 tangent = vec3(0.0, 1.0, 0.0);
    vec3 bitangent = vec3(1.0, 0.0, 0.0);
    vec3 worldTangent = normalize(mat3(modelMatrix) * tangent);
    vec3 worldBitangent = normalize(mat3(modelMatrix) * bitangent);
    
    vTangent = worldTangent;
    vBitangent = worldBitangent;
    vThickness = (1.0 - vHeight) * 0.8 + 0.2;
    
    vec3 worldPosCalc = (modelMatrix * vec4(pos, 1.0)).xyz;
    vViewDir = normalize(cameraPosition - worldPosCalc);
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
    vReflect = reflect(-vViewDir, worldNormal);
    vGrassColour = vec3(1.0, 1.0, 1.0);
    
    // View-space thickening (makes grass blades fuller when viewed edge-on)
    // Calculate grass face normal (after rotation)
    vec3 grassFaceNormal = vec3(sin(rotation), 0.0, cos(rotation));
    
    // Get view direction (XZ plane only)
    vec3 viewDir = normalize(cameraPosition - worldPosCalc);
    vec3 viewDirXZ = normalize(vec3(viewDir.x, 0.0, viewDir.z));
    vec3 grassFaceNormalXZ = normalize(vec3(grassFaceNormal.x, 0.0, grassFaceNormal.z));
    
    // Calculate how edge-on we're viewing the grass
    float viewDotNormal = saturate(dot(grassFaceNormalXZ, viewDirXZ));
    float viewSpaceThickenFactor = easeOut(1.0 - viewDotNormal, 4.0) * smoothstep(0.0, 0.2, viewDotNormal);
    
    // CRITICAL: NO thickening at tip to preserve triangular point!
    // Completely disable thickening in the last 5% where triangle point forms
    float heightTaper = pow(1.0 - vHeight, 5.0); // Quintic taper
    float tipProtection = 1.0 - smoothstep(0.93, 0.98, vHeight); // Zero thickening at tip!
    viewSpaceThickenFactor *= heightTaper * tipProtection;
    
    // Determine which side of the blade (left=-1, right=1) based on UV.x
    float xSide = uv.x; // 0 = left, 1 = right
    
    // Transform to view space first
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Apply view-space thickening in screen space (AFTER view transform)
    // Only if enabled via Leva control
    if (enableViewThickening) {
      mvPosition.x += viewSpaceThickenFactor * (xSide - 0.5) * 0.08 * scale;
    }
    
    // Project to clip space
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// FULL GRASS FRAGMENT SHADER - FIXED VERSION (No saturate function)
export const grassFragmentShader = `
  precision highp float;
  
  uniform sampler2D grassTexture;
  uniform sampler2D envMap;
  uniform float envMapIntensity;
  uniform bool enableEnvMap;
  
  uniform vec3 baseColor;
  uniform vec3 middleColor;
  uniform vec3 tipColor;
  uniform float gradientPower;
  uniform float baseTransitionPoint;
  uniform float tipTransitionPoint;
  
  // Lighting uniforms
  uniform vec3 sunDirection;
  uniform bool disableLighting;
  
  // Moon uniforms
  uniform bool disableMoonReflection;
  uniform float moonIntensity;
  uniform vec3 moonDirection;
  uniform vec3 moonColor;
  
  // More uniforms
  uniform float roughnessBase;
  uniform float roughnessTip;
  uniform float fresnelPower;
  uniform float roughnessIntensity;
  uniform float specularIntensity;
  uniform vec3 specularColor;
  uniform float specularPower;
  
  // Color variation uniforms
  uniform bool enableColorVariation;
  uniform float colorVariationIntensity;
  uniform float tipColorVariationIntensity;
  
  // Additional uniforms
  uniform float grassDensity;
  uniform bool disableTextureTint;
  uniform float edgeDarkeningStrength;
  uniform float sssIntensity;
  uniform float sssPower;
  uniform float sssScale;
  uniform vec3 sssColor;
  uniform bool disableSSS;
  uniform float contactShadowIntensity;
  uniform float contactShadowRadius;
  uniform bool enableAO;
  uniform float aoIntensity;
  uniform float aoRadius;
  uniform bool enableWrappedLighting;
  uniform float wrapAmount;
  uniform bool enablePlayerInteraction;
  uniform float playerInteractionRadius;
  uniform float playerInteractionStrength;
  uniform bool enablePlayerInteractionRepel;
  uniform vec3 playerPosition;
  uniform bool enableDistanceFog;
  uniform float fogScatterDensity;
  uniform float fogExtinctionDensity;
  uniform vec3 fogSkyColor;
  
  // Anisotropy uniforms
  uniform bool enableAnisotropy;
  uniform float anisotropyStrength;
  uniform float anisotropyTangent;
  uniform float anisotropyBitangent;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vGrassColour;
  varying float vHeight;
  varying float vGrassType;
  varying float vWindInfluence;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;
  varying float vThickness;
  varying vec3 vColorVariation;
  varying vec3 vTipColorVariation;
  varying vec3 vReflect;
  varying vec3 vViewDir;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  
  // Helper functions (using clamp instead of saturate)
  float easeIn(float x, float t) {
    return pow(x, t);
  }
  
  float easeOut(float x, float t) {
    return 1.0 - pow(1.0 - x, t);
  }
  
  // Ambient occlusion calculation
  float calculateAO(float height, float density) {
    float ao = 1.0 - (density * 0.2) - (1.0 - height) * 0.3;
    return mix(1.0, ao, aoIntensity);
  }
  
  // Contact shadow calculation
  float getContactShadow(float groundDistance) {
    float shadow = 1.0 - smoothstep(0.0, contactShadowRadius, groundDistance);
    return mix(1.0, shadow, contactShadowIntensity);
  }
  
  // Distance fog calculation
  vec3 calculateDistanceFog(vec3 baseColor, vec3 viewDir, float sceneDepth) {
    vec3 skyColor = fogSkyColor;
    
    if (enableEnvMap) {
      vec2 skyUV = vec2(
        0.5 + atan(viewDir.z, viewDir.x) / (2.0 * 3.14159265),
        0.5 - asin(viewDir.y) / 3.14159265
      );
      skyColor = texture2D(envMap, skyUV).rgb;
    }
    
    float fogScatter = 1.0 - exp(-fogScatterDensity * sceneDepth);
    float fogExtinction = exp(-fogExtinctionDensity * sceneDepth);
    
    return baseColor * fogExtinction + skyColor * (1.0 - fogScatter);
  }
  
  void main() {
    vec4 texColor = texture2D(grassTexture, vUv);
    if (texColor.a < 0.1) discard;
    
    // Complex gradient with color variation
    float gradient = vUv.y;
    vec3 color;
    if (enableColorVariation) {
      if (gradient < baseTransitionPoint) {
        float t = pow(gradient / baseTransitionPoint, gradientPower);
        vec3 baseColorVaried = baseColor + vColorVariation * 0.3 * colorVariationIntensity;
        vec3 middleColorVaried = middleColor + vColorVariation * 0.4 * colorVariationIntensity;
        color = mix(baseColorVaried, middleColorVaried, t);
      } else if (gradient < tipTransitionPoint) {
        color = middleColor + vColorVariation * 0.4 * colorVariationIntensity;
      } else {
        float t = pow((gradient - tipTransitionPoint) / (1.0 - tipTransitionPoint), gradientPower);
        vec3 middleColorVaried = middleColor + vColorVariation * 0.4 * colorVariationIntensity;
        vec3 tipColorVaried = tipColor + vTipColorVariation * 0.5 * tipColorVariationIntensity;
        color = mix(middleColorVaried, tipColorVaried, t);
      }
    } else {
      if (gradient < baseTransitionPoint) {
        float t = pow(gradient / baseTransitionPoint, gradientPower);
        color = mix(baseColor, middleColor, t);
      } else if (gradient < tipTransitionPoint) {
        color = middleColor;
      } else {
        float t = pow((gradient - tipTransitionPoint) / (1.0 - tipTransitionPoint), gradientPower);
        color = mix(middleColor, tipColor, t);
      }
    }
    
    // Apply texture tinting
    if (!disableTextureTint) {
      color *= texColor.rgb;
    }
    
    // Lighting calculations
    if (!disableLighting) {
      vec3 normal = normalize(vNormal);
      vec3 lightDir = normalize(sunDirection);
      
      // Wrapped lighting
      float NdotL;
      if (enableWrappedLighting) {
        NdotL = clamp((dot(normal, lightDir) + wrapAmount) / (1.0 + wrapAmount), 0.0, 1.0);
      } else {
        NdotL = max(dot(normal, lightDir), 0.0);
      }
      
      // Ambient occlusion
      if (enableAO) {
        float ao = calculateAO(vHeight, grassDensity);
        color *= ao;
      }
      
      // Specular highlights - SUN GLINTS on grass tips!
      vec3 specular = vec3(0.0);
      
      // Height-based masking - only TIPS get sun glints (like real grass!)
      float tipMask = smoothstep(0.3, 0.8, vHeight); // Only top 50% of blade
      
      vec3 viewDir = normalize(-vViewPosition);
      
      if (enableAnisotropy) {
        // Anisotropic specular (more realistic for grass)
        vec3 H = normalize(lightDir + viewDir);
        float TdotH = dot(normalize(vTangent), H);
        float BdotH = dot(normalize(vBitangent), H);
        float NdotH = dot(normal, H);
        
        float roughnessT = mix(roughnessBase * anisotropyTangent, roughnessTip * anisotropyTangent * 0.5, vHeight);
        float roughnessB = mix(roughnessBase * anisotropyBitangent, roughnessTip * anisotropyBitangent * 2.0, vHeight);
        
        float at = roughnessT * roughnessT;
        float ab = roughnessB * roughnessB;
        
        float denom = (TdotH * TdotH / at) + (BdotH * BdotH / ab) + (NdotH * NdotH);
        denom = max(denom, 0.001);
        float D = 1.0 / (3.14159 * at * ab * denom * denom);
        
        float VdotH = max(dot(viewDir, H), 0.0);
        float F = pow(1.0 - VdotH, fresnelPower);
        
        float anisoSpec = D * F * anisotropyStrength;
        // Sun highlights using specularColor from Leva, modulated by tip mask
        specular = specularColor * anisoSpec * specularIntensity * 8.0 * tipMask;
      } else {
        // Standard specular
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), specularPower);
        
        // Calculate roughness (matching grass11)
        float roughness = mix(roughnessBase, roughnessTip, vHeight) * roughnessIntensity;
        spec *= (1.0 - roughness * 0.8);
        
        // Sun highlights using specularColor from Leva, modulated by tip mask
        specular = specularColor * spec * specularIntensity * 3.0 * tipMask;
      }
      
      // Moon highlights (uses moonColor from Leva, on tips only)
      if (!disableMoonReflection) {
        vec3 moonDir = normalize(moonDirection);
        vec3 moonReflectDir = reflect(-moonDir, normal);
        float moonSpec = pow(max(dot(viewDir, moonReflectDir), 0.0), specularPower * 0.8);
        // Moon uses your configured color (red, white, whatever you set!)
        specular += moonColor * moonSpec * specularIntensity * moonIntensity * 3.0 * tipMask;
      }
      
      // Apply lighting (matching grass11 style)
      float depthVariation = 0.4 + 0.6 * vHeight;
      float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 1.5);
      float lighting = (0.4 + 0.4 * NdotL + 0.1 * rim) * depthVariation;
      
      // SSS (Subsurface Scattering)
      vec3 sssContribution = vec3(0.0);
      if (!disableSSS) {
        float backScatter = max(dot(-lightDir, normal), 0.0);
        float sss = pow(backScatter, sssPower) * vThickness * sssScale;
        float rimSSS = pow(rim, 2.0) * vThickness * 0.5;
        float totalSSS = clamp(sss + rimSSS, 0.0, 1.0);
        sssContribution = sssColor * totalSSS * sssIntensity;
      }
      
      color = color * lighting + specular + sssContribution;
    }
    
    // Environment mapping
    if (enableEnvMap) {
      vec3 reflectDir = normalize(vReflect);
      vec2 envUV = vec2(
        0.5 + atan(reflectDir.z, reflectDir.x) / (2.0 * 3.14159265),
        0.5 - asin(reflectDir.y) / 3.14159265
      );
      vec3 envColor = texture2D(envMap, envUV).rgb;
      color = mix(color, envColor, envMapIntensity);
    }
    
    // Contact shadow
    float contactShadow = getContactShadow(vWorldPosition.y);
    color *= contactShadow;
    
    // Distance fog
    if (enableDistanceFog) {
      float sceneDepth = length(vViewPosition);
      vec3 viewDir = normalize(vViewPosition);
      color = calculateDistanceFog(color, viewDir, sceneDepth);
    }
    
    gl_FragColor = vec4(color, texColor.a);
  }
`;

// ORIGINAL COMPLEX FRAGMENT SHADER - COMMENTED OUT FOR DEBUGGING
export const grassFragmentShaderComplex = `
  precision highp float;
  
  // Helper functions
  float saturate(float x) {
    return clamp(x, 0.0, 1.0);
  }
  
  uniform sampler2D grassTexture;
  uniform sampler2D envMap;
  uniform float envMapIntensity;
  uniform float roughnessBase;
  uniform float roughnessTip;
  uniform float fresnelPower;
  uniform bool enableEnvMap;
  uniform float roughnessIntensity;
  uniform vec3 baseColor;
  uniform vec3 middleColor;
  uniform vec3 tipColor;
  uniform float gradientPower;
  uniform float baseTransitionPoint;
  uniform float tipTransitionPoint;
  uniform float grassDensity;
  uniform bool disableLighting;
  uniform float specularIntensity;
  uniform vec3 specularColor;
  uniform float specularPower;
  uniform bool disableMoonReflection;
  uniform float moonIntensity;
  uniform vec3 moonDirection;
  uniform vec3 moonColor;
  uniform vec3 sunDirection;
  uniform bool disableTextureTint;
  uniform float edgeDarkeningStrength;
  uniform float sssIntensity;
  uniform float sssPower;
  uniform float sssScale;
  uniform vec3 sssColor;
  uniform bool disableSSS;
  uniform float contactShadowIntensity;
  uniform float contactShadowRadius;
  uniform bool enableAO;
  uniform float aoIntensity;
  uniform float aoRadius;
  uniform bool enableColorVariation;
  uniform float colorVariationIntensity;
  uniform float tipColorVariationIntensity;
  uniform float anisotropyStrength;
  uniform float anisotropyTangent;
  uniform float anisotropyBitangent;
  uniform bool enableAnisotropy;
  
  // Quick_Grass-style atmospheric fog
  uniform bool enableDistanceFog;
  uniform float fogScatterDensity;
  uniform float fogExtinctionDensity;
  uniform vec3 fogSkyColor;
  
  // Wrapped lighting for softer, more natural shading
  uniform bool enableWrappedLighting;
  uniform float wrapAmount;
  
  // Player interaction - grass bends away from player!
  uniform bool enablePlayerInteraction;
  uniform float playerInteractionRadius;
  uniform float playerInteractionStrength;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vGrassColour;
  varying float vHeight;
  varying float vGrassType;
  varying float vWindInfluence;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;
  varying float vThickness;
  varying vec3 vColorVariation;
  varying vec3 vTipColorVariation;
  varying vec3 vReflect;
  varying vec3 vViewDir;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  
  // Optimized contact shadow
  float getContactShadow(float groundDistance) {
    float distanceShadow = 1.0 - smoothstep(0.0, contactShadowRadius, groundDistance) * 0.6;
    return mix(1.0, distanceShadow, contactShadowIntensity);
  }
  
  // Optimized AO
  float getAmbientOcclusion() {
    float ao = 1.0 - (grassDensity * 0.2) - (1.0 - vHeight) * 0.3;
    return mix(1.0, ao, aoIntensity);
  }
  
  // Quick_Grass-style atmospheric fog with scattering + extinction
  vec3 calculateDistanceFog(vec3 baseColor, vec3 viewDir, float sceneDepth) {
    // Use envMap to sample sky color in view direction (or fallback to uniform)
    vec3 skyColor = fogSkyColor;
    
    if (enableEnvMap) {
      // Sample sky from environment map in the direction we're looking
      vec2 skyUV = vec2(
        0.5 + atan(viewDir.z, viewDir.x) / (2.0 * 3.14159265),
        0.5 - asin(viewDir.y) / 3.14159265
      );
      skyColor = texture2D(envMap, skyUV).rgb * 0.7 + fogSkyColor * 0.3; // Blend with uniform
    }
    
    // Distance-based fog (Quick_Grass method)
    float fogDepth = sceneDepth * sceneDepth;
    
    // Scattering: how much light spreads in the fog
    float fogScatter = exp(-fogScatterDensity * fogScatterDensity * fogDepth);
    
    // Extinction: how much fog blocks the object
    float fogExtinction = exp(-fogExtinctionDensity * fogExtinctionDensity * fogDepth);
    
    // Physically-based blend: object darkens + sky color appears
    return baseColor * fogExtinction + skyColor * (1.0 - fogScatter);
  }
  
  void main() {
    vec4 texColor = texture2D(grassTexture, vUv);
    if (texColor.a < 0.1) discard;
    
    // Dynamic gradient
    float gradient = vUv.y;
    float baseEnd = baseTransitionPoint;
    float tipStart = tipTransitionPoint;
    
    vec3 color;
    if (enableColorVariation) {
      if (gradient < baseEnd) {
        float t = pow(gradient / baseEnd, gradientPower);
        vec3 baseColorVaried = baseColor + vColorVariation * 0.3 * colorVariationIntensity;
        vec3 middleColorVaried = middleColor + vColorVariation * 0.4 * colorVariationIntensity;
        color = mix(baseColorVaried, middleColorVaried, t);
      } else if (gradient < tipStart) {
        color = middleColor + vColorVariation * 0.4 * colorVariationIntensity;
      } else {
        float t = pow((gradient - tipStart) / (1.0 - tipStart), gradientPower);
        vec3 middleColorVaried = middleColor + vColorVariation * 0.4 * colorVariationIntensity;
        vec3 tipColorVaried = tipColor + vTipColorVariation * 0.5 * tipColorVariationIntensity;
        color = mix(middleColorVaried, tipColorVaried, t);
      }
    } else {
      if (gradient < baseEnd) {
        float t = pow(gradient / baseEnd, gradientPower);
        color = mix(baseColor, middleColor, t);
      } else if (gradient < tipStart) {
        color = middleColor;
      } else {
        float t = pow((gradient - tipStart) / (1.0 - tipStart), gradientPower);
        color = mix(middleColor, tipColor, t);
      }
    }
    
    if (!disableTextureTint) {
      // Extract LUMINANCE (brightness) from texture, NOT color!
      // This gives edge darkening without blue tint
      float edgeDarkening = dot(texColor.rgb, vec3(0.299, 0.587, 0.114)); // RGB to luminance
      
      // Blend between original color (1.0) and darkened version
      // This allows controlling the edge darkening strength!
      color *= mix(1.0, edgeDarkening, edgeDarkeningStrength);
    }
    
    // Calculate roughness (used by both envMap and specular)
    float roughness = mix(roughnessBase, roughnessTip, vHeight) * roughnessIntensity;
    
    // ========== IMAGE-BASED LIGHTING (IBL) + SKY REFLECTIONS ==========
    // AAA-Quality environmental lighting (like Zelda BOTW, Genshin Impact)
    // 
    // TWO COMPONENTS:
    // 1. IBL Ambient: Sky provides ambient light (replaces flat ambient)
    //    - Grass in shadow gets realistic sky lighting
    //    - Changes with time of day / environment
    //    - Heavily blurred for diffuse look
    // 
    // 2. Sky Reflections on Tips: Subtle atmospheric effect
    //    - Only blade tips catch sky color (like dewy grass)
    //    - Controlled by roughness (wet = more, dry = less)
    //    - Controlled by fresnel (grazing angles = more)
    //    - Height-masked (base = none, tips = full)
    //    - NOT mirror-like, just atmospheric!
    //
    // Result: Natural grass that "fits" the environment! 🌿✨
    if (enableEnvMap) {
      // 1. IBL AMBIENT LIGHTING - Sky provides ambient light
      // Sample sky from "up" direction (world space normal pointing up)
      vec3 worldNormal = normalize(vNormal);
      vec2 skyUV;
      skyUV.x = atan(worldNormal.z, worldNormal.x) / 6.28318530718 + 0.5;
      skyUV.y = asin(clamp(worldNormal.y, -1.0, 1.0)) / 3.14159265359 + 0.5;
      
      // Blurred sky sample for diffuse ambient (replaces flat ambient)
      vec3 skyAmbient = texture2D(envMap, skyUV).rgb;
      vec3 blur = vec3(0.0);
      float blurRadius = 0.15; // Heavy blur for diffuse
      blur += texture2D(envMap, skyUV + vec2(blurRadius, 0.0)).rgb;
      blur += texture2D(envMap, skyUV + vec2(-blurRadius, 0.0)).rgb;
      blur += texture2D(envMap, skyUV + vec2(0.0, blurRadius)).rgb;
      blur += texture2D(envMap, skyUV + vec2(0.0, -blurRadius)).rgb;
      skyAmbient = (skyAmbient + blur) / 5.0;
      
      // Apply IBL ambient (this replaces/enhances flat ambient lighting)
      // Grass in shadow gets sky light naturally!
      color += skyAmbient * 0.25 * envMapIntensity; // 25% ambient contribution
      
      // 2. SKY REFLECTIONS ON TIPS - Subtle atmospheric effect
      // Only blade tips catch sky color (like dewy grass)
      vec3 r = normalize(vReflect);
      vec2 reflectUV;
      reflectUV.x = atan(r.z, r.x) / 6.28318530718 + 0.5;
      reflectUV.y = asin(clamp(r.y, -1.0, 1.0)) / 3.14159265359 + 0.5;
      
      // Roughness-based blur for natural look (not mirror)
      // Low roughness (wet) = sharp reflection, High roughness (dry) = blurred
      vec3 skyReflection = texture2D(envMap, reflectUV).rgb;
      blur = vec3(0.0);
      float reflectBlur = roughness * 0.15; // Stronger blur effect based on roughness
      blur += texture2D(envMap, reflectUV + vec2(reflectBlur, 0.0)).rgb;
      blur += texture2D(envMap, reflectUV + vec2(-reflectBlur, 0.0)).rgb;
      blur += texture2D(envMap, reflectUV + vec2(0.0, reflectBlur)).rgb;
      blur += texture2D(envMap, reflectUV + vec2(0.0, -reflectBlur)).rgb;
      
      // Blend based on roughness: low roughness = less blur, high roughness = more blur
      float blurMix = smoothstep(0.0, 0.5, roughness); // Gradual transition
      skyReflection = mix(skyReflection, blur / 4.0, blurMix);
      
      // Height masking - ONLY tips get sky reflections
      float tipReflectionMask = smoothstep(0.6, 0.95, vHeight); // Top 35% of blade
      
      // Fresnel effect - more reflection at grazing angles (uses fresnelPower uniform!)
      vec3 viewDir = normalize(-vViewPosition);
      vec3 normal = normalize(vNormal);
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), fresnelPower);
      
      // Roughness control - wet grass (low roughness) = more sky reflection
      // Stronger effect for visibility!
      float reflectionStrength = pow(1.0 - roughness, 2.0) * fresnel * tipReflectionMask;
      
      // Apply sky reflections to tips (increased from 0.15 to 0.25 for visibility)
      color += skyReflection * reflectionStrength * 0.25 * envMapIntensity;
    }
    
    // Lighting
    if (!disableLighting) {
      vec3 lightDir = normalize(sunDirection);
      vec3 normal = normalize(vNormal);
      
      // Wrapped lighting (Quick_Grass style) - softer, more natural for thin objects
      float NdotL;
      if (enableWrappedLighting) {
        // Light wraps around thin objects like grass blades
        NdotL = saturate((dot(normal, lightDir) + wrapAmount) / (1.0 + wrapAmount));
      } else {
        // Standard Lambert lighting
        NdotL = max(dot(normal, lightDir), 0.0);
      }
      
      float depthVariation = 0.4 + 0.6 * vHeight;
      
      vec3 viewDir = normalize(-vViewPosition);
      float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 1.5);
      
      // Specular highlights - SUN GLINTS on grass tips!
      vec3 specular = vec3(0.0);
      
      // Height-based masking - only TIPS get sun glints (like real grass!)
      // Bottom of blades are hidden in dense grass, don't catch light
      float tipMask = smoothstep(0.3, 0.8, vHeight); // Only top 50% of blade
      
      if (enableAnisotropy) {
        vec3 H = normalize(lightDir + viewDir);
        float TdotH = dot(normalize(vTangent), H);
        float BdotH = dot(normalize(vBitangent), H);
        float NdotH = dot(normal, H);
        
        float roughnessT = mix(roughnessBase * anisotropyTangent, roughnessTip * anisotropyTangent * 0.5, vHeight);
        float roughnessB = mix(roughnessBase * anisotropyBitangent, roughnessTip * anisotropyBitangent * 2.0, vHeight);
        
        float at = roughnessT * roughnessT;
        float ab = roughnessB * roughnessB;
        
        float denom = (TdotH * TdotH / at) + (BdotH * BdotH / ab) + (NdotH * NdotH);
        denom = max(denom, 0.001);
        float D = 1.0 / (3.14159 * at * ab * denom * denom);
        
        float VdotH = max(dot(viewDir, H), 0.0);
        float F = pow(1.0 - VdotH, fresnelPower);
        
        float anisoSpec = D * F * anisotropyStrength;
        // Sun highlights using specularColor from Leva, modulated by tip mask
        specular = specularColor * anisoSpec * specularIntensity * 8.0 * tipMask;
      } else {
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), specularPower);
        // Use roughness calculated earlier
        spec *= (1.0 - roughness * 0.8);
        // Sun highlights using specularColor from Leva, modulated by tip mask
        // Boosted 3x to match moon visibility
        specular = specularColor * spec * specularIntensity * 3.0 * tipMask;
      }
      
      // Moon highlights (uses moonColor from Leva, on tips only)
      if (!disableMoonReflection) {
        vec3 moonDir = normalize(moonDirection);
        vec3 moonReflectDir = reflect(-moonDir, normal);
        float moonSpec = pow(max(dot(viewDir, moonReflectDir), 0.0), specularPower * 0.8);
        // Moon uses your configured color (red, white, whatever you set!)
        specular += moonColor * moonSpec * specularIntensity * moonIntensity * 3.0 * tipMask;
      }
      
      // SSS
      vec3 sssContribution = vec3(0.0);
      if (!disableSSS) {
        float backScatter = max(dot(-lightDir, normal), 0.0);
        float sss = pow(backScatter, sssPower) * vThickness * sssScale;
        float rimSSS = pow(rim, 2.0) * vThickness * 0.5;
        float totalSSS = clamp(sss + rimSSS, 0.0, 1.0);
        sssContribution = sssColor * totalSSS * sssIntensity;
      }
      
      float lighting = (0.4 + 0.4 * NdotL + 0.1 * rim) * depthVariation;
      color = color * lighting + specular + sssContribution;
    }
    
    // Contact shadows - optimized
    float contactShadow = getContactShadow(vWorldPosition.y);
    color *= contactShadow;
    
    // AO
    if (enableAO) {
      color *= getAmbientOcclusion();
    }
    
    // Distance fog (Quick_Grass-style) - applied last for realism
    if (enableDistanceFog) {
      float sceneDepth = length(vViewPosition);
      vec3 viewDir = normalize(vViewPosition);
      color = calculateDistanceFog(color, viewDir, sceneDepth);
    }
    
    gl_FragColor = vec4(color, texColor.a);
  }
`;

export const grassDepthVertexShader = `
  precision highp float;
  
  uniform float time;
  uniform float windStrength;
  uniform vec2 windDirection;
  uniform float grassDensity;
  uniform float windSpeed;
  uniform float windFrequency;
  uniform float windAmplitude;
  uniform float windTurbulence;
  uniform float flappingIntensity;
  uniform vec3 playerPosition;
  uniform float highDetailDistance;
  uniform float mediumDetailDistance;
  uniform mat4 viewMatrixInverse;
  uniform bool enableViewThickening;
  uniform float grassBaseLean;
  uniform float bladeCurveAmount;
  uniform bool enablePlayerInteraction;
  uniform float playerInteractionRadius;
  uniform float playerInteractionStrength;
  uniform bool playerInteractionRepel;
  uniform float shadowAlphaThreshold;
  
  attribute vec3 offset;
  attribute float scale;
  attribute float rotation;
  attribute float windInfluence;
  attribute float grassType;
  attribute vec3 colorVariation;
  attribute vec3 tipColorVariation;
  
  varying vec2 vUv;
  varying float vAlpha;
  
  // Optimized noise functions
  float hash12(vec2 p) {
    vec2 p2 = fract(p * vec2(443.8975, 397.2973));
    p2 += dot(p2.xy, p2.yx + 19.19);
    return fract(p2.x * p2.y);
  }
  
  float noise12(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
  }
  
  float remap(float v, float inMin, float inMax, float outMin, float outMax) {
    return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);
  }
  
  float easeIn(float x, float t) {
    return pow(x, t);
  }
  
  float easeOut(float x, float t) {
    return 1.0 - pow(1.0 - x, t);
  }
  
  float saturate(float x) {
    return clamp(x, 0.0, 1.0);
  }
  
  mat2 rotate2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }
  
  // 3D rotation matrices (like Quick_Grass) - maintains blade length!
  mat3 rotateX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
      1.0, 0.0, 0.0,
      0.0, c, -s,
      0.0, s, c
    );
  }
  
  mat3 rotateZ(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
      c, -s, 0.0,
      s, c, 0.0,
      0.0, 0.0, 1.0
    );
  }
  
  mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
      c, 0.0, s,
      0.0, 1.0, 0.0,
      -s, 0.0, c
    );
  }
  
  // Rotate around arbitrary axis (for wind) - like Quick_Grass!
  mat3 rotateAxis(vec3 axis, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    float x = axis.x;
    float y = axis.y;
    float z = axis.z;
    
    return mat3(
      x*x*oc + c,    x*y*oc - z*s,  x*z*oc + y*s,
      x*y*oc + z*s,  y*y*oc + c,    y*z*oc - x*s,
      x*z*oc - y*s,  y*z*oc + x*s,  z*z*oc + c
    );
  }
  
  void main() {
    vUv = uv;
    
    // Calculate distance from player for LOD (use offset directly)
    float distToPlayer = length(offset.xz - playerPosition.xz);
    
    // Shader-based LOD scaling - GENTLE transitions, NEVER disappear!
    float lodScale = 1.0;
    if (distToPlayer > highDetailDistance) {
      lodScale = mix(1.0, 0.85, smoothstep(highDetailDistance, mediumDetailDistance, distToPlayer));
    }
    
    // Apply instance scale with LOD
    vec3 pos = position * scale * lodScale;
    
    // Apply instance rotation (Y-axis - around vertical)
    float cos_r = cos(rotation);
    float sin_r = sin(rotation);
    mat2 rotationMatrix = mat2(cos_r, -sin_r, sin_r, cos_r);
    pos.xz = rotationMatrix * pos.xz;
    
    // Natural forward lean (ROTATION, not offset - maintains blade length!)
    float easedHeight = uv.y * uv.y;
    float leanAngle = grassBaseLean * easedHeight;
    pos = rotateX(leanAngle) * pos;
    
    // Grass blade S-curve (ROTATION, not offset - maintains blade length!)
    float curveAngle = pow(uv.y, 2.0) * bladeCurveAmount;
    pos = rotateZ(curveAngle) * pos;
    
    // Wind system - ROTATION-BASED (no stretching!) like Quick_Grass
    vec3 worldPos = pos + offset;
    
    // Main wind direction and intensity
    float windDir = noise12(worldPos.xz * windFrequency + time * windSpeed * 0.5);
    float windNoiseSample = noise12(worldPos.xz * windFrequency * 2.5 + time * windSpeed);
    float windLeanAngle = remap(windNoiseSample, -1.0, 1.0, 0.25, 1.0);
    windLeanAngle = easeIn(windLeanAngle, 2.0) * 1.25 * windTurbulence * windAmplitude * windStrength;
    vec3 windAxis = vec3(cos(windDir), 0.0, sin(windDir));
    
    // Height factor - wind affects tips more than base
    float heightFactor = pow(uv.y, 1.5);
    
    // Multi-layer wind angles (not offsets!)
    float wind1 = noise12(worldPos.xz * windFrequency + time * windSpeed * 0.8) * windStrength * windInfluence * windAmplitude * 0.3;
    float wind2 = noise12(worldPos.xz * windFrequency * 2.0 + time * windSpeed * 1.2) * windStrength * windInfluence * windAmplitude * 0.18;
    float wind3 = noise12(worldPos.xz * windFrequency * 0.5 + time * windSpeed * 0.3) * windStrength * windInfluence * windAmplitude * 0.12;
    
    // Flapping (high-frequency oscillation)
    float flapping = sin(time * windSpeed * 2.0 + worldPos.x * windFrequency + worldPos.z * windFrequency) * windStrength * windInfluence * windAmplitude * 0.12 * flappingIntensity;
    
    // Total wind lean angle (scaled by height)
    float totalWindAngle = (wind1 + wind2 + wind3 + flapping) * windTurbulence * heightFactor;
    windLeanAngle = windLeanAngle * heightFactor + totalWindAngle;
    
    // Apply wind as ROTATION (no stretching!)
    pos = rotateAxis(windAxis, windLeanAngle) * pos;
    
    // Small twist rotation for variety
    float windTwist = noise12(worldPos.xz * windFrequency * 1.5 + time * windSpeed * 0.6) * windStrength * heightFactor * windInfluence * windAmplitude * 0.1 * windTurbulence;
    pos = rotateY(windTwist) * pos;
    
    // PLAYER INTERACTION - Grass bends away from OR toward player!
    if (enablePlayerInteraction) {
      vec3 grassBladePos = worldPos;
      // Full 3D distance calculation
      float distToPlayer3D = distance(grassBladePos, playerPosition);
      // Separate Y-distance for height threshold
      float heightDiff = abs(grassBladePos.y - playerPosition.y);
      
      // Only affect grass if player is within reasonable height range (3 units = player height + jump)
      float heightFalloff = smoothstep(3.0, 0.0, heightDiff);
      // Regular distance falloff (now in 3D)
      float distanceFalloff = smoothstep(playerInteractionRadius, playerInteractionRadius * 0.4, distToPlayer3D);
      // Combine both falloffs
      float playerFalloff = distanceFalloff * heightFalloff;
      
      if (playerFalloff > 0.01) {
        // Calculate direction in 3D, but keep lean axis horizontal
        vec3 grassToPlayer = normalize(playerPosition - grassBladePos);
        vec3 grassToPlayerHorizontal = normalize(vec3(grassToPlayer.x, 0.0, grassToPlayer.z));
        vec3 playerLeanAxis = vec3(grassToPlayerHorizontal.z, 0.0, -grassToPlayerHorizontal.x);
        float playerLeanAngle = playerFalloff * playerInteractionStrength * heightFactor;
        
        if (!playerInteractionRepel) {
          playerLeanAngle = -playerLeanAngle;
        }
        
        pos = rotateAxis(playerLeanAxis, playerLeanAngle) * pos;
      }
    }
    
    pos += offset;
    
    // View-space thickening (makes grass blades fuller when viewed edge-on)
    vec3 grassFaceNormal = vec3(sin(rotation), 0.0, cos(rotation));
    vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(pos, 1.0)).xyz);
    vec3 viewDirXZ = normalize(vec3(viewDir.x, 0.0, viewDir.z));
    vec3 grassFaceNormalXZ = normalize(vec3(grassFaceNormal.x, 0.0, grassFaceNormal.z));
    
    float viewDotNormal = saturate(dot(grassFaceNormalXZ, viewDirXZ));
    float viewSpaceThickenFactor = easeOut(1.0 - viewDotNormal, 4.0) * smoothstep(0.0, 0.2, viewDotNormal);
    
    float heightTaper = pow(1.0 - (position.y + 0.5), 5.0);
    float tipProtection = 1.0 - smoothstep(0.93, 0.98, position.y + 0.5);
    viewSpaceThickenFactor *= heightTaper * tipProtection;
    
    float xSide = uv.x;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    if (enableViewThickening) {
      mvPosition.x += viewSpaceThickenFactor * (xSide - 0.5) * 0.08 * scale;
    }
    
    gl_Position = projectionMatrix * mvPosition;
    
    // Calculate alpha for shadow casting
    float height = position.y + 0.5;
    vAlpha = smoothstep(shadowAlphaThreshold, shadowAlphaThreshold + 0.1, height);
  }
`;

export const grassDepthFragmentShader = `
  precision highp float;
  
  varying vec2 vUv;
  varying float vAlpha;
  
  uniform sampler2D grassTexture;
  
  void main() {
    vec4 texColor = texture2D(grassTexture, vUv);
    if (texColor.a < 0.1) discard;
    
    gl_FragColor = vec4(0.0, 0.0, 0.0, vAlpha * texColor.a);
  }
`;
