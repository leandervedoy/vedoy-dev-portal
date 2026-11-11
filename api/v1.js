import { isToolRequest, handleTools } from '../lib/standalone-handler.js';
export default async function handler(req,res){
  if(isToolRequest(req))return handleTools(req,res);
  const {default:legacy}=await import('./[...path].js');
  return legacy(req,res);
}
