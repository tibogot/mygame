# ⚠️ RESTART DEV SERVER REQUIRED

## What Changed

1. ✅ Installed `vite-plugin-glsl` package
2. ✅ Updated `vite.config.js` to handle GLSL imports
3. ✅ Copied actual repository implementation
4. ✅ Created proper R3F wrapper
5. ✅ Positioned performance stats correctly

## 🔄 How to Restart

### Option 1: Terminal

1. Press `Ctrl+C` in terminal to stop current dev server
2. Run: `npm run dev`

### Option 2: VS Code

1. Stop the running process
2. Start fresh dev server

## ✅ After Restart

You should see:

- ✅ No shader errors in console
- ✅ Mountain rendering with proper impostor
- ✅ Performance stats on **middle-left** (between Stats and Controls)
- ✅ Toggle impostor on/off in Leva panel

## 📍 Screen Layout

```
┌──────────────────────────────────────────┐
│ Stats (drei)            Leva Panel       │
│ (top-left)               (top-right)     │
│                                          │
│ 🚀 Impostor Performance                 │ ← MIDDLE-LEFT
│    FPS: 110                              │    (45% from top)
│    Draw Calls: 1                         │
│    Triangles: 32                         │
│                                          │
│                                          │
│ Character Controls                       │
│ (bottom-left)                            │
└──────────────────────────────────────────┘
```

## 🎯 Test Checklist

After restart:

- [ ] Select `map5(copy)` in Leva
- [ ] See mountain in background
- [ ] Toggle impostor ON/OFF
- [ ] Watch performance stats change
- [ ] No console errors!

---

**Restart now to see the proper octahedral impostor in action!** 🚀
