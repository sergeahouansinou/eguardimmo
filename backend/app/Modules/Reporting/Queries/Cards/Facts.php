<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Cards;

use App\Modules\Reporting\Support\Reading;
use Carbon\CarbonImmutable;

/**
 * Faits non comptables des tableaux de bord : comptes, dates et statuts, jamais un montant.
 */
final readonly class Facts
{
    public function __construct(private Reading $lecture) {}

    /**
     * @return array{count: int, next: list<array{id: string, reference: string, ends_on: string}>}
     */
    public function mandatesToRenew(CarbonImmutable $today, int $days): array
    {
        $lues = $this->lecture->table('mandates')->where('status', 'active')
            ->where('ends_on', '>=', $today->toDateString())->where('ends_on', '<=', $today->addDays($days)->toDateString())
            ->orderBy('ends_on')->orderBy('id')->limit(5)
            ->selectRaw('id, reference, ends_on, count(*) over () as total')->get();

        return [
            'count' => (int) ($lues->first()->total ?? 0),
            'next' => array_values($lues->map(fn ($m): array => ['id' => (string) $m->id, 'reference' => (string) $m->reference, 'ends_on' => substr((string) $m->ends_on, 0, 10)])->all()),
        ];
    }

    public function certificatesToRenew(CarbonImmutable $today, int $days): int
    {
        return $this->lecture->table('certificates', 'c')
            ->leftJoin('certificates as r', fn ($j) => $j->on('r.replaces_id', '=', 'c.id')->on('r.organization_id', '=', 'c.organization_id'))
            ->whereNull('r.id')->whereNotNull('c.expires_on')->where('c.expires_on', '<=', $today->addDays($days)->toDateString())
            ->count();
    }

    public function leasesEnding(CarbonImmutable $today, int $days): int
    {
        return $this->lecture->table('leases')->where('status', 'signed')
            ->where('ends_on', '>=', $today->toDateString())->where('ends_on', '<=', $today->addDays($days)->toDateString())->count();
    }

    /**
     * Lots non archivés sans bail signé en cours à la date donnée.
     */
    public function vacantUnits(CarbonImmutable $today): int
    {
        $jour = $today->toDateString();

        return $this->lecture->table('units', 'u')->whereNull('u.archived_at')
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('lease_units as lu')
                ->join('leases as l', fn ($j) => $j->on('l.id', '=', 'lu.lease_id')->on('l.organization_id', '=', 'lu.organization_id'))
                ->whereColumn('lu.unit_id', 'u.id')->whereColumn('lu.organization_id', 'u.organization_id')
                ->where('l.status', 'signed')->where('l.starts_on', '<=', $jour)
                ->where(fn ($d) => $d->whereNull('l.ends_on')->orWhere('l.ends_on', '>=', $jour))
                ->where('lu.valid_from', '<=', $jour)->where(fn ($d) => $d->whereNull('lu.valid_to')->orWhere('lu.valid_to', '>', $jour)))
            ->count();
    }

    public function openInterventions(): int
    {
        return $this->lecture->table('interventions')->whereNotIn('status', ['declined', 'cancelled', 'closed'])->count();
    }
}
