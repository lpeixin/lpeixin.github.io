/* =========================================================================
   NORTHBOUND — procedural texture library (all generated at runtime)
   ========================================================================= */

const TEX = {};

function buildTextures() {
  const wood = makeWoodTextures(512, { planks: 5, tone: 0.6, warm: 1.08, seed: 12 });
  TEX.wood = {
    mapTex: makeTexture(wood.map, { repeat: [1, 1] }),
    normTex: makeTexture(wood.normal, { repeat: [1, 1], srgb: false }),
    roughTex: makeTexture(wood.rough, { repeat: [1, 1], srgb: false }),
  };

  const darkWood = makeWoodTextures(256, { planks: 3, tone: 0.4, warm: 1.0, seed: 31 });
  TEX.darkWood = {
    mapTex: makeTexture(darkWood.map, { repeat: [1, 1] }),
    normTex: makeTexture(darkWood.normal, { repeat: [1, 1], srgb: false }),
  };

  const rock = makeRockTextures(512, 7);
  TEX.rock = {
    mapCanvas: rock.map,
    mapTex: makeTexture(rock.map, { aniso: 8 }),
    normTex: makeTexture(rock.normal, { srgb: false }),
  };

  const moss = makeMossTextures(512);
  TEX.moss = {
    mapTex: makeTexture(moss.map),
    normTex: makeTexture(moss.normal, { srgb: false }),
  };

  TEX.waterN = makeTexture(makeWaterNormal(512), { srgb: false, repeat: [1, 1] });
  TEX.foam = makeTexture(makeFoamTexture(512), { srgb: false, repeat: [1, 1] });
  TEX.sail = makeTexture(makeSailTexture(512, 512), { repeat: [1, 1] });

  TEX.shields = [];
  for (let i = 0; i < 4; i++) {
    TEX.shields.push(makeTexture(makeShieldTexture(i, 256), { repeat: [1, 1] }));
  }
  TEX.glow = makeTexture(makeGlowTexture(128), { repeat: [1, 1] });
  TEX.glow.wrapS = TEX.glow.wrapT = THREE.ClampToEdgeWrapping;
}
