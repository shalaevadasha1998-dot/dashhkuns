// PNG application icon generated server-side; no external assets or dependencies.
import {deflateSync} from "node:zlib";
export const maxDuration=10;
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0});
function crc32(buf){let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function chunk(type,body){const size=Buffer.alloc(4),name=Buffer.from(type,"ascii"),checksum=Buffer.alloc(4);size.writeUInt32BE(body.length);checksum.writeUInt32BE(crc32(Buffer.concat([name,body])));return Buffer.concat([size,name,body,checksum])}
function makeIcon(size){
 const pixels=Buffer.alloc(size*(size*4+1));
 const r=size/512;
 for(let y=0;y<size;y++){
  const off=y*(size*4+1);pixels[off]=0;
  for(let x=0;x<size;x++){
   const X=(x+.5)/r,Y=(y+.5)/r;
   const cornerX=Math.max(118-X,0,X-(512-118));const cornerY=Math.max(118-Y,0,Y-(512-118));
   const outside=cornerX*cornerX+cornerY*cornerY>118*118;
   let rgba=outside?[0,0,0,0]:[16,16,16,255];
   // bold loop and vertical ascender of a geometric 'd'
   const outer=((X-255)/137)**2+((Y-261)/151)**2<1;
   const inner=((X-255)/65)**2+((Y-261)/77)**2<1;
   const stem=(X>350&&X<405&&Y>103&&Y<405);
   if(!outside&&((outer&&!inner)||stem))rgba=[204,255,0,255];
   if(!outside&&(X-402)**2+(Y-108)**2<32**2)rgba=[255,63,173,255];
   const i=off+1+x*4;pixels[i]=rgba[0];pixels[i+1]=rgba[1];pixels[i+2]=rgba[2];pixels[i+3]=rgba[3];
  }
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ihdr),chunk("IDAT",deflateSync(pixels,{level:9})),chunk("IEND",Buffer.alloc(0))]);
}
export default function handler(req,res){
 if(req.method!=="GET")return res.status(405).end();
 const size=Number(req.query.size);
 if(![180,192,512].includes(size))return res.status(400).end();
 res.setHeader("Content-Type","image/png");res.setHeader("Cache-Control","public, max-age=86400, immutable");res.setHeader("X-Content-Type-Options","nosniff");res.status(200).send(makeIcon(size));
}
