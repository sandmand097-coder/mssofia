import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
 plugins:[react()],
 server:{
  port:5173,
  strictPort:true,
  proxy:{'/api':'http://127.0.0.1:4010'}
 },
 build:{
  rollupOptions:{
   output:{
    manualChunks(id){
     const file=id.replaceAll('\\','/');
     if(!file.includes('/node_modules/'))return;
     if(file.includes('/node_modules/react-dom/')||file.includes('/node_modules/scheduler/'))return 'react-dom-vendor';
     if(file.includes('/node_modules/react/'))return 'react-vendor';
     if(file.includes('/node_modules/react-router/')||file.includes('/node_modules/react-router-dom/'))return 'router-vendor';
     if(file.includes('/node_modules/lucide-react/'))return 'icons-vendor';
     if(file.includes('/node_modules/livekit-client/'))return 'livekit-client-vendor';
     if(file.includes('/node_modules/@livekit/components-react/'))return 'livekit-ui-vendor';
     if(file.includes('/node_modules/@livekit/'))return 'livekit-sdk-vendor';
    }
   }
  }
 }
});
