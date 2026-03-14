const fs = require('fs');
const path = require('path');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'openapiru.json'), 'utf8'));
console.log('servers:', JSON.stringify(spec.servers, null, 2));
const paths = Object.keys(spec.paths || {});
console.log('paths containing "task":', paths.filter(p => /task/i.test(p)));
console.log('paths containing "module":', paths.filter(p => /module/i.test(p)).slice(0, 30));
