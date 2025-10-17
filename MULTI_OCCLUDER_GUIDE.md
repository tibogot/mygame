# Multi-Occluder Occlusion Culling System

## Overview

This advanced occlusion culling system extends Clayde's robust multi-point sampling approach to handle multiple occluder planes simultaneously. You can now test how multiple transparent planes work together to occlude a target sphere, with full control over each occluder's properties.

## Components Available

### 1. `MultiOccluderTest` - Dynamic Multi-Occluder System

Allows you to dynamically add/remove occluder planes with random generation and management controls.

**Features:**

- ✅ Dynamic occluder management (add/remove/clear)
- ✅ Random occluder generation with random colors
- ✅ Individual occluder control
- ✅ Combined occlusion testing against all occluders
- ✅ Real-time debug information

**Usage in Map5:**

```tsx
// Enable in Leva controls:
// Debug → Multi-Occluder Test → Enable Multi-Occluder Test
```

### 2. `AdvancedMultiOccluderTest` - Individual Control System

Provides precise individual control over 3 predefined occluder planes with dedicated Leva controls.

**Features:**

- ✅ 3 predefined occluder planes (Red, Green, Blue)
- ✅ Individual Leva controls for each occluder
- ✅ Enable/disable individual occluders
- ✅ Real-time position, size, rotation, and color control
- ✅ Combined occlusion testing

**Usage in Map5:**

```tsx
// Enable in Leva controls:
// Debug → Advanced Multi-Occluder → Enable Advanced Multi-Occluder
```

## How to Use

### Basic Multi-Occluder Test

1. **Enable the test:**

   - Go to Leva controls → "🔍 DEBUG" → "Multi-Occluder Test"
   - Enable "🎯 Enable Multi-Occluder Test"

2. **Add occluders:**

   - Click "🎲 Add Random Occluder" to add random colored planes
   - Use "🔄 Reset to Defaults" to get 3 default occluders
   - Use "🗑️ Clear All Occluders" to remove all

3. **Test occlusion:**
   - Orbit the camera around the setup
   - Watch the debug info show occlusion percentage
   - See how multiple planes combine to occlude the sphere

### Advanced Multi-Occluder Test

1. **Enable the test:**

   - Go to Leva controls → "🔍 DEBUG" → "Advanced Multi-Occluder"
   - Enable "🎯 Enable Advanced Multi-Occluder"

2. **Control individual occluders:**

   - **🔴 Occluder 1**: Red plane with full controls
   - **🟢 Occluder 2**: Green plane with full controls
   - **🔵 Occluder 3**: Blue plane with full controls

3. **For each occluder you can control:**
   - **Enabled**: Toggle on/off
   - **Position**: X, Y, Z coordinates
   - **Size**: Width and height
   - **Rotation**: X, Y, Z rotation (in degrees)
   - **Color**: Any hex color

## Testing Scenarios

### Scenario 1: Overlapping Occluders

- Position two planes to overlap
- See how they combine to create stronger occlusion
- Test different angles to see consistent behavior

### Scenario 2: Partial Occlusion

- Position planes to partially cover the sphere
- Observe occlusion percentage changes
- Verify 99% threshold for "fully occluded"

### Scenario 3: Multiple Angles

- Test from different camera positions
- Verify consistent occlusion detection
- No more angle-dependent false positives!

### Scenario 4: Dynamic Testing

- Use random occluder generation
- Test with different numbers of occluders
- See how system handles complex scenarios

## Key Improvements Over Single Occluder

### Multi-Point Sampling Against Multiple Objects

```tsx
// The system now tests against ALL occluders simultaneously:
occluders.forEach((occluder) => {
  if (!occluder.enabled) return;
  const occluderMesh = occluderRefs.current[occluder.id];
  if (occluderMesh) {
    const intersects = raycaster.current.intersectObject(occluderMesh, true);
    allIntersects.push(...intersects);
  }
});

// Sort all intersections by distance
allIntersects.sort((a, b) => a.distance - b.distance);
```

### Combined Occlusion Detection

- Tests 26 points on the sphere against ALL occluders
- Finds the closest intersection from any occluder
- Determines visibility based on combined occlusion
- Handles complex multi-plane scenarios correctly

### Visual Feedback

- Each occluder has a different color for easy identification
- Real-time debug info shows active occluder count
- Sphere color changes based on combined occlusion
- Debug panel shows total occlusion percentage

## Performance Considerations

### For Your Zelda Game:

1. **Multiple Terrain Objects**: Test against multiple buildings, mountains, terrain pieces
2. **Dynamic Occluders**: Buildings can be added/removed as player moves
3. **Layered Occlusion**: Complex scenes with multiple occlusion layers
4. **Optimized Testing**: Only test against nearby occluders

### Example Integration:

```tsx
// Test a tree against multiple terrain pieces
const terrainOccluders = [
  nearbyBuilding1,
  nearbyBuilding2,
  terrainMesh,
  mountainObject,
];

const { isOccluded } = useOcclusionTest(treeObject, terrainOccluders, {
  testPointCount: 20,
  occlusionThreshold: 0.95,
});
```

## Debug Information

### Multi-Occluder Test Debug Panel:

```
Multi-Occluder Test
Occluders: 3
Occlusion: 85%
VISIBLE
```

### Advanced Multi-Occluder Debug Panel:

```
Advanced Multi-Occluder
Active: 2/3
Occlusion: 95%
OCCLUDED
```

## Color Coding System

### Default Colors:

- **🔴 Red**: Primary occluder (default)
- **🟢 Green**: Secondary occluder
- **🔵 Blue**: Tertiary occluder

### Random Colors:

When using "Add Random Occluder", planes get random colors from:

- Red, Green, Blue, Yellow, Magenta, Cyan, Orange, Purple

## Troubleshooting

### No Occlusion Detected:

- Check if occluders are enabled
- Verify occluder positions are between camera and target
- Ensure occluder size is sufficient
- Check target sphere radius

### Inconsistent Occlusion:

- Increase test point count (currently 26)
- Adjust occlusion threshold (currently 99%)
- Verify occluder geometry is proper
- Check for transparent material issues

### Performance Issues:

- Reduce number of active occluders
- Lower test point count
- Test less frequently (every 2-3 frames)
- Use distance-based culling

## Advanced Usage Examples

### Testing Against Your Game Objects:

```tsx
// Test NPC against multiple buildings
const buildingOccluders = nearbyBuildings.map((building) => building.mesh);
const { isOccluded } = useOcclusionTest(npcObject, buildingOccluders);

// Hide NPC when fully occluded
npcObject.visible = !isOccluded;
```

### Dynamic Occluder Management:

```tsx
// Add/remove occluders based on player position
useEffect(() => {
  const nearbyOccluders = getNearbyOccluders(playerPosition);
  setOccluders(nearbyOccluders);
}, [playerPosition]);
```

### Complex Scene Testing:

```tsx
// Test against multiple scene elements
const sceneOccluders = [...buildings, ...trees, ...terrainPieces, ...mountains];

// Different thresholds for different object types
const treeThreshold = 0.95; // Trees need 95% occlusion
const npcThreshold = 0.99; // NPCs need 99% occlusion
```

## Testing Your Implementation

1. **Enable Multi-Occluder Test** and add some random occluders
2. **Test different combinations** of enabled/disabled occluders
3. **Try the Advanced version** for precise control
4. **Orbit the camera** to test from all angles
5. **Verify consistent behavior** - no more angle-dependent issues!

The multi-occluder system demonstrates how Clayde's robust approach scales to complex scenarios with multiple occluding objects, providing a solid foundation for your Zelda game's occlusion culling system.
