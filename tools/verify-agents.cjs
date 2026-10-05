const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const assert = require('node:assert/strict');
const { discover } = require('../src/main/discovery.cjs');
const { Profiles, validateSettings } = require('../src/main/profile.cjs');
const { within, hash } = require('../src/main/files.cjs');
const catalog = require('../catalog.json').mods;
const run = promisify(execFile);

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-agents-'));
  try {
    const found = await discover(validateSettings({}, catalog), catalog);
    assert(found.gamePath, 'PZ local encontrado');
    const gameJar = path.join(found.gamePath, 'projectzomboid.jar');
    const gameJson = path.join(found.gamePath, 'ProjectZomboid64.json');
    const original = [await hash(gameJar), await hash(gameJson)];
    const settings = validateSettings({ selected: ['skinwalker', 'viewpoint'] }, catalog);
    const profiles = new Profiles(path.join(temp, 'profile'), catalog);
    const review = await profiles.review(settings, found);
    await profiles.apply(review.token, settings);
    const agents = (await profiles.manifest()).mods.filter(mod => mod.kind === 'agent');
    assert(agents.every(mod => mod.installed && within(temp, mod.installed)), 'copias JAR isoladas em pasta temporaria');
    const env = { ...process.env, PATH: `${path.join(found.gamePath, 'jre64/bin')};${path.join(found.gamePath, 'win64')};${process.env.PATH || ''}` };
    delete env.JAVA_TOOL_OPTIONS; delete env.JDK_JAVA_OPTIONS; delete env._JAVA_OPTIONS;
    const report = [];
    // Apenas premain + java -version: nao inicia o jogo, grava voz ou abre uma conta Steam.
    for (const selection of [[agents[0]], [agents[1]], agents]) {
      const args = ['-Djava.awt.headless=true', '--enable-native-access=ALL-UNNAMED', '--add-exports=java.base/jdk.internal.misc=ALL-UNNAMED',
        '-Djava.library.path=win64/;.', `-Duser.home=${temp}`, '-Dzomboid.steam=0',
        ...selection.map(mod => `-javaagent:${mod.installed}${mod.id === 'zombiebuddy' ? `=policy=prompt,config_dir=${path.join(temp, 'zombie-buddy')}` : ''}`),
        '-cp', `${found.gamePath}${path.delimiter}${gameJar}`, '-version'];
      const { stdout, stderr } = await run(path.join(found.gamePath, 'jre64/bin/java.exe'), args,
        { cwd: found.gamePath, env, shell: false, windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024 });
      if (selection.some(mod => mod.id === 'skinwalker')) assert(stdout.includes('[Skinwalker] Agent 0.3.0 ready'), stdout + stderr);
      if (selection.some(mod => mod.id === 'zombiebuddy')) assert(stdout.includes('Agent installed.'), stdout + stderr);
      if (selection.length === 2) assert(stdout.includes('[Skinwalker] Installed 1 call-site hook(s): zombie/Lua/LuaManager$Exposer'), 'hook Skinwalker presente antes do aquecimento ZombieBuddy');
      report.push({ agents: selection.map(mod => mod.id), success: true, stdout, stderr });
      console.log(`PASS: premain ${selection.map(mod => mod.name).join(' + ')} na JVM do PZ, sem DLL adicional.`);
    }
    assert.deepEqual([await hash(gameJar), await hash(gameJson)], original, 'arquivos vanilla preservados');
    const result = path.join(__dirname, '../test-results');
    await fs.mkdir(result, { recursive: true });
    await fs.writeFile(path.join(result, 'agents.json'), JSON.stringify({ mode: 'premain-only', vanillaPreserved: true, report }, null, 2));
  } finally {
    assert(within(os.tmpdir(), temp));
    await fs.rm(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
