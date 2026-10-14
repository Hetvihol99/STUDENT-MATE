import {existsSync,readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
if(!existsSync('dist/server/wrangler.json'))throw new Error('Run npm run build before local migrations.');
// Use Wrangler's migration ledger so rerunning this command is safe.
const config=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
config.d1_databases=config.d1_databases.map(d=>({...d,migrations_dir:path.join(root,'drizzle')}));
mkdirSync('.sites-runtime',{recursive:true});
// The generated config has paths relative to dist/server; preserve that base.
const migrationConfig='dist/server/wrangler.migrations.json';writeFileSync(migrationConfig,JSON.stringify(config,null,2));
const result=spawnSync(process.execPath,['--import','./scripts/windows-fs-compat.mjs','--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config',migrationConfig,'--persist-to','.wrangler/state'],{stdio:'inherit',env:{...process.env,CI:'true'}});if(result.error)throw result.error;process.exit(result.status??1);
