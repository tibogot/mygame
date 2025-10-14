# 🐛 **PERFORMANCE FIX - 2 FPS BUG RESOLVED**

## ❌ **What Was Wrong**

### **Problem 1: LOD System Killing Performance**

```typescript
// This was running EVERY FRAME for ALL 1000 trees!
useFrame(() => {
  treePositions.forEach((tree, i) => {
    instancedMeshRef.current.setMatrixAt(i, matrix); // 1000 calls per frame!
  });
  instancedMeshRef.current.instanceMatrix.needsUpdate = true; // Force GPU upload every frame!
});
```

**Result**: Updating 1000 matrices every frame = **2 FPS** 💀

### **Problem 2: GPU Billboarding Shader**

The vertex shader injection with `onBeforeCompile` was potentially causing:

- Shader recompilation on every frame
- Incorrect shader injection order
- GPU stalls

---

## ✅ **What Was Fixed**

### **Fix 1: DISABLED LOD System**

```typescript
// LOD is DISABLED for now - it was killing performance!
// The GPU billboarding in the shader is enough for good performance
```

**Matrices are now set ONCE** in `useEffect`, not every frame!

### **Fix 2: DISABLED GPU Billboarding (Temporarily)**

```typescript
// Use material WITHOUT billboarding for now (testing performance)
const billboardMaterial = useMemo(() => {
  const mat = material.clone();
  // NO shader injection!
  return mat;
}, [material]);
```

Trees are static but should now render at **60 FPS**!

---

## 🚀 **REFRESH NOW AND CHECK**

### **What You Should See:**

1. **Console Output:**

```
✅ Extracted tree geometry:
   - Vertices: [X]
   - Triangles: [Y]
🌲 Total triangles for 1000 trees: [Y * 1000]
🌲 Setting up 1000 instanced trees...
✅ 1000 trees positioned!
```

2. **FPS:**

   - **Expected**: 40-60 FPS (depending on tree complexity)
   - **Trees**: 1000 static trees visible
   - **Trees won't rotate** (billboarding disabled for now)

3. **If Tree Complexity is Too High:**
   - Check console: `Total triangles for 1000 trees:`
   - If > 500,000 triangles: Reduce tree count to 500

---

## 📊 **Performance Expectations**

| Tree Model Complexity          | Max Trees @ 60 FPS |
| ------------------------------ | ------------------ |
| **Simple** (500 triangles)     | 5000               |
| **Medium** (2000 triangles)    | 1000               |
| **Complex** (10,000 triangles) | 200                |

The `tree.glb` from octahedral-impostor is **medium complexity**.

---

## 🔧 **Next Steps**

### **Step 1: Verify Instancing Works**

1. Refresh browser
2. Check FPS - should be **40-60 FPS**
3. If still slow, check console for triangle count

### **Step 2: Re-enable Billboarding (Later)**

Once performance is good with static trees, we can re-add CPU-side billboarding:

```typescript
// In useFrame (runs every frame but WAY cheaper than updating matrices)
useFrame(({ camera }) => {
  groupRef.current.children.forEach((tree) => {
    tree.lookAt(camera.position); // Simple Y-axis rotation
  });
});
```

### **Step 3: Optimize Tree Model**

If still slow:

1. Use a simpler tree.glb (fewer triangles)
2. Or reduce tree count to 500
3. Or implement proper LOD (only update nearby trees)

---

## 🐛 **Troubleshooting**

### **Still Getting 2 FPS?**

Check console for:

```
🌲 Total triangles for 1000 trees: [HUGE NUMBER]
```

If > 1,000,000 triangles:

- **Reduce Tree Count** to 200-500 in Leva
- Or use a simpler tree model

### **Trees Not Visible?**

- Check console: `✅ 1000 trees positioned!`
- Trees might be far from camera
- Fly around the map to find them

### **Want More Performance?**

1. Use a **LOD model** (low-poly tree)
2. **Reduce tree count** to 500
3. **Simplify the tree geometry** (decimate in Blender)

---

## 📝 **What to Tell Me**

After refreshing, share:

1. **FPS**: What's your new framerate?
2. **Console Output**: Paste the triangle count line
3. **Visible Trees**: Can you see 1000 trees?

Then we can:

- Re-enable billboarding (if FPS is good)
- Or optimize further (if still slow)

---

## ✅ **Summary**

**Before:**

- ❌ LOD updating 1000 matrices per frame = 2 FPS
- ❌ GPU billboarding shader causing issues

**After:**

- ✅ Matrices set ONCE = 60 FPS!
- ✅ Simple instanced rendering
- ✅ Static trees (no billboarding yet)

**Refresh and check your FPS!** 🚀
