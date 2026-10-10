import assert from 'node:assert/strict';
import {schoolContactConfigured,guardianRegistrationReleaseReady} from '../server/school-contact.js';
import {googleStudentConfig,googleAdminConfig} from '../server/google-admin-auth.js';
import {schoolReadiness} from '../server/release-readiness.js';

const config={
 NODE_ENV:'production',PUBLIC_LAUNCH_MODE:'full',
 APP_ORIGIN:'https://mssofia.pages.dev',
 GOOGLE_OAUTH_CLIENT_ID:'123-test.apps.googleusercontent.com',
 GOOGLE_ADMIN_LOGIN_ENABLED:'true',GOOGLE_ADMIN_EMAIL:'director@example.com',
 GOOGLE_STUDENT_LOGIN_ENABLED:'true',
 REGISTRATION_ENABLED:'true',SCHOOL_PRIVACY_APPROVED:'true',
 SCHOOL_SUPPORT_PHONE:'01027661546'
};
let n=0;
const check=(condition,label)=>{assert.ok(condition,label);n++};
check(schoolContactConfigured(config),'public school support phone qualifies as reachable contact');
check(guardianRegistrationReleaseReady(config),'guardian release requires explicit school privacy release and public contact');
check(googleStudentConfig(config).registrationEnabled,'Google-managed student sign-up can open without email delivery');
check(googleAdminConfig(config).enabled,'existing director retains Google sign-in');
check(schoolReadiness(config).outboundMailConfigured===false,'email-only account creation remains unavailable');
check(schoolReadiness(config).paymentUploadConfigured===false,'no private payment proof store cannot open payments');
check(schoolReadiness(config).studentGoogleRegistrationEnabled===true,'admin can view enabled student status');
check(!googleStudentConfig({...config,SCHOOL_PRIVACY_APPROVED:'false'}).registrationEnabled,'privacy not approved blocks child accounts');
check(!googleStudentConfig({...config,REGISTRATION_ENABLED:'false'}).registrationEnabled,'school can instantly disable public registration');
check(!googleStudentConfig({...config,SCHOOL_SUPPORT_PHONE:'',SCHOOL_CONTACT_EMAIL:''}).registrationEnabled,'no contact means no registration');
check(!schoolContactConfigured({...config,SCHOOL_SUPPORT_PHONE:'011123'}),'invalid support phone rejected');
check(schoolContactConfigured({...config,SCHOOL_SUPPORT_PHONE:'',SCHOOL_CONTACT_EMAIL:'help@example.com'}),'verified school contact email remains supported');
check(!googleStudentConfig({...config,PUBLIC_LAUNCH_MODE:'admin'}).enabled,'admin preparation mode still forbids student registration');
check(!googleStudentConfig({...config,GOOGLE_STUDENT_LOGIN_ENABLED:'false'}).enabled,'Google student flag defaults deny');
check(!googleStudentConfig({...config,APP_ORIGIN:'http://insecure.test'}).enabled,'production student Google login must use HTTPS');
check(!googleStudentConfig({...config,GOOGLE_OAUTH_CLIENT_ID:'malformed'}).enabled,'malformed client ID blocks registration');
console.log('PASS '+n+' Google guardian registration release and payment separation checks');
