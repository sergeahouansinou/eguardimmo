<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Request;

final readonly class IssueMobileToken
{
    public const CAPACITE = 'mobile';

    public function __construct(
        private RecordDeviceLogin $appareils,
        private RecordSuccessfulLogin $derniereConnexion,
        private RecordAudit $audit,
        private Request $request,
    ) {}

    public function handle(User $user, string $nomAppareil): string
    {
        $minutes = config('sanctum.expiration');
        $expiration = is_int($minutes) ? now()->addMinutes($minutes) : null;

        $jeton = $user->createToken($nomAppareil, [self::CAPACITE], $expiration);

        $this->derniereConnexion->handle($user);
        $this->appareils->handle($user, 'mobile|'.$nomAppareil.'|'.$this->request->userAgent(), $nomAppareil);
        $this->audit->handle('auth.token.issued', $user->id, ['channel' => 'mobile', 'token_id' => $jeton->accessToken->id]);

        return $jeton->plainTextToken;
    }
}
