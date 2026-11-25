<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

/**
 * Activité d'un compte : sa création, sa dernière connexion, ses jetons d'API et ses sessions web.
 */
final class AccountActivity
{
    /**
     * @return Builder<User> comptes sans aucune activité après cet instant
     */
    public function idleSince(CarbonImmutable $limite): Builder
    {
        return User::query()
            ->where('users.created_at', '<=', $limite)
            ->where(fn (Builder $q): Builder => $q->whereNull('users.last_login_at')->orWhere('users.last_login_at', '<=', $limite))
            ->whereNotExists(fn (QueryBuilder $jetons) => $this->tokens($jetons)
                ->where(fn (QueryBuilder $q) => $q->where('last_used_at', '>', $limite)->orWhere('created_at', '>', $limite)))
            ->whereNotExists(fn (QueryBuilder $sessions) => $this->sessions($sessions)->where('last_activity', '>', $limite->getTimestamp()));
    }

    /**
     * @param  Builder<User>  $comptes
     * @return Builder<User> restreint aux comptes actifs au moins une fois depuis cet instant
     */
    public function seenSince(Builder $comptes, CarbonImmutable $depuis): Builder
    {
        return $comptes->where(fn (Builder $q): Builder => $q
            ->where('users.created_at', '>=', $depuis)
            ->orWhere('users.last_login_at', '>=', $depuis)
            ->orWhereExists(fn (QueryBuilder $jetons) => $this->tokens($jetons)
                ->where(fn (QueryBuilder $t) => $t->where('last_used_at', '>=', $depuis)->orWhere('created_at', '>=', $depuis)))
            ->orWhereExists(fn (QueryBuilder $sessions) => $this->sessions($sessions)->where('last_activity', '>=', $depuis->getTimestamp())));
    }

    /**
     * @param  list<User>  $comptes  avec `created_at` et `last_login_at`
     * @return array<string, CarbonImmutable> dernière activité par compte
     */
    public function lastSeen(array $comptes): array
    {
        $ids = array_map(fn (User $compte): string => $compte->id, $comptes);
        $jetons = DB::table((new PersonalAccessToken)->getTable())->where('tokenable_type', (new User)->getMorphClass())->whereIn('tokenable_id', $ids)
            ->groupBy('tokenable_id')->selectRaw('tokenable_id as compte, max(last_used_at) as utilise, max(created_at) as cree')->get()->keyBy('compte');
        $sessions = DB::table((string) config('session.table', 'sessions'))->whereIn('user_id', $ids)
            ->groupBy('user_id')->selectRaw('user_id as compte, max(last_activity) as vu')->get()->keyBy('compte');
        $dernieres = [];

        foreach ($comptes as $compte) {
            $autres = array_values(array_filter([
                $compte->last_login_at,
                $jetons->get($compte->id)?->utilise,
                $jetons->get($compte->id)?->cree,
            ]));
            $instants = [
                CarbonImmutable::parse($compte->getAttribute('created_at')),
                ...array_map(fn (mixed $date): CarbonImmutable => CarbonImmutable::parse($date), $autres),
            ];

            if (($vu = $sessions->get($compte->id)?->vu) !== null) {
                $instants[] = CarbonImmutable::createFromTimestamp((int) $vu, (string) config('app.timezone'));
            }

            $dernieres[$compte->id] = max($instants);
        }

        return $dernieres;
    }

    private function tokens(QueryBuilder $requete): QueryBuilder
    {
        return $requete->from((new PersonalAccessToken)->getTable())
            ->whereColumn('tokenable_id', 'users.id')
            ->where('tokenable_type', (new User)->getMorphClass());
    }

    private function sessions(QueryBuilder $requete): QueryBuilder
    {
        return $requete->from((string) config('session.table', 'sessions'))->whereColumn('user_id', 'users.id');
    }
}
