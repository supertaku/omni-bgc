// Host script contract tests; this fixture does not constitute browser visual QA.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = execFileSync('python', ['-c', "import sys; sys.path.insert(0,'pipelines/etl/review-dashboard'); from offices_view import SCRIPT; print(SCRIPT)"],
  { cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8' });
const script = source.match(/<script>\r?\n([\s\S]*?)\r?\n<\/script>/)[1];
function harness(values) {
  const rows = values.map(([textContent, district, strength]) => ({
    textContent, hidden: false,
    getAttribute: key => key === 'data-district' ? district : strength,
  }));
  const controls = Object.fromEntries(['office-search', 'office-district', 'office-strength'].map(id => [id, {
    value: '', options: [], addEventListener(_, fn) { this.event = fn; }, append(option) { this.options.push(option); },
  }]));
  const results = { textContent: '' }; const empty = { hidden: true };
  const document = {
    getElementById(id) {
      if (id === 'office_candidates') return values.length ? { querySelectorAll: () => rows } : null;
      if (id === 'office-results') return results;
      if (id === 'office-empty') return empty;
      return controls[id];
    },
    createElement: () => ({}),
  };
  vm.runInNewContext(script, { document });
  const filter = (text = '', district = '', strength = '') => {
    controls['office-search'].value = text;
    controls['office-district'].value = district;
    controls['office-strength'].value = strength;
    controls['office-search'].event();
    return rows.filter(r => !r.hidden).map(r => r.textContent);
  };
  return { filter, results, empty, controls };
}

test('company multi-site, aliases, building, industry, district and no-match searches', () => {
  const view = harness([
    ['Infor Asian Century Center technology', 'BGC Core', 'High'],
    ['Infor Seven/NEO technology', 'BGC Core', 'High'],
    ['Procter & Gamble P&G Procter and Gamble Net Park', 'BGC Core', 'Medium'],
    ['Thinking Machines Twenty-Four Seven McKinley', 'BGC Core', 'High'],
    ['DigiPlus Ecoprime Building', 'BGC Core', 'High'],
    ['HCLTech Science Hub McKinley Hill', 'McKinley Hill', 'Medium'],
  ]);
  assert.equal(view.results.textContent, '6 of 6 candidate office rows');
  assert.equal(view.filter(' INFOR ').length, 2);
  assert.equal(view.filter('technology').length, 2);
  assert.equal(view.filter('Procter and Gamble').length, 1);
  assert.equal(view.filter('P&G').length, 1);
  assert.equal(view.filter('Ecoprime').length, 1);
  assert.equal(view.filter('Thinking Machines').length, 1);
  assert.equal(view.filter('Thinking\n\tMachines').length, 1);
  assert.equal(view.filter('McKinley', 'McKinley Hill', 'Medium').length, 1);
  assert.equal(view.filter('no-such-company').length, 0);
  assert.equal(view.empty.hidden, false);
  assert.equal(view.results.textContent, '0 of 6 candidate office rows');
  assert.equal(view.filter('', 'BGC Core', 'High').length, 4);
  assert.equal(view.empty.hidden, true);
});

test('empty candidate dataset reports zero without a missing-table exception', () => {
  const view = harness([]);
  assert.equal(view.results.textContent, '0 of 0 candidate office rows');
  assert.equal(view.empty.hidden, false);
});
