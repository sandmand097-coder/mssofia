// Development-only disconnected LiveKit context smoke test. This file is not imported by the production app.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {LiveKitRoom} from '@livekit/components-react';
import {MeetingStudio} from '../components/Classroom.jsx';

export function mountRoomSandbox(lessonId,isHost=true){
 const element=document.createElement('div');
 element.id='mrsofia-room-smoke';
 document.body.appendChild(element);
 const root=createRoot(element);
 root.render(<LiveKitRoom connect={false} audio={false} video={false} token="" serverUrl="">
  <MeetingStudio connection={{lessonId,teacherId:'no-presenter-yet',isHost,role:isHost?'teacher':'student'}} onDisconnected={()=>{}}/>
 </LiveKitRoom>);
 return ()=>{root.unmount();element.remove()};
}
