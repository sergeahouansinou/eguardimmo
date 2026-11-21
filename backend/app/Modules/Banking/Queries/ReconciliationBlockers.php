<?php

declare(strict_types=1);

namespace App\Modules\Banking\Queries;

use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\LedgerRole;
use App\Modules\Banking\Enums\ReconciliationStatus;
use App\Modules\Banking\Models\BankReconciliation;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\ReconciliationCalculator;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;

final readonly class ReconciliationBlockers
{
    public function __construct(private ReconciliationCalculator $calcul) {}

    /**
     * Motifs bloquants de la clôture du mois : pour chaque compte suivi dont le suivi commence au plus tard à la fin du mois, un état
     * validé et à jour est exigé. `bank_reconciliation_missing` : aucun état validé ; `bank_reconciliation_stale` : un état validé existe
     * mais une écriture ou une ligne de relevé l'a rendu périmé.
     *
     * Un compte fermé reste suivi pour les mois qui finissent avant sa fermeture ; avec des fonds de tiers, un compte de tiers suivi est
     * obligatoire (`banking.require_trust_account`), faute de quoi le mois est bloqué.
     *
     * @return list<string>
     */
    public function for(CarbonImmutable $month, bool $thirdPartyFunds = false): array
    {
        $fin = $month->endOfMonth()->startOfDay();
        $motifs = [];

        $comptes = OrganizationBankAccount::query()->whereDate('reconciliation_from', '<=', $fin->toDateString())
            ->where(fn ($q) => $q->where('status', AccountStatus::Active)->orWhere('closed_at', '>=', $fin->addDay()->startOfDay()))->orderBy('id')->get();

        if ($thirdPartyFunds && config('banking.require_trust_account') === true && ! $comptes->contains(fn (OrganizationBankAccount $c): bool => $c->ledger_role === LedgerRole::TrustBank)) {
            $motifs['bank_reconciliation_missing'] = true;
        }

        foreach ($comptes as $compte) {
            $etat = BankReconciliation::query()->where('bank_account_id', $compte->id)->whereDate('as_of', $fin->toDateString())
                ->where('status', ReconciliationStatus::Validated)->first();

            if ($etat === null) {
                $motifs['bank_reconciliation_missing'] = true;

                continue;
            }

            try {
                $saisi = $etat->bank_balance_source === 'entered' ? (int) $etat->bank_balance->getAmount() : null;
                $perime = $this->calcul->compute($compte, $fin, $saisi)->freshness !== $etat->ledger_version;
            } catch (ApiProblem $erreur) {
                if ($erreur->problemCode !== ErrorCode::ReconciliationBalanceRequired->value) {
                    throw $erreur;
                }

                $perime = true;
            }

            if ($perime) {
                $motifs['bank_reconciliation_stale'] = true;
            }
        }

        return array_keys($motifs);
    }
}
