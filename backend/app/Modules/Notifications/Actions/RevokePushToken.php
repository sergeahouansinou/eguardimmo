<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\PushToken;
use Illuminate\Support\Str;

final readonly class RevokePushToken
{
    public function __construct(private RevokePushTokens $revocation) {}

    /**
     * Rejouable. Seul le propriétaire révoque son appareil ; l'appareil d'un autre compte répond la même 404 qu'un appareil inconnu.
     */
    public function handle(string $userId, string $tokenId): void
    {
        $existe = Str::isUuid($tokenId) && PushToken::query()->where('user_id', $userId)->whereKey($tokenId)->exists();

        if (! $existe) {
            throw ErrorCode::PushTokenNotFound->problem();
        }

        $this->revocation->handle(PushToken::query()->where('user_id', $userId)->whereKey($tokenId));
    }
}
