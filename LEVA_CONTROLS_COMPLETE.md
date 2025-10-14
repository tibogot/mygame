# 🎮 **COMPLETE LEVA CONTROLS FOR FOREST FINE-TUNING**

## ✅ **ALL CONTROLS NOW LIVE!**

You can now adjust **EVERYTHING in real-time** while the game runs!

---

## 🎛️ **New Leva Panel: "🌲 InstancedMesh2 Forest (Map5)"**

### **Forest Setup:**

| Control              | Default | Range    | What It Does                    |
| -------------------- | ------- | -------- | ------------------------------- |
| **🌲 Enable Forest** | ON      | -        | Toggle entire forest on/off     |
| **Tree Count**       | 1000    | 100-5000 | Number of trees (try 3000!)     |
| **Min Radius**       | 80m     | 30-150m  | Inner ring (keeps center clear) |
| **Max Radius**       | 200m    | 50-300m  | Outer ring (forest extent)      |

### **LOD System (Performance):**

| Control                 | Default | Range    | What It Does                              |
| ----------------------- | ------- | -------- | ----------------------------------------- |
| **🎨 Use LOD**          | ON      | -        | Enable/disable LOD system                 |
| **🔍 LOD Mid Distance** | 100m    | 30-200m  | When to switch to medium detail           |
| **🔍 LOD Low Distance** | 180m    | 50-300m  | When to switch to low detail (silhouette) |
| **🔍 LOD Mid Ratio**    | 0.5     | 0.2-0.8  | Medium detail (50% = half triangles)      |
| **🔍 LOD Low Ratio**    | 0.2     | 0.05-0.5 | Low detail (20% = just shape)             |

### **Leaves Appearance:**

| Control                    | Default | Range   | What It Does                                      |
| -------------------------- | ------- | ------- | ------------------------------------------------- |
| **🍃 Leaves Opacity**      | 1.0     | 0.3-1.0 | Overall transparency of leaves                    |
| **🍃 Leaves Alpha Cutoff** | 0.5     | 0.0-1.0 | Transparency threshold (lower = more transparent) |

---

## 🎨 **HOW TO USE THESE CONTROLS:**

### **1. Fine-Tune LOD (Performance vs Quality):**

**Problem**: Trees simplify too early (ugly blocky trees)  
**Solution**: Increase "LOD Mid Distance" to 150m

**Problem**: Still laggy with many trees  
**Solution**: Decrease "LOD Mid Ratio" to 0.3 (more simplification)

**Example Settings:**

```
Quality Focus:
- LOD Mid Distance: 150m
- LOD Low Distance: 250m
- LOD Mid Ratio: 0.7 (70% detail kept)
- LOD Low Ratio: 0.3 (30% detail)

Performance Focus:
- LOD Mid Distance: 60m
- LOD Low Distance: 120m
- LOD Mid Ratio: 0.3 (30% detail)
- LOD Low Ratio: 0.1 (10% detail - very simple)
```

### **2. Perfect Leaves Transparency:**

**Problem**: Leaves look too solid  
**Solution**:

- Decrease "Alpha Cutoff" to 0.3 (softer edges)
- Decrease "Opacity" to 0.9 (slight transparency)

**Problem**: Leaves have holes/artifacts  
**Solution**:

- Increase "Alpha Cutoff" to 0.7 (sharper cutoff)
- Keep "Opacity" at 1.0 (fully opaque where visible)

**Example Settings:**

```
Soft, Wispy Leaves (like wind-blown):
- Opacity: 0.85
- Alpha Cutoff: 0.3

Sharp, Dense Leaves:
- Opacity: 1.0
- Alpha Cutoff: 0.6

Autumn/Sparse Leaves:
- Opacity: 0.7
- Alpha Cutoff: 0.4
```

### **3. Find Your Sweet Spot:**

**For Dense Zelda Forest:**

```
Tree Count: 2000-3000
Min Radius: 60m
Max Radius: 250m
LOD Mid Distance: 120m
LOD Low Distance: 200m
Leaves Opacity: 0.9
Alpha Cutoff: 0.5
```

**For Open Field with Distant Forest:**

```
Tree Count: 5000
Min Radius: 150m
Max Radius: 300m
LOD Mid Distance: 80m (aggressive LOD)
LOD Low Distance: 150m
Leaves Opacity: 1.0
Alpha Cutoff: 0.5
```

---

## 🚀 **LIVE TUNING WORKFLOW:**

### **Step 1: Add More Trees**

1. Start with 1000 trees
2. Increase to 2000, check FPS
3. Keep increasing until FPS drops below 50
4. That's your max tree count!

### **Step 2: Tune LOD**

