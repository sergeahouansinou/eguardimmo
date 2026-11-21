<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\OwnerFunds\Data\PayoutEvaluationData;
use App\Modules\OwnerFunds\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Compte d'un mandant et net reversable : calculé par le serveur, jamais saisi.
 *
 * @property PayoutEvaluationData $resource
 */
final class PayoutEvaluationResource extends JsonResource
{
    public function __construct(PayoutEvaluationData $evaluation, private readonly string $devise)
    {
        parent::__construct($evaluation);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $e = $this->resource;
        $m = fn (int $v): array => MoneyShape::minor($v, $this->devise);

        return [
            'mandant_party_id' => $e->mandantPartyId,
            'payable' => $m($e->payable),
            'in_transit' => $m($e->inTransit),
            'called_not_collected' => $m($e->called),
            'fees_due' => $m($e->feesDue),
            'fees_estimated' => $m($e->feesEstimated),
            'reserve' => $m($e->reserve),
            'full_hold' => $e->fullHold,
            'net_payable' => $m($e->net),
            'bank_last4' => $e->account?->last4,
            'exclusion_reason' => $e->reason?->value,
        ];
    }
}
