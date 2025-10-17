/**
 * GrassShadersCSM - CustomShaderMaterial compatible shaders
 *
 * These shaders work WITH Three.js's built-in lighting/shadow system
 * by injecting custom code at specific points rather than replacing everything.
 */

export const grassVertexShaderCSM = `
  // Custom uniforms
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
  
  // Custom attributes
  attribute vec3 offset;
  attribute float scale;
  attribute float rotation;
  attribute float windInfluence;
  attribute float grassType;
  attribute vec3 colorVariation;
  attribute vec3 tipColorVariation;
  
  // Varyings to pass to fragment shader
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
  
  // 3D rotation matrices
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
  
  // Rotate around arbitrary axis (for wind)
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
    // Set varyings
    vUv = uv;
    vHeight = position.y + 0.5;
    vGrassType = grassType;
    vWindInfluence = windInfluence;
    vColorVariation = colorVariation;
    vTipColorVariation = tipColorVariation;
    
    // Calculate distance from player for LOD
    float distToPlayer = length(offset.xz - playerPosition.xz);
    
    // Shader-based LOD scaling
    float lodScale = 1.0;
    if (distToPlayer > highDetailDistance) {
      lodScale = mix(1.0, 0.85, smoothstep(highDetailDistance, mediumDetailDistance, distToPlayer));
    }
    
    // Apply instance scale with LOD
    vec3 pos = position * scale * lodScale;
    
    // Apply instance rotation (Y-axis)
    float cos_r = cos(rotation);
    float sin_r = sin(rotation);
    mat2 rotationMatrix = mat2(cos_r, -sin_r, sin_r, cos_r);
    pos.xz = rotationMatrix * pos.xz;
    
    // Natural forward lean
    float easedHeight = uv.y * uv.y;
    float leanAngle = grassBaseLean * easedHeight;
    pos = rotateX(leanAngle) * pos;
    
    // Grass blade S-curve
    float curveAngle = pow(uv.y, 2.0) * bladeCurveAmount;
    pos = rotateZ(curveAngle) * pos;
    
    // Wind system
    vec3 worldPos = pos + offset;
    
    // Main wind direction and intensity
    float windDir = noise12(worldPos.xz * windFrequency + time * windSpeed * 0.5);
    float windNoiseSample = noise12(worldPos.xz * windFrequency * 2.5 + time * windSpeed);
    float windLeanAngle = remap(windNoiseSample, -1.0, 1.0, 0.25, 1.0);
    windLeanAngle = easeIn(windLeanAngle, 2.0) * 1.25 * windTurbulence * windAmplitude * windStrength;
    vec3 windAxis = vec3(cos(windDir), 0.0, sin(windDir));
    
    // Height factor
    float heightFactor = pow(uv.y, 1.5);
    
    // Multi-layer wind
    float wind1 = noise12(worldPos.xz * windFrequency + time * windSpeed * 0.8) * windStrength * windInfluence * windAmplitude * 0.3;
    float wind2 = noise12(worldPos.xz * windFrequency * 2.0 + time * windSpeed * 1.2) * windStrength * windInfluence * windAmplitude * 0.18;
    float wind3 = noise12(worldPos.xz * windFrequency * 0.5 + time * windSpeed * 0.3) * windStrength * windInfluence * windAmplitude * 0.12;
    
    // Flapping
    float flapping = sin(time * windSpeed * 2.0 + worldPos.x * windFrequency + worldPos.z * windFrequency) * windStrength * windInfluence * windAmplitude * 0.12 * flappingIntensity;
    
    // Total wind
    float totalWindAngle = (wind1 + wind2 + wind3 + flapping) * windTurbulence * heightFactor;
    windLeanAngle = windLeanAngle * heightFactor + totalWindAngle;
    
    // Apply wind rotation
    pos = rotateAxis(windAxis, windLeanAngle) * pos;
    
    // Wind twist
    float windTwist = noise12(worldPos.xz * windFrequency * 1.5 + time * windSpeed * 0.6) * windStrength * heightFactor * windInfluence * windAmplitude * 0.1 * windTurbulence;
    pos = rotateY(windTwist) * pos;
    
    // Player interaction
    if (enablePlayerInteraction) {
      vec3 grassBladePos = worldPos;
      float distToPlayer = distance(grassBladePos.xz, playerPosition.xz);
      
      float playerFalloff = smoothstep(playerInteractionRadius, playerInteractionRadius * 0.4, distToPlayer);
      
      if (playerFalloff > 0.01) {
        vec3 grassToPlayer = normalize(vec3(playerPosition.x, 0.0, playerPosition.z) - vec3(grassBladePos.x, 0.0, grassBladePos.z));
        vec3 playerLeanAxis = vec3(grassToPlayer.z, 0.0, -grassToPlayer.x);
        float playerLeanAngle = playerFalloff * playerInteractionStrength * heightFactor;
        
        if (!playerInteractionRepel) {
          playerLeanAngle = -playerLeanAngle;
        }
        
        pos = rotateAxis(playerLeanAxis, playerLeanAngle) * pos;
      }
    }
    
    // Add offset
    pos += offset;
    
    // Calculate world position and view position
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
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
    
    vViewDir = normalize(cameraPosition - vWorldPosition);
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
    vReflect = reflect(-vViewDir, worldNormal);
    vGrassColour = vec3(1.0, 1.0, 1.0);
    
    // View-space thickening
    vec3 grassFaceNormal = vec3(sin(rotation), 0.0, cos(rotation));
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 viewDirXZ = normalize(vec3(viewDir.x, 0.0, viewDir.z));
    vec3 grassFaceNormalXZ = normalize(vec3(grassFaceNormal.x, 0.0, grassFaceNormal.z));
    
    float viewDotNormal = saturate(dot(grassFaceNormalXZ, viewDirXZ));
    float viewSpaceThickenFactor = easeOut(1.0 - viewDotNormal, 4.0) * smoothstep(0.0, 0.2, viewDotNormal);
    
    // No thickening at tip
    float heightTaper = pow(1.0 - vHeight, 5.0);
    float tipProtection = 1.0 - smoothstep(0.93, 0.98, vHeight);
    viewSpaceThickenFactor *= heightTaper * tipProtection;
    
    float xSide = uv.x;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    if (enableViewThickening) {
      mvPosition.x += viewSpaceThickenFactor * (xSide - 0.5) * 0.08 * scale;
    }
    
    // CSM INJECTION POINT: Set the transformed position
    // This replaces gl_Position calculation
    csm_Position = pos;
  }
`;

