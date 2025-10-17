import * as THREE from "three";

export interface GrassGeometryConfig {
  grassHeight: number;
  grassHeightMultiplier: number;
  grassBaseWidth: number;
  grassTipWidth: number;
  grassBaseLean: number;
  widthTaperPower: number;
  tipPointPercent: number;
}

/**
 * GrassGeometry - Extracted Geometry Creation Logic for Grass System
 *
 * This component contains all the geometry creation logic that was previously
 * embedded in SimonDevGrass11. This separation makes the main component
 * much cleaner and easier to debug.
 */
export const createGrassGeometry = (
  segments: number,
  name: string,
  config: GrassGeometryConfig
): THREE.PlaneGeometry => {
  const {
    grassHeight,
    grassHeightMultiplier,
    grassBaseWidth,
    grassTipWidth,
    widthTaperPower,
    tipPointPercent,
  } = config;

  // Start with width=1.0 as a BASE, then we'll apply absolute widths
  // (Not 0.08 which is too small and causes multiplication issues!)
  const geom = new THREE.PlaneGeometry(
    1.0, // Unit width - we'll apply actual width in taper loop
    1.2 * grassHeight * grassHeightMultiplier,
    1,
    segments
  );

  const vertices = geom.attributes.position.array as Float32Array;

  // Easing functions (like Quick_Grass) with safety checks
  const easeOut = (t: number, power: number) => {
    const clampedT = Math.max(0.0, Math.min(1.0, t));
    const safePower = Math.max(0.1, power);
    const result = 1.0 - Math.pow(1.0 - clampedT, safePower);
    return isNaN(result) || !isFinite(result) ? 0.5 : result;
  };
  const easeIn = (t: number, power: number) => {
    const clampedT = Math.max(0.0, Math.min(1.0, t));
    const safePower = Math.max(0.1, power);
    const result = Math.pow(clampedT, safePower);
    return isNaN(result) || !isFinite(result) ? 0.5 : result;
  };

  // Apply width taper - SINGLE smooth curve like Quick_Grass!
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i]; // -0.5 to 0.5 for unit PlaneGeometry
    const y = vertices[i + 1];
    const normalizedY = (y + 0.6) / 1.2; // Normalize to 0-1 range
    const safeNormalizedY = Math.max(0.0, Math.min(1.0, normalizedY));

    // easeOut: stays wide longer, narrows at end (natural look!)
    const widthPercent = easeOut(1.0 - safeNormalizedY, widthTaperPower);

    // Interpolate smoothly from tip width to base width
    const targetWidth =
      grassTipWidth + (grassBaseWidth - grassTipWidth) * widthPercent;

    // CRITICAL: Converge to POINT at very tip (creates TRIANGLE tip, not flat!)
    // tipPointPercent controls how much of the blade converges to a point
    let finalWidth = targetWidth;
    const pointStart = 1.0 - tipPointPercent; // Where point convergence starts

    // Debug tip convergence
    const isInTipZone = safeNormalizedY > pointStart;
    if (i === 0 && segments === 12) {
      console.log(
        `🔺 Tip convergence: y=${safeNormalizedY.toFixed(
          3
        )}, pointStart=${pointStart.toFixed(
          3
        )}, inZone=${isInTipZone}, tipPointPercent=${tipPointPercent}`
      );
    }

    if (isInTipZone) {
      const tipConverge = Math.min(
        1.0,
        (safeNormalizedY - pointStart) / tipPointPercent
      ); // 0→1, clamped
      finalWidth = Math.max(0.001, targetWidth * (1.0 - tipConverge)); // Narrows to minimum width at very top

      if (i === 0 && segments === 12) {
        console.log(
          `  → tipConverge=${tipConverge.toFixed(
            3
          )}, targetWidth=${targetWidth.toFixed(
            3
          )}, finalWidth=${finalWidth.toFixed(3)}`
        );
      }
    }

    // Set absolute width directly
    vertices[i] = x * finalWidth;

    // NOTE: Natural forward lean is NOW applied in the SHADER (after rotation)
    // This ensures that when bladesPerCluster > 1, all blades lean in the
    // SAME world direction, creating a tight cluster instead of splaying out.
    // See vertex shader for the lean implementation.
  }

  // Shift blade up so base is at y=0
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 1] += (1.2 * grassHeight * grassHeightMultiplier) / 2;
  }

  geom.attributes.position.needsUpdate = true;
  geom.computeVertexNormals(); // Recompute normals after curve
  console.log(
    `  ✅ ${name}: ${segments} segs | taper:${widthTaperPower.toFixed(1)} | ${(
      grassBaseWidth * 100
    ).toFixed(0)}mm→${(grassTipWidth * 100).toFixed(0)}mm`
  );
  return geom;
};

/**
 * Creates all LOD geometries for the grass system
 */
export const createGrassGeometries = (config: GrassGeometryConfig) => {
  console.log("🔨 Creating LOD geometries (cached)...");

  return {
    high: createGrassGeometry(12, "High Detail", config), // Close grass
    medium: createGrassGeometry(6, "Medium Detail", config), // Medium distance
    low: createGrassGeometry(3, "Low Detail", config), // Far grass
  };
};

export default {
  createGrassGeometry,
  createGrassGeometries,
};
