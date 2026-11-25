<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Actions\VerifyTwoFactorCode;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use App\Shared\Http\OperatorProof;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Preuve de double authentification à chaque écriture de la console : le code est vérifié puis retiré de la requête,
 * il n'atteint ni la validation, ni les journaux.
 */
final readonly class RequireOperatorProof
{
    public const CHAMP_CODE = 'two_factor_code';

    public const CHAMP_SECOURS = 'recovery_code';

    public function __construct(private VerifyTwoFactorCode $verification) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        $code = $this->lire($request, self::CHAMP_CODE);
        $secours = $this->lire($request, self::CHAMP_SECOURS);

        if ($code === null && $secours === null) {
            throw ErrorCode::OperatorProofRequired->problem();
        }

        if (! $this->verification->handle($user, $code, $secours, enSession: true)) {
            throw ErrorCode::OperatorProofInvalid->problem();
        }

        $request->attributes->set(OperatorProof::ATTRIBUT, $secours !== null ? OperatorProof::RECOVERY_CODE : OperatorProof::TOTP);
        $request->request->remove(self::CHAMP_CODE);
        $request->request->remove(self::CHAMP_SECOURS);
        $request->json()->remove(self::CHAMP_CODE);
        $request->json()->remove(self::CHAMP_SECOURS);

        return $next($request);
    }

    private function lire(Request $request, string $champ): ?string
    {
        $corps = $request->isJson() ? $request->json() : $request->request;
        $valeur = $corps->get($champ);

        if (is_int($valeur)) {
            $valeur = (string) $valeur;
        }

        return is_string($valeur) && trim($valeur) !== '' ? trim($valeur) : null;
    }
}
