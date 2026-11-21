<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\Data\AccountingPeriodData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Banking\PublicApi\BankReconciliationStatus;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\Idempotency;
use App\Modules\OwnerFunds\Support\TrustGuard;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class CloseAccountingMonth
{
    public function __construct(
        private Ledger $livre,
        private LedgerReader $lecteur,
        private LedgerAggregates $agregats,
        private TrustGuard $cantonnement,
        private OrganizationDirectory $organisations,
        private CurrentOrganization $organisation,
        private Idempotency $idempotence,
        private BankReconciliationStatus $rapprochement,
    ) {}

    /**
     * Clôt le plus ancien mois ouvert. Motifs bloquants propres aux fonds des mandants : écart de cantonnement et
     * `PayoutsInTransit` différent de la somme des reversements en attente (ADR 0031, décision 5), plus l'état de rapprochement
     * bancaire de chaque compte suivi (ADR 0035 : `bank_reconciliation_missing`, `bank_reconciliation_stale`).
     *
     * @return array{period: AccountingPeriodData, replayed: bool, warnings: list<string>}
     */
    public function handle(CarbonImmutable $mois, string $cle, ?string $userId, CarbonImmutable $today): array
    {
        $empreinte = hash('sha256', 'close|'.$mois->format('Y-m'));
        $periode = null;

        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($mois, $userId, $today, &$periode): array {
            $this->livre->lockParty($this->organisation->id());
            $periode = $this->livre->closeMonth($mois, $userId, fn (): array => $this->blockers($mois), $today);

            return ['type' => 'accounting_period', 'id' => $periode->id];
        });

        $periode ??= array_find($this->agregats->periods(), fn (AccountingPeriodData $p): bool => $p->id === $resultat['id']) ?? throw ErrorCode::NotValidatable->problem();

        return ['period' => $periode, 'replayed' => $resultat['replayed'], 'warnings' => $this->warnings($today)];
    }

    /**
     * @return list<string>
     */
    private function blockers(CarbonImmutable $mois): array
    {
        $motifs = [];

        if (! $this->cantonnement->coverage()->covered) {
            $motifs[] = 'trust_funds_gap';
        }

        $devise = $this->organisations->currency();
        $enAttente = (int) PayoutItem::query()->where('status', PayoutItemStatus::Pending->value)->sum('net_amount');

        if ((int) $this->lecteur->accountBalance(AccountRole::PayoutsInTransit, $devise)->getAmount() !== $enAttente) {
            $motifs[] = 'payouts_in_transit_mismatch';
        }

        return [...$motifs, ...$this->rapprochement->closingBlockers($mois, thirdPartyFunds: true)];
    }

    /**
     * @return list<string>
     */
    private function warnings(CarbonImmutable $today): array
    {
        $seuil = $today->subDays((int) config('owner_funds.pending_warning_days'));
        $anciens = PayoutItem::query()->where('status', PayoutItemStatus::Pending->value)->where('updated_at', '<', $seuil)->exists();

        return $anciens ? ['pending_payouts_older_than_threshold'] : [];
    }
}
