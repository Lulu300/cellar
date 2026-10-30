// Génère ROADMAP.md (pour les agents) et la page HTML de suivi, en lecture seule, depuis tasks.mjs
// et status.json, à côté de ce fichier.
// Usage : node docs/roadmap/build.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { meta, states, phases, tasks, decisions } from './tasks.mjs';
import { loadAudit } from './audit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const status = JSON.parse(readFileSync(join(here, 'status.json'), 'utf8'));

// Contrôles de cohérence
const ids = new Set(tasks.map((t) => t.id));
for (const t of tasks) {
	for (const d of t.deps) if (!ids.has(d)) throw new Error(`${t.id} dépend de ${d}, inconnu`);
	if (!phases.some((p) => p.id === t.phase)) throw new Error(`${t.id} : phase ${t.phase} inconnue`);
	// for…of voit aussi les trous d'un tableau (une virgule en trop), que some() sauterait.
	for (const field of ['where', 'todo', 'src'])
		for (const x of t[field]) if (typeof x !== 'string' || !x.trim()) throw new Error(`${t.id} : élément vide dans ${field}`);
}
const phaseIndex = Object.fromEntries(phases.map((p, i) => [p.id, i]));
for (const t of tasks)
	for (const d of t.deps) {
		const dep = tasks.find((x) => x.id === d);
		if (phaseIndex[dep.phase] > phaseIndex[t.phase]) console.warn(`attention : ${t.id} (${t.phase}) dépend de ${d} (${dep.phase}), phase ultérieure`);
	}

const auditDir = join(here, 'reviews', 'audit-pre-1.0');
const audit = existsSync(auditDir) ? loadAudit(auditDir) : null;

