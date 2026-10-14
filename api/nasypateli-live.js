import privateHandler from './nasypateli-renderer.js';

export const maxDuration=10;

// The shared renderer remains an authenticated API handler, never a public static asset
// Keep Origin on same-origin browser form navigation; do not accept null origins
export default function handler(req,res){
  const originalSetHeader=res.setHeader;
  res.setHeader=function(name,value){
    const safeValue=String(name).toLowerCase()==='referrer-policy'?'same-origin':value;
    return originalSetHeader.call(this,name,safeValue);
  };
  try{return privateHandler(req,res);}
  finally{res.setHeader=originalSetHeader;}
}
