import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
const sandbox = {
  console,
  Date,
  Set,
  Map,
  String,
  Number,
  Math,
  Object,
  Array,
  RegExp,
  chrome: {
    runtime: { onInstalled: { addListener() {} }, onMessage: { addListener() {} } },
    storage: { local: { set() {}, get() {} } }
  }
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

function assert(condition, message, payload = {}) {
  if (!condition) {
    console.error(JSON.stringify({ message, ...payload }, null, 2));
    process.exit(1);
  }
}

const anchor = new Date(2026, 5, 30, 12, 0, 0, 0);
const settings = { includeEUR: false };
const jsonItems = [
  { title: 'CB Consumer Confidence', country: 'USD', date: '2026-06-30T10:00:00-04:00', impact: 'Medium' },
  { title: 'JOLTS Job Openings', country: 'USD', date: '2026-06-30T10:00:00-04:00', impact: 'Medium' },
  { title: 'ADP Non-Farm Employment Change', country: 'USD', date: '2026-07-01T08:15:00-04:00', impact: 'Medium' },
  { title: 'Fed Chairman Warsh Speaks', country: 'USD', date: '2026-07-01T09:00:00-04:00', impact: 'High' },
  { title: 'ISM Manufacturing PMI', country: 'USD', date: '2026-07-01T10:00:00-04:00', impact: 'High' },
  { title: 'ISM Manufacturing Prices', country: 'USD', date: '2026-07-01T10:00:00-04:00', impact: 'Medium' },
  { title: 'Average Hourly Earnings m/m', country: 'USD', date: '2026-07-02T08:30:00-04:00', impact: 'High' },
  { title: 'Non-Farm Employment Change', country: 'USD', date: '2026-07-02T08:30:00-04:00', impact: 'High' },
  { title: 'Unemployment Rate', country: 'USD', date: '2026-07-02T08:30:00-04:00', impact: 'High' },
  { title: 'Unemployment Claims', country: 'USD', date: '2026-07-02T08:30:00-04:00', impact: 'Medium' }
];
const parsed = sandbox.normalizeJsonCalendarItems(anchor, jsonItems, settings);
const days = sandbox.buildDayCards(anchor, parsed.events, parsed.holidays);
const wed = days.find(day => day.dateKey === '2026-07-01');
const thu = days.find(day => day.dateKey === '2026-07-02');

assert(parsed.events.length === 10, 'JSON fallback should keep all USD high/medium events', { parsed });
assert(wed && !wed.empty && wed.events.some(group => group.time === '20:15'), 'Wednesday should contain Beijing-time ADP event', { wed });
assert(thu && !thu.empty && thu.events.some(group => group.time === '20:30'), 'Thursday should contain Beijing-time labor events', { thu });

console.log(JSON.stringify({
  jsonCount: parsed.events.length,
  wed,
  thu
}, null, 2));
