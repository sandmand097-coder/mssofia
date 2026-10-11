import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isPublicBootstrapRoute} from '../src/public-bootstrap.js';

for (const path of ['/', '/courses', '/privacy', '/terms', '/courses/']) {
 assert.equal(isPublicBootstrapRoute(path),true,'public route '+path);
}
for (const path of ['/login','/register','/admin','/teacher','/student','/dashboard','/lesson/test','/courses/some-course','/reset-password','/foo']) {
 assert.equal(isPublicBootstrapRoute(path),false,'protected or non-static route '+path);
}
assert.equal(isPublicBootstrapRoute(null),false);
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
assert.match(app,/const routeReady=!bootstrapping\|\|isPublicBootstrapRoute\(pathname\)/,'public route bypasses initial backend handshake');
assert.match(app,/<Route path="\/lesson\/:id" element=\{publicOnly\?<PublicUnavailable\/>:<LessonRoom\/>\}/,'lesson protection retained');
assert.match(app,/<Route path="\/dashboard" element=\{publicOnly\?<PublicUnavailable\/>:<RoutePortal\/>\}/,'dashboard protection retained');
console.log('PASS fast public bootstrap route guards');
