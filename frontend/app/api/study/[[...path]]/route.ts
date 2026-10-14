import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {handle} from '@/server/application';
export const dynamic='force-dynamic';
async function route(request:Request){const user=await getChatGPTUser();return handle(request,env,user?{id:user.userId,name:user.displayName}:null)}
export const GET=route;export const POST=route;export const PATCH=route;export const DELETE=route;
