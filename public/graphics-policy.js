export const GRAPHICS_MODES=['Low','Medium','High','Ultra','Ultra+'];
const policies={
 Low:{clouds:4,scenery:3,sceneryDistance:85,effects:false,stars:70,grass:3000,mobileGrass:3500,mobileScenery:2,shadowSize:512,mobileShadowSize:512,ratio:.7,mobileRatio:.7,pixels:3500000,mobilePixels:1100000,terrainRadius:2,sharpness:0,description:'Performance · fewer clouds and decorations · effects off'},
 Medium:{clouds:8,scenery:7,sceneryDistance:150,effects:true,stars:140,grass:8000,mobileGrass:3500,mobileScenery:3,shadowSize:512,mobileShadowSize:512,ratio:1.25,mobileRatio:.9,pixels:3500000,mobilePixels:1100000,terrainRadius:2,sharpness:0,description:'Balanced · more clouds and decorations · color effects'},
 High:{clouds:12,scenery:12,sceneryDistance:250,effects:true,stars:220,grass:12000,mobileGrass:3500,mobileScenery:4,shadowSize:1024,mobileShadowSize:512,ratio:1.7,mobileRatio:1.1,pixels:3500000,mobilePixels:1100000,terrainRadius:3,sharpness:0,description:'Detailed · full clouds and decorations · depth effects'},
 Ultra:{clouds:18,scenery:18,sceneryDistance:300,effects:true,stars:360,grass:16000,mobileGrass:4500,mobileScenery:6,shadowSize:2048,mobileShadowSize:1024,ratio:2,mobileRatio:1.35,pixels:5500000,mobilePixels:1600000,terrainRadius:3,sharpness:.12,description:'Ultra · denser scenery and clouds · sharper image · 2048px desktop shadows'},
 'Ultra+':{clouds:24,scenery:26,sceneryDistance:360,effects:true,stars:600,grass:20000,mobileGrass:5500,mobileScenery:8,shadowSize:4096,mobileShadowSize:2048,ratio:2.5,mobileRatio:1.6,pixels:8000000,mobilePixels:2200000,terrainRadius:4,sharpness:.22,description:'Ultra+ · maximum scenery and clouds · finest image · 4096px desktop shadows'}
};
export function graphicsPolicy(quality='Medium'){return policies[quality]||policies.Medium}
