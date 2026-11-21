<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Enums\ContactUpdateStatus;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\ContactUpdateRequest;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class DismissContactUpdate
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(ContactUpdateRequest $demande, User $acteur): ContactUpdateRequest
    {
        return DB::transaction(function () use ($demande, $acteur): ContactUpdateRequest {
            $verrouillee = ContactUpdateRequest::query()->whereKey($demande->id)->lockForUpdate()->firstOrFail();

            if ($verrouillee->status !== ContactUpdateStatus::Pending) {
                throw ErrorCode::ContactUpdateNotPending->problem();
            }

            $verrouillee->forceFill(['status' => ContactUpdateStatus::Dismissed, 'email' => null, 'phone' => null, 'decided_by_user_id' => $acteur->id, 'decided_at' => now()])->save();
            $this->audit->handle('parties.contact_update.dismissed', $acteur->id, [], $verrouillee);

            return $verrouillee;
        });
    }
}
