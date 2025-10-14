# 🐛 **2 FPS ISSUE - DIAGNOSIS**

## ❌ **Problem Identified!**

### **The Issue:**

Trees are spawning at `mountainPosition = [0, -0.5, 0]` (the origin)  
Camera/Player likely starts at or near `[0, 0, 0]`  
**Result**: ALL 1000 trees are directly in front of the camera = 2 FPS!

### **What Happens:**

```
Mountain: (0, -0.5, 0)
Camera:   (0, 0, -5) or similar
Trees:    All within radius 100-150 of mountain
          = All visible at startup!
```

---

## 🚀 **REFRESH NOW TO SEE DIAGNOSTIC INFO!**

After refreshing, check console for:

```
📏 Tree distances from camera:
   Min: [X]m | Max: [Y]m | Avg: [Z]m
   Trees within 50m: [N]/1000

⚠️ WARNING: [N] trees are very close to camera!
   This will cause low FPS. Trees should be spread out more.

⚠️ WARNING: [XXXXX] total triangles is VERY HIGH!
   Each tree has [XXX] triangles. Consider using a simpler model.
```

This will tell us:

1. **How many trees are too close** (< 50m from camera)
2. **How complex the tree model is** (triangles per tree)
3. **Total rendering load** (total triangles)

---

## ✅ **Solutions:**

### **1. Spread Trees Further**

- Increase `forestRadius` from 150 to 200+
- Trees will be more spread out

### **2. Reduce Tree Count**

- Start with 500 trees (already done!)
- Increase only if FPS is good

### **3. Use Simpler Tree Model**

- If `tree.glb` has > 5000 triangles, it's too complex
- Need a low-poly version

### **4. Use LOD (Future)**

- High detail nearby
- Low detail far away
- But needs multiple tree models

---

## 🔍 **Test Steps:**

1. **Refresh browser**
2. **Check console** for warnings
3. **Share these values:**
   - Triangles per tree: ?
   - Trees within 50m: ?
   - FPS: ?

Then we can fix it properly!
