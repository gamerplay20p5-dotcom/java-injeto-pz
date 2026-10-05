function validateCatalog(value) {
  if (value?.schema !== 1 || !Array.isArray(value.mods) || value.mods.length > 32) throw new Error('Catalogo invalido.');
  const keys = new Set(['id', 'name', 'modId', 'kind', 'category', 'accent', 'workshopId', 'description', 'notes', 'jarName', 'jarPaths', 'premain', 'dependencies', 'build']);
  const ids = new Set();
  for (const mod of value.mods) {
    if (!mod || Object.keys(mod).some(key => !keys.has(key)) || !/^[a-z0-9-]{1,48}$/.test(mod.id) || ids.has(mod.id)) throw new Error('ID duplicado ou campo desconhecido no catalogo.');
    ids.add(mod.id);
    for (const field of ['name', 'modId', 'category', 'description', 'notes', 'build'])
      if (typeof mod[field] !== 'string' || !mod[field] || mod[field].length > 2048 || /[\x00-\x1f]/.test(mod[field])) throw new Error('Texto invalido no catalogo.');
    if (!['agent', 'workshop'].includes(mod.kind) || !['coral', 'teal', 'lime'].includes(mod.accent)) throw new Error('Tipo de Java ou cor invalida.');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.jar$/.test(mod.jarName)) throw new Error('Nome de JAR invalido.');
    if (mod.workshopId != null && (typeof mod.workshopId !== 'string' || !/^\d{1,20}$/.test(mod.workshopId))) throw new Error('ID Workshop invalido.');
    if (!Array.isArray(mod.jarPaths) || !mod.jarPaths.length || mod.jarPaths.length > 8 || mod.jarPaths.some(file =>
      typeof file !== 'string' || file.length > 512 || file.includes('\\') || file.split('/').some(part => !part || part === '.' || part === '..' || /[:\x00-\x1f]/.test(part)) || !file.endsWith('.jar')))
      throw new Error('Caminho de JAR invalido no catalogo.');
    if (mod.kind === 'agent' && (typeof mod.premain !== 'string' || !/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(mod.premain))) throw new Error('Premain-Class invalida.');
    if (!Array.isArray(mod.dependencies) || mod.dependencies.length > 32 || mod.dependencies.some(id => typeof id !== 'string')) throw new Error('Dependencias invalidas.');
  }
  const complete = new Set(), visiting = new Set();
  function visit(id) {
    if (!ids.has(id) || visiting.has(id)) throw new Error('Dependencia ausente ou circular no catalogo.');
    if (complete.has(id)) return;
    visiting.add(id);
    for (const dependency of value.mods.find(mod => mod.id === id).dependencies) visit(dependency);
    visiting.delete(id); complete.add(id);
  }
  for (const id of ids) visit(id);
  return value.mods;
}
module.exports = { validateCatalog };
