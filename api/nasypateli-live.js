import privateHandler from './nasypateli-renderer.js';
import {applyIdentity} from '../lib/nasypateli-identity.mjs';
import {applyStudio} from '../lib/nasypateli-studio.mjs';

export const maxDuration=10;

// The renderer authenticates first. Presentation transforms cannot grant access.
export default function handler(req,res){
  const originalSetHeader=res.setHeader;
  const originalSend=res.send;
  res.setHeader=function(name,value){
    const safeValue=String(name).toLowerCase()==='referrer-policy'?'same-origin':value;
    return originalSetHeader.call(this,name,safeValue);
  };
  res.send=function(body){return originalSend.call(this,applyStudio(applyIdentity(body)));};
  try{return privateHandler(req,res);}
  finally{res.setHeader=originalSetHeader;res.send=originalSend;}
}
