// A connected, isolated classroom fixture, unlike RoomSandbox.jsx which uses
// connect={false}. Only invoked by local QA scripts, never by the shipped app.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {LiveKitRoom} from '@livekit/components-react';
import {MeetingStudio} from '../components/Classroom.jsx';

export function mountConnectedRoomSandbox({lessonId,isHost,teacherId,serverUrl,token}){
 const element=document.createElement('div');
 element.id='mssofia-connected-room-fixture';
 document.body.appendChild(element);
 const root=createRoot(element);
 root.render(
  <LiveKitRoom token={token} serverUrl={serverUrl} connect audio={false} video={false}
   options={{adaptiveStream:true,dynacast:true}}>
   <MeetingStudio connection={{
    lessonId,isHost,teacherId,role:isHost?'admin':'student'
   }} onDisconnected={()=>{}} onTimingChange={()=>{}}/>
  </LiveKitRoom>
 );
 return ()=>{root.unmount();element.remove()};
}
