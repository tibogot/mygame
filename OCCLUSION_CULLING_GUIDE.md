# Occlusion Culling System for Zelda-like Game

## Overview

This occlusion culling system is based on Clayde's robust multi-point sampling approach, which solves the angle-dependent false occlusion issues you were experiencing. Instead of testing just one point, it samples 26+ points distributed evenly across the target object using a Fibonacci sphere algorithm.

## Why Your Original Approach Had Issues

Your original single-point test was failing because:

1. **Single point testing**: Only testing the center point doesn't represent the entire object volume
2. **Transparent material sorting**: Three.js has issues with transparent object depth sorting
3. **View frustum edge cases**: Single raycasts miss edge cases at different angles
4. **Volume representation**: A sphere's visibility can't be determined by just its center point

## Components Available

### 1. `OcclusionTest` - Basic Debug Component

Simple component for testing occlusion between a red plane (occluder) and green sphere (target).

**Usage in Map5:**

```tsx
// Already integrated in Map5 - just enable in Leva controls:
// Debug → Occlusion Test → Enable Occlusion Test
```

**Features:**

- ✅ 26-point Fibonacci sphere sampling
- ✅ Real-time occlusion percentage (0-100%)
- ✅ 99% threshold for "fully occluded"
- ✅ Visual feedback (red/green colors)
- ✅ Leva controls for positioning and sizing

### 2. `OcclusionTestAdvanced` - Production Ready

Advanced component for testing real objects against multiple occluders.

**Usage:**

```tsx
import {
  OcclusionTestAdvanced,
  useOcclusionTest,
} from "./OcclusionTestAdvanced";

// Option 1: Direct component usage
<OcclusionTestAdvanced
  targetObject={myTree}
  occluders={[terrain, mountain, building]}
  testPointCount={32}
  occlusionThreshold={0.95}
  onOcclusionChange={(occluded, percentage) => {
    myTree.visible = !occluded;
  }}
/>;

// Option 2: Hook usage (recommended)
const { isOccluded, occlusionPercentage } = useOcclusionTest(
  myTree,
  [terrain, mountain],
  { testPointCount: 20, occlusionThreshold: 0.98 }
);
```

### 3. `Map5OcclusionIntegration` - Ready for Your Map

Pre-built integration for your Map5 terrain and mountain objects.

## Integration with Your Zelda Game

### Step 1: Enable Basic Test in Map5

1. Run your Map5 scene
2. Open Leva controls
3. Go to "🔍 DEBUG" → "Occlusion Test"
4. Enable "🎯 Enable Occlusion Test"
5. Adjust positions and test different scenarios

### Step 2: Test Against Your Terrain

```tsx
// In your Map5 component, add this after your terrain setup:
import { Map5OcclusionIntegration } from "./OcclusionTestExample";

// In your JSX, add:
{
  terrainMeshRef.current && (
    <Map5OcclusionIntegration
      terrainMesh={terrainMeshRef.current}
      mountainObjects={[mountainRef.current]}
    />
  );
}
```

### Step 3: Production Implementation

```tsx
// For your actual game objects (trees, buildings, NPCs):
const { isOccluded } = useOcclusionTest(
  treeObject,
  [terrain, buildings, mountains],
  {
    testPointCount: 20, // Balance: 10-15 for performance, 30+ for accuracy
    occlusionThreshold: 0.95, // 95% occluded = fully occluded
  }
);

// Hide object when occluded
useEffect(() => {
  if (treeObject) {
    treeObject.visible = !isOccluded;
  }
}, [isOccluded, treeObject]);
```

## Performance Optimization Tips

### For Large Maps (Your Zelda Game):

1. **Test Point Count**:

   - 10-15 points: Fast, good for distant objects
   - 20-26 points: Balanced (recommended)
   - 30+ points: Accurate, use for important objects

2. **Update Frequency**:

   ```tsx
   // Test every 3 frames instead of every frame
   const [frameCount, setFrameCount] = useState(0);
   useFrame(() => {
     if (frameCount % 3 === 0) {
       // Run occlusion test
     }
     setFrameCount(frameCount + 1);
   });
   ```

3. **Distance-Based Testing**:

   ```tsx
   // Only test objects within certain distance
   const distance = camera.position.distanceTo(targetObject.position);
   if (distance < maxTestDistance) {
     // Run occlusion test
   }
   ```

4. **Level of Detail (LOD)**:
   ```tsx
   // Different test point counts based on distance
   const testPoints = distance < 50 ? 26 : distance < 100 ? 15 : 8;
   ```

## Troubleshooting

### False Positives (Object disappears when it shouldn't):

- Increase `testPointCount` (try 32-50)
- Lower `occlusionThreshold` (try 0.95 instead of 0.99)
- Check if occluder has proper geometry

### False Negatives (Object visible when it should be occluded):

- Increase `occlusionThreshold` (try 0.99)
- Add more occluders to the array
- Check occluder material transparency

### Performance Issues:

- Reduce `testPointCount`
- Test less frequently (every 2-3 frames)
- Limit test distance
- Use simpler occluder geometry

## Advanced Usage

### Testing Multiple Objects:

```tsx
const objectsToTest = [tree1, tree2, building1, npc1];
const occluders = [terrain, mountain1, mountain2, building2];

objectsToTest.forEach((obj) => {
  const { isOccluded } = useOcclusionTest(obj, occluders);
  obj.visible = !isOccluded;
});
```

### Dynamic Occluder Updates:

```tsx
// Update occluders when player moves
useEffect(() => {
  const nearbyBuildings = getNearbyBuildings(playerPosition);
  setOccluders([terrain, ...nearbyBuildings]);
}, [playerPosition]);
```

### Batch Testing:

```tsx
// Test multiple objects in one frame
useFrame(() => {
  if (frameCount % 2 === 0) {
    testObjectBatch1();
  } else {
    testObjectBatch2();
  }
});
```

## Testing Your Implementation

1. **Enable the basic test in Map5** and verify it works correctly
2. **Test different angles** - the system should be consistent now
3. **Try the advanced integration** with your terrain
4. **Optimize performance** by adjusting test point count and frequency
5. **Scale up** to your full game objects

The key improvement over your original approach is the **multi-point sampling** which eliminates the angle-dependent issues you were experiencing. Clayde's Fibonacci sphere algorithm ensures even distribution of test points across all angles, making the occlusion detection much more reliable.
