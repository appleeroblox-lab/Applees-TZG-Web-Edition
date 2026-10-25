import { env } from 'cloudflare:workers';
import { debugRequest } from '../../../../server/debug-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return debugRequest(request,env)}
export async function POST(request:Request){return debugRequest(request,env)}
