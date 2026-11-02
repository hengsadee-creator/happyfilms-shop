import { readFile, writeFile } from 'node:fs/promises';
const inputs = { storefrontScript: 'automation.js', adminPage: 'stock-admin.html', adminScript: 'stock-admin.js', conversionScript: 'conversion.js', assistantScript: 'assistant.js', smmScript: 'smm-app.js' };
let output = '';
for (const [name, file] of Object.entries(inputs)) output += `const ${name}=${JSON.stringify(await readFile(new URL('../web/' + file, import.meta.url), 'utf8'))};\n`;
for (const [name, file] of [['transportScript', 'transport.js'], ['recoveryStyle', 'recovery.css']]) {
  try { output += `const ${name}=${JSON.stringify(await readFile(new URL('../web/' + file, import.meta.url), 'utf8'))};\n`; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
output += await readFile(new URL('../worker/backend.mjs', import.meta.url), 'utf8');
await writeFile(new URL('../worker/worker.mjs', import.meta.url), output);
console.log('Built existing Worker with readable client sources. No deployment performed.');
