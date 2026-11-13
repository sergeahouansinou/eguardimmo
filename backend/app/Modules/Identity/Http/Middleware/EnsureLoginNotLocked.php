<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AccountLockout;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final readonly class EnsureLoginNotLocked
{
    public function __construct(private AccountLockout $lockout) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $id = $request->hasSession() ? $request->session()->get('login.id') : null;
        $user = is_string($id) ? User::query()->find($id) : null;

        if ($user !== null) {
            $this->lockout->ensureNotLocked($user->email);
        }

        return $next($request);
    }
}
