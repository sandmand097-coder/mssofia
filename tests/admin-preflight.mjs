import assert from 'node:assert/strict';
import {adminProductionReady,validAdminEnvironment} from '../server/admin-preflight.js';

const env={
 NODE_ENV:'production',
 PUBLIC_LAUNCH_MODE:'admin',
 REGISTRATION_ENABLED:'false',
 GOOGLE_ADMIN_LOGIN_ENABLED:'true',
 GOOGLE_OAUTH_CLIENT_ID:'12345-test.apps.googleusercontent.com',
 GOOGLE_ADMIN_EMAIL:'sandmand097@gmail.com',
 APP_ORIGIN:'https://mssofia.pages.dev',
 JWT_SECRET:'e'.repeat(96),
 DATABASE_URL:'postgresql://mssofia_backend.jtluslevdmcpxxkngomj:demo-password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
};
let queries=0,closed=0;
const fake=(login='mssofia_backend',approved=true)=>()=>({
 query:async (sql,params)=>{
  queries++;
  assert.match(sql,/current_user/);
  assert.deepEqual(params,['sandmand097@gmail.com']);
  return{rows:[{login,approved}]};
 },
 end:async()=>{closed++}
});
assert.equal(validAdminEnvironment(env),true);
assert.equal(await adminProductionReady(env,fake()),true);
assert.equal(closed,1);
assert.equal(await adminProductionReady(env,fake('postgres')),false);
assert.equal(await adminProductionReady(env,fake('mssofia_backend',false)),false);
for(const bad of [
 {DATABASE_URL:'postgresql://mssofia_backend.wnkewiulyobbjftckfqb:abc@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'},
 {DATABASE_URL:'postgresql://mssofia_backend.jtluslevdmcpxxkngomj:abc@localhost:5432/postgres'},
 {DATABASE_URL:'postgresql://mssofia_backend.jtluslevdmcpxxkngomj:abc@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=disable'},
 {DATABASE_URL:'postgresql://mssofia_backend.jtluslevdmcpxxkngomj:YOUR_RANDOM_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'},
 {JWT_SECRET:'ANOTHER_RANDOM_SECRET_AT_LEAST_48_CHARACTERS'},
 {PUBLIC_LAUNCH_MODE:'full'},
 {REGISTRATION_ENABLED:'true'},
 {GOOGLE_ADMIN_LOGIN_ENABLED:'false'},
 {APP_ORIGIN:'https://attacker.example'},
 {GOOGLE_ADMIN_EMAIL:''},
 {PGSSL:'disable'}
]){
 const override={...env,...bad};
 assert.equal(validAdminEnvironment(override),false,JSON.stringify(Object.keys(bad)));
 assert.equal(await adminProductionReady(override,fake()),false);
}
const before=queries;
let closedFailures=0;
const broken=()=>({query:async()=>{throw Error('database failure')},end:async()=>{closedFailures++}});
assert.equal(await adminProductionReady(env,broken),false);
assert.equal(closedFailures,1);
assert.equal(queries,before);
console.log('PASS admin preflight: verified role, school identity, certificate, fail-closed conditions');
