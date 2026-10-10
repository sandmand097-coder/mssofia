// Administrators can inspect deployment prerequisites without access to any
// secret value. "Configured" never implies a verified payment or email delivery.
import {googleAdminConfig,googleStudentConfig} from './google-admin-auth.js';
import {schoolContactConfigured} from './school-contact.js';

export function schoolReadiness(env=process.env){
 const admin=googleAdminConfig(env),guardian=googleStudentConfig(env);
 const privacyApproved=env.SCHOOL_PRIVACY_APPROVED==='true';
 const registrationFlag=env.REGISTRATION_ENABLED==='true';
 const ownerContactConfigured=schoolContactConfigured(env);
 const senderConfigured=Boolean(env.MAIL_FROM&&(env.RESEND_API_KEY||env.SMTP_HOST));
 const walletNumberConfigured=/^01[0125]\d{8}$/.test(env.VODAFONE_CASH_NUMBER||'');
 const receiptStorageConfigured=Boolean(
  /^https:\/\/[^/]+\.supabase\.co\/?$/.test(env.SUPABASE_URL||'')&&(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY)
 );
 const livestreamConfigured=Boolean(
  /^wss:\/\/[^/]+\.livekit\.cloud\/?$/i.test(env.LIVEKIT_URL||'')
  &&env.LIVEKIT_API_KEY&&env.LIVEKIT_API_SECRET
 );
 const googleStudentsConfigured=guardian.enabled;
 return{
  launchMode:env.PUBLIC_LAUNCH_MODE||'preview',
  adminGoogleEnabled:admin.enabled,
  studentGoogleEnabled:googleStudentsConfigured,
  studentGoogleRegistrationEnabled:guardian.registrationEnabled,
  passwordEmailSignupEnabled:senderConfigured&&privacyApproved&&registrationFlag&&ownerContactConfigured,
  guardianPrivacyApproved:privacyApproved,
  registrationAllowedBySchool:registrationFlag,
  schoolContactConfigured:ownerContactConfigured,
  outboundMailConfigured:senderConfigured,
  paymentWalletConfigured:walletNumberConfigured,
  privateReceiptStorageConfigured:receiptStorageConfigured,
  paymentUploadConfigured:walletNumberConfigured&&receiptStorageConfigured,
  livekitCredentialsConfigured:livestreamConfigured,
  // These flags describe activation, not evidence of a successful real payment.
  monthlyRenewalsEnabled:env.MONTHLY_RENEWALS_ENABLED==='true',
  classroomQuestionsEnabled:env.CLASSROOM_QA_ENABLED==='true'
 };
}
