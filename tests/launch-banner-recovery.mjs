import assert from 'node:assert/strict';
import {launchModeFromHealth} from '../src/launch-mode.js';
import {isPublicBootstrapRoute} from '../src/public-bootstrap.js';

assert.equal(launchModeFromHealth({ok:true,mode:'full',registrationAvailable:true}),'full');
assert.equal(launchModeFromHealth({ok:true,mode:'preview'}),'preview');
assert.equal(launchModeFromHealth({ok:true,mode:'admin'}),'admin');
for(const bad of [{ok:false,mode:'full'}, {ok:true,mode:'not-real'}, {mode:'full'},null,undefined]){
 assert.equal(launchModeFromHealth(bad),'offline','unknown health must fail closed');
}
for(const pathname of ['/','/courses','/courses/','/privacy','/terms']){
 assert.equal(isPublicBootstrapRoute(pathname),true);
}
for(const pathname of ['/login','/register','/verify-email','/student','/admin','/teacher','/lesson/abc','/courses/123','/dashboard']){
 assert.equal(isPublicBootstrapRoute(pathname),false,'private route '+pathname+' must await bootstrap');
}
console.log('PASS strict health/launch mode contract and public/private route isolation');
