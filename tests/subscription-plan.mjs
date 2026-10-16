import assert from 'node:assert/strict';
import {
 FIRST_MONTH_EGP,REGULAR_MONTH_EGP,SUBSCRIPTION_DAYS,
 introductoryOfferApplies,firstPaymentAmount,renewalAmount
} from '../shared/subscription-plan.js';

assert.equal(FIRST_MONTH_EGP,100,'first month price');
assert.equal(REGULAR_MONTH_EGP,170,'renewal price');
assert.equal(SUBSCRIPTION_DAYS,30,'subscription period');
const science={subject:'علوم',price:170};
assert.equal(introductoryOfferApplies(science),true,'paid science course receives introductory all-access offer');
assert.equal(firstPaymentAmount(science),100,'science first payment uses shared introductory price');
assert.equal(renewalAmount(science),170,'science renewal uses shared regular price');
assert.equal(firstPaymentAmount({subject:'علوم',price:0}),0,'free science course is not charged');
assert.equal(introductoryOfferApplies({subject:'علوم',price:0}),false,'free course is not an introductory paid subscription');
assert.equal(firstPaymentAmount({subject:'لغة إنجليزية',price:220}),220,'non-science paid course preserves its configured first price');
assert.equal(renewalAmount({subject:'لغة إنجليزية',price:220}),220,'non-science paid course preserves renewal price');
console.log('PASS shared subscription pricing is consistent across first payment, renewal and UI eligibility');
