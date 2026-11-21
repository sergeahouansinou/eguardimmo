<?php

declare(strict_types=1);

namespace App\Modules\Operations\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Enums\ApprovalStatus;
use App\Modules\Operations\Enums\ErrorCode;
use App\Modules\Operations\Models\OperatorApproval;
use App\Modules\Operations\Support\ApprovalTransitions;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CancelApproval
{
    public function __construct(private ApprovalTransitions $transitions, private RecordAudit $audit) {}

    public function handle(OperatorApproval $demande, User $demandeur, string $preuve): OperatorApproval
    {
        /** @var array{OperatorApproval, ErrorCode|null} $issue */
        $issue = DB::transaction(function () use ($demande, $demandeur, $preuve): array {
            $verrouillee = $this->transitions->locked($demande->id);

            if ($verrouillee->requested_by_user_id !== $demandeur->id) {
                throw ErrorCode::ApprovalRoleForbidden->problem();
            }

            if ($verrouillee->status === ApprovalStatus::Cancelled) {
                return [$verrouillee, null];
            }

            if ($this->transitions->expireIfDue($verrouillee)) {
                return [$verrouillee, ErrorCode::ApprovalExpired];
            }

            if ($verrouillee->status !== ApprovalStatus::Pending) {
                throw ErrorCode::ApprovalNotPending->problem();
            }

            $this->transitions->terminer($verrouillee, ApprovalStatus::Cancelled, $demandeur->id, $preuve);
            $this->audit->handle('operations.approval.cancelled', $demandeur->id, $this->transitions->metadonnees($verrouillee));

            return [$verrouillee, null];
        });

        if ($issue[1] !== null) {
            throw $issue[1]->problem();
        }

        return $issue[0]->load(['requester', 'decider']);
    }
}
