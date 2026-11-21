<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionQuote;
use Illuminate\Support\Str;

final class QuoteLookup
{
    public function quote(string $quoteId, string $interventionId): InterventionQuote
    {
        return (Str::isUuid($quoteId) ? InterventionQuote::query()->whereKey($quoteId)->where('intervention_id', $interventionId)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::QuoteNotFound->problem();
    }

    public function approval(string $approvalId, string $interventionId): InterventionApproval
    {
        return (Str::isUuid($approvalId) ? InterventionApproval::query()->whereKey($approvalId)->where('intervention_id', $interventionId)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::ApprovalNotFound->problem();
    }

    public function pendingFor(string $interventionId): ?InterventionApproval
    {
        return InterventionApproval::query()->where('intervention_id', $interventionId)->whereIn('status', ['pending', 'question'])->lockForUpdate()->first();
    }
}
