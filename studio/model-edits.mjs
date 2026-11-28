const materialFields = new Set(['color', 'metalness', 'roughness', 'opacity']);
const colorPattern = /^#[\da-f]{6}$/i;

function validateMaterial(field, value) {
  if (field === 'visible') return typeof value === 'boolean';
  if (['position', 'rotation', 'scale'].includes(field)) {
    return Array.isArray(value) && value.length === 3 && value.every(component =>
      Number.isFinite(component) && (field === 'scale'
        ? component >= .01 && component <= 100 : Math.abs(component) <= 10000));
  }
  if (!materialFields.has(field)) return false;
  if (field === 'color') return typeof value === 'string' && colorPattern.test(value);
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

// Preserve mesh names, geometry ranges and collider definitions. The returned
// data can be handed directly to the game's existing modelFromData loader.
export function applyModelMaterialEdits(model, edits) {
  if (!Array.isArray(model?.meshes) || !Array.isArray(edits)) {
    throw new TypeError('Expected a game model and an array of material edits.');
  }
  const meshes = model.meshes.map(mesh => ({ ...mesh }));
  for (const { index, name, field, value } of edits) {
    if (!Number.isInteger(index) || index < 0 || meshes[index]?.name !== name) {
      throw new RangeError('The selected model part no longer matches this revision.');
    }
    if (!validateMaterial(field, value)) {
      throw new RangeError('Invalid model property or value.');
    }
    meshes[index][field] = value;
  }
  return { ...model, meshes };
}
