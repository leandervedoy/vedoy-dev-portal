import { createServer } from 'node:http';
import { handleTools,isToolRequest } from './standalone-handler.js';
const port=Number(process.env.PORT||8787);
createServer((req,res)=>{if(isToolRequest(req))return handleTools(req,res);res.statusCode=404;res.end('Not found');}).listen(port,'127.0.0.1',()=>console.log(`Vedoy Tools: http://127.0.0.1:${port}/api/v1/tools`));
