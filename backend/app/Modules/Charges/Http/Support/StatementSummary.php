<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Support;

use App\Modules\Charges\Models\ChargeStatement;

final class StatementSummary
{
    /**
     * @return array<string, mixed>
     */
    public static function of(ChargeStatement $d): array
    {
        return [
            'id' => $d->id,
            'exercise_id' => $d->exercise_id,
            'lease_id' => $d->lease_id,
            'number' => $d->number,
            'status' => $d->status->value,
            'occupied_days' => $d->occupied_days,
            'share_total' => Shapes::money($d->share_total),
            'provisions_called' => Shapes::money($d->provisions_called),
            'provisions_unpaid' => Shapes::money($d->provisions_unpaid),
            'balance' => Shapes::money($d->balance),
            'suggested_monthly_provision' => Shapes::money($d->suggested_monthly_provision),
            'settlement' => $d->settlement?->value,
            'not_before' => $d->not_before?->toDateString(),
            'mandant_party_id' => $d->mandant_party_id,
            'issued_at' => $d->issued_at?->toIso8601String(),
            'supersedes_id' => $d->supersedes_id,
            'failure_reason' => $d->failure_reason,
            'lock_version' => $d->lock_version,
        ];
    }
}
