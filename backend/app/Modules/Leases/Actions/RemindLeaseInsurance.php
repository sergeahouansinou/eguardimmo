<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Events\LeaseInsuranceReminded;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseInsuranceReminder;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RemindLeaseInsurance
{
    public const int INTERVALLE_JOURS = 7;

    public function __construct(private RecordAudit $audit) {}

    /**
     * Notification seulement : ce n'est pas une mise en demeure. Une relance par 7 jours et par bail, sous verrou du bail.
     */
    public function handle(Lease $lease, User $acteur): void
    {
        DB::transaction(function () use ($lease, $acteur): void {
            $verrouille = Lease::query()->whereKey($lease->id)->lockForUpdate()->firstOrFail();

            if (in_array($verrouille->status, [LeaseStatus::Draft, LeaseStatus::Cancelled], true)) {
                throw ErrorCode::InsuranceSubmissionNotAllowed->problem('Le bail n\'est pas signé : aucune relance possible.');
            }

            if (LeaseInsuranceReminder::query()->where('lease_id', $verrouille->id)->where('sent_at', '>', now()->subDays(self::INTERVALLE_JOURS))->exists()) {
                throw ErrorCode::InsuranceReminderTooSoon->problem();
            }

            $relance = LeaseInsuranceReminder::query()->create(['lease_id' => $verrouille->id, 'sent_by_user_id' => $acteur->id, 'sent_at' => now()]);
            $this->audit->handle('leases.insurance.reminded', $acteur->id, [], $verrouille);
            LeaseInsuranceReminded::dispatch($verrouille->id, $verrouille->organization_id, $relance->sent_at->toDateString());
        });
    }
}
