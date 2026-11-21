<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Middleware;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Support\CampaignAccess;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Les diffusions de l'organisation courante sont réservées à `owner`, `admin` et `manager` : 403 pour tout autre rôle, comptable compris.
 */
final readonly class EnsureCampaignManager
{
    public function __construct(private CampaignAccess $acces) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        $this->acces->assertManager($user);

        return $next($request);
    }
}
