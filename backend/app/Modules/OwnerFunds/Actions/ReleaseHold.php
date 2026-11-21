<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Models\PayoutHold;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class ReleaseHold
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Rejouable : une retenue déjà levée est renvoyée telle quelle.
     */
    public function handle(string $holdId, ?string $userId): PayoutHold
    {
        return DB::transaction(function () use ($holdId, $userId): PayoutHold {
            $retenue = (Str::isUuid($holdId) ? PayoutHold::query()->whereKey($holdId)->lockForUpdate()->first() : null) ?? throw ErrorCode::HoldNotFound->problem();

            if ($retenue->released_at !== null) {
                return $retenue;
            }

            $retenue->released_at = now();
            $retenue->released_by_user_id = $userId;
            $retenue->save();
            $this->audit->handle('ownerfunds.hold.released', subject: $retenue, metadata: ['mandant_party_id' => $retenue->mandant_party_id]);

            return $retenue;
        });
    }
}
