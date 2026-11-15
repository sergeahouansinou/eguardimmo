import { connection } from 'next/server';
import { noStoreHeaders } from '@/server/problem';

export async function GET(): Promise<Response> {
  await connection();
  return new Response(null, { status: 204, headers: noStoreHeaders() });
}
