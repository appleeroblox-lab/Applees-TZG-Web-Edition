import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyModelMaterialEdits } from '../studio/model-edits.mjs';

const ship = JSON.parse(await readFile(new URL('../public/models/player-ship.json', import.meta.url), 'utf8'));
const part = ship.meshes[0];
const edit = { index: 0, name: part.name, field: 'color', value: '#123456' };
const edited = applyModelMaterialEdits(ship, [edit]);
assert.equal(edited.meshes[0].color, edit.value);
assert.deepEqual(edited.meshes[0], { ...part, color: edit.value });
assert.notEqual(part.color, edit.value);
assert.equal(edited.colliders, ship.colliders);
assert.deepEqual(edited.meshes.slice(1), ship.meshes.slice(1));
assert.throws(() => applyModelMaterialEdits(ship, [{ ...edit, name: 'stale' }]), RangeError);
assert.throws(() => applyModelMaterialEdits(ship, [{ ...edit, field: 'map' }]), RangeError);
assert.throws(() => applyModelMaterialEdits(ship, [{ ...edit, field: 'opacity', value: 3 }]), RangeError);
console.log('Studio material edits preserve existing game model bindings.');
