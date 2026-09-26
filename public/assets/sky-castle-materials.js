/**
 * Five art directions for a real, freely orbitable Three.js scene.
 *
 * Opaque surfaces retain Three.js' normal, light and shadow calculations. The
 * shader then compresses the diffuse illumination into art-directed bands and
 * adds broad pigment variation in object space. There are no painted billboards
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
  varying vec2 vPaintUv;
  uniform float uPaintContrast;
  uniform float uPaintBands;
  uniform float uPaintSoftness;
  uniform float uPaintPigment;
  uniform float uPaintGrain;
  uniform float uPaintSurface;
  uniform vec3 uPaintShadow;
  uniform vec3 uPaintMoss;

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
  const shared = {
    uPaintContrast:{ value:0.78 }, uPaintBands:{ value:3 },
    uPaintSoftness:{ value:0.2 }, uPaintPigment:{ value:0.95 },
    uPaintGrain:{ value:0.08 }, uPaintShadow:{ value:new THREE.Color(PALETTES.fantasy.shadow) },
    uPaintMoss:{ value:new THREE.Color(PALETTES.fantasy.grass) },
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
    const surface = key === 'rock' ? 1 : (key === 'grass' || key === 'leaf') ? 2 : key === 'cloud' ? 3 : key === 'leafDetail' ? 4 : 0;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared, { uPaintSurface:{ value:surface } });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPaintPosition;\nvarying vec2 vPaintUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaintPosition = position;\nvPaintUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${PIGMENT_GLSL}`)
        .replace('#include <color_fragment>', /* glsl */`
          #include <color_fragment>
          vec3 pigmentPosition = vPaintPosition;
          float broadPigment = paintNoise(pigmentPosition * 0.82);
          float brushPigment = paintNoise(pigmentPosition * vec3(4.7, 1.8, 4.7));
          float pigment = (broadPigment - 0.5) * 0.34 + (brushPigment - 0.5) * uPaintGrain;
          if (uPaintSurface > 0.5 && uPaintSurface < 1.5) {
            // The geometry supplies the silhouette. Nested pigment fields add
            // mineral families and lichen colonies without increasing contrast.
            float footprint = max(length(dFdx(pigmentPosition)), length(dFdy(pigmentPosition)));
            vec3 geology = rockDomainWarp(pigmentPosition);
            float crag = rockFbm(geology * vec3(1.04, 0.33, 1.04), footprint * 1.46);
            float ridged = 1.0 - abs(rockFbm(geology * 0.68 + vec3(4.6, 17.2, 8.1), footprint * 0.95) * 2.0 - 1.0);
            pigment += (crag - 0.5) * 0.35 + (ridged - 0.78) * 0.045;
            vec3 mineralColor = mix(vec3(0.89, 0.95, 1.02), vec3(1.10, 1.03, 0.88), smoothstep(0.26, 0.74, crag));
            diffuseColor.rgb *= mix(vec3(1.0), mineralColor, uPaintPigment);
            vec4 textureDetail = rockTexture(pigmentPosition);
            pigment += (textureDetail.y - 0.5) * 0.10 - textureDetail.x * 0.085 - textureDetail.z * 0.075;
            float mineralFleck = smoothstep(0.64, 0.86, textureDetail.y);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.10, 1.08, 1.01), mineralFleck * uPaintPigment);
            float colony = rockFbm(geology * vec3(2.6, 1.8, 2.6) + vec3(8.4, 1.7, 3.9), footprint * 3.64);
            float moss = smoothstep(-0.6, 1.6, pigmentPosition.y) * smoothstep(0.49, 0.67, crag * 0.55 + colony * 0.45);
            moss *= mix(0.70, 1.0, textureDetail.y);
            diffuseColor.rgb = mix(diffuseColor.rgb, uPaintMoss, moss * 0.28 * uPaintPigment);
          }
          if (uPaintSurface > 1.5 && uPaintSurface < 2.5) {
            pigment += (broadPigment - 0.5) * 0.25;
            vec3 meadowTint = mix(vec3(0.83, 0.97, 1.01), vec3(1.12, 1.03, 0.77), smoothstep(0.23, 0.77, broadPigment));
            diffuseColor.rgb *= mix(vec3(1.0), meadowTint, uPaintPigment);
          }
          if (uPaintSurface > 3.5) {
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
          outgoingLight += totalEmissiveRadiance;
          if (uPaintSurface > 2.5 && uPaintSurface < 3.5) outgoingLight = mix(diffuseColor.rgb, outgoingLight, 0.40);
        `);
    };
    material.customProgramCacheKey = () => `sky-castle-painted-v4-${surface}`;
    materials[key] = material;
  }

  const waterUniforms = {
    uPhase:{ value:0 }, uWater:{ value:new THREE.Color() },
    uFoam:{ value:new THREE.Color() }, uCozy:{ value:0 },
    uWorldScale:{ value:new THREE.Vector2(1,1) },
  };
  const waterVertex = /* glsl */`
    varying vec2 vWaterUv;
    varying vec3 vWaterPosition;
    uniform float uPhase;
    uniform float uFall;
    #include <fog_pars_vertex>
    void main() {
      vWaterUv = uv;
      vWaterPosition = position;
      vec3 p = position;
      float t = uPhase * 6.28318530718;
      if (uFall < 0.5) {
        p.y += sin(position.x * 2.4 + t * 2.0) * cos(position.z * 2.1 - t * 3.0) * 0.012;
      }
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;
  const waterFragment = /* glsl */`
    varying vec2 vWaterUv;
    varying vec3 vWaterPosition;
    uniform float uPhase;
    uniform vec3 uWater;
    uniform vec3 uFoam;
    uniform float uFall;
    uniform float uCozy;
    uniform vec2 uWorldScale;
    #include <fog_pars_fragment>
    void main() {
      vec2 uv = vWaterUv;
      float t = uPhase * 6.28318530718;
      vec3 color;
      float alpha;
      if (uFall > 0.5) {
        // Thin ribbons and descending highlights, not a solid white curtain.
        float ribbonPhase = uv.x * 66.0 * uWorldScale.x + sin(uv.y * 11.0 * uWorldScale.y - t * 2.0) * 0.55;
        float ribbon = sin(ribbonPhase);
        float resolved = 1.0 - smoothstep(1.0, 3.0, fwidth(ribbonPhase));
        float pulse = sin(uv.y * 80.0 * uWorldScale.y + t * 8.0 + sin(uv.x * 23.0 * uWorldScale.x));
        float foam = mix(0.065, smoothstep(0.64, 1.0, ribbon) * (0.36 + 0.19 * pulse), resolved);
        foam += pow(uv.y, 12.0) * 0.33;
        foam += pow(1.0 - uv.y, 7.0) * 0.17;
        color = mix(uWater, uFoam, clamp(0.25 + foam, 0.0, 1.0));
        float edge = smoothstep(0.0, 0.07, uv.x) * smoothstep(0.0, 0.07, 1.0 - uv.x);
        float foot = smoothstep(0.0, 0.12, uv.y);
        alpha = edge * foot * (0.70 + foam * 0.25);
      } else {
        vec2 p = vWaterPosition.xz;
        // Broken wind streaks follow broad currents; avoid a regular dot grid.
        float ripplePhase = p.y * 13.0 + sin(p.x * 1.6 + t) * 1.6 + t * 3.0;
        float ripples = sin(ripplePhase);
        float resolved = 1.0 - smoothstep(1.0, 3.0, fwidth(ripplePhase));
        float current = sin(p.x * 3.1 - p.y * 1.7 + sin(t) * 0.4);
        float glint = smoothstep(0.91, 1.0, ripples) * smoothstep(0.15, 0.85, current) * 0.28 * resolved;
        float broad = sin(p.x * .23 + p.y * .09 + sin(p.y * .14) * 1.4 - t) * .65
          + sin(p.y * .17 - p.x * .08 + cos(p.x * .11) + t) * .35;
        color = mix(uWater, uFoam, 0.11 + glint + broad * 0.035);
        alpha = 0.94;
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
    waterUniforms.uWater.value.setHex(preset.water);
    waterUniforms.uFoam.value.setHex(preset.foam);
    waterUniforms.uCozy.value = id === 'cozy' ? 1 : 0;
    return styleInfo[id] || styleInfo.fantasy;
  }

  function animate(phase) {
    // Keep exact integer endpoints identical, including negative phases.
    waterUniforms.uPhase.value = ((phase % 1) + 1) % 1;
  }
  function setWorldScale(horizontal=1,vertical=1) {
    waterUniforms.uWorldScale.value.set(horizontal,vertical);
  }
  setStyle('fantasy');
  return { materials, setStyle, animate, setWorldScale, styleInfo };
}
