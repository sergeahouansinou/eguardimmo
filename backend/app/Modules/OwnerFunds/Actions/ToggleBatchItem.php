<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\ExclusionReason;
use App\Modules\OwnerFunds\Enums\PayoutBatchStatus;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\PayoutEvaluator;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Money;

final readonly class ToggleBatchItem
{
    public function __construct(
        private PayoutEvaluator $evaluateur,
        private OrganizationDirectory $organisations,
    ) {}

    /**
     * Exclusion motivée à la main (`manual`) ou réinclusion d'un mandant exclu à la main, dans un lot brouillon. La
     * réinclusion relit le net : un motif du serveur ne se lève jamais à la main.
     */
    public function handle(string $batchId, string $itemId, bool $include, int $lockVersion, CarbonImmutable $today): PayoutBatch
    {
        return DB::transaction(function () use ($batchId, $itemId, $include, $lockVersion, $today): PayoutBatch {
            $lot = (Str::isUuid($batchId) ? PayoutBatch::query()->whereKey($batchId)->lockForUpdate()->first() : null) ?? throw ErrorCode::BatchNotFound->problem();
            $element = (Str::isUuid($itemId) ? PayoutItem::query()->whereKey($itemId)->where('batch_id', $lot->id)->lockForUpdate()->first() : null) ?? throw ErrorCode::ItemNotFound->problem();

            if ($lot->lock_version !== $lockVersion) {
                throw ErrorCode::StaleVersion->problem();
            }

            if ($lot->status !== PayoutBatchStatus::Draft) {
                throw ErrorCode::NotValidatable->problem();
            }

            if ($include) {
                $this->reinclude($element, $today);
            } elseif ($element->status === PayoutItemStatus::Included) {
                $element->status = PayoutItemStatus::Excluded;
                $element->exclusion_reason = ExclusionReason::Manual;
                $element->save();
            }

            $lot->lock_version++;
            $lot->save();

            return $lot;
        });
    }

    private function reinclude(PayoutItem $element, CarbonImmutable $today): void
    {
        if ($element->status === PayoutItemStatus::Included) {
            return;
        }

        if ($element->status !== PayoutItemStatus::Excluded || $element->exclusion_reason !== ExclusionReason::Manual) {
            throw ErrorCode::ItemExcluded->problem();
        }

        $eval = $this->evaluateur->evaluate($element->mandant_party_id, $today);

        if ($eval->reason !== null) {
            throw ErrorCode::ItemExcluded->problem();
        }

        $devise = $this->organisations->currency();
        $element->status = PayoutItemStatus::Included;
        $element->exclusion_reason = null;
        $element->net_amount = new Money($eval->net, $devise);
        $element->bank_account_id = $eval->account?->bankAccountId;
        $element->bank_last4 = $eval->account?->last4;

        try {
            $element->save();
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::ItemExcluded->problem();
        }
    }
}
