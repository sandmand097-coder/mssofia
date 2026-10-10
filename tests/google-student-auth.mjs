import assert from 'node:assert/strict';
import {googleStudentConfig,eligibleGoogleStudent,resolveGoogleStudent} from '../server/google-admin-auth.js';

const base={
 NODE_ENV:'production',PUBLIC_LAUNCH_MODE:'full',
 APP_ORIGIN:'https://mssofia.pages.dev',
 GOOGLE_OAUTH_CLIENT_ID:'12345-test.apps.googleusercontent.com',
 GOOGLE_ADMIN_EMAIL:'director@example.com',
 GOOGLE_ADMIN_LOGIN_ENABLED:'true',GOOGLE_STUDENT_LOGIN_ENABLED:'true',
 REGISTRATION_ENABLED:'true',SCHOOL_PRIVACY_APPROVED:'true',
 SCHOOL_CONTACT_EMAIL:'support@school.example'
};
const profile={iss:'https://accounts.google.com',sub:'parent-google-sub',email:'parent@example.com',email_verified:true};
let checks=0;
const check=(ok,message)=>{assert.ok(ok,message);checks++};
check(!googleStudentConfig({}).enabled,'student Google sign-in off by default');
check(!googleStudentConfig({...base,PUBLIC_LAUNCH_MODE:'admin'}).enabled,'admin-only phase excludes student Google');
check(!googleStudentConfig({...base,GOOGLE_STUDENT_LOGIN_ENABLED:'false'}).enabled,'independent student flag respected');
check(googleStudentConfig(base).registrationEnabled,'approved, opted-in guardian registration available');
check(!googleStudentConfig({...base,REGISTRATION_ENABLED:'false'}).registrationEnabled,'closed enrollment prevents Google sign-up');
check(!googleStudentConfig({...base,SCHOOL_PRIVACY_APPROVED:'false'}).registrationEnabled,'unapproved privacy policy blocks enrollment');
check(!googleStudentConfig({...base,SCHOOL_CONTACT_EMAIL:''}).registrationEnabled,'contact email required');
check(!googleStudentConfig({...base,APP_ORIGIN:'http://insecure.example'}).enabled,'HTTPS required in production');
const created=[];
const db={row:null};
const store={
 get:async(sql,email)=>{assert.ok(/SELECT \* FROM users WHERE email=\?/.test(sql));check(email==='parent@example.com','Google parent email used for lookup');return db.row},
 run:async(sql,...params)=>{
  if(sql.startsWith('INSERT OR IGNORE INTO users')){
   const [id,name,email,password_hash,role,status,specialty,created_at,guardian_email,guardian_consent_at,email_verified_at,google_sub]=params;
   check(role==='student'&&status==='active','only active student role can be provisioned');
   check(password_hash.length>=59&&!password_hash.includes('parent-google-sub'),'random unguessable hash stored rather than known password');
   check(email===profile.email&&guardian_email===profile.email,'guardian verified email is account identity');
   check(Boolean(guardian_consent_at&&email_verified_at),'guardian consent and verified email recorded');
   db.row={id,name,email,password_hash,role,status,specialty,created_at,guardian_email,guardian_consent_at,email_verified_at,google_sub,session_version:0};
   created.push(db.row);
   return{changes:1};
  }
  if(sql.startsWith('UPDATE users SET google_sub=')){
   const [sub,id,again]=params;
   if(!db.row||db.row.id!==id||db.row.google_sub&&db.row.google_sub!==sub)return{changes:0};
   db.row.google_sub=sub;return{changes:1};
  }
  throw Error('Unexpected SQL operation');
 },
 uid:()=>'user-1',now:()=>'2026-10-10T10:00:00.000Z',env:base
};
const registration={register_student:true,student_name:'طالب العلوم',guardian_consent:true};
const invalid=[
 [{...profile,email_verified:false},registration],
 [{...profile,iss:'https://evil.example'},registration],
 [{...profile,sub:''},registration],
 [{...profile,email:''},registration],
 [{...profile,email:'director@example.com'},registration]
];
for(const [candidate,input]of invalid){
 const result=await resolveGoogleStudent(candidate,input,store);
 check(result.status===403,'unauthenticated or privileged Google identity rejected');
}
check(created.length===0,'invalid identities created no database records');
for(const attempt of [
 {register_student:false,student_name:'طالب',guardian_consent:true},
 {register_student:true,student_name:'طالب',guardian_consent:false},
 {register_student:true,student_name:'',guardian_consent:true},
 {register_student:true,student_name:'a',guardian_consent:true},
 {register_student:true,student_name:'x'.repeat(81),guardian_consent:true}
]){
 const result=await resolveGoogleStudent(profile,attempt,store);
 check(result.status===400,'explicit valid guardian consent and student name required');
}
check(created.length===0,'invalid registration inputs never create an account');
const closed=await resolveGoogleStudent(profile,registration,{...store,env:{...base,REGISTRATION_ENABLED:'false'}});
check(closed.status===503&&created.length===0,'closed registration cannot be bypassed by verified Google');
const accepted=await resolveGoogleStudent(profile,registration,store);
check(accepted.status===200&&accepted.user.role==='student','verified guardian may register a student');
check(created.length===1,'exactly one student created');
check(eligibleGoogleStudent(profile,db.row),'guardian Google account can sign in after approval');
check(!eligibleGoogleStudent({...profile,sub:'other-sub'},db.row),'different immutable Google subject denied');
check(!eligibleGoogleStudent({...profile,email:'other@example.com'},db.row),'different guardian email denied');
check(!eligibleGoogleStudent(profile,{...db.row,role:'admin'}),'student auth cannot inherit admin role');
check(!eligibleGoogleStudent(profile,{...db.row,status:'blocked'}),'blocked student denied');
check(!eligibleGoogleStudent(profile,{...db.row,guardian_consent_at:null}),'missing guardian attestation denied');
check(!eligibleGoogleStudent(profile,{...db.row,email_verified_at:null}),'missing identity verification denied');
const again=await resolveGoogleStudent(profile,{},store);
check(again.status===200&&created.length===1,'known guardian logs in without another signup');
const switched=await resolveGoogleStudent({...profile,sub:'other-sub'},registration,store);
check(switched.status===403,'Google subject replacement rejected');
db.row={...db.row,role:'teacher',google_sub:null};
const elevated=await resolveGoogleStudent(profile,registration,store);
check(elevated.status===403,'existing teacher cannot be converted to student');
db.row=null;
const notRegistered=await resolveGoogleStudent(profile,{},store);
check(notRegistered.status===400,'unknown Google account cannot auto-register without consent');
console.log('RESULT '+checks+' Google guardian and student authorization checks passed');
