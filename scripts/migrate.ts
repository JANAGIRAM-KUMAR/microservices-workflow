import {config} from 'dotenv';
import { readFileSync } from 'node:fs';
import {resolve} from 'node:path';
import {getPool} from '../packages/shared/src/db/pool';

config({path: resolve(process.cwd(), '.env')});

async function main(){
    const file = process.argv[2] ?? 'sql/001_users.sql';
    const sql = readFileSync(resolve(process.cwd(), file), 'utf-8');
    
    const pool = getPool();
    await pool.query(sql);

    console.log(`Successfully migrated ${file}`);
    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});