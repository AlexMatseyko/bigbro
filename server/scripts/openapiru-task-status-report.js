const fs = require('fs');
const path = require('path');

const specPath = path.join(__dirname, '..', 'openapiru.json');
const reportPath = path.join(__dirname, '..', 'openapiru-task-status-report.txt');

const raw = fs.readFileSync(specPath, 'utf8');
const spec = JSON.parse(raw);

const lines = [];

function write(line) {
  lines.push(line);
}

function resolveRef(ref, root) {
  if (!ref || typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  const parts = ref.replace('#/', '').split('/');
  let cur = root;
  for (const p of parts) {
    cur = cur && cur[p];
  }
  return cur;
}

function isStatusRelatedKey(key) {
  const k = (key || '').toLowerCase();
  return (
    k === 'status' ||
    k === 'status_id' ||
    k === 'statusid' ||
    k === 'status_title' ||
    k === 'statustitle' ||
    k.includes('status')
  );
}

function describeType(prop) {
  if (!prop) return 'unknown';
  const type = prop.type;
  const ref = prop.$ref;
  const enumVal = prop.enum;
  const items = prop.items;
  const parts = [];
  if (type) parts.push('type: ' + type);
  if (ref) parts.push('$ref: ' + ref);
  if (enumVal && Array.isArray(enumVal)) parts.push('enum: [' + enumVal.join(', ') + ']');
  if (items) {
    if (items.$ref) parts.push('items: $ref ' + items.$ref);
    if (items.enum && Array.isArray(items.enum)) parts.push('items enum: [' + items.enum.join(', ') + ']');
  }
  return parts.length ? parts.join('; ') : JSON.stringify(prop).slice(0, 100);
}

function collectEnumsFromSchema(schema, visited) {
  const out = [];
  if (!schema || visited.has(schema)) return out;
  visited.add(schema);
  if (schema.enum && Array.isArray(schema.enum)) {
    out.push({ values: schema.enum });
  }
  const props = schema.properties || {};
  for (const [key, prop] of Object.entries(props)) {
    if (prop && prop.enum && Array.isArray(prop.enum)) {
      out.push({ property: key, values: prop.enum });
    }
  }
  return out;
}

// Recursively find all objects that have .properties (schema-like)
function findSchemaLikeObjects(obj, pathSegments, results) {
  if (!obj || typeof obj !== 'object') return;
  if (obj.properties && typeof obj.properties === 'object') {
    results.push({ schema: obj, path: pathSegments.join('') });
  }
  for (const [k, v] of Object.entries(obj)) {
    findSchemaLikeObjects(v, pathSegments.concat('.' + k), results);
  }
}

const allSchemaLike = [];
findSchemaLikeObjects(spec, [], allSchemaLike);

// Task-related: path contains "task" (e.g. /module/task/tasks/...)
const taskRelated = allSchemaLike.filter(({ path: p }) => /task/i.test(p));
// Dedupe by schema object identity so we don't report same schema multiple times
const seen = new Set();
const taskSchemasUnique = [];
for (const { schema, path: p } of taskRelated) {
  const key = p + '|' + Object.keys(schema.properties || {}).sort().join(',');
  if (seen.has(key)) continue;
  seen.add(key);
  taskSchemasUnique.push({ schema, path: p });
}

write('=== OpenAPI Task & Status Report (openapiru.json) ===');
write('');
write('Schemas with "task" in name (case insensitive):');
write('  (This spec has no components.schemas; schemas are inline under paths.)');
write('  Task-related schema locations (path in spec containing "task"):');
taskSchemasUnique.forEach(({ path: p }) => write('  - ' + p));
write('');
write('Total task-related schema locations: ' + taskSchemasUnique.length);
write('');

for (const { schema, path: schemaPath } of taskSchemasUnique) {
  const props = schema.properties || {};
  const propKeys = Object.keys(props);

  write('--- Schema at: ' + schemaPath + ' ---');
  const statusProps = propKeys.filter(isStatusRelatedKey);
  if (statusProps.length > 0) {
    write('Status-related properties:');
    for (const key of statusProps) {
      const prop = props[key];
      const desc = describeType(prop);
      write('  ' + key + ': ' + desc);
    }
    write('');
  }
  write('All properties:');
  for (const key of propKeys) {
    const prop = props[key];
    const desc = describeType(prop);
    const marker = isStatusRelatedKey(key) ? ' [status-related]' : '';
    write('  ' + key + ': ' + desc + marker);
  }
  write('');

  const visited = new Set();
  const enums = collectEnumsFromSchema(schema, visited);
  if (enums.length > 0) {
    write('Enums/lists in this schema:');
    for (const e of enums) {
      write('  ' + (e.property ? 'Property "' + e.property + '": ' : '') + (Array.isArray(e.values) ? e.values.join(', ') : String(e.values)));
    }
    write('');
  }
  write('');
}

// Also scan all task-related schemas for nested objects that might be "status" (e.g. response.properties.status)
write('=== Status value lists (enums) found in task-related schemas ===');
const allStatusEnums = [];
const visitedGlobal = new Set();
for (const { schema } of taskSchemasUnique) {
  function walk(o) {
    if (!o || visitedGlobal.has(o)) return;
    visitedGlobal.add(o);
    if (o.enum && Array.isArray(o.enum)) {
      const hasStatus = o.enum.some(v => String(v).toLowerCase().includes('status') || ['new','done','in progress','closed'].some(s => String(v).toLowerCase().includes(s)));
      if (hasStatus || (o.title && /status/i.test(o.title))) allStatusEnums.push(o.enum);
    }
    if (typeof o === 'object') {
      for (const v of Object.values(o)) walk(v);
    }
  }
  walk(schema);
}
// Also collect by property name
const statusValueLists = [];
for (const { schema, path: sp } of taskSchemasUnique) {
  const props = schema.properties || {};
  for (const [key, prop] of Object.entries(props)) {
    if (!isStatusRelatedKey(key)) continue;
    if (prop && prop.enum && Array.isArray(prop.enum)) {
      statusValueLists.push({ source: sp, property: key, values: prop.enum });
    }
  }
}
for (const { source, property, values } of statusValueLists) {
  write('From ' + source + ', property "' + property + '":');
  write('  Values: ' + values.join(', '));
  write('');
}
if (statusValueLists.length === 0 && allStatusEnums.length === 0) {
  write('  (No explicit status enum lists found in task schemas.)');
}

const reportText = lines.join('\n');
fs.writeFileSync(reportPath, reportText, 'utf8');
console.log('Report written to:', reportPath);
