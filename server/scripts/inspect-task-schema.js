const fs = require('fs');
const path = require('path');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'openapiru.json'), 'utf8'));

const schemas = spec.components && spec.components.schemas ? spec.components.schemas : {};
const taskSchemaNames = Object.keys(schemas).filter((k) => /task/i.test(k));

const out = [];
for (const name of taskSchemaNames) {
  const schema = schemas[name];
  const props = schema && schema.properties ? schema.properties : {};
  const propKeys = Object.keys(props);
  const statusKeys = propKeys.filter((k) => /status/i.test(k));
  out.push({ name, propKeys: propKeys.slice(0, 30), statusKeys, sampleProp: statusKeys[0] ? props[statusKeys[0]] : null });
}

fs.writeFileSync(path.join(__dirname, 'task-schema-out.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('Written task-schema-out.json');
