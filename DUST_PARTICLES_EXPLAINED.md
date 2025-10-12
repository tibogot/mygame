# Dust Particles Component - Explanation

## Overview

The `DustParticles` component is based on SimonDev's wind effect from his Quick_Grass project. It creates atmospheric floating dust particles that drift with the wind, adding depth and life to your scene.

## How It Works

### 1. **Billboard Particle System**

- Creates instanced geometry (one plane repeated multiple times)
- Each particle is a billboard that always faces the camera
- Uses `InstancedBufferGeometry` for efficient rendering of many particles

### 2. **Shader-Based Animation**

The component uses custom GLSL shaders to achieve smooth, realistic movement:

#### **Vertex Shader:**

- **Billboard Effect**: Calculates camera-facing orientation matrix so particles always face you
- **Wind Direction**: Uses noise functions to generate pseudo-random wind directions
- **Wind Drift**: Animates particles along wind direction over time
- **Fade In/Out**: Creates a 4-second cycle where particles fade in, stay visible, then fade out
- **Random Rotation**: Each particle has a random UV rotation for variety
- **Procedural Positioning**: Uses hash functions for deterministic but random-looking placement

#### **Fragment Shader:**

- Samples the `dust.png` texture
- Darkens the texture (multiplies by 0.5) for a subtle dust effect
- Applies fade animation based on particle lifecycle

### 3. **Spatial Distribution (Grid System)**

The component creates a grid of particle "cells" around the camera:

- **Cell Size**: Based on `spawnRange` (default 20 units)
- **Grid Coverage**: 6x6 cells around the camera (-3 to +3 in both X and Z)
- **Camera Following**: Grid automatically moves as camera moves (like Minecraft chunks)

### 4. **Optimizations**

- **Frustum Culling**: Only renders particles visible to the camera
- **Distance Culling**: Stops rendering particles beyond `maxDistance`
- **Mesh Pooling**: Reuses mesh instances instead of creating/destroying them
- **Instanced Rendering**: Uses GPU instancing for efficient rendering of identical geometry

### 5. **Key Technical Details**

```typescript
// Each particle cell contains 'count' dust particles
count: 8; // 8 particles per cell

// Random offsets are generated once and stored as vertex attributes
offsets[i * 3 + 0] = (Math.random() * 2.0 - 1.0) * (spawnRange / 2); // X
offsets[i * 3 + 1] = Math.random() * 1.0 + 2.0; // Y (height 2-3)
offsets[i * 3 + 2] = (Math.random() * 2.0 - 1.0) * (spawnRange / 2); // Z

// Wind animation formula
windOffset = offset + windAxis * time * 5.0;

// Fade animation (smoothstep for smooth transitions)
fadeInOut =
  smoothstep(0.0, period * 0.25, time) *
  smoothstep(period, period * 0.75, time);
```

## Usage in Your Project

### Step 1: Select map5(copy)

In the Leva controls panel, select "map5(copy)" from the Map dropdown.

### Step 2: Enable Dust Particles

Open the "Dust Particles (Map5)" panel in Leva and toggle "✨ Enable Dust Particles"

### Step 3: Adjust Parameters

You can tweak the following parameters:

- **Particle Count** (4-20): Number of dust particles per cell

  - More particles = denser dust effect
  - Default: 8 (good balance between quality and performance)

- **Spawn Range** (10-50): Size of each dust particle cell in world units

  - Larger = more spread out particles
  - Default: 20.0

- **Max Distance** (20-100): How far from camera to render particles

  - Larger = more visible particles (but lower performance)
  - Default: 50.0

- **Dust Width** (0.1-2.0): Horizontal size of each dust particle

  - Default: 0.4

- **Dust Height** (0.1-2.0): Vertical size of each dust particle
  - Default: 0.4

## Performance Characteristics

### Good Performance:

- Uses instanced rendering (efficient GPU usage)
- Frustum and distance culling (only renders visible particles)
- Mesh pooling (no allocation/deallocation overhead)

### Total Particles Rendered:

With default settings:

- Grid size: 6x6 = 36 cells
- Particles per cell: 8
- Maximum visible particles: ~288 (but typically much less due to culling)

### Compared to SimonDev's Original:

- ✅ Same visual quality
- ✅ Same shader code (adapted for React Three Fiber)
- ✅ Same spatial distribution system
- ✅ TypeScript with proper typing
- ✅ Integrated with Leva controls for easy tweaking

## How the Texture is Used

The `dust.png` texture is:

1. Loaded from `/public/textures/dust.png`
2. Set to SRGB color space for proper color reproduction
3. Applied to billboard quads using UV coordinates
4. Rotated randomly per particle for variety
5. Faded in/out over time for smooth animation

The texture should be:

- **Format**: PNG with alpha channel
- **Content**: White/light particle on transparent background
- **Size**: Power of 2 (e.g., 256x256, 512x512) for best performance

## Integration Points

The component is integrated into your Experience.jsx:

- Only renders on map5(copy)
- Has its own Leva control panel
- Doesn't interfere with other effects (grass, leaves, etc.)
- Can be combined with other effects simultaneously

## Tips for Best Results

1. **Combine with grass**: Works great with SimonDevGrass9/10 for a complete environment
2. **Adjust with lighting**: Dust is most visible with directional/volumetric lighting
3. **Size matters**: Smaller particles (0.2-0.4) look more realistic
4. **Distance culling**: Keep maxDistance moderate (40-60) for best performance
5. **Particle count**: 8 particles per cell is usually enough; more can look too dense

## Code References

### Key Files:

- `src/components/DustParticles.tsx` - Main component
- `src/components/Experience.jsx` - Integration point
- `public/textures/dust.png` - Texture file

### SimonDev's Original:

- `public/Quick_Grass-main/src/base/render/wind-component.js`
- `public/Quick_Grass-main/public/shaders/wind-lighting-model-vsh.glsl`
- `public/Quick_Grass-main/public/shaders/wind-lighting-model-fsh.glsl`

## Future Enhancements

Potential improvements you could make:

1. Add wind direction control (uniform wind direction instead of noise-based)
2. Add particle color tinting
3. Add multiple particle textures (dust, leaves, bugs, etc.)
4. Add interaction with character movement (push particles away)
5. Add weather controls (calm vs windy)
