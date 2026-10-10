import assert from 'node:assert/strict';
import {schoolReadiness} from '../server/release-readiness.js';

const env={
 NODE_ENV:'production',PUBLIC_LAUNCH_MODE:'admin',APP_ORIGIN:'https://mssofia.pages.dev',
 GOOGLE_ADMIN_LOGIN_ENABLED:'true',GOOGLE_STUDENT_LOGIN_ENABLED:'true',
 GOOGLE_OAUTH_CLIENT_ID:'12345-test.apps.googleusercontent.com',GOOGLE_ADMIN_EMAIL:'director@example.com',
 REGISTRATION_ENABLED:'false',SCHOOL_PRIVACY_APPROVED:'false',
 SCHOOL_CONTACT_EMAIL:'school@example.com',
 LIVEKIT_URL:'wss://test.livekit.cloud',LIVEKIT_API_KEY:'mock',LIVEKIT_API_SECRET:'mock',
 VODAFONE_CASH_NUMBER:'01012345678',
 SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'mock'
};
let status=schoolReadiness(env);
assert.equal(status.adminGoogleEnabled,true);
assert.equal(status.studentGoogleEnabled,false,'admin-only denies Google students');
assert.equal(status.studentGoogleRegistrationEnabled,false);
assert.equal(status.guardianPrivacyApproved,false);
assert.equal(status.registrationAllowedBySchool,false);
assert.equal(status.paymentUploadConfigured,true,'only reports storage configuration');
assert.equal(status.livekitCredentialsConfigured,true,'only reports LiveKit config');
status=schoolReadiness({...env,PUBLIC_LAUNCH_MODE:'full'});
assert.equal(status.studentGoogleEnabled,true);
assert.equal(status.studentGoogleRegistrationEnabled,false,'legal and launch flags still block new students');
status=schoolReadiness({...env,PUBLIC_LAUNCH_MODE:'full',REGISTRATION_ENABLED:'true',SCHOOL_PRIVACY_APPROVED:'true'});
assert.equal(status.studentGoogleRegistrationEnabled,true,'guardian pathway can be enabled after approval');
assert.equal(status.outboundMailConfigured,false,'Google registration does not assert email sender verified');
assert.equal(status.passwordEmailSignupEnabled,false,'password enrollment remains closed without sender');
status=schoolReadiness({...env,PUBLIC_LAUNCH_MODE:'full',REGISTRATION_ENABLED:'true',SCHOOL_PRIVACY_APPROVED:'true',RESEND_API_KEY:'mock',MAIL_FROM:'school@example.com'});
assert.equal(status.passwordEmailSignupEnabled,true,'email signup is separately configured');
status=schoolReadiness({...env,GOOGLE_ADMIN_LOGIN_ENABLED:'false',GOOGLE_STUDENT_LOGIN_ENABLED:'false',VODAFONE_CASH_NUMBER:'bad',SUPABASE_SERVICE_ROLE_KEY:''});
assert.equal(status.adminGoogleEnabled,false);
assert.equal(status.studentGoogleEnabled,false);
assert.equal(status.paymentUploadConfigured,false);
status=schoolReadiness({...env,SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'sb_secret_mock-secret'});
assert.equal(status.privateReceiptStorageConfigured,true,'modern server secret keys supported');
assert.ok(!Object.keys(status).some(key=>/secret|apiKey|token|serviceRole|databaseUrl|connectionString/i.test(key)),'no secrets or contact details leaked in readiness output');
console.log('PASS administrator deployment readiness flags and no-secret responses');
