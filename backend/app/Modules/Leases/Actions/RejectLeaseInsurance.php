<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\InsuranceRejectionReason;
use App\Modules\Leases\Enums\InsuranceSubmissionStatus;
use App\Modules\Leases\Events\LeaseInsuranceDecided;
use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RejectLeaseInsurance
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Un dépôt refusé ne devient jamais une pièce : la couverture du bail reste celle d'avant.
     */
    public function handle(LeaseInsuranceSubmission $depot, User $acteur, InsuranceRejectionReason $motif, ?string $note): LeaseInsuranceSubmission
    {
        $refuse = DB::transaction(function () use ($depot, $acteur, $motif, $note): LeaseInsuranceSubmission {
            $verrouille = LeaseInsuranceSubmission::query()->whereKey($depot->id)->lockForUpdate()->firstOrFail();

            if ($verrouille->status !== InsuranceSubmissionStatus::Pending) {
                throw ErrorCode::InsuranceSubmissionNotPending->problem();
            }

            $verrouille->forceFill(['status' => InsuranceSubmissionStatus::Rejected, 'rejection_reason' => $motif, 'note' => $note, 'decided_by_user_id' => $acteur->id, 'decided_at' => now()])->save();
            $this->audit->handle('leases.insurance.rejected', $acteur->id, [], $verrouille);

            return $verrouille;
        });

        LeaseInsuranceDecided::dispatch($refuse->id, $refuse->lease_id, $refuse->organization_id, $refuse->party_id, false);

        return $refuse;
    }
}
