/**
 * Five art directions for a real, freely orbitable Three.js scene.
 *
 * Opaque surfaces retain Three.js' normal, light and shadow calculations. The
 * shader then compresses the diffuse illumination into art-directed bands and
 * adds broad pigment variation plus optional world-mapped painted textures. There are no painted billboards
 * standing in for the island, no reflection maps and no photoreal specular layer.
 *
 * Call setStyle(id) without rebuilding geometry. Call animate(normalizedPhase)
 * with a value from 0 to 1; every animated term has an integer period, so both
 * endpoints produce the same water surface.
 */

const SURFACES = ['grass', 'rock', 'stone', 'stoneLight', 'roof', 'gold', 'dark', 'wood', 'leaf', 'leafDetail', 'trunk', 'flower', 'cloud'];
const PALETTES = {
  original: {
    grass:0x859c50, rock:0x9c8260, stone:0xd8ca93, stoneLight:0xefe0b4,
    roof:0x548c86, gold:0xc69a49, dark:0x364e45, wood:0x96703f,
    leaf:0x698449, trunk:0x796347, flower:0xdba560, cloud:0xf8eac6,
    water:0x408e9c, foam:0xd6eadc, shadow:0x76909b,
    sky:0x76aec4, fog:0x9fbdbb, outline:0x384d4b,
    ambient:1.35, sunlight:2.5, contrast:0.78, bands:3, softness:0.16,
    pigment:0.80, grain:0.12, outlineOpacity:0.25, outlineWidth:0.014,
  },
  fantasy: {
    grass:0x71a84c, rock:0xa68162, stone:0xe8ddbe, stoneLight:0xffedcb,
    roof:0x469d9c, gold:0xd8af58, dark:0x39574c, wood:0x986f49,
    leaf:0x438e58, trunk:0x80603e, flower:0xe69a96, cloud:0xfff9e8,
    water:0x319eaf, foam:0xd2f4e9, shadow:0x5d7797,
    sky:0x79c1df, fog:0xb4dce4, outline:0x47625d,
    ambient:1.15, sunlight:2.8, contrast:0.92, bands:4, softness:0.32,
    pigment:1.0, grain:0.08, outlineOpacity:0.0, outlineWidth:0.0,
  },
  ink: {
    grass:0x98a663, rock:0xa7a382, stone:0xdfd2a5, stoneLight:0xf5e6bc,
    roof:0x759e95, gold:0xc4a161, dark:0x485b54, wood:0x988464,
    leaf:0x7f9565, trunk:0x7c7660, flower:0xc49178, cloud:0xf8eacb,
    water:0x679f9e, foam:0xe4e9cb, shadow:0x8fa49a,
    sky:0x8cb7c4, fog:0xc0cdbf, outline:0x374d49,
    ambient:1.35, sunlight:2.45, contrast:0.65, bands:3, softness:0.012,
    pigment:0.18, grain:0.025, outlineOpacity:0.85, outlineWidth:0.020,
  },
  ghibli: {
    grass:0x82ab62, rock:0x998570, stone:0xe6d8b4, stoneLight:0xffedca,
    roof:0x527f84, gold:0xd8ae67, dark:0x425b51, wood:0x9c774f,
    leaf:0x54845b, trunk:0x7f6c50, flower:0xdfa991, cloud:0xfff4d9,
    water:0x63afb7, foam:0xe4f3db, shadow:0x76949c,
    sky:0x82bcd1, fog:0xc1ddd9, outline:0x668273,
    ambient:1.5, sunlight:2.3, contrast:0.70, bands:0, softness:0.35,
    pigment:0.82, grain:0.045, outlineOpacity:0.06, outlineWidth:0.004,
  },
  cozy: {
    grass:0x9dbf7e, rock:0xa5af90, stone:0xe8d9b3, stoneLight:0xfaeacb,
    roof:0x8fbfaf, gold:0xd7b876, dark:0x738875, wood:0xb4a185,
    leaf:0x7e9f76, trunk:0x8b8c72, flower:0xe6ad9e, cloud:0xfaf0d9,
    water:0x89c4c4, foam:0xeaf5de, shadow:0xadbfaa,
    sky:0xb8d9dd, fog:0xd9e4d9, outline:0x60755f,
    ambient:1.8, sunlight:1.6, contrast:0.26, bands:0, softness:0.3,
    pigment:0.3, grain:0.035, outlineOpacity:0.48, outlineWidth:0.013,
  },
};

export const styleInfo = Object.freeze(Object.fromEntries(
  Object.entries(PALETTES).map(([id, value]) => [id, Object.freeze({ ...value, id })]),
));

