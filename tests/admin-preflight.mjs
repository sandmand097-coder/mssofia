import assert from 'node:assert/strict';
import {validAdminEnvironment,adminConfigurationStatus,adminProductionStatus,adminProductionReady} from '../server/admin-preflight.js';

const env={
 NODE_ENV:'production',PUBLIC_LAUNCH_MODE:'admin',
 REGISTRATION_ENABLED:'false',SCHOOL_PRIVACY_APPROVED:'false',
 GOOGLE_ADMIN_LOGIN_ENABLED:'true',
 GOOGLE_OAUTH_CLIENT_ID:'12345-test.apps.googleusercontent.com',
 GOOGLE_ADMIN_EMAIL:'sandmand097@gmail.com',APP_ORIGIN:'https://mssofia.pages.dev',
 JWT_SECRET:'e'.repeat(96),
 DATABASE_URL:'postgresql://mssofia_backend.jtluslevdmcpxxkngomj:demo-password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
};
const fake=(login='mssofia_backend',approved=true)=>()=>({
 query:async (sql,params)=>{
  assert.match(sql,/current_user/);
  assert.deepEqual(params,['sandmand097@gmail.com']);
  return {rows:[{login,approved}]};
 },
 end:async()=>{}
});
assert.equal(validAdminEnvironment(env),true);
assert.equal(adminConfigurationStatus(env),'CONFIG_READY');
assert.deepEqual(await adminProductionStatus(env,fake()),{ready:true,code:'READY'});
assert.equal(await adminProductionReady(env,fake()),true);
assert.equal((await adminProductionStatus(env,fake('postgres'))).code,'DATABASE_ROLE_MISMATCH');
assert.equal((await adminProductionStatus(env,fake('mssofia_backend',false))).code,'DIRECTOR_ACCOUNT_NOT_APPROVED');
const negatives=[
 [{DATABASE_URL:'postgresql://mssofia_backend.wrong:abc@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'},'DATABASE_URL_WRONG_PROJECT_OR_POOLER'],
 [{DATABASE_URL:'postgresql://mssofia_backend.jtluslevdmcpxxkngomj:abc@localhost:5432/postgres'},'DATABASE_URL_WRONG_PROJECT_OR_POOLER'],
 [{DATABASE_URL:'postgresql://mssofia_backend.jtluslevdmcpxxkngomj:abc@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=disable'},'DATABASE_TLS_DISABLED'],
 [{DATABASE_URL:'postgresql://mssofia_backend.jtluslevdmcpxxkngomj:YOUR_RANDOM_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'},'DATABASE_PASSWORD_MISSING'],
 [{JWT_SECRET:'ANOTHER_RANDOM_SECRET_AT_LEAST_48_CHARACTERS'},'JWT_SECRET_NOT_STRONG_RANDOM_HEX'],
 [{PUBLIC_LAUNCH_MODE:'full'},'MODE_NOT_ADMIN'],
 [{REGISTRATION_ENABLED:'true'},'PUBLIC_REGISTRATION_NOT_LOCKED'],
 [{GOOGLE_ADMIN_LOGIN_ENABLED:'false'},'GOOGLE_ADMIN_CONFIG_INCOMPLETE'],
 [{APP_ORIGIN:'https://attacker.example'},'APP_ORIGIN_MISMATCH'],
 [{GOOGLE_ADMIN_EMAIL:''},'GOOGLE_ADMIN_CONFIG_INCOMPLETE'],
 [{PGSSL:'disable'},'DATABASE_TLS_DISABLED']
];
for(const [overrides,code] of negatives){
 const t={...env,...overrides};
 assert.equal(validAdminEnvironment(t),false);
 assert.equal(adminConfigurationStatus(t),code);
 assert.equal((await adminProductionStatus(t,fake())).code,code);
}
let cleaned=false;
const failing=()=>({query:async()=>{throw new Error('secret=do-not-log')},end:async()=>{cleaned=true}});
assert.deepEqual(await adminProductionStatus(env,failing),{ready:false,code:'DATABASE_TLS_AUTH_OR_NETWORK_FAILED'});
assert.equal(cleaned,true);
console.log('PASS administrator-only readiness checks, fail-closed and sanitized diagnostics');
