// Game atmosphere palettes matched to the selected Roblox surface artwork.
const profiles={
 'Proxima b':{air:['#957133','#ead19b','#526c48'],cloud:'#fff0cf',rim:'#ddb367',fill:'#ffe8b9'},
 'Proxima d':{air:['#73594b','#c8aa8d','#526c48'],cloud:'#e3cfba',rim:'#b38968',fill:'#efcfb4'}
};
export const proximaAtmosphere=body=>profiles[body?.name]||null;
