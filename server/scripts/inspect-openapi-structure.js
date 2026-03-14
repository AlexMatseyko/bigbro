const fs = require('fs');
const path = require('path');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'openapiru.json'), 'utf8'));

function findInObject(obj, pred, path = '') {
  const results = [];
  if (!obj || typeof obj !== 'object') return results;
  if (pred(obj, path)) results.push({ path, obj });
  for (const [k, v] of Object.entries(obj)) {
    results.push(...findInObject(v, pred, path ? path + '.' + k : k));
  }
  return results;
}

// Find all objects that have "properties" (schema-like)
const withProps = findInObject(spec, (o) => o && typeof o === 'object' && o.properties && typeof o.properties === 'object');
console.log('Number of schema-like objects (with .properties):', withProps.length);
withProps.slice(0, 15).forEach(({ path: p }) => console.log('  ', p));

// Sample one to see structure
if (withProps.length > 0) {
  const first = withProps[0];
  console.log('\nSample schema at', first.path, '- property keys:', Object.keys(first.obj.properties).slice(0, 20));
}

// Check paths for operation schemas
const paths = spec.paths || {};
console.log('\nPath keys (first 20):', Object.keys(paths).slice(0, 20));

// Raw string search for "task" and "status"
const raw = fs.readFileSync(path.join(__dirname, '..', 'openapiru.json'), 'utf8');
const taskIdx = raw.toLowerCase().indexOf('task');
console.log('\nFirst occurrence of "task" at index:', taskIdx);
if (taskIdx >= 0) console.log('Context:', raw.slice(Math.max(0, taskIdx - 30), taskIdx + 80));