// L'état d'une tâche Tn de l'audit suit celui des tâches qui la citent dans `src` (« T3 de l’audit »), et celui
// d'un constat celui des tâches qui le citent (« audit-pre-1.0/axe-6-pages.md#m1, m5–m7 ») : fait quand elles le
// sont toutes, en cours dès que l'une a commencé. Un constat « déjà fait (BUG-14, …) » suit la tâche nommée.
// Sa note reste celle de status.json.
const stateOf = (id) => status[id]?.state || 'todo';
const citedStates = {};
const cite = (ref, state) => (citedStates[ref] ??= []).push(state);
for (const t of tasks)
	for (const s of t.src) {
		const auditTask = s.match(/^(T\d+) de l’audit/)?.[1];
		if (auditTask) cite(auditTask, stateOf(t.id));
		const [, axis, refs] = s.match(/^audit-pre-1\.0\/axe-([1-7])-[^#]*#(.*)$/) || [];
		if (!axis) continue;
		for (const part of refs.split(';')) {
			const doneBy = part.match(/déjà faits? \(([A-Z]+-\d+)/)?.[1];
			// « R3-m12 » ou « UI-08/Reste-3 » désignent une ligne de revue, pas un constat, et une parenthèse
			// peut renvoyer au constat d'un autre axe (« même correction que a6 m18 »).
			for (const [, letter, from, to] of part.replace(/\([^)]*\)/g, '').matchAll(/(?<![\w\/-])([CMm])(\d+)(?:–[CMm]?(\d+))?(?![\w-])/g))
				for (let n = +from; n <= +(to || from); n++) cite(`A${axis}-${letter}${n}`, stateOf(doneBy || t.id));
		}
	}
const knownRefs = new Set(audit ? [...audit.axes.flatMap((a) => a.findings.map((f) => f.key)), ...audit.synthese.tasks.map((t) => t.id)] : []);
const pageStatus = { ...status };
for (const [ref, list] of Object.entries(citedStates)) {
	if (audit && !knownRefs.has(ref)) console.warn(`attention : ${ref} cité dans tasks.mjs mais absent de l’audit`);
	const state = list.every((s) => s === 'done') ? 'done' : list.some((s) => s === 'doing' || s === 'done') ? 'doing' : list.includes('blocked') ? 'blocked' : 'todo';
	pageStatus[`audit-${ref}`] = { ...status[`audit-${ref}`], state };
}

// HTML, avec l'onglet de l'audit d'avant 1.0 quand ses fichiers sont là
const html = readFileSync(join(here, 'template.html'), 'utf8').replace(
	'/*__DATA__*/null',
	() => JSON.stringify({ meta, states, phases, tasks, decisions, audit, status: pageStatus }).replace(/</g, '\\u003c')
);
writeFileSync(join(here, 'roadmap.html'), html);

// Markdown
const sevLabel = { critique: 'critique', majeur: 'majeur', mineur: 'mineur', evolution: 'évolution' };
const stateLabel = Object.fromEntries(states.map((s) => [s.key, s.label]));
const L = [];
L.push(`# Feuille de route ${meta.project}`);
L.push('');
L.push(`Revue du code du ${meta.date}, commit \`${meta.baseCommit}\`. Ce fichier est la version pour les agents : une entrée par tâche, avec assez de contexte pour rédiger un ticket ou la traiter.`);
L.push('');
L.push(`- Statuts : \`status.json\`, repris sous chaque tâche. Pour en changer un : \`node docs/roadmap/status.mjs <ID> <${states.map((s) => s.key).join('|')}> [note]\`, qui régénère aussi ce fichier.`);
L.push('- Page de suivi, en lecture seule : `node docs/roadmap/build.mjs`, puis ouvrez `docs/roadmap/roadmap.html` (non versionnée).');
L.push('- Rapports détaillés, avec `fichier:ligne` et scénarios : `docs/roadmap/reviews/` (les références `review-N-*.md#X` des tâches y renvoient).');
L.push('- Les numéros de ligne datent de l’audit : revérifiez-les avant de modifier le code.');
L.push('');
L.push('## Règles pour les agents');
L.push('');
L.push('1. Une tâche par branche, créée depuis `develop` et mergée dans `develop` (rebase puis fast-forward). `main` ne reçoit que les versions publiées. Respectez les dépendances (`Dépend de`).');
L.push('2. Avant de coder, relisez la section citée dans `Sources` et vérifiez que le problème existe toujours.');
L.push('3. La tâche est terminée quand son critère d’acceptation est vérifié et que `pnpm check`, ainsi que `pnpm test` et `pnpm lint` une fois en place (QA-01, QA-02), passent.');
L.push('4. Avant le merge dans `develop`, passez la tâche à « Fait » dans un dernier commit de la branche : `node docs/roadmap/status.mjs <ID> done "<note>"`, la note donnant le numéro de la PR ou la plage de commits, puis commitez `status.json` et `ROADMAP.md`.');
L.push('');
L.push('## Décisions prises');
L.push('');
for (const d of decisions) L.push(`- **${d.topic}** : ${d.choice}`);
L.push('');
L.push('## Vue d’ensemble');
L.push('');
L.push('| Phase | Objectif | Tâches | Faites |');
L.push('|---|---|---|---|');
for (const p of phases) {
	const phaseIds = tasks.filter((t) => t.phase === p.id).map((t) => t.id);
	L.push(`| ${p.id} · ${p.title} | ${p.goal} | ${phaseIds.join(', ')} | ${phaseIds.filter((id) => stateOf(id) === 'done').length} / ${phaseIds.length} |`);
}
L.push('');
for (const p of phases) {
	L.push(`## ${p.id} · ${p.title}`);
	L.push('');
	L.push(p.goal);
	L.push('');
	for (const t of tasks.filter((x) => x.phase === p.id)) {
		L.push(`### ${t.id} · ${t.title}`);
		L.push('');
		L.push(`Sévérité **${sevLabel[t.sev]}** · effort **${t.size}**` + (t.deps.length ? ` · dépend de ${t.deps.join(', ')}` : '') + ` · statut **${stateLabel[stateOf(t.id)]}**`);
		L.push('');
		const rec = status[t.id];
		// < échappé : GitHub lirait « /api/<table> » comme une balise.
		if (rec?.note) L.push(`**Suivi** (${rec.updatedAt.slice(0, 10)}) : ${rec.note.replace(/</g, '&lt;')}`, '');
		L.push(`**Problème** : ${t.why}`);
		L.push('');
		L.push(`**Fichiers** : ${t.where.map((w) => '`' + w + '`').join(', ')}`);
		L.push('');
		L.push('**À faire**');
		L.push('');
		for (const x of t.todo) L.push(`- ${x}`);
		L.push('');
		L.push(`**Critère d’acceptation** : ${t.done}`);
		L.push('');
		L.push(`**Sources** : ${t.src.join(', ')}`);
		L.push('');
	}
}
writeFileSync(join(here, 'ROADMAP.md'), L.join('\n'));
console.log(`${tasks.length} tâches, ${phases.length} phases`);
