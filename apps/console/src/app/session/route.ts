import { handleLogin, handleLogout } from '@/server/login';

export function POST(request: Request): Promise<Response> {
  return handleLogin(request);
}

export function DELETE(request: Request): Promise<Response> {
  return handleLogout(request);
}
