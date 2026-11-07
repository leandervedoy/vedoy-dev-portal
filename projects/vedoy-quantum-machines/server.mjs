import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname,resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const allow=new Set(['/','/index.html','/app.mjs','/style.css','/src/bb84.mjs','/src/word-otp.mjs']);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};
const port=Number(process.env.PORT||4173);
const host=process.env.HOST||'127.0.0.1';
createServer(async(req,res)=>{
 const name=new URL(req.url||'/', 'http://localhost').pathname;
 if(!allow.has(name)){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not Found');return;}
 const path=resolve(root,name==='/'?'index.html':name.substring(1));
 if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{
  const contents=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'text/plain; charset=utf-8',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
   'Referrer-Policy':'no-referrer',
   'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
  res.end(contents);
 }catch{res.writeHead(404);res.end('Not Found');}
}).listen(port,host,()=>console.log('Vedoy Quantum Machines research lab: http://'+host+':'+port));