const PIGMENT_GLSL = /* glsl */`
  varying vec3 vPaintPosition;
  varying vec3 vPaintWorldPosition;
  varying vec3 vPaintWorldNormal;
  varying vec2 vPaintUv;
  uniform float uPaintContrast;
  uniform float uPaintBands;
  uniform float uPaintSoftness;
  uniform float uPaintPigment;
  uniform float uPaintGrain;
  uniform float uPaintSurface;
  uniform vec3 uPaintShadow;
  uniform vec3 uPaintMoss;
  uniform sampler2D uMeadowTexture;
  uniform vec3 uMeadowMean;
  uniform float uMeadowEnabled;
  uniform float uMeadowStrength;
  uniform sampler2D uRockTexture;
  uniform vec3 uRockMean;
  uniform float uRockEnabled;
  uniform float uRockStrength;

  float paintHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.23, 0.37));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float paintNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(paintHash(i), paintHash(i + vec3(1,0,0)), f.x),
                   mix(paintHash(i + vec3(0,1,0)), paintHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(paintHash(i + vec3(0,0,1)), paintHash(i + vec3(1,0,1)), f.x),
                   mix(paintHash(i + vec3(0,1,1)), paintHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float paintBand(float lightValue) {
    if (uPaintBands < 1.0) return lightValue;
    float steps = max(1.0, uPaintBands - 1.0);
    float s = lightValue * steps;
    float low = floor(s);
    float boundary = smoothstep(0.5 - uPaintSoftness, 0.5 + uPaintSoftness, fract(s));
    return (low + boundary) / steps;
  }
  // Three independently oriented physical scales keep the painted strokes
  // attached to the world while preventing an obvious repeated square tile.
  // Ordinary derivatives choose mip levels for each continuous coordinate set.
  float paintSeamWeight(vec2 uv) {
    vec2 toEdge = 0.5 - abs(fract(uv) - 0.5);
    return smoothstep(0.008, 0.13, min(toEdge.x, toEdge.y));
  }
  vec3 samplePaintTile(sampler2D paintTexture, vec2 worldXZ, vec2 worldDx, vec2 worldDy, float frequency) {
    const mat2 rotateA = mat2(0.80, 0.60, -0.60, 0.80);
    const mat2 rotateB = mat2(0.93, -0.37, 0.37, 0.93);
    vec2 q = worldXZ * frequency;
    vec2 dx = worldDx * frequency, dy = worldDy * frequency;
    vec2 crossingUV = rotateA * q * 1.43 + vec2(0.37, 0.71);
    vec2 broadUV = rotateB * q * 0.67 + vec2(0.83, 0.19);
    vec3 primary = textureGrad(paintTexture, q, dx, dy).rgb;
    vec3 crossing = textureGrad(paintTexture, crossingUV, rotateA * dx * 1.43, rotateA * dy * 1.43).rgb;
    vec3 broad = textureGrad(paintTexture, broadUV, rotateB * dx * 0.67, rotateB * dy * 0.67).rgb;
    float blend = paintNoise(vec3(worldXZ * 0.034, 7.4));
    // Suppress each sample near its own image edge. Other orientations carry
    // the paint through that region, hiding an imperfect source tile's joins.
    vec3 weights = vec3(0.66 - blend * 0.12, 0.20 + blend * 0.12, 0.14)
      * vec3(paintSeamWeight(q), paintSeamWeight(crossingUV), paintSeamWeight(broadUV));
    weights += vec3(0.012);
    weights /= dot(weights, vec3(1.0));
    return primary * weights.x + crossing * weights.y + broad * weights.z;
  }
  vec3 surfacePaint(sampler2D paintTexture, vec3 worldPosition, vec3 worldNormal, float frequency) {
    // Compute derivatives before projection branches, then use explicit texture
    // gradients. This avoids undefined mip selection on steep-bank boundaries.
    vec3 worldDx = dFdx(worldPosition), worldDy = dFdy(worldPosition);
    vec3 weights = pow(abs(normalize(worldNormal)), vec3(4.0));
    weights /= max(dot(weights, vec3(1.0)), 0.0001);
    vec3 painted = vec3(0.0);
    if (weights.y > 0.002) painted += samplePaintTile(paintTexture, worldPosition.xz, worldDx.xz, worldDy.xz, frequency) * weights.y;
    if (weights.x > 0.002) painted += samplePaintTile(paintTexture, worldPosition.zy + vec2(6.2, 1.4), worldDx.zy, worldDy.zy, frequency) * weights.x;
    if (weights.z > 0.002) painted += samplePaintTile(paintTexture, worldPosition.xy + vec2(3.8, 7.1), worldDx.xy, worldDy.xy, frequency) * weights.z;
    return painted;
  }
  vec3 paletteRelativePaint(vec3 painted, vec3 imageMean, float contrast, float chroma) {
    const vec3 luminanceWeights = vec3(0.2126, 0.7152, 0.0722);
    float paintedLuma = max(dot(painted, luminanceWeights), 0.015);
    float meanLuma = max(dot(imageMean, luminanceWeights), 0.015);
    float lightRatio = pow(clamp(paintedLuma / meanLuma, 0.28, 2.10), contrast);
    vec3 relativeChroma = (painted / paintedLuma) / max(imageMean / meanLuma, vec3(0.08));
    return vec3(lightRatio) * mix(vec3(1.0), clamp(relativeChroma, vec3(0.73), vec3(1.34)), chroma);
  }
  // Four octave pigment fields, filtered before their frequencies become
  // subpixel. Rotation between octaves prevents an obvious Cartesian grid.
  float rockFbm(vec3 p, float footprint) {
    const mat3 rotateOctave = mat3(0.00, 0.80, 0.60,
                                -0.80, 0.36, -0.48,
                                -0.60, -0.48, 0.64);
    float value = 0.0;
    float amplitude = 0.5333333;
    float frequency = 1.0;
    for (int octave = 0; octave < 4; octave++) {
      float visible = 1.0 - smoothstep(0.18, 0.48, footprint * frequency);
      value += (paintNoise(p) - 0.5) * amplitude * visible;
      p = rotateOctave * p * 2.03 + vec3(11.3, 7.1, 3.7);
      frequency *= 2.03;
      amplitude *= 0.5;
    }
    return 0.5 + value;
  }
  vec3 rockDomainWarp(vec3 p) {
    vec3 drift = vec3(paintNoise(p * 0.38 + vec3(3.7, 9.1, 1.2)),
                      paintNoise(p * 0.34 + vec3(8.4, 1.3, 6.8)),
                      paintNoise(p * 0.41 + vec3(1.6, 4.9, 12.7)));
    return p + (drift - 0.5) * 0.70;
  }
  float rockRelief(vec3 p) {
    // Broad flakes only. Cracks, pores and the highest fractal octaves must
    // never perturb normals: that would turn toon shadows into dotted noise.
    float footprint = max(length(dFdx(p)), length(dFdy(p)));
    float broad = paintNoise(p * vec3(1.3, 2.1, 1.3)) * 0.70
                + paintNoise(p * vec3(2.6, 3.1, 2.6) + vec3(11.7)) * 0.30;
    float visible = 1.0 - smoothstep(0.05, 0.20, footprint);
    return (broad - 0.5) * 0.0038 * visible;
  }
  // Broken, gently warped beds stay subordinate to the actual fractal crags.
  // Fine pores retain their existing close-up-only filter and remain color-only.
  vec4 rockTexture(vec3 p) {
    float footprint = max(length(dFdx(p)), length(dFdy(p)));
    vec3 q = rockDomainWarp(p);
    float bedWarp = rockFbm(q * vec3(0.62, 0.27, 0.62), footprint * 0.86);
    float bedPhase = q.y * 9.1 + bedWarp * 4.3 + q.x * 0.17;
    float bed = sin(bedPhase);
    float bedWidth = fwidth(bedPhase);
    float broken = smoothstep(0.41, 0.66, rockFbm(q * vec3(2.7, 0.85, 2.7), footprint * 3.8));
    float seam = (1.0 - smoothstep(0.018, 0.13 + bedWidth, abs(bed))) * broken;
    seam *= 1.0 - smoothstep(0.30, 1.0, bedWidth);
    float flakes = rockFbm(q * vec3(3.2, 5.8, 3.2), footprint * 8.1);
    float fine = 1.0 - smoothstep(0.008, 0.035, footprint);
    float pores = smoothstep(0.59, 0.83, paintNoise(p * 46.0)) * fine;
    return vec4(seam, flakes, pores, rockRelief(p));
  }

`;

