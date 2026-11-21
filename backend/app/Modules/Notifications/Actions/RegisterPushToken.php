<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\NewPushTokenData;
use App\Modules\Notifications\Models\PushToken;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class RegisterPushToken
{
    public function __construct(private RevokePushTokens $revocation) {}

    /**
     * Rejouable. Un jeton d'appareil n'appartient qu'à un compte : s'il passe à un autre, il lui est retiré. Un seul jeton
     * actif par session mobile : l'ancien (rotation du jeton FCM) est révoqué.
     */
    public function handle(NewPushTokenData $donnees): PushToken
    {
        try {
            return DB::transaction(fn (): PushToken => $this->register($donnees));
        } catch (UniqueConstraintViolationException) {
            return DB::transaction(fn (): PushToken => $this->register($donnees));
        }
    }

    private function register(NewPushTokenData $donnees): PushToken
    {
        $empreinte = PushToken::hash($donnees->token);
        $existant = PushToken::query()->where('token_hash', $empreinte)->lockForUpdate()->first();

        $attributs = [
            'user_id' => $donnees->userId,
            'access_token_id' => $donnees->accessTokenId,
            'platform' => $donnees->platform,
            'token' => $donnees->token,
            'device_name' => $donnees->deviceName,
            'revoked_at' => null,
        ];

        $jeton = $existant ?? new PushToken(['token_hash' => $empreinte]);
        $jeton->fill($attributs)->save();

        if ($donnees->accessTokenId !== null) {
            $this->revocation->handle(PushToken::query()
                ->where('user_id', $donnees->userId)
                ->where('access_token_id', $donnees->accessTokenId)
                ->whereKeyNot($jeton->id));
        }

        return $jeton;
    }
}
