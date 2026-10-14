import privateHandler from './nasypateli-renderer.js';
import {applyIdentity} from '../lib/nasypateli-identity.mjs';

export const maxDuration=10;

// Access checks and session cookies remain in the existing authenticated renderer.
// Only its permitted HTML response is restyled. Keep same-origin form navigation.
export default function handler(req,res){
  const originalSetHeader=res.setHeader;
  const originalSend=res.send;
  res.setHeader=function(name,value){
    const safeValue=String(name).toLowerCase()==='referrer-policy'?'same-origin':value;
    return originalSetHeader.call(this,name,safeValue);
  };
  res.send=function(body){return originalSend.call(this,applyIdentity(body));};
  try{return privateHandler(req,res);}
  finally{res.setHeader=originalSetHeader;res.send=originalSend;}
}
