// F3: footer is public wording: no internal jargon, keeps the honesty sentences.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const want = { 'index.html': ['Démo à données fictives. Ce n’est pas un système de sécurité.', 'Contenu provisoire, sans valeur contractuelle'], 'en/index.html': ['Demo with fictional data. Not a safety system.', 'provisional content, no contractual value'] };
for (const [f, [disc, prov]] of Object.entries(want)) test(`${f}: footer keeps the honesty message, no round/prototype jargon`, () => {
  const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const foot = h.match(/<footer>([\s\S]*?)<\/footer>/)[1];
  assert.ok(foot.includes(disc)); assert.ok(foot.toLowerCase().includes(prov.toLowerCase()));
  assert.doesNotMatch(foot, /round|prototype|prototy/i);
});
