// Verified 30-day course entitlements. The original approval is immutable;
// subsequent approved payments can extend access through an append-only ledger.
export const PAID_ACCESS_DAYS=30;
export const PAID_ACCESS_MS=PAID_ACCESS_DAYS*24*60*60*1000;
export const renewalsEnabled=()=>process.env.MONTHLY_RENEWALS_ENABLED==='true';

// Explicitly gated until the non-destructive PostgreSQL migration has been
// applied. No production query references the new table by default.
export const renewalEndSelect=(bookingAlias='b')=>{
 if(!/^[a-z][a-z0-9_]*$/i.test(bookingAlias))throw Error('Unsafe booking alias');
 return renewalsEnabled()
  ? `(SELECT MAX(sr.period_end) FROM subscription_renewals sr WHERE sr.booking_id=${bookingAlias}.id AND sr.status='approved' AND sr.confirmed_on_phone=TRUE) AS renewal_end`
  : 'NULL AS renewal_end';
};

export function evaluateMonthlyAccess(record,current=Date.now()){
 const bookingStatus=record?.booking_status??record?.status;
 const price=Number(record?.course_price??record?.price??0);
 const pending={active:false,kind:'pending',expiresAt:null,daysRemaining:0};
 if(!record||bookingStatus!=='approved')return pending;
 if(!Number.isFinite(price)||price<0)return {...pending,kind:'invalid'};
 if(price===0)return {active:true,kind:'free',expiresAt:null,daysRemaining:null};
 const confirmed=record.confirmed_on_phone===true||record.confirmed_on_phone===1||record.confirmed_on_phone==='1';
 if(record.payment_status!=='approved'||!confirmed)return {...pending,kind:'payment_required'};
 const approvedAt=Date.parse(record.payment_reviewed_at??record.reviewed_at??'');
 if(!Number.isFinite(approvedAt)||approvedAt>current)return {...pending,kind:'payment_required'};
 const originalExpiry=approvedAt+PAID_ACCESS_MS;
 const lastRenewalEnd=Date.parse(record.renewal_end||'');
 const expiry=Number.isFinite(lastRenewalEnd)&&lastRenewalEnd>originalExpiry?lastRenewalEnd:originalExpiry;
 if(current>=expiry)return {active:false,kind:'expired',expiresAt:new Date(expiry).toISOString(),daysRemaining:0};
 return {
  active:true,kind:'monthly',expiresAt:new Date(expiry).toISOString(),
  daysRemaining:Math.ceil((expiry-current)/86400000)
 };
}

export function accessView(row,current=Date.now()){
 const entitlement=evaluateMonthlyAccess(row,current);
 return {
  live_access_active:entitlement.active,
  live_access_status:entitlement.kind,
  live_access_expires_at:entitlement.expiresAt,
  live_access_days_remaining:entitlement.daysRemaining
 };
}

export async function countCurrentMembers(all,courseId,current=Date.now()){
 const members=await all(
  `SELECT b.status AS booking_status,c.price AS course_price,p.status AS payment_status,
  p.reviewed_at AS payment_reviewed_at,p.confirmed_on_phone,${renewalEndSelect('b')}
  FROM bookings b JOIN courses c ON c.id=b.course_id
  LEFT JOIN payment_submissions p ON p.booking_id=b.id
  WHERE b.course_id=? AND b.status='approved'`,
  courseId
 );
 return members.reduce((n,row)=>n+(evaluateMonthlyAccess(row,current).active?1:0),0);
}
