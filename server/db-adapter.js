// Async storage adapter. SQLite stays available for local development and isolated tests.
// DATABASE_URL selects a persistent PostgreSQL instance (Supabase Session/Transaction Pooler).
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
const sqlite=process.env.DATABASE_URL?null:await import('./db.js');

export const isCloudDatabase=Boolean(process.env.DATABASE_URL);
const pool=isCloudDatabase?new Pool({
 connectionString:process.env.DATABASE_URL,
 ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:true},
 max:Number(process.env.PG_POOL_MAX||6),
 idleTimeoutMillis:30000,
 connectionTimeoutMillis:12000,
 statement_timeout:10000
}):null;

function compilePgSql(input){
 let sql=input.replace(/\bdatetime\(\s*l\.starts_at\s*\)/gi,'l.starts_at')
  .replace(/\bdatetime\(\s*'now'\s*\)/gi,'now()')
  .replace(/\bsubstr\(\s*created_at\s*,\s*1\s*,\s*10\s*\)/gi,"to_char(created_at,'YYYY-MM-DD')");
 const ignore=/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
 if(ignore)sql=sql.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i,'INSERT INTO');
 let index=0;
 sql=sql.replace(/\?/g,()=>'$'+(++index));
 if(ignore)sql=sql.trim().replace(/;$/,'')+' ON CONFLICT DO NOTHING';
 return sql;
}
function normalize(value){
 if(value instanceof Date)return value.toISOString();
 if(typeof value==='bigint')return Number(value);
 if(Array.isArray(value))return value.map(normalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalize(v)]));
 return value;
}
async function query(sql,params){
 const result=await pool.query(compilePgSql(sql),params);
 return {rows:result.rows.map(normalize),rowCount:result.rowCount};
}
export const get=async(sql,...params)=>isCloudDatabase?(await query(sql,params)).rows[0]:sqlite.get(sql,...params);
export const all=async(sql,...params)=>isCloudDatabase?(await query(sql,params)).rows:sqlite.all(sql,...params);
export const run=async(sql,...params)=>isCloudDatabase?{changes:(await query(sql,params)).rowCount}:sqlite.run(sql,...params);
export const uid=()=>randomUUID();
export const now=()=>new Date().toISOString();
export const publicUser=user=>user?Object.fromEntries(Object.entries(user).filter(([k])=>!['password_hash','session_version'].includes(k))):null;
export const checkConnection=async()=>{
 if(!isCloudDatabase)return true;
 const r=await pool.query('SELECT 1 AS ready');
 return r.rows[0]?.ready===1;
};
let sqliteTransactionQueue=Promise.resolve();
// Atomic admin payment decisions on one connection. The transaction callback must
// use only its scoped query helpers, never the top-level pool helpers.
export async function withTransaction(callback){
 if(!isCloudDatabase){
  // Serialize concurrent local review requests; production uses PostgreSQL row locks.
  let release;
  const waiting=sqliteTransactionQueue;
  sqliteTransactionQueue=new Promise(resolve=>{release=resolve});
  await waiting;
  try{sqlite.db.exec('BEGIN IMMEDIATE')}catch(error){release();throw error}
  const tx={
   get:async(sql,...args)=>sqlite.get(sql,...args),
   all:async(sql,...args)=>sqlite.all(sql,...args),
   run:async(sql,...args)=>sqlite.run(sql,...args)
  };
  try{const value=await callback(tx);sqlite.db.exec('COMMIT');return value;}
  catch(error){sqlite.db.exec('ROLLBACK');throw error}
  finally{release()}
 }
 const client=await pool.connect();
 const queryOnClient=async(sql,args=[])=>{
  const r=await client.query(compilePgSql(sql),args);
  return{rows:r.rows.map(normalize),changes:r.rowCount};
 };
 try{
  await client.query('BEGIN');
  const tx={
   get:async(sql,...args)=>(await queryOnClient(sql,args)).rows[0],
   all:async(sql,...args)=>(await queryOnClient(sql,args)).rows,
   run:async(sql,...args)=>({changes:(await queryOnClient(sql,args)).changes})
  };
  const value=await callback(tx);
  await client.query('COMMIT');
  return value;
 }catch(error){
  await client.query('ROLLBACK').catch(()=>{});
  throw error;
 }finally{client.release()}
}
export const closeConnection=async()=>{if(pool)await pool.end()};
