<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\InsuranceSubmissionStatus;
use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class WithdrawLeaseInsurance
{
    public function __construct(
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    public function handle(string $organizationId, string $submissionId, User $user): LeaseInsuranceSubmission
    {
        return $this->contexte->run($organizationId, fn (): LeaseInsuranceSubmission => DB::transaction(function () use ($submissionId, $user): LeaseInsuranceSubmission {
            $depot = LeaseInsuranceSubmission::query()->whereKey($submissionId)->lockForUpdate()->firstOrFail();

            if ($depot->status !== InsuranceSubmissionStatus::Pending) {
                throw ErrorCode::InsuranceSubmissionNotPending->problem();
            }

            $depot->forceFill(['status' => InsuranceSubmissionStatus::Withdrawn, 'decided_at' => now()])->save();
            $this->audit->handle('leases.insurance.withdrawn', $user->id, [], $depot);

            return $depot;
        }));
    }
}
