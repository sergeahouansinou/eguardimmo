<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Data\InterventionFilters;
use App\Modules\Maintenance\Data\Lookups;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

final readonly class Interventions
{
    public function __construct(
        private PartyDirectory $parties,
        private UnitDirectory $lots,
    ) {}

    /**
     * Tri par identifiant UUID v7 décroissant, sous le contexte de l'organisation.
     *
     * @return CursorPaginator<int, Intervention>
     */
    public function page(InterventionFilters $filtres, CarbonImmutable $today): CursorPaginator
    {
        return Intervention::query()
            ->with('visits')
            ->when($filtres->status !== null, fn (Builder $q) => $q->where('status', $filtres->status))
            ->when($filtres->priority !== null, fn (Builder $q) => $q->where('priority', $filtres->priority))
            ->when($filtres->unitId !== null, fn (Builder $q) => $q->where('unit_id', $filtres->unitId))
            ->when($filtres->supplierPartyId !== null, fn (Builder $q) => $q->where('supplier_party_id', $filtres->supplierPartyId))
            ->when($filtres->origin !== null, fn (Builder $q) => $q->where('origin', $filtres->origin))
            ->when($filtres->overdue, fn (Builder $q) => $q->whereIn('status', array_map(fn (InterventionStatus $s): string => $s->value, InterventionStatus::open()))->where('due_on', '<', $today->toDateString()))
            ->when($filtres->dueFrom !== null || $filtres->dueTo !== null, fn (Builder $q) => $q->where(fn (Builder $groupe) => $groupe
                ->where(fn (Builder $echeance) => $this->inPeriod($echeance, 'due_on', $filtres))
                ->orWhereHas('visits', fn (Builder $visite) => $this->inPeriod($visite, 'scheduled_on', $filtres))))
            ->when($filtres->search !== null, function (Builder $q) use ($filtres): void {
                $motif = '%'.addcslashes((string) $filtres->search, '%_\\').'%';
                $q->where(fn (Builder $groupe) => $groupe->where('reference', 'like', $motif)->orWhere('title', 'like', $motif));
            })
            ->orderByDesc('id')
            ->cursorPaginate($filtres->perPage, cursor: $filtres->cursor === null ? null : Cursor::fromEncoded($filtres->cursor));
    }

    /**
     * Période semi-ouverte [due_from, due_to) sur la colonne donnée : l'échéance de l'intervention ou la date d'une visite.
     *
     * @template T of Model
     *
     * @param  Builder<T>  $requete
     */
    private function inPeriod(Builder $requete, string $colonne, InterventionFilters $filtres): void
    {
        $requete
            ->when($filtres->dueFrom !== null, fn (Builder $q) => $q->where($colonne, '>=', $filtres->dueFrom))
            ->when($filtres->dueTo !== null, fn (Builder $q) => $q->where($colonne, '<', $filtres->dueTo));
    }

    public function get(string $id): Intervention
    {
        return (Str::isUuid($id) ? Intervention::query()->whereKey($id)->first() : null) ?? throw ErrorCode::InterventionNotFound->problem();
    }

    public function detail(string $id): Intervention
    {
        $intervention = $this->get($id);
        $intervention->load(['events', 'files', 'visits', 'quotes.lines', 'approvals', 'invoices.taxes', 'invoices.allocations', 'invoices.payments']);

        return $intervention;
    }

    /**
     * @param  iterable<Intervention>  $interventions
     */
    public function lookups(iterable $interventions): Lookups
    {
        $parties = [];
        $lots = [];

        foreach ($interventions as $intervention) {
            foreach ([$intervention->supplier_party_id, $intervention->mandant_party_id, $intervention->reporter_party_id] as $partie) {
                if ($partie !== null) {
                    $parties[$partie] = true;
                }
            }

            if ($intervention->unit_id !== null) {
                $lots[$intervention->unit_id] = true;
            }
        }

        return new Lookups(
            array_map(fn ($partie): string => $partie->displayName, $parties === [] ? [] : $this->parties->findMany(array_keys($parties))),
            $lots === [] ? [] : $this->lots->findMany(array_keys($lots)),
        );
    }
}