/** Return live materials and their small style/animation controller. */
export function createMaterials(THREE) {
  // The fallback keeps the optional sampler valid before an image is loaded.
  const whiteFallback = () => {
    const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    texture.needsUpdate = true;
    return texture;
  };
  const paintLoadRevisions = { Meadow:0, Rock:0 };
  const shared = {
    uPaintContrast:{ value:0.78 }, uPaintBands:{ value:3 },
    uPaintSoftness:{ value:0.2 }, uPaintPigment:{ value:0.95 },
    uPaintGrain:{ value:0.08 }, uPaintShadow:{ value:new THREE.Color(PALETTES.fantasy.shadow) },
    uPaintMoss:{ value:new THREE.Color(PALETTES.fantasy.grass) },
    uMeadowTexture:{ value:whiteFallback() }, uMeadowEnabled:{ value:0 },
    uMeadowMean:{ value:new THREE.Color(0x77a451) }, uMeadowStrength:{ value:0.84 },
    uRockTexture:{ value:whiteFallback() }, uRockEnabled:{ value:0 },
    uRockMean:{ value:new THREE.Color(0xb58a67) }, uRockStrength:{ value:0.86 },
  };
  const materials = {};

  for (const key of SURFACES) {
    const material = new THREE.MeshStandardMaterial({
      color:PALETTES.fantasy[key === 'leafDetail' ? 'leaf' : key], roughness:1, metalness:0,
      // Neither flat normals nor shiny highlights belong to these art directions.
      flatShading:false, dithering:false, side:['grass', 'leaf', 'leafDetail'].includes(key) ? THREE.DoubleSide : THREE.FrontSide,
    });
    material.name = `painted-${key}`;
    material.userData.castleSurface = key;
    const surface = key === 'rock' ? 1 : key === 'grass' ? 2 : key === 'cloud' ? 3 : key === 'leafDetail' ? 4 : key === 'leaf' ? 5 : 0;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared, { uPaintSurface:{ value:surface } });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPaintPosition;\nvarying vec3 vPaintWorldPosition;\nvarying vec3 vPaintWorldNormal;\nvarying vec2 vPaintUv;')
        .replace('#include <begin_vertex>', /* glsl */`
          #include <begin_vertex>
          vPaintPosition = position;
          vPaintUv = uv;
          vec4 paintWorldPosition = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            paintWorldPosition = instanceMatrix * paintWorldPosition;
          #endif
          vPaintWorldPosition = (modelMatrix * paintWorldPosition).xyz;
          vPaintWorldNormal = inverseTransformDirection(transformedNormal, viewMatrix);
        `);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${PIGMENT_GLSL}`)
        .replace('#include <color_fragment>', /* glsl */`
          #include <color_fragment>
          vec3 pigmentPosition = vPaintPosition;
          float footprint = max(length(dFdx(pigmentPosition)), length(dFdy(pigmentPosition)));
          float broadPigment = paintNoise(pigmentPosition * 0.82);
          float brushVisibility = 1.0 - smoothstep(0.08, 0.30, footprint);
          float brushPigment = paintNoise(pigmentPosition * vec3(4.7, 1.8, 4.7));
          float pigment = (broadPigment - 0.5) * 0.16
            + (brushPigment - 0.5) * uPaintGrain * brushVisibility;
          if (uPaintSurface > 0.5 && uPaintSurface < 1.5) {
            // Rock has three physical scales: coherent mineral bodies, broad
            // sedimentary beds, and close-up flakes. None grow with the island.
            vec3 geology = rockDomainWarp(pigmentPosition);
            float mass = paintNoise(pigmentPosition * vec3(0.042, 0.064, 0.042) + vec3(8.2, 2.7, 6.4));
            float fold = paintNoise(pigmentPosition * 0.073 + vec3(2.1, 8.4, 1.7));
            float beds = paintNoise(vec3(pigmentPosition.x * 0.028,
              pigmentPosition.y * 0.27 + fold * 1.8, pigmentPosition.z * 0.028));
            float crag = rockFbm(geology * vec3(0.43, 0.19, 0.43), footprint * 0.61);
            vec3 shale = vec3(0.61, 0.78, 1.12);
            vec3 sandstone = vec3(1.21, 1.035, 0.78);
            float mineralFamily = smoothstep(0.30, 0.70, mass * 0.65 + beds * 0.35);
            vec3 mineralColor = mix(shale, sandstone, mineralFamily);
            float paleBed = smoothstep(0.57, 0.79, beds) * smoothstep(0.25, 0.52, mass);
            mineralColor = mix(mineralColor, vec3(1.16, 1.12, 1.01), paleBed * 0.38);
            diffuseColor.rgb *= mix(vec3(1.0), mineralColor, uPaintPigment);
            vec4 textureDetail = rockTexture(pigmentPosition);
            pigment = (beds - 0.5) * 0.11 + (crag - 0.5) * 0.14
              + (textureDetail.y - 0.5) * 0.08 - textureDetail.x * 0.07 - textureDetail.z * 0.055;
            float colony = rockFbm(geology * vec3(0.35, 0.22, 0.35) + vec3(8.4, 1.7, 3.9), footprint * 0.49);
            float moss = smoothstep(-0.6, 1.6, pigmentPosition.y)
              * smoothstep(0.52, 0.71, mass * 0.45 + colony * 0.55);
            diffuseColor.rgb = mix(diffuseColor.rgb, uPaintMoss * 0.78, moss * 0.22 * uPaintPigment);
            if (uRockEnabled > 0.5) {
              // Roughly 1–3 meter painted fragments complement the real crags.
              // Projection and mip levels stay fixed in physical world units.
              vec3 painted = surfacePaint(uRockTexture, vPaintWorldPosition, vPaintWorldNormal, 0.115);
              vec3 paintRatio = paletteRelativePaint(painted, uRockMean, 0.80, 0.48);
              diffuseColor.rgb *= mix(vec3(1.0), paintRatio, uRockStrength);
              pigment *= 0.42;
            }
          }
          if (uPaintSurface > 1.5 && uPaintSurface < 2.5) {
            // Connected meadow washes, rather than high-frequency camouflage.
            // These fields remain in physical units, so close views reveal
            // smaller brushwork while a whole hillside reads as one landform.
            vec3 meadowPosition = pigmentPosition;
            meadowPosition.xz += vec2(paintNoise(pigmentPosition * 0.024 + vec3(7.3)),
              paintNoise(pigmentPosition * 0.028 + vec3(12.8))) * 5.0;
            float growth = paintNoise(meadowPosition * vec3(0.060, 0.026, 0.060));
            float dry = paintNoise(meadowPosition * vec3(0.087, 0.038, 0.068) + vec3(3.2, 7.4, 1.1));
            // Intermediate washes are elongated and overlap softly. They add
            // a few meters of variation inside the large growth regions without
            // returning to the former one-meter camouflage/noise pattern.
            vec3 washPosition = vec3(meadowPosition.x * 0.88 + meadowPosition.z * 0.47,
              meadowPosition.y, meadowPosition.z * 0.88 - meadowPosition.x * 0.47);
            float wash = paintNoise(washPosition * vec3(0.23, 0.08, 0.13)) * 0.64
              + paintNoise(washPosition * vec3(0.11, 0.035, 0.29) + vec3(9.4, 2.3, 4.7)) * 0.36;
            vec3 meadowTint = mix(vec3(0.64, 0.81, 0.87), vec3(1.12, 1.07, 0.84), smoothstep(0.30, 0.70, growth));
            meadowTint = mix(meadowTint, vec3(1.12, 1.035, 0.73), smoothstep(0.58, 0.79, dry) * 0.40);
            diffuseColor.rgb *= mix(vec3(1.0), meadowTint, uPaintPigment);
            pigment = (wash - 0.5) * 0.52
              + (brushPigment - 0.5) * uPaintGrain * 0.16 * brushVisibility;
            if (uMeadowEnabled > 0.5) {
              // Luminance carries the brushwork; relative chroma carries warm
              // and cool strokes. The image never replaces a style's palette.
              vec3 painted = surfacePaint(uMeadowTexture, vPaintWorldPosition, vPaintWorldNormal, 0.055);
              vec3 paintRatio = paletteRelativePaint(painted, uMeadowMean, 0.78, 0.32);
              diffuseColor.rgb *= mix(vec3(1.0), paintRatio, uMeadowStrength);
              pigment *= 0.52;
            }
          }
          if (uPaintSurface > 4.5) {
            // Foliage keeps a quiet crown mass. Its geometry and cast shadows
            // supply the leaves; a grass texture must not stipple the canopy.
            pigment = (broadPigment - 0.5) * 0.10;
          }
          if (uPaintSurface > 3.5 && uPaintSurface < 4.5) {
            // UVs follow an individual leaf: U base→tip, V edge→edge.
            float across = abs(vPaintUv.y - 0.5);
            float aa = max(fwidth(vPaintUv.y), 0.004);
            float midrib = 1.0 - smoothstep(0.006, 0.012 + aa, across);
            float veinWave = abs(sin((vPaintUv.x - across * 0.65) * 34.0));
            float veins = (1.0 - smoothstep(0.03, 0.13 + fwidth(veinWave), veinWave)) * smoothstep(0.02, 0.12, across);
            float tip = smoothstep(0.15, 0.94, vPaintUv.x);
            diffuseColor.rgb *= mix(vec3(0.91, 0.96, 0.88), vec3(1.12, 1.07, 0.88), tip);
            diffuseColor.rgb *= 1.0 + (midrib * 0.12 + veins * 0.055) * uPaintPigment;
          }
          float pigmentStrength = uPaintSurface > 2.5 && uPaintSurface < 3.5 ? 0.12 : 1.0;
          diffuseColor.rgb *= 1.0 + pigment * uPaintPigment * pigmentStrength;
        `)
        .replace('#include <normal_fragment_maps>', /* glsl */`
          #include <normal_fragment_maps>
          if (uPaintSurface > 0.5 && uPaintSurface < 1.5) {
            float relief = rockRelief(vPaintPosition) * uPaintPigment;
            vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
            vec3 r1 = cross(dy, normal), r2 = cross(normal, dx);
            float determinant = dot(dx, r1);
            vec3 gradient = sign(determinant) * (dFdx(relief) * r1 + dFdy(relief) * r2);
            normal = normalize(max(abs(determinant), 0.0000001) * normal - gradient);
          }
        `)
        .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;', /* glsl */`
          // The actual 3D normal establishes form; a bright hemisphere cannot
          // wash it away. Three's direct-light pass supplies cast-shadow visibility.
          float pigmentLuma = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.015);
          float paintedLight = 0.55;
          #if NUM_DIR_LIGHTS > 0
            float sunFacing = dot(normal, directionalLights[0].direction);
            float directLuma = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722));
            float sunLuma = dot(directionalLights[0].color, vec3(0.2126, 0.7152, 0.0722));
            float expectedDirect = max(sunFacing, 0.0) * sunLuma * pigmentLuma * 0.3056;
            float visibility = clamp(directLuma / max(expectedDirect, 0.001), 0.0, 1.0);
            if (sunFacing < 0.025) visibility = 1.0;
            paintedLight = smoothstep(-0.34, 0.96, sunFacing);
            paintedLight *= mix(0.40, 1.0, visibility);
          #else
            paintedLight = clamp(dot(totalDiffuse, vec3(0.2126, 0.7152, 0.0722)) / pigmentLuma, 0.0, 1.0);
          #endif
          paintedLight = paintBand(paintedLight);
          float shade = mix(0.99, mix(0.34, 1.13, paintedLight), uPaintContrast);
          vec3 warmPigment = diffuseColor.rgb * mix(vec3(1.0), vec3(1.05, 1.01, 0.92), paintedLight * uPaintContrast);
          vec3 outgoingLight = warmPigment * shade;
          float shadowMix = (1.0 - paintedLight) * uPaintContrast;
          float rockShadow = (uPaintSurface > 0.5 && uPaintSurface < 1.5) ? 0.58 : 0.24;
          vec3 coolPigment = uPaintShadow * max(0.32, pigmentLuma * 0.88);
          outgoingLight = mix(outgoingLight, coolPigment, shadowMix * rockShadow);
          if (uPaintSurface > 0.5 && uPaintSurface < 1.5) {
            // A low-intensity open-sky bounce reveals crag orientation even
            // where the sun is behind the cliff. It is world-fixed, not a
            // camera-facing rim light, so it stays attached during the orbit.
            vec3 worldNormal = inverseTransformDirection(normal, viewMatrix);
            float skyFacing = dot(worldNormal, normalize(vec3(-0.55, 0.70, -0.45)));
            float skyFill = smoothstep(-0.65, 1.0, skyFacing);
            if (uPaintBands > 1.0 && uPaintSoftness < 0.04) skyFill = paintBand(skyFill);
            vec3 bouncePigment = mix(diffuseColor.rgb, uPaintShadow * max(0.28, pigmentLuma), 0.22);
            outgoingLight += bouncePigment * (0.025 + skyFill * 0.25)
              * (1.0 - paintedLight) * uPaintContrast;
          }
          outgoingLight += totalEmissiveRadiance;
          if (uPaintSurface > 2.5 && uPaintSurface < 3.5) outgoingLight = mix(diffuseColor.rgb, outgoingLight, 0.40);
        `);
    };
    material.customProgramCacheKey = () => `sky-castle-painted-v8-${surface}`;
    materials[key] = material;
  }

  const waterUniforms = {
    uPhase:{ value:0 }, uWater:{ value:new THREE.Color() },
    uFoam:{ value:new THREE.Color() }, uCozy:{ value:0 },
    uWaterPigment:{ value:1 },
    uWorldScale:{ value:new THREE.Vector2(1,1) },
  };
  const waterVertex = /* glsl */`
    varying vec2 vWaterUv;
    varying vec3 vWaterPosition;
    varying float vWaterDepth;
    varying vec3 vWaterView;
    varying vec3 vWaterNormal;
    attribute float waterDepth;
    uniform float uPhase;
    uniform float uFall;
    #include <fog_pars_vertex>
    void main() {
      vWaterUv = uv;
      vWaterPosition = position;
      vWaterDepth = waterDepth;
      vWaterNormal = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
      vec3 p = position;
      float t = uPhase * 6.28318530718;
      if (uFall < 0.5) {
        p.y += sin(position.x * 2.4 + t * 2.0) * cos(position.z * 2.1 - t * 3.0) * 0.012;
      }
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      vWaterView = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;
  const waterFragment = /* glsl */`
    varying vec2 vWaterUv;
    varying vec3 vWaterPosition;
    varying float vWaterDepth;
    varying vec3 vWaterView;
    varying vec3 vWaterNormal;
    uniform float uPhase;
    uniform vec3 uWater;
    uniform vec3 uFoam;
    uniform float uFall;
    uniform float uCozy;
    uniform float uWaterPigment;
    uniform vec2 uWorldScale;
    #include <fog_pars_fragment>
    float waterHash(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * 0.1031);
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }
    float waterNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(waterHash(i), waterHash(i + vec2(1.0, 0.0)), f.x),
        mix(waterHash(i + vec2(0.0, 1.0)), waterHash(i + vec2(1.0)), f.x), f.y);
    }
    float waterField(vec2 p) {
      const mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
      return waterNoise(p) * 0.67 + waterNoise(turn * p * 2.07 + vec2(8.3, 2.8)) * 0.33;
    }
    void main() {
      vec2 uv = vWaterUv;
      float t = uPhase * 6.28318530718;
      vec2 drift = vec2(cos(t), sin(t));
      vec3 color;
      float alpha;
      if (uFall > 0.5) {
        // Flow ribbons vary in thickness and brightness. Their broad optical
        // body stays readable after the narrow ribbons become subpixel.
        vec2 fallP = vec2(uv.x * uWorldScale.x, uv.y * uWorldScale.y);
        float lane = waterNoise(vec2(fallP.x * 13.0, fallP.y * 0.25) + drift * 0.13);
        float ribbonPhase = fallP.x * 61.0 + lane * 3.8 + sin(fallP.y * 8.0 - t * 2.0) * 0.24;
        float resolved = 1.0 - smoothstep(1.0, 3.0, fwidth(ribbonPhase));
        float pulse = sin(fallP.y * 67.0 + t * 8.0 + lane * 8.0);
        float foam = mix(0.06, smoothstep(0.68, 1.0, sin(ribbonPhase)) * (0.25 + 0.11 * pulse), resolved);
        foam += pow(uv.y, 12.0) * 0.27 + pow(1.0 - uv.y, 7.0) * 0.13;
        float body = waterNoise(vec2(uv.x * 7.0, uv.y * 1.4) + drift * 0.12);
        color = mix(uWater * vec3(0.82, 0.98, 1.04), uFoam, clamp(0.18 + body * 0.18 + foam, 0.0, 1.0));
        float edge = smoothstep(0.0, 0.055, uv.x) * smoothstep(0.0, 0.055, 1.0 - uv.x);
        float foot = smoothstep(0.0, 0.12, uv.y);
        alpha = edge * foot * (0.66 + body * 0.12 + foam * 0.22);
      } else {
        vec2 p = vWaterPosition.xz;
        vec2 region = p / max(uWorldScale.x, 1.0);
        float depth = max(vWaterDepth, 0.0) / max(uWorldScale.y, 1.0);
        float deep = smoothstep(0.018, 0.44, depth);
        float shore = 1.0 - smoothstep(0.008, 0.090, depth);
        vec2 bend = vec2(waterNoise(region * 0.72 + vec2(4.1, 9.3)),
          waterNoise(region * 0.68 + vec2(8.7, 2.4))) - 0.5;
        vec2 current = region + bend * 1.15;
        float pool = waterField(current * 0.71 + drift * 0.14);
        float skyWash = waterField(current * vec2(0.52, 1.12) + vec2(2.4, 7.1) + drift * 0.18);
        vec3 deepColor = uWater * vec3(0.61, 0.80, 0.96);
        vec3 shallowColor = mix(uWater * vec3(0.92, 1.13, 0.96), uFoam, 0.20);
        color = mix(shallowColor, deepColor, deep);
        color *= 0.91 + pool * 0.19;
        float fresnel = pow(1.0 - abs(dot(normalize(vWaterNormal), normalize(vWaterView))), 3.0);
        // Broad reflected sky washes are irregular and sparse, not a second
        // periodic wave grid. The base remains translucent colored water.
        float reflection = smoothstep(0.34, 0.74, skyWash) * (0.12 + fresnel * 0.20);
        color = mix(color, uFoam, reflection * mix(0.65, 1.0, uWaterPigment));
        // Two stretched noise fields form broken, gently curved wind marks.
        // Derivatives suppress them before they alias into diagonal dot rows.
        vec2 rippleP = vec2(p.x * 0.57 + p.y * 0.07, p.y * 2.25);
        rippleP += bend * 0.8 + drift * vec2(0.36, 0.62);
        float ripple = waterNoise(rippleP);
        float rippleWidth = max(fwidth(ripple), 0.009);
        float ridge = 1.0 - smoothstep(0.014, 0.046 + rippleWidth, abs(ripple - 0.56));
        float resolve = 1.0 - smoothstep(0.75, 1.9, max(length(dFdx(rippleP)), length(dFdy(rippleP))));
        float windPatch = smoothstep(0.43, 0.68, waterNoise(p * 0.19 + bend * 2.0 + vec2(6.8, 4.3)));
        // A second, shorter field clips each contour into isolated wind marks.
        // Its drifting phase is circular, preserving both animation endpoints.
        float broken = smoothstep(0.48, 0.70, waterNoise(vec2(p.x * 1.48, p.y * 0.84)
          + bend + drift * 0.20 + vec2(11.3, 5.7)));
        float glint = ridge * windPatch * broken * resolve * 0.072 * mix(0.5, 1.0, uWaterPigment);
        color = mix(color, uFoam, glint + shore * 0.055);
        alpha = mix(0.78, 0.96, deep);
      }
      color = mix(color, mix(uWater, uFoam, 0.2), uCozy * 0.24);
      gl_FragColor = vec4(color, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }
  `;
  for (const [key, fall] of [['water', 0], ['waterfall', 1]]) {
    materials[key] = new THREE.ShaderMaterial({
      name:`painted-${key}`,
      uniforms:{ ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...waterUniforms, uFall:{ value:fall } },
      vertexShader:waterVertex, fragmentShader:waterFragment,
      transparent:true, depthWrite:false, side:THREE.DoubleSide,
      fog:true, toneMapped:false,
    });
    materials[key].defaultAttributeValues.waterDepth = [0.5];
    materials[key].userData.castleSurface = key;
  }

  function setStyle(id) {
    const preset = PALETTES[id] || PALETTES.fantasy;
    for (const key of SURFACES) materials[key].color.setHex(preset[key === 'leafDetail' ? 'leaf' : key]);
    shared.uPaintContrast.value = preset.contrast;
    shared.uPaintBands.value = preset.bands;
    shared.uPaintSoftness.value = preset.softness;
    shared.uPaintPigment.value = preset.pigment;
    shared.uPaintGrain.value = preset.grain;
    shared.uPaintShadow.value.setHex(preset.shadow);
    shared.uPaintMoss.value.setHex(preset.grass);
    shared.uMeadowStrength.value = ({ original:0.70, fantasy:0.88, ink:0.22, cozy:0.38, ghibli:0.82 })[id] ?? 0.88;
    shared.uRockStrength.value = ({ original:0.76, fantasy:0.92, ink:0.24, cozy:0.36, ghibli:0.84 })[id] ?? 0.92;
    waterUniforms.uWater.value.setHex(preset.water);
    waterUniforms.uFoam.value.setHex(preset.foam);
    waterUniforms.uCozy.value = id === 'cozy' ? 1 : 0;
    waterUniforms.uWaterPigment.value = preset.pigment;
    return styleInfo[id] || styleInfo.fantasy;
  }

  /** Load an optional hand-painted color field without rebuilding any meshes.
   * Returns the installed THREE.Texture; rejects on network/image failure while
   * retaining the previous texture. The supplied image should be tileable.
   */
  async function loadPaintTexture(url, kind) {
    const revision = ++paintLoadRevisions[kind];
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.name = `hand-painted-${kind.toLowerCase()}`;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    // Calibrate against the actual image mean so warm/cool styles remain their
    // own colors even when a replacement texture has a different base hue.
    const mean = new THREE.Color(kind === 'Meadow' ? 0x77a451 : 0xb58a67);
    try {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const context = canvas.getContext('2d', { willReadFrequently:true });
      context.drawImage(texture.image, 0, 0, 32, 32);
      const data = context.getImageData(0, 0, 32, 32).data;
      const sample = new THREE.Color(); let red = 0, green = 0, blue = 0, total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const weight = data[i + 3] / 255;
        sample.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, THREE.SRGBColorSpace);
        red += sample.r * weight; green += sample.g * weight; blue += sample.b * weight; total += weight;
      }
      if (total > 0) mean.setRGB(red / total, green / total, blue / total);
    } catch {
      // Cross-origin images may be paintable but not readable. A stable palette-average
      // calibration remains usable; the original local asset takes the path above.
    }
    const textureUniform = shared[`u${kind}Texture`];
    if (revision !== paintLoadRevisions[kind]) { texture.dispose(); return textureUniform.value; }
    const previous = textureUniform.value;
    shared[`u${kind}Mean`].value.copy(mean);
    textureUniform.value = texture;
    shared[`u${kind}Enabled`].value = 1;
    previous.dispose();
    return texture;
  }

  const loadMeadowTexture = url => loadPaintTexture(url, 'Meadow');
  const loadRockTexture = url => loadPaintTexture(url, 'Rock');

  function animate(phase) {
    // Keep exact integer endpoints identical, including negative phases.
    waterUniforms.uPhase.value = ((phase % 1) + 1) % 1;
  }
  function setWorldScale(horizontal=1,vertical=1) {
    waterUniforms.uWorldScale.value.set(horizontal,vertical);
  }
  setStyle('fantasy');
  return { materials, setStyle, animate, setWorldScale, loadMeadowTexture, loadRockTexture, styleInfo };
}
