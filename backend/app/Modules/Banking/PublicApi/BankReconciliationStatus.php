<?php

declare(strict_types=1);

namespace App\Modules\Banking\PublicApi;

use App\Modules\Banking\Queries\ReconciliationBlockers;
use Carbon\CarbonImmutable;

/**
 * État de rapprochement des comptes bancaires suivis, lu par la clôture mensuelle des fonds des mandants (ADR 0031, décision 5).
 */
final readonly class BankReconciliationStatus
{
    public function __construct(private ReconciliationBlockers $blocages) {}

    /**
     * Motifs bloquants de la clôture du mois : `bank_reconciliation_missing` (aucun état validé) ou `bank_reconciliation_stale` (un état
     * validé est devenu périmé) pour chaque compte suivi dont le suivi commence au plus tard à la fin du mois.
     *
     * Un compte fermé compte pour les mois antérieurs à sa fermeture. `$thirdPartyFunds` : l'agence détient des fonds de tiers, un compte de
     * tiers suivi est alors exigé.
     *
     * @return list<string>
     */
    public function closingBlockers(CarbonImmutable $month, bool $thirdPartyFunds = false): array
    {
        return $this->blocages->for($month, $thirdPartyFunds);
    }
}