export const grassFragmentShaderCSM = `
  // Custom uniforms
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
  
  uniform vec3 sunDirection;
  uniform bool disableLighting;
  
  uniform bool disableMoonReflection;
  uniform float moonIntensity;
  uniform vec3 moonDirection;
  uniform vec3 moonColor;
  
  uniform float roughnessBase;
  uniform float roughnessTip;
  uniform float fresnelPower;
  uniform float roughnessIntensity;
  uniform float specularIntensity;
  uniform vec3 specularColor;
  uniform float specularPower;
  
  uniform bool enableColorVariation;
  uniform float colorVariationIntensity;
  uniform float tipColorVariationIntensity;
  
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
  
  uniform bool enableAnisotropy;
  uniform float anisotropyStrength;
  uniform float anisotropyTangent;
  uniform float anisotropyBitangent;
  
  // Varyings from vertex shader
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
  
  // Helper functions
  float easeIn(float x, float t) {
    return pow(x, t);
  }
  
  float easeOut(float x, float t) {
    return 1.0 - pow(1.0 - x, t);
  }
  
  float calculateAO(float height, float density) {
    float ao = 1.0 - (density * 0.2) - (1.0 - height) * 0.3;
    return mix(1.0, ao, aoIntensity);
  }
  
  float getContactShadow(float groundDistance) {
    float shadow = 1.0 - smoothstep(0.0, contactShadowRadius, groundDistance);
    return mix(1.0, shadow, contactShadowIntensity);
  }
  
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
    
    // Custom lighting on top of Three.js lighting
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
      
      // Specular highlights
      vec3 specular = vec3(0.0);
      float tipMask = smoothstep(0.3, 0.8, vHeight);
      vec3 viewDir = normalize(-vViewPosition);
      
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
        specular = specularColor * anisoSpec * specularIntensity * 8.0 * tipMask;
      } else {
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), specularPower);
        
        float roughness = mix(roughnessBase, roughnessTip, vHeight) * roughnessIntensity;
        spec *= (1.0 - roughness * 0.8);
        
        specular = specularColor * spec * specularIntensity * 3.0 * tipMask;
      }
      
      // Moon highlights
      if (!disableMoonReflection) {
        vec3 moonDir = normalize(moonDirection);
        vec3 moonReflectDir = reflect(-moonDir, normal);
        float moonSpec = pow(max(dot(viewDir, moonReflectDir), 0.0), specularPower * 0.8);
        specular += moonColor * moonSpec * specularIntensity * moonIntensity * 3.0 * tipMask;
      }
      
      // Subsurface scattering
      vec3 sssContribution = vec3(0.0);
      if (!disableSSS) {
        float backScatter = max(dot(-lightDir, normal), 0.0);
        float sss = pow(backScatter, sssPower) * vThickness * sssScale;
        float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 1.5);
        float rimSSS = pow(rim, 2.0) * vThickness * 0.5;
        float totalSSS = clamp(sss + rimSSS, 0.0, 1.0);
        sssContribution = sssColor * totalSSS * sssIntensity;
      }
      
      float depthVariation = 0.4 + 0.6 * vHeight;
      float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 1.5);
      float lighting = (0.4 + 0.4 * NdotL + 0.1 * rim) * depthVariation;
      
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
    
    // CSM INJECTION POINT: Modify the diffuse color
    // Three.js will apply shadows on top of this
    csm_DiffuseColor = vec4(color, texColor.a);
  }
`;