1. Walk close to trees (< 50m)
2. Adjust "LOD Mid Distance" until they look good
3. Walk far from trees (> 150m)
4. Adjust "LOD Low Ratio" until silhouettes look good

### **Step 3: Perfect Leaves**

1. Look at trees from 20m away
2. Adjust "Leaves Opacity" for desired density
3. Adjust "Alpha Cutoff" for edge sharpness
4. Move around to see how it looks from different angles

---

## 📊 **Understanding LOD Ratios:**

```
LOD Ratio:    Triangles per Tree:    When to Use:
0.8 (80%)     640 triangles          High quality, close viewing
0.5 (50%)     400 triangles          Medium distance, balanced
0.3 (30%)     240 triangles          Far distance, still recognizable
0.2 (20%)     160 triangles          Very far, silhouette only
0.1 (10%)     80 triangles           Extreme distance, blob shape
```

---

## 🍃 **Understanding Alpha Controls:**

### **Leaves Opacity** (overall transparency):

- **1.0**: Fully opaque leaves (dense foliage)
- **0.8**: Slightly see-through (realistic)
- **0.5**: Very transparent (sparse canopy)

### **Alpha Cutoff** (transparency threshold):

- **0.0**: All pixels visible (smooth but may show artifacts)
- **0.5**: Standard cutoff (balanced)
- **0.8**: Sharp edges (only solid parts visible)
- **1.0**: Maximum cutoff (very sharp, may look harsh)

---

## 🎮 **Recommended Presets:**

### **Preset 1: Dense Forest (Zelda Style)**

```
Tree Count: 2500
Min Radius: 70m
Max Radius: 220m
LOD Mid Distance: 120m
LOD Low Distance: 200m
LOD Mid Ratio: 0.5
LOD Low Ratio: 0.2
Leaves Opacity: 0.95
Alpha Cutoff: 0.5
```

### **Preset 2: Sparse Forest (Open World)**

```
Tree Count: 1500
Min Radius: 100m
Max Radius: 280m
LOD Mid Distance: 80m
LOD Low Distance: 150m
LOD Mid Ratio: 0.4
LOD Low Ratio: 0.15
Leaves Opacity: 0.85
Alpha Cutoff: 0.4
```

### **Preset 3: Maximum Performance**

```
Tree Count: 5000
Min Radius: 120m
Max Radius: 300m
LOD Mid Distance: 60m (aggressive!)
LOD Low Distance: 120m
LOD Mid Ratio: 0.3
LOD Low Ratio: 0.1
Leaves Opacity: 1.0
Alpha Cutoff: 0.6
```

---

## 🔥 **PRO TIPS:**

### **Tip 1: Find LOD Sweet Spot**

1. Set "Tree Count" to 3000
2. Adjust "LOD Mid Distance" until trees look good from player height
3. Adjust "LOD Low Distance" until distant trees are acceptable
4. **Lower distances = better performance but earlier simplification**

### **Tip 2: Balance Leaves**

- **High Alpha Cutoff (0.7+)**: Sharp leaves, better performance
- **Low Alpha Cutoff (0.3-)**: Soft leaves, more fill, slight performance hit

### **Tip 3: Season Simulation**

- **Spring**: Opacity 0.95, Alpha 0.5 (full leaves)
- **Summer**: Opacity 1.0, Alpha 0.6 (dense)
- **Autumn**: Opacity 0.75, Alpha 0.4 (sparse)
- **Winter**: Set Tree Count to 0 (no leaves!)

---

## 📏 **All Controls Explained:**

### **LOD Mid Distance:**

"At what distance should trees start simplifying?"

- **Lower (60m)**: Trees simplify sooner = better FPS
- **Higher (150m)**: Trees stay detailed longer = better quality

### **LOD Low Distance:**

"At what distance should trees become silhouettes?"

- **Lower (120m)**: Aggressive simplification = maximum FPS
- **Higher (250m)**: Keep some detail further = better visuals

### **LOD Ratios:**

"How much to simplify?"

- **0.8**: Keep 80% of triangles (still detailed)
- **0.5**: Keep 50% (medium detail)
- **0.2**: Keep 20% (just outline)

---

## ✅ **YOU CAN NOW:**

- ✅ **Tune LOD** in real-time while running around
- ✅ **Perfect leaf transparency** by adjusting sliders
- ✅ **Find optimal performance** for your hardware
- ✅ **Create different forest atmospheres** (dense, sparse, seasonal)

---

## 🚀 **REFRESH AND START TUNING!**

Open **Leva** → **"🌲 InstancedMesh2 Forest (Map5)"**

You'll see **11 controls** for complete forest customization!

**Have fun creating your perfect Zelda forest!** 🌲🗡️✨
