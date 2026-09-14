import fs from 'node:fs';import path from 'node:path';
const files=fs.readdirSync('dist/assets').filter(f=>f.endsWith('.js'));
for(const file of files){const s=fs.readFileSync(path.join('dist/assets',file),'utf8');for(const blocked of ['NexaMind2026!','Agenda2026!','doctora@nexamind.demo','secretaria@nexamind.demo','SUPABASE_SERVICE_ROLE_KEY','WOMPI_CLIENT_SECRET'])if(s.includes(blocked)){console.error('Unsafe value in production bundle',file);process.exit(1);}}
console.log('DIST_SCAN_OK');
