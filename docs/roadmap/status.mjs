// Change le statut d'une tâche ou d'un point de l'audit dans status.json, puis régénère ROADMAP.md
// et la page de suivi.
// Usage : node docs/roadmap/status.mjs <id> <statut> [note]
// <id> : une tâche de tasks.mjs (SEC-02) ou un point de l'audit préfixé par audit- (audit-B1,
// audit-D3, audit-T5, audit-A6-M2). Sans note, la note déjà enregistrée est gardée.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { states, tasks } from './tasks.mjs';
import { loadAudit } from './audit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, 'status.json');
const [id, state, note] = process.argv.slice(2);

function fail(message) {
	console.error(message);
	process.exit(1);
}

// Les mêmes points que ceux que la page suit (auditItems dans template.html).
const audit = loadAudit(join(here, 'reviews', 'audit-pre-1.0'));
const auditRefs = [
	...audit.synthese.blockers.flatMap((g) => g.items.map((b) => b.id)),
	...audit.synthese.decisions.map((d) => d.id),
	...audit.synthese.tasks.map((t) => t.id),
	...audit.axes.flatMap((a) => a.findings.map((f) => f.key))
];
const ids = new Set([...tasks.map((t) => t.id), ...auditRefs.map((ref) => `audit-${ref}`)]);
const keys = states.map((s) => s.key);

if (!id || !state) fail('Usage : node docs/roadmap/status.mjs <id> <statut> [note]');
// Une note sans guillemets arriverait mot par mot : seul le premier remplacerait la note enregistrée.
if (process.argv.length > 5) fail('Mettez la note entre guillemets.');
if (!ids.has(id)) fail(`${id} : ni une tâche de tasks.mjs, ni un point de l'audit (audit-B1, audit-A6-M2…)`);
if (!keys.includes(state)) fail(`${state} : statut inconnu, attendu ${keys.join(', ')}`);

const status = JSON.parse(readFileSync(file, 'utf8'));
status[id] = { state, note: note ?? status[id]?.note ?? '', updatedAt: new Date().toISOString() };
// Une entrée par ligne, triées par identifiant : un conflit de rebase reste limité à ses lignes.
const lines = Object.keys(status)
	.sort()
	.map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(status[key])}`);
writeFileSync(file, `{\n${lines.join(',\n')}\n}\n`);
console.log(`${id} : ${state}`);

// build.mjs fait son travail à l'import : il régénère ROADMAP.md et la page depuis le nouveau status.json.
await import('./build.mjs');
