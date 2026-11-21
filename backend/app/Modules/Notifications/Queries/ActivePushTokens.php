<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Notifications\Models\PushToken;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Un jeton d'appareil n'est utilisable que tant que la session mobile qui l'a enregistré existe : déconnexion,
 * révocation d'appareil, changement de mot de passe et expiration suppriment le jeton Sanctum (ADR 0027).
 */
final class ActivePushTokens
{
    /**
     * @return list<PushToken>
     */
    public function for(string $userId): array
    {
        return array_values($this->usable()->where('user_id', $userId)->get()->all());
    }

    /**
     * Jetons non révoqués dont la session mobile a disparu ou expiré.
     *
     * @return Builder<PushToken>
     */
    public function stale(): Builder
    {
        return PushToken::query()
            ->whereNull('revoked_at')
            ->where(fn (Builder $q): Builder => $q
                ->whereNull('access_token_id')
                ->orWhereNotIn('access_token_id', $this->sessions()));
    }

    /**
     * @return Builder<PushToken>
     */
    private function usable(): Builder
    {
        return PushToken::query()
            ->whereNull('revoked_at')
            ->whereNotNull('access_token_id')
            ->whereIn('access_token_id', $this->sessions());
    }

    private function sessions(): \Illuminate\Database\Query\Builder
    {
        return DB::table('personal_access_tokens')
            ->select('id')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }
}
