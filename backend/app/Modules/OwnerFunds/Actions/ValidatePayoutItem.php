<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Invoicing\Enums\ErrorCode as InvoicingError;
use App\Modules\Invoicing\PublicApi\ManagementFeeInvoices;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\ExclusionReason;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Models\FeeStatement;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\FeeBilling;
use App\Modules\OwnerFunds\Support\OwnerEntries;
use App\Modules\OwnerFunds\Support\PayoutEvaluator;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Money\Money;
use Throwable;

/**
 * Validation d'un mandant, dans sa propre transaction (ADR 0031, décision 4) : verrou du compte, relecture complète
 * (le brouillon n'est jamais cru), facturation et compensation des honoraires, recalcul du net, écriture vers
 * `PayoutsInTransit`. Un mandant écarté n'écrit rien.
 */
final readonly class ValidatePayoutItem
{
    public function __construct(
        private Ledger $livre,
        private LedgerAggregates $agregats,
        private PayoutEvaluator $evaluateur,
        private FeeBilling $honoraires,
        private ManagementFeeInvoices $factures,
        private OrganizationDirectory $organisations,
        private OwnerEntries $ecritures,
    ) {}

    public function handle(string $itemId, ?string $userId, CarbonImmutable $today): PayoutItemStatus
    {
        try {
            $resultat = $this->transaction(fn (): PayoutItemStatus|ExclusionReason => $this->validate($itemId, $userId, $today));
        } catch (ApiProblem $erreur) {
            if (! str_starts_with($erreur->problemCode, 'invoice_')) {
                throw $erreur;
            }

            $resultat = $this->reasonOf($erreur);
        }

        return $resultat instanceof ExclusionReason ? $this->exclude($itemId, $resultat) : $resultat;
    }

    /**
     * Une raison d'exclusion annule la transaction entière (facturation des honoraires comprise).
     *
     * @param  callable(): (PayoutItemStatus|ExclusionReason)  $travail
     */
    private function transaction(callable $travail): PayoutItemStatus|ExclusionReason
    {
        DB::beginTransaction();

        try {
            $resultat = $travail();
        } catch (Throwable $erreur) {
            DB::rollBack();

            throw $erreur;
        }

        $resultat instanceof ExclusionReason ? DB::rollBack() : DB::commit();

        return $resultat;
    }

    private function validate(string $itemId, ?string $userId, CarbonImmutable $today): PayoutItemStatus|ExclusionReason
    {
        $ligne = PayoutItem::query()->whereKey($itemId)->firstOrFail(['mandant_party_id', 'batch_id']);
        $this->livre->lockParty($ligne->mandant_party_id);
        PayoutBatch::query()->whereKey($ligne->batch_id)->lockForUpdate()->firstOrFail();
        $element = PayoutItem::query()->whereKey($itemId)->lockForUpdate()->firstOrFail();

        if ($element->status !== PayoutItemStatus::Included) {
            return $element->status;
        }

        $this->honoraires->apply($this->honoraires->plan($element->mandant_party_id, $today), $today);
        $element->fees_settled_amount = new Money($this->compensate($element, $today), $this->organisations->currency());
        $eval = $this->evaluateur->evaluate($element->mandant_party_id, $today);

        if ($eval->reason !== null) {
            return $eval->reason;
        }

        if ($eval->net !== (int) $element->net_amount->getAmount() || $eval->account?->bankAccountId !== $element->bank_account_id || $eval->net > $eval->payable) {
            return ExclusionReason::Stale;
        }

        $ecriture = $this->livre->post($this->ecritures->validation($element, $today));
        $element->status = PayoutItemStatus::Pending;
        $element->transit_entry_id = $ecriture->id;
        $element->validated_by_user_id = $userId;
        $element->save();

        return PayoutItemStatus::Pending;
    }

    /**
     * Compense les factures d'honoraires ouvertes sur le compte du mandant, la plus ancienne d'abord ; retourne le total compensé.
     */
    private function compensate(PayoutItem $element, CarbonImmutable $today): int
    {
        $devise = $this->organisations->currency();
        $total = 0;
        $releves = FeeStatement::query()->where('mandant_party_id', $element->mandant_party_id)->whereNotNull('invoice_id')->orderBy('period_start')->orderBy('id')->get();

        foreach ($releves as $releve) {
            $solde = $this->agregats->ownerFunds([$element->mandant_party_id], $devise)[$element->mandant_party_id]->payable ?? new Money(0, $devise);

            if (! $solde->isPositive()) {
                break;
            }

            $total += $this->factures->settleFromOwnerAccount((string) $releve->invoice_id, (int) $solde->getAmount(), "owner_funds:fee_settlement:{$releve->invoice_id}:{$element->id}", $today);
        }

        return $total;
    }

    private function exclude(string $itemId, ExclusionReason $raison): PayoutItemStatus
    {
        return DB::transaction(function () use ($itemId, $raison): PayoutItemStatus {
            PayoutBatch::query()->whereKey(PayoutItem::query()->whereKey($itemId)->value('batch_id'))->lockForUpdate()->firstOrFail();
            $element = PayoutItem::query()->whereKey($itemId)->lockForUpdate()->firstOrFail();

            if ($element->status === PayoutItemStatus::Included) {
                $element->status = PayoutItemStatus::Excluded;
                $element->exclusion_reason = $raison;
                $element->save();
            }

            return $element->status;
        });
    }

    private function reasonOf(ApiProblem $erreur): ExclusionReason
    {
        return $erreur->problemCode === InvoicingError::PdfUnavailable->value ? ExclusionReason::InvoicePdfUnavailable : ExclusionReason::InvoiceNotIssuable;
    }
}
