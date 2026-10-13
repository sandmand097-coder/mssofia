// Lightweight regression guard for the production release boundary.
// This file never contacts providers and never handles real account data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const edge=read('functions/api/[[path]].js');
const backend=read('server/index.js');
const payment=read('server/payment-routes.js');
const renewal=read('server/subscription-renewals.js');
const diagnostics=read('server/deployment-diagnostics.js');
const checkout=read('.github/workflows/cloudflare-pages.yml');
const runbook=read('docs/PRODUCTION-ARCHITECTURE-AND-REFACTOR-PLAN.md');
const proxy=read('server/reverse-proxy.js');

assert.match(edge,/const RENDER_ORIGIN='https:\/\/mssofia\.onrender\.com'/);
assert.match(edge,/headers\.delete\(key\)/,'edge strips user-supplied forwarded header entries');
assert.match(edge,/out\.headers\.set\('cache-control','no-store, private'\)/);
assert.match(backend,/configureReverseProxy\(app\);/);
assert.ok(backend.indexOf('configureReverseProxy(app);')<backend.search(/const authLimiter\s*=\s*rateLimit\s*\(/),'proxy trust configured before rate limiting');
assert.match(proxy,/production\?1:false/,'Render proxy trust limited to one trusted hop');
assert.match(payment,/SCHOOL_REFUND_POLICY_APPROVED==='true'/,'new paid enrollments require owner sign-off');
assert.match(renewal,/SCHOOL_REFUND_POLICY_APPROVED/,'new manual renewals require owner sign-off');
assert.match(payment,/verifyPrivateStorage/,'receipt API requires independent bucket verification');
assert.match(diagnostics,/const VERIFIED_PROJECT='wnkewiulyobbjftckfqb'/,'owner-controlled cutover project pinned');
assert.match(checkout,/run: node scripts\/run-production-risk-probe\.mjs/,'post-deployment GET-only readiness remains required');
assert.match(runbook,/Current deployment map/,'runtime boundaries are documented');
console.log('PASS operational architecture boundaries, exact project, payment sign-off and bounded proxy assertions');
