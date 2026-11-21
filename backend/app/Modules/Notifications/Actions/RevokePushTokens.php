<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Models\PushToken;
use Illuminate\Database\Eloquent\Builder;

final readonly class RevokePushTokens
{
    /**
     * Révoque et efface la valeur chiffrée ; la ligne reste (traçabilité), rien d'autre ne l'utilise plus.
     *
     * @param  Builder<PushToken>  $jetons
     */
    public function handle(Builder $jetons): int
    {
        return $jetons->whereNull('revoked_at')->update(['revoked_at' => now(), 'token' => null]);
    }
}
