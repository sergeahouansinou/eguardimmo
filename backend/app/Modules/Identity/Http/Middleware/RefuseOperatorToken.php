<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Actions\IssueConsoleToken;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RefuseOperatorToken
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && self::porteLaCapaciteOperateur($user)) {
            throw ErrorCode::OperatorTokenForbidden->problem();
        }

        return $next($request);
    }

    public static function porteLaCapaciteOperateur(User $user): bool
    {
        $jeton = $user->currentAccessToken();

        return $jeton instanceof PersonalAccessToken
            && is_array($jeton->abilities)
            && in_array(IssueConsoleToken::CAPACITE, $jeton->abilities, true);
    }
}
