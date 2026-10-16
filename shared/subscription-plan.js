export const FIRST_MONTH_EGP=100;
export const REGULAR_MONTH_EGP=170;
export const SUBSCRIPTION_DAYS=30;

export const isScienceSubject=value=>/(علوم|فيزياء|أحياء|كيمياء|science|physics|biology|chemistry)/i.test(String(value||''));

export const introductoryOfferApplies=course=>
 Number(course?.price)>0&&isScienceSubject(course?.subject);

export const firstPaymentAmount=course=>{
 const price=Number(course?.price||0);
 if(!Number.isFinite(price)||price<=0)return 0;
 return isScienceSubject(course?.subject)?FIRST_MONTH_EGP:price;
};

export const renewalAmount=course=>{
 const price=Number(course?.price||0);
 if(!Number.isFinite(price)||price<=0)return 0;
 return isScienceSubject(course?.subject)?REGULAR_MONTH_EGP:price;
};
