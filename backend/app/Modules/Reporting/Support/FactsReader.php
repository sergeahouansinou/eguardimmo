<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use Carbon\CarbonImmutable;

/**
 * Faits non comptables d'un compte rendu, lus en SQL dans les tables des autres modules (ADR 0030, décision 1) : références
 * d'intervention, procédures de recouvrement ouvertes, quittances émises. Jamais un montant.
 */
final readonly class FactsReader
{
    private const int QUITTANCES_MAX = 500;

    public function __construct(private Reading $lecture) {}

    /**
     * @param  list<string>  $allocationIds
     * @return array<string, string> référence d'intervention par imputation de facture
     */
    public function interventionReferences(array $allocationIds): array
    {
        if ($allocationIds === []) {
            return [];
        }

        $lues = $this->lecture->table('invoice_allocations', 'ia')
            ->join('interventions as i', fn ($j) => $j->on('i.id', '=', 'ia.intervention_id')->on('i.organization_id', '=', 'ia.organization_id'))
            ->whereIn('ia.id', $allocationIds)
            ->select(['ia.id as allocation_id', 'i.reference as reference'])
            ->get();
        $references = [];

        foreach ($lues as $ligne) {
            $references[(string) $ligne->allocation_id] = (string) $ligne->reference;
        }

        return $references;
    }

    /**
     * @param  list<string>  $leaseIds
     * @return array<string, int> nombre de dossiers de recouvrement actifs par bail
     */
    public function activeRecoveryCases(array $leaseIds): array
    {
        if ($leaseIds === []) {
            return [];
        }

        $lues = $this->lecture->table('recovery_cases')
            ->whereIn('lease_id', $leaseIds)->whereIn('status', ['open', 'in_plan'])
            ->selectRaw('lease_id, count(*) as total')->groupBy('lease_id')->get();
        $dossiers = [];

        foreach ($lues as $ligne) {
            $dossiers[(string) $ligne->lease_id] = (int) $ligne->total;
        }

        return $dossiers;
    }

    /**
     * @param  list<string>  $leaseIds
     * @return list<array{number: string, lease_id: string, issued_on: string}>
     */
    public function receipts(array $leaseIds, CarbonImmutable $from, CarbonImmutable $to): array
    {
        if ($leaseIds === []) {
            return [];
        }

        $lues = $this->lecture->table('rent_receipts')
            ->whereIn('lease_id', $leaseIds)->whereNull('voided_at')
            ->where('issued_on', '>=', $from->toDateString())->where('issued_on', '<', $to->addDay()->toDateString())
            ->orderBy('issued_on')->orderBy('number')->limit(self::QUITTANCES_MAX)
            ->select(['number', 'lease_id', 'issued_on'])->get();

        return array_values($lues->map(fn ($l): array => [
            'number' => (string) $l->number,
            'lease_id' => (string) $l->lease_id,
            'issued_on' => substr((string) $l->issued_on, 0, 10),
        ])->all());
    }
}
