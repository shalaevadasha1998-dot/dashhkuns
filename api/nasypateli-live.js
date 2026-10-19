import privateHandler from './nasypateli-renderer.js';
import {applyIdentity} from '../lib/nasypateli-identity.mjs';
import {applyStudio} from '../lib/nasypateli-studio.mjs';
import {applyVoiceReference} from '../lib/nasypateli-voice-reference.mjs';
import {applyAutoLive} from '../lib/nasypateli-auto-live.mjs';

export const maxDuration=10;

// The renderer authenticates first. Presentation transforms cannot grant access.
export default function handler(req,res){
  const originalSetHeader=res.setHeader;
  const originalSend=res.send;
  res.setHeader=function(name,value){
    const key=String(name).toLowerCase();
    let safeValue=key==='referrer-policy'?'same-origin':value;
    // Only local blob playback: no external media host or network upload permission.
    if(key==='content-security-policy')safeValue=String(safeValue).replace("connect-src 'none'","connect-src 'self'")+"; media-src blob:";
    return originalSetHeader.call(this,name,safeValue);
  };
  res.send=function(body){return originalSend.call(this,applyAutoLive(applyVoiceReference(applyStudio(applyIdentity(body)))));};
  try{return privateHandler(req,res);}
  finally{res.setHeader=originalSetHeader;res.send=originalSend;}
}
