import assert from 'node:assert/strict';
import {googleAdminConfig,eligibleGoogleAdmin} from '../server/google-admin-auth.js';

let count=0;
const check=(value,label)=>{assert.ok(value,label);count++;console.log('PASS '+label)};
const allowed='director@example.com';
const env={
 GOOGLE_OAUTH_CLIENT_ID:'1234567-abcdefgh.apps.googleusercontent.com',
 GOOGLE_ADMIN_EMAIL:allowed,
 GOOGLE_ADMIN_LOGIN_ENABLED:'true',
 APP_ORIGIN:'https://mssofia.onrender.com',
 NODE_ENV:'production'
};
const admin={id:'one',email:allowed,role:'admin',status:'active',google_sub:null};
const payload={iss:'https://accounts.google.com',sub:'google-sub-123',email:allowed,email_verified:true};
check(!googleAdminConfig({}).enabled,'Google SSO stays off by default');
check(googleAdminConfig(env).enabled,'fully configured Google SSO can be enabled');
check(!googleAdminConfig({...env,GOOGLE_ADMIN_LOGIN_ENABLED:'false'}).enabled,'feature flag disables Google SSO');
check(!googleAdminConfig({...env,GOOGLE_OAUTH_CLIENT_ID:'attacker-client'}).enabled,'client ID validated');
check(!googleAdminConfig({...env,GOOGLE_ADMIN_EMAIL:'invalid'}).enabled,'allowlisted Gmail must be a real email address');
check(!googleAdminConfig({...env,APP_ORIGIN:'http://wrong.example.com'}).enabled,'production Google SSO requires HTTPS');
check(eligibleGoogleAdmin(payload,admin,allowed),'preapproved director with verified Google identity is accepted');
check(eligibleGoogleAdmin({...payload,email:'DIRECTOR@example.com'},admin,allowed),'email matching is case-insensitive');
check(!eligibleGoogleAdmin({...payload,email_verified:false},admin,allowed),'unverified Google email rejected');
check(!eligibleGoogleAdmin({...payload,iss:'https://evil.example.com'},admin,allowed),'forged issuer rejected');
check(!eligibleGoogleAdmin({...payload,sub:''},admin,allowed),'missing immutable Google subject rejected');
check(!eligibleGoogleAdmin({...payload,email:'other@example.com'},admin,allowed),'different Google email rejected');
check(!eligibleGoogleAdmin(payload,{...admin,role:'student'},allowed),'student never becomes administrator');
check(!eligibleGoogleAdmin(payload,{...admin,role:'teacher'},allowed),'teacher never becomes administrator');
check(!eligibleGoogleAdmin(payload,{...admin,status:'blocked'},allowed),'blocked administrator cannot log in');
check(!eligibleGoogleAdmin(payload,{...admin,google_sub:'previous-google-sub'},allowed),'different Google subject rejected after binding');
check(eligibleGoogleAdmin(payload,{...admin,google_sub:'google-sub-123'},allowed),'existing Google binding remains usable');
check(!eligibleGoogleAdmin(payload,null,allowed),'unknown email cannot self-register as administrator');
check(!eligibleGoogleAdmin(payload,{...admin,email:'another@example.com'},allowed),'database admin email must match allowlist');
check(!eligibleGoogleAdmin(payload,admin,'another@example.com'),'outside configured admin email denied');
console.log('RESULT '+count+' Google admin identity and default-deny checks passed');
