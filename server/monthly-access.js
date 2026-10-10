// A paid course includes thirty days of live lessons after the administrator
// confirms actual receipt of funds. Paid booking status alone is insufficient.
// This uses the already-deployed payment approval record; no schema mutation.
// A subsequent paid month requires an auditable renewal workflow (not enabled yet).
export const PAID_ACCESS_DAYS=30;
const DURATION=PAID_ACCESS_DAYS*24*60*60*1000;

export function evaluateMonthlyAccess(record,current=Date.now()){
 const bookingStatus=record?.booking_status??record?.status;
 const price=Number(record?.course_price??record?.price??0);
 const pending={active:false,kind:'pending',expiresAt:null,daysRemaining:0};
 if(!record||bookingStatus!=='approved')return pending;
 if(!Number.isFinite(price)||price<0)return {...pending,kind:'invalid'};
 if(price===0)return {active:true,kind:'free',expiresAt:null,daysRemaining:null};
 const status=record.payment_status;
 const confirmed=record.confirmed_on_phone===true||record.confirmed_on_phone===1||record.confirmed_on_phone==='1';
 if(status!=='approved'||!confirmed)return {...pending,kind:'payment_required'};
 const approvedAt=record.payment_reviewed_at??record.reviewed_at;
 const when=Date.parse(approvedAt||'');
 if(!Number.isFinite(when)||when>current)return {...pending,kind:'payment_required'};
 const expiry=when+DURATION;
 if(current>=expiry)return {active:false,kind:'expired',expiresAt:new Date(expiry).toISOString(),daysRemaining:0};
 return {active:true,kind:'monthly',expiresAt:new Date(expiry).toISOString(),daysRemaining:Math.ceil((expiry-current)/86400000)};
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
  "SELECT b.status AS booking_status,c.price AS course_price,p.status AS payment_status,p.reviewed_at AS payment_reviewed_at,p.confirmed_on_phone FROM bookings b JOIN courses c ON c.id=b.course_id LEFT JOIN payment_submissions p ON p.booking_id=b.id WHERE b.course_id=? AND b.status='approved'",
  courseId
 );
 return members.reduce((n,row)=>n+(evaluateMonthlyAccess(row,current).active?1:0),0);
}
