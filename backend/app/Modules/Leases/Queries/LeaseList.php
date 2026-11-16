<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeasePhase;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Support\LeaseOccupancy;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;

final readonly class LeaseList
{
    /**
     * @return CursorPaginator<int, Lease>
     */
    public function list(LeaseFilters $filtres, int $parPage, CarbonInterface $today): CursorPaginator
    {
        $jour = $today->toDateString();

        return Lease::query()
            ->with([
                'units' => fn ($q) => $q->where('is_main', true)->orderBy('valid_from')->orderBy('id'),
                'parties' => fn ($q) => $q->where('role', LeasePartyRole::Tenant->value)->orderBy('valid_from')->orderBy('id'),
            ])
            ->when($filtres->archived, fn (Builder $q) => $q->whereNotNull('archived_at'), fn (Builder $q) => $q->whereNull('archived_at'))
            ->when($filtres->phase !== null, fn (Builder $q) => $this->inPhase($q, $filtres->phase ?? LeasePhase::Draft, $jour))
            ->when($filtres->unitId !== null, fn (Builder $q) => $q->whereHas('units', fn (Builder $u) => $u->where('unit_id', $filtres->unitId)))
            ->when($filtres->partyId !== null, fn (Builder $q) => $q->whereHas('parties', fn (Builder $p) => $p->where('party_id', $filtres->partyId)))
            ->when($filtres->search !== null && $filtres->search !== '', fn (Builder $q) => $this->searching($q, (string) $filtres->search))
            ->orderByDesc('starts_on')
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $this->cursor($filtres->cursor));
    }

    /**
     * Même table de vérité que LeasePhaseResolver, exprimée en SQL.
     *
     * @param  Builder<Lease>  $requete
     */
    private function inPhase(Builder $requete, LeasePhase $phase, string $jour): void
    {
        $signe = function (Builder $q): Builder {
            LeaseOccupancy::status($q);

            return $q;
        };
        $nonTermine = fn (Builder $q): Builder => $q->where(fn (Builder $e) => $e->whereNull('ends_on')->orWhere('ends_on', '>', $jour));

        match ($phase) {
            LeasePhase::Draft => $requete->where('status', LeaseStatus::Draft->value),
            LeasePhase::Ended => $requete->where(fn (Builder $q) => $q
                ->where('status', LeaseStatus::Cancelled->value)
                ->orWhere(fn (Builder $s) => $s->where('status', LeaseStatus::Terminated->value)->whereNull('ends_on'))
                ->orWhere(fn (Builder $s) => $signe($s)->where('ends_on', '<=', $jour))),
            LeasePhase::Upcoming => $signe($requete)->where('starts_on', '>', $jour),
            LeasePhase::Notice => $nonTermine($signe($requete)->where('starts_on', '<=', $jour))
                ->whereNotNull('notice_received_on')->where('notice_received_on', '<=', $jour),
            LeasePhase::Running => $nonTermine($signe($requete)->where('starts_on', '<=', $jour))
                ->where(fn (Builder $e) => $e->whereNull('notice_received_on')->orWhere('notice_received_on', '>', $jour)),
        };
    }

    /**
     * @param  Builder<Lease>  $requete
     */
    private function searching(Builder $requete, string $terme): void
    {
        $motif = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($terme)).'%';

        $requete->whereRaw("LOWER(leases.reference) LIKE ? ESCAPE '!'", [$motif]);
    }

    /**
     * Le paginateur écrit la date de tri avec l'heure (« 2026-02-01 00:00:00 ») ; une colonne `date` se compare au jour seul.
     */
    private function cursor(?string $encode): ?Cursor
    {
        $curseur = $encode === null ? null : Cursor::fromEncoded($encode);

        if ($curseur === null) {
            return null;
        }

        $parametres = $curseur->toArray();
        unset($parametres['_pointsToNextItems']);
        $parametres['starts_on'] = substr((string) ($parametres['starts_on'] ?? ''), 0, 10);

        return new Cursor($parametres, $curseur->pointsToNextItems());
    }
}
