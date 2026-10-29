// Representative surface colors sampled from the bundled planet artwork.
const palettes={
  "roblox/mercury.png": {
    "ground": "#848383",
    "accent": "#5f5e5e"
  },
  "roblox/venus.png": {
    "ground": "#c66c24",
    "accent": "#8f4e1a"
  },
  "roblox/earth.png": {
    "ground": "#55698d",
    "accent": "#3d4c66"
  },
  "roblox/moon.png": {
    "ground": "#73716e",
    "accent": "#53514f"
  },
  "roblox/mars.png": {
    "ground": "#b9593b",
    "accent": "#85402a"
  },
  "roblox/ceres.png": {
    "ground": "#948476",
    "accent": "#6b5f55"
  },
  "roblox/pluto.png": {
    "ground": "#ad9884",
    "accent": "#7d6d5f"
  },
  "roblox/eris.png": {
    "ground": "#9ca1a9",
    "accent": "#70747a"
  },
  "roblox/makemake.png": {
    "ground": "#bc8574",
    "accent": "#876054"
  },
  "phobos.jpg": {
    "ground": "#626262",
    "accent": "#474747"
  },
  "deimos.jpg": {
    "ground": "#6e6e6e",
    "accent": "#4f4f4f"
  },
  "roblox/io.png": {
    "ground": "#97864c",
    "accent": "#6d6037"
  },
  "roblox/europa.png": {
    "ground": "#bcb392",
    "accent": "#878169"
  },
  "roblox/ganymede.png": {
    "ground": "#7e6f5f",
    "accent": "#5b5044"
  },
  "roblox/callisto.png": {
    "ground": "#7a6c55",
    "accent": "#584e3d"
  },
  "roblox/titan.png": {
    "ground": "#a57c3e",
    "accent": "#77592d"
  },
  "roblox/enceladus.png": {
    "ground": "#b9b9ba",
    "accent": "#858586"
  },
  "roblox/mimas.png": {
    "ground": "#837f80",
    "accent": "#5e5b5c"
  },
  "roblox/rhea.png": {
    "ground": "#6c6b66",
    "accent": "#4e4d49"
  },
  "roblox/dione.png": {
    "ground": "#7e7e7e",
    "accent": "#5b5b5b"
  },
  "roblox/tethys.png": {
    "ground": "#979797",
    "accent": "#6d6d6d"
  },
  "roblox/iapetus.png": {
    "ground": "#251e1b",
    "accent": "#1b1613"
  },
  "roblox/miranda.png": {
    "ground": "#78726e",
    "accent": "#56524f"
  },
  "roblox/ariel.png": {
    "ground": "#4e4e4e",
    "accent": "#383838"
  },
  "roblox/umbriel.png": {
    "ground": "#3f3f3f",
    "accent": "#2d2d2d"
  },
  "roblox/titania.png": {
    "ground": "#756258",
    "accent": "#54473f"
  },
  "roblox/oberon.png": {
    "ground": "#514c49",
    "accent": "#3a3735"
  },
  "roblox/triton.png": {
    "ground": "#bcb5ba",
    "accent": "#878286"
  },
  "roblox/charon.png": {
    "ground": "#a79d95",
    "accent": "#78716b"
  },
  "roblox/dysnomia.png": {
    "ground": "#605655",
    "accent": "#453e3d"
  },
  "roblox/proxima-b.png": {
    "ground": "#daab5d",
    "accent": "#9d7b43"
  },
  "exo6.png": {
    "ground": "#3a6936",
    "accent": "#2a4c27"
  },
  "exo7.png": {
    "ground": "#79bad8",
    "accent": "#57869c"
  },
  "exo5.png": {
    "ground": "#9d9630",
    "accent": "#716c23"
  },
  "roblox/orcus.png": {
    "ground": "#5e7078",
    "accent": "#445156"
  },
  "roblox/quaoar.png": {
    "ground": "#6b4e4e",
    "accent": "#4d3838"
  },
  "roblox/sedna.png": {
    "ground": "#76504c",
    "accent": "#553a37"
  },
  "roblox/gonggong.png": {
    "ground": "#864b3f",
    "accent": "#60362d"
  },
  "roblox/salacia.png": {
    "ground": "#474747",
    "accent": "#333333"
  },
  "roblox/varda.png": {
    "ground": "#e0b18b",
    "accent": "#a17f64"
  },
  "roblox/actaea.png": {
    "ground": "#ad5b47",
    "accent": "#7d4233"
  },
  "roblox/ilmar\u00eb.png": {
    "ground": "#d8d8e5",
    "accent": "#9c9ca5"
  },
  "roblox/vanth.png": {
    "ground": "#4e403f",
    "accent": "#382e2d"
  },
  "roblox/xiangliu.png": {
    "ground": "#656972",
    "accent": "#494c52"
  },
  "roblox/proxima-d.png": {
    "ground": "#72533a",
    "accent": "#523c2a"
  }
};
export const texturePalette=body=>palettes[body?.texture]||null;
