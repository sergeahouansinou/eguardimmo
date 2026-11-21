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

final readonly class RejectApproval
{
    public function __construct(private ApprovalTransitions $transitions, private RecordAudit $audit) {}

    public function handle(OperatorApproval $demande, User $decideur, string $preuve): OperatorApproval
    {
        /** @var array{OperatorApproval, ErrorCode|null} $issue */
        $issue = DB::transaction(function () use ($demande, $decideur, $preuve): array {
            $verrouillee = $this->transitions->locked($demande->id);

            if ($verrouillee->status === ApprovalStatus::Rejected && $verrouillee->decided_by_user_id === $decideur->id) {
                return [$verrouillee, null];
            }

            if ($this->transitions->expireIfDue($verrouillee)) {
                return [$verrouillee, ErrorCode::ApprovalExpired];
            }

            if ($verrouillee->status !== ApprovalStatus::Pending) {
                throw ErrorCode::ApprovalNotPending->problem();
            }

            if ($decideur->id === $verrouillee->requested_by_user_id) {
                throw ErrorCode::ApprovalSelfForbidden->problem();
            }

            if (! $verrouillee->action->canBeDecidedBy($decideur->operatorRoles())) {
                throw ErrorCode::ApprovalRoleForbidden->problem();
            }

            $this->transitions->terminer($verrouillee, ApprovalStatus::Rejected, $decideur->id, $preuve);
            $this->audit->handle('operations.approval.rejected', $decideur->id, $this->transitions->metadonnees($verrouillee));

            return [$verrouillee, null];
        });

        if ($issue[1] !== null) {
            throw $issue[1]->problem();
        }

        return $issue[0]->load(['requester', 'decider']);
    }
}
