const AdmZip = require('adm-zip');
const fs = require('node:fs/promises');
const { safeJar, hash } = require('./files.cjs');

async function inspectJar(file, expectedPremain) {
  const source = await safeJar(file);
  const stat = await fs.stat(source);
  const zip = new AdmZip(source);
  const entry = zip.getEntry('META-INF/MANIFEST.MF');
  // JARs assinados incluem resumos por classe; o ZombieBuddy supera 1 MiB aqui.
  if (!entry || entry.header.size > 4 * 1024 * 1024) throw new Error('Manifesto de JAR ausente ou inv\u00e1lido.');
  const manifest = Object.create(null);
  // O formato JAR permite continua\u00e7\u00e3o de linha iniciada com um espa\u00e7o.
  const mainSection = entry.getData().toString('utf8').replace(/\r?\n /g, '').split(/\r?\n\r?\n/, 1)[0];
  for (const line of mainSection.split(/\r?\n/)) {
    const split = line.indexOf(':');
    if (split > 0) manifest[line.slice(0, split).toLowerCase()] = line.slice(split + 1).trim();
  }
  const premain = manifest['premain-class'] || null;
  if (expectedPremain && premain !== expectedPremain) throw new Error('Este JAR n\u00e3o corresponde ao agente esperado no cat\u00e1logo.');
  if (premain && !zip.getEntry(premain.replaceAll('.', '/') + '.class')) throw new Error('Classe de entrada do agente ausente.');
  const signaturePresent = zip.getEntries().some(item => /^META-INF\/[^/]+\.(SF|RSA|DSA|EC)$/i.test(item.entryName));
  return { source, size: stat.size, hash: await hash(source), premain,
    version: manifest['implementation-version'] || manifest['bundle-version'] || null,
    manifest: true, signature: signaturePresent ? 'Presente; nao verificada' : 'Nao verificada', risk: 'Codigo nativo / acesso do usuario' };
}

module.exports = { inspectJar };
