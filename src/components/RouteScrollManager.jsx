import {useLayoutEffect} from 'react';
import {useLocation} from 'react-router-dom';

// Browser scroll restoration is disabled before React mounts in main.jsx.
// Each new page starts at its heading; deliberate /#section links still work
// when a lazily loaded page has not rendered the target section yet.
export default function RouteScrollManager(){
 const {pathname,hash}=useLocation();
 useLayoutEffect(()=>{
  const timers=[];
  const toTop=()=>window.scrollTo({top:0,left:0,behavior:'instant'});
  if(!hash){
   toTop();
   return;
  }
  let id;
  try{id=decodeURIComponent(hash.slice(1))}catch{id=hash.slice(1)}
  const toAnchor=()=>{
   const element=id?document.getElementById(id):null;
   if(!element)return false;
   element.scrollIntoView({block:'start',behavior:'instant'});
   return true;
  };
  if(!toAnchor()){
   toTop();
   // Allow the lazy home/guide content to render before following /#method,
   // /#about and other section URLs. No continuous polling or timers remain.
   for(const delay of [60,180,420,900,1500])
    timers.push(setTimeout(()=>{toAnchor()},delay));
  }
  return()=>{for(const timer of timers)clearTimeout(timer)};
 },[pathname,hash]);
 return null;
}
