// Lit l'audit d'avant 1.0 (reviews/audit-pre-1.0/*.md) pour l'onglet « Audit » de la page de suivi.
// Les fichiers Markdown restent la source : ce module les découpe en données et les rend en HTML.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const VERDICTS = ['Corrigé', 'Partiel', 'Non fait', 'Sans objet', 'Écart décidé'];
const SEVERITIES = { Critique: 'critique', Majeur: 'majeur', Mineur: 'mineur' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const indentOf = (l) => l.match(/^ */)[0].length;
const isFence = (l) => /^\s*```/.test(l);
const isTableLine = (l) => /^\s*\|/.test(l);
const listMarker = (l) => l.match(/^( *)([-*]|\d+\.) +/);
const isBlockStart = (l) => isFence(l) || isTableLine(l) || /^#{1,6} /.test(l) || listMarker(l);

// Renvois vers les constats : « axe 6, M2 et m3 » et « a3 m1–m6, m9 ».
let knownFindings = new Set();
const missingRefs = new Set();
function refLink(axis, id) {
	const key = `A${axis}-${id}`;
	if (!knownFindings.has(key)) {
		missingRefs.add(key);
		return id;
	}
	return `<a class="ref" href="#${key}" data-open="${key}">${id}</a>`;
}
function linkRefs(html) {
	html = html.replace(/\baxe ([1-7])((?:(?:, | et )[CMm]\d+\b)+)/g, (_, axis, tail) =>
		`axe ${axis}` + tail.replace(/[CMm]\d+/g, (id) => refLink(axis, id))
	);
	return html.replace(/\ba([1-7])\b([^;)|<]*)/g, (_, axis, tail) =>
		`a${axis}` + tail.replace(/(^|[\s,–])([CMm]\d+)\b/g, (__, before, id) => before + refLink(axis, id))
	);
}

function inline(text) {
	const codes = [];
	let s = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
	s = esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	s = linkRefs(s);
	return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
}

const splitRow = (l) =>
	l
		.trim()
		.replace(/^\||\|$/g, '')
		.split(/(?<!\\)\|/)
		.map((c) => c.trim().replace(/\\\|/g, '|'));

function table(lines) {
	const [head, , ...body] = lines.map(splitRow);
	return (
		'<div class="tbl"><table><thead><tr>' +
		head.map((c) => `<th>${inline(c)}</th>`).join('') +
		'</tr></thead><tbody>' +
		body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
		'</tbody></table></div>'
	);
}

// Découpe une liste en éléments ; chaque élément garde ses lignes, sans l'indentation de la liste.
function listItems(lines, i) {
	const first = listMarker(lines[i]);
	const indent = first[1].length;
	const ordered = /\d/.test(first[2]);
	const items = [];
	while (i < lines.length) {
		const m = listMarker(lines[i]);
		if (!m || m[1].length !== indent || /\d/.test(m[2]) !== ordered) break;
		const width = m[0].length;
		const content = [lines[i].slice(width)];
		i++;
		while (i < lines.length) {
			const l = lines[i];
			if (!l.trim()) {
				let j = i;
				while (j < lines.length && !lines[j].trim()) j++;
				if (j < lines.length && indentOf(lines[j]) > indent) {
					content.push('');
					i++;
					continue;
				}
				break;
			}
			if (indentOf(l) > indent) content.push(l.slice(Math.min(indentOf(l), width)));
			else if (!isBlockStart(l) && content[content.length - 1].trim()) content.push(l.trim());
			else break;
			i++;
		}
		items.push(content);
	}
	return { items, ordered, next: i };
}

function render(text, headingShift = 0) {
	const lines = Array.isArray(text) ? text : text.split('\n');
	const out = [];
	let i = 0;
	while (i < lines.length) {
		const l = lines[i];
		if (!l.trim()) {
			i++;
			continue;
		}
		if (isFence(l)) {
			const body = [];
			i++;
			while (i < lines.length && !isFence(lines[i])) body.push(lines[i++]);
			i++;
			out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
			continue;
		}
		const h = l.match(/^(#{1,6}) +(.*)$/);
		if (h) {
			const level = Math.min(6, h[1].length + headingShift);
			out.push(`<h${level}>${inline(h[2])}</h${level}>`);
			i++;
			continue;
		}
		if (isTableLine(l)) {
			const rows = [];
			while (i < lines.length && isTableLine(lines[i])) rows.push(lines[i++]);
			out.push(table(rows));
			continue;
		}
		if (listMarker(l)) {
			const { items, ordered, next } = listItems(lines, i);
			const tag = ordered ? 'ol' : 'ul';
			out.push(`<${tag}>` + items.map((c) => `<li>${render(c, headingShift).replace(/^<p>([\s\S]*?)<\/p>/, '$1')}</li>`).join('') + `</${tag}>`);
			i = next;
			continue;
		}
		const para = [];
		while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i]))) para.push(lines[i++].trim());
		out.push(`<p>${inline(para.join(' '))}</p>`);
	}
	return out.join('');
}

// Découpe sur les titres d'un niveau donné, en ignorant les blocs de code.
function sections(lines, level) {
	const prefix = '#'.repeat(level) + ' ';
	const result = { preamble: [], parts: [] };
	let current = null;
	let fence = false;
	for (const l of lines) {
		if (isFence(l)) fence = !fence;
		if (!fence && l.startsWith(prefix)) {
			current = { title: l.slice(prefix.length).trim(), lines: [] };
			result.parts.push(current);
		} else (current ? current.lines : result.preamble).push(l);
	}
	return result;
}

const verdictOf = (cell) => VERDICTS.find((v) => cell.startsWith(v)) || cell;

function traceability(part) {
	const groups = [];
	const sub = sections(part.lines, 3);
	for (const g of sub.parts) {
		const rows = [];
		const rest = [];
		let tableLines = [];
		const flush = () => {
			if (!tableLines.length) return;
			if (/^\|\s*Réf\s*\|/.test(tableLines[0].trim())) {
				for (const l of tableLines.slice(2)) {
					const [ref, point, verdict, proof] = splitRow(l);
					rows.push({ ref, point: inline(point), verdict: verdictOf(verdict), proof: inline(proof || '') });
				}
			} else rest.push(...tableLines);
			tableLines = [];
		};
		for (const l of g.lines) {
			if (isTableLine(l)) tableLines.push(l);
			else {
				flush();
				rest.push(l);
			}
		}
		flush();
		groups.push({ title: inline(g.title), rows, html: render(rest, 1) });
	}
	return { intro: render(sub.preamble), groups };
}

const SEV_OF_ID = { C: 'critique', M: 'majeur', m: 'mineur' };

// Un constat commence par « **m3. Titre** » et court jusqu'au constat ou au titre suivant.
// L'axe 7 en range aussi deux sous le chemin de mise à jour : on les reprend là où ils sont.
function findings(part, axis) {
	const list = [];
	const extras = [];
	for (const sub of sections(part.lines, 3).parts) {
		const rest = [];
		let cur = null;
		for (const l of sub.lines) {
			const m = l.match(/^\*\*([CMm]\d+)\. (.*?)\*\*\s*(.*)$/);
			if (m) {
				cur = { key: `A${axis}-${m[1]}`, axis, id: m[1], sev: SEV_OF_ID[m[1][0]], title: m[2], note: m[3], lines: [] };
				list.push(cur);
			} else if (cur && !/^#/.test(l)) cur.lines.push(l);
			else {
				cur = null;
				rest.push(l);
			}
		}
		// Un titre resté sans contenu (« Constats ») n'a plus lieu d'être une fois les constats extraits.
		while (rest.length && (!rest[rest.length - 1].trim() || /^#/.test(rest[rest.length - 1]))) rest.pop();
		if (!SEVERITIES[sub.title]) extras.push({ title: inline(sub.title), html: render(rest, 1) });
	}
	return { list, extras };
}

function finishFinding(f) {
	const where = f.lines.find((l) => l.startsWith('- Où :')) || '';
	const firstPath = where.match(/`([^`]+)`/);
	const verification = (f.lines.find((l) => l.startsWith('- Vérification :')) || '').replace('- Vérification :', '').trim();
	return {
		key: f.key,
		axis: f.axis,
		id: f.id,
		sev: f.sev,
		title: inline(f.title),
		origin: inline(f.note.replace(/^\((.*)\)$/, '$1')),
		where: firstPath ? firstPath[1] : '',
		corrected: verification.startsWith('Confirmé, corrigé'),
		html: render(f.lines),
		md: `**${f.id}. ${f.title}** (axe ${f.axis})\n${f.lines.join('\n').trim()}`
	};
}

function axisFile(dir, name) {
	const lines = readFileSync(join(dir, name), 'utf8').split('\n');
	const head = lines[0].match(/^# .*axe (\d) : (.*)$/);
	if (!head) throw new Error(`${name} : titre inattendu`);
	const axis = Number(head[1]);
	const top = sections(lines.slice(1), 2);
	const axisData = { n: axis, file: name, title: head[2][0].toUpperCase() + head[2].slice(1), intro: render(top.preamble), sections: [] };
	for (const part of top.parts) {
		const num = part.title.match(/^(\d)\./)?.[1];
		if (num === '2') axisData.trace = traceability(part);
		else if (num === '3') {
			const f = findings(part, axis);
			axisData.rawFindings = f.list;
			axisData.extras = f.extras;
			axisData.findingsIntro = render(sections(part.lines, 3).preamble);
		} else axisData.sections.push({ num, title: inline(part.title.replace(/^\d\.\s*/, '')), lines: part.lines });
	}
	return axisData;
}

// Éléments suivis de la synthèse : bloquants (R, B), tâches (T) et décisions (D).
function trackedItem(content, group) {
	const m = content[0].match(/^\*\*([RBD]\d+)\. (.+?)\*\*/);
	if (!m) return null;
	const body = [content[0].replace(`**${m[1]}. `, '**'), ...content.slice(1)];
	return { id: m[1], group, title: inline(m[2].replace(/[.:]$/, '')), html: render(body), md: content.join('\n') };
}

function synthese(dir) {
	const lines = readFileSync(join(dir, 'synthese.md'), 'utf8').split('\n');
	const top = sections(lines.slice(1), 2);
	const s = { intro: render(top.preamble), blockers: [], tasks: [], decisions: [], sections: [] };
	for (const part of top.parts) {
		if (part.title.startsWith('1.')) {
			for (const sub of sections(part.lines, 3).parts) {
				const items = [];
				const rest = [];
				for (let i = 0; i < sub.lines.length; ) {
					if (listMarker(sub.lines[i])) {
						const { items: li, next } = listItems(sub.lines, i);
						li.forEach((c) => items.push(c));
						i = next;
					} else rest.push(sub.lines[i++]);
				}
				const tracked = items.map((c) => trackedItem(c, sub.title)).filter(Boolean);
				if (tracked.length) s.blockers.push({ title: inline(sub.title), intro: render(rest), items: tracked });
				else s.calendar = { title: inline(sub.title), html: render(sub.lines) };
			}
		} else if (part.title.startsWith('2.')) {
			const rows = part.lines.filter(isTableLine).slice(2).map(splitRow);
			s.tasksIntro = render(part.lines.filter((l) => !isTableLine(l)));
			for (const [name, content, sources] of rows) {
				const m = name.match(/^(T\d+)\. (.*)$/);
				s.tasks.push({ id: m[1], title: inline(m[2]), content: inline(content), sources: inline(sources), md: `${name}\n\n${content}\n\nSources : ${sources}` });
			}
		} else if (part.title.startsWith('3.')) {
			let group = '';
			for (let i = 0; i < part.lines.length; ) {
				const l = part.lines[i];
				if (listMarker(l)) {
					const { items, next } = listItems(part.lines, i);
					items.forEach((c) => {
						const d = trackedItem(c, group);
						if (d) s.decisions.push(d);
					});
					i = next;
				} else {
					if (l.trim()) group = l.trim().replace(/ :$/, '');
					i++;
				}
			}
		} else s.sections.push({ title: inline(part.title), html: render(part.lines) });
	}
	return s;
}

export function loadAudit(dir) {
	const files = readdirSync(dir).filter((f) => /^axe-\d-.*\.md$/.test(f)).sort();
	// Premier passage : la liste des constats, pour que les renvois rendus ensuite pointent juste.
	knownFindings = new Set();
	for (const f of files) {
		const lines = readFileSync(join(dir, f), 'utf8').split('\n');
		const axis = lines[0].match(/axe (\d)/)[1];
		const part = sections(lines, 2).parts.find((p) => p.title.startsWith('3.'));
		for (const l of part.lines) {
			const m = l.match(/^\*\*([CMm]\d+)\. /);
			if (m) knownFindings.add(`A${axis}-${m[1]}`);
		}
	}
	missingRefs.clear();
	const axes = files.map((f) => axisFile(dir, f));
	for (const a of axes) {
		a.findings = a.rawFindings.map(finishFinding);
		delete a.rawFindings;
		a.sections = a.sections.map((x) => ({ num: x.num, title: x.title, html: render(x.lines, 1) }));
	}
	const syn = synthese(dir);
	if (missingRefs.size) console.warn(`attention : renvois vers des constats inconnus : ${[...missingRefs].join(', ')}`);
	return { axes, synthese: syn, verdicts: VERDICTS };
}
