import { isToolRequest, handleTools } from '../../lib/standalone-handler.js';
export default async function modelsAndPlatformGateway(req,res){
  if(isToolRequest(req))return handleTools(req,res);
  const routed=Array.isArray(req.query?.__vedoy_route)?req.query.__vedoy_route.join('/'):String(req.query?.__vedoy_route||'').trim();
  if(routed){const clean=routed.replace(/^\/+|\/+$/g,'');const params=new URLSearchParams(req.query||{});params.delete('__vedoy_route');req.url=`/api/v1/${clean}${params.size?'?'+params.toString():''}`;}
  const {default:handler}=await import('../[...path].js');
  return handler(req,res);
}
