<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AbsoluteSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

final readonly class EnforceAbsoluteSession
{
    public function __construct(private AbsoluteSession $session) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->hasSession()) {
            return $next($request);
        }

        $garde = Auth::guard('web');
        $user = $garde->user();

        if ($user instanceof User && ! $request->session()->has(AbsoluteSession::CLE)) {
            $this->session->start($request->session(), $user);
        }

        if ($user !== null && $this->session->expired($request->session())) {
            $garde->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            // Le garde sanctum a déjà mis l'utilisateur en cache via AuthenticateSession : sans cela, auth:sanctum le laisserait passer.
            Auth::forgetGuards();
        }

        return $next($request);
    }
}
