<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutBatchStatus;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Events\PayoutExecuted;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\Idempotency;
use App\Modules\OwnerFunds\Support\ItemLocator;
use App\Modules\OwnerFunds\Support\OwnerEntries;
use App\Modules\OwnerFunds\Support\SecondApproval;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

final readonly class ExecutePayoutItem
{
    public function __construct(
        private ItemLocator $verrous,
        private Ledger $livre,
        private OwnerEntries $ecritures,
        private SecondApproval $doubleControle,
        private PartyDirectory $parties,
        private Idempotency $idempotence,
        private RecordAudit $audit,
    ) {}

    /**
     * Exécution manuelle : l'agence a viré depuis la banque de tiers et saisit date et référence. Écriture débit
     * `PayoutsInTransit`, crédit `TrustBank`. Le lot passe à `executed` quand plus aucun élément n'est en attente.
     *
     * @return array{item: PayoutItem, replayed: bool}
     */
    public function handle(string $batchId, string $itemId, string $executedOn, ?string $reference, string $cle, string $userId, CarbonImmutable $today, bool $acknowledgeAccountChange = false): array
    {
        $empreinte = hash('sha256', (string) json_encode(['execute', $batchId, $itemId, $executedOn, $reference, $acknowledgeAccountChange], JSON_THROW_ON_ERROR));
        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($batchId, $itemId, $executedOn, $reference, $userId, $today, $acknowledgeAccountChange): array {
            [$lot, $element] = $this->verrous->lock($batchId, $itemId);

            if ($element->status !== PayoutItemStatus::Pending || $lot->status !== PayoutBatchStatus::Validated) {
                throw ErrorCode::ItemNotActionable->problem();
            }

            $jour = CarbonImmutable::parse($executedOn);

            if ($jour->greaterThan($today) || $jour->lessThan(CarbonImmutable::parse((string) $lot->validated_at?->toDateString()))) {
                throw ErrorCode::ItemNotActionable->problem('La date d\'exécution doit être comprise entre la validation du lot et aujourd\'hui.');
            }

            $compteChange = $this->parties->payoutAccount($element->mandant_party_id, $today)?->bankAccountId !== $element->bank_account_id;

            if ($compteChange && ! $acknowledgeAccountChange) {
                throw ErrorCode::AccountChanged->problem();
            }

            $solo = $this->doubleControle->check($lot->second_approver_required, $lot->approvers_count, $element->validated_by_user_id, $userId);
            $ecriture = $this->livre->post($this->ecritures->execution($element, (string) $lot->number, $jour));
            $element->status = PayoutItemStatus::Paid;
            $element->execution_entry_id = $ecriture->id;
            $element->executed_on = Carbon::parse($executedOn);
            $element->bank_reference = $reference;
            $element->executed_by_user_id = $userId;
            $element->executed_solo = $solo;
            $element->save();
            $this->closeBatchIfDone($lot);
            $this->audit->handle('ownerfunds.payout.executed', subject: $element, metadata: ['batch_id' => $lot->id, 'solo' => $solo, 'account_changed' => $compteChange]);
            PayoutExecuted::dispatch($element->organization_id, $lot->id, $element->id, (string) $lot->number, $element->mandant_party_id);

            return ['type' => 'payout_item', 'id' => $element->id];
        });

        return ['item' => PayoutItem::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }

    private function closeBatchIfDone(PayoutBatch $lot): void
    {
        if (! PayoutItem::query()->where('batch_id', $lot->id)->where('status', PayoutItemStatus::Pending->value)->exists()) {
            $lot->status = PayoutBatchStatus::Executed;
            $lot->lock_version++;
            $lot->save();
        }
    }
}
