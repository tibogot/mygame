# 🌫️ Volumetric Fog Upgrade - Map5

## What Changed?

Your basic fog has been upgraded to **realistic raymarched volumetric fog** with advanced features!

### Old Implementation ❌

- Basic `THREE.Fog` and `THREE.FogExp2`
- Simple distance-based alpha blending
- No light scattering
- No realistic density variation
- Looked flat and unrealistic

### New Implementation ✅

- **Raymarched screen-space volumetrics**
- **3D Perlin noise** for realistic fog density variation
- **Henyey-Greenstein phase function** for light scattering
- **Beer's law** for light absorption
- **Height-based falloff** for ground fog effects
- **Animated fog** with procedural movement
- **Multiple sampling** for smooth appearance

## Technical Details

### Shader-Based Implementation

The new volumetric fog uses a custom post-processing shader that:

1. **Ray Marches** through the scene (16 samples by default)
2. **Calculates fog density** at each step using layered 3D noise (FBM - Fractional Brownian Motion)
3. **Applies light scattering** using physically-based phase functions
4. **Accumulates transmittance** using Beer's law for realistic light absorption
5. **Blends with scene** using proper volumetric integration

### Key Features

#### 🌊 Procedural Noise

- 4 octaves of 3D Simplex noise
- Creates natural-looking fog variations
- Animated over time for realistic movement

#### ☀️ Light Scattering

- Henyey-Greenstein phase function
- Realistic forward/backward scattering
- Controllable light position and intensity

#### ⛰️ Height Falloff

- Ground fog effects
- Exponential height-based density
- Adjustable fog height and falloff rate

#### 🎨 Full Control

All parameters controllable via Leva GUI:

- Fog density
- Fog height
- Height falloff
- Fog color
- Light position (X, Y, Z)
- Light intensity
- Noise scale
- Animation speed
- Absorption coefficient
- Scattering coefficient

## Where to Find It

### Leva Controls Panel

Look for **"🌫️ Volumetric Fog (Map5)"** in the Leva panel when on Map5.

### Files Modified

1. **`src/components/VolumetricFog.tsx`** (NEW)

   - Custom volumetric fog effect
   - Raymarching shader implementation
   - React Three Fiber integration

2. **`src/components/SSAOEffect.jsx`** (UPDATED)

   - Now includes volumetric fog
   - Renamed conceptually to "Post-Processing Effects"
   - Combines N8AO + Volumetric Fog + SMAA

3. **`src/components/Experience.jsx`** (UPDATED)
   - Removed old VolumetricFog reference
   - Now uses integrated post-processing

## How to Use

### Quick Start

1. Go to **Map5** in the map selector
2. Open Leva controls panel
3. Find **"🌫️ Volumetric Fog (Map5)"**
4. Toggle **"Enable Volumetric Fog"** to ON
5. Adjust parameters to your liking!

### Recommended Settings

#### 🌄 Morning Mist

```
Density: 0.015
Height: 0.0
Height Falloff: 0.3
Color: #c8d5e8 (light blue)
Light Y: 50
Light Intensity: 1.5
Noise Scale: 0.03
Animation Speed: 0.05
```

#### 🌫️ Dense Fog

```
Density: 0.04
Height: 2.0
Height Falloff: 0.8
Color: #e0e0e0 (gray)
Light Y: 30
Light Intensity: 0.8
Noise Scale: 0.05
Animation Speed: 0.02
```

#### 🏔️ Mountain Fog

```
Density: 0.025
Height: -2.0
Height Falloff: 1.2
Color: #b0c4de (steel blue)
Light Y: 70
Light Intensity: 2.0
Noise Scale: 0.02
Animation Speed: 0.03
```

#### 🌊 Animated Clouds

```
Density: 0.01
Height: 5.0
Height Falloff: 0.5
Color: #f0f8ff (alice blue)
Noise Scale: 0.08
Animation Speed: 0.15
```

## Performance Notes

- **16 ray marching samples** - good balance between quality and performance
- Works alongside N8AO without conflicts
- Uses post-processing pipeline efficiently
- Compatible with Three.js r180+

## Comparison with Libraries

Your implementation is based on the same principles as:

- `three-volumetric-pass` (but compatible with latest Three.js)
- Unity's volumetric fog
- Unreal Engine's exponential height fog

But customized for React Three Fiber with full Leva integration!

## Future Enhancements (Optional)

If you want even more realism, you could add:

- Shadow mapping integration (fog receives shadows)
- Multiple light sources
- Color gradient based on height
- Temporal filtering for smoother animation
- Wind direction control
- Fog obstacles/exclusion zones

## Troubleshooting

**Q: Fog looks too dense/sparse?**
A: Adjust the "Density" parameter. Start at 0.015 and tweak from there.

**Q: Fog doesn't match lighting?**
A: Make sure the Light Position (X, Y, Z) matches your directional light position.

**Q: Performance issues?**
A: The fog uses 16 samples. This is already optimized. If needed, you could reduce samples in the shader code (line ~125 in VolumetricFog.tsx).

**Q: Can I use this on other maps?**
A: Yes! Just add `<SSAOEffect />` to other maps in Experience.jsx, or extract the VolumetricFogEffect to use separately.

## Credits

Implementation based on:

- Raymarched volumetric rendering techniques
- Simplex noise by Stefan Gustavson
- Henyey-Greenstein phase function (astrophysics)
- Beer's law for light absorption (physics)

Enjoy your realistic volumetric fog! 🌫️✨
