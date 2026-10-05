const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCatalog } = require('../src/main/catalog.cjs');
const source = require('../catalog.json');
test('catalogo publicado e valido e nao contem comandos ou downloads de mods', () => {
  assert.equal(validateCatalog(source).length, 3);
});
for (const [label, mutate] of [
  ['arquivo fora da pasta', value => { value.mods[0].jarName = '../malicioso.jar'; }],
  ['caminho absoluto', value => { value.mods[0].jarPaths = ['C:/malicioso.jar']; }],
  ['traversal', value => { value.mods[0].jarPaths = ['../malicioso.jar']; }],
  ['comando arbitrario', value => { value.mods[0].command = 'powershell'; }],
  ['ID duplicado', value => { value.mods[1].id = value.mods[0].id; }],
  ['dependencia ausente', value => { value.mods[0].dependencies = ['outro']; }],
  ['dependencia circular', value => { value.mods[0].dependencies = ['skinwalker']; }]
]) test(`catalogo rejeita ${label}`, () => {
  const value = structuredClone(source); mutate(value); assert.throws(() => validateCatalog(value));
});
