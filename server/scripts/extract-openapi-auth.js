const fs = require('fs');
const path = require('path');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'openapiru.json'), 'utf8'));

const out = {
  info: spec.info ? { description: (spec.info.description || '').slice(0, 3000) } : {},
  servers: spec.servers,
  security: spec.security,
  componentsSecuritySchemes: spec.components && spec.components.securitySchemes,
  pathsWithToken: {}
};

if (spec.paths) {
  for (const p of Object.keys(spec.paths)) {
    if (/token|oauth|auth|login/i.test(p)) out.pathsWithToken[p] = Object.keys(spec.paths[p] || {});
  }
}

console.log(JSON.stringify(out, null, 2));
