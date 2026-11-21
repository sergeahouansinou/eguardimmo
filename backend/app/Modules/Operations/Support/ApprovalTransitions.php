<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support;

use App\Modules\Operations\Enums\ApprovalStatus;
use App\Modules\Operations\Models\OperatorApproval;
use App\Shared\Audit\RecordAudit;

/**
 * Transitions d'une demande, toujours dans la transaction de l'appelant et sur une ligne verrouillée.
 */
final readonly class ApprovalTransitions
{
    public function __construct(private RecordAudit $audit) {}

    public function locked(string $id): OperatorApproval
    {
        return OperatorApproval::query()->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    public function expireIfDue(OperatorApproval $demande): bool
    {
        if ($demande->status === ApprovalStatus::Pending && $demande->expires_at->isPast()) {
            $this->terminer($demande, ApprovalStatus::Expired, null, null);
            $this->audit->handle('operations.approval.expired', null, $this->metadonnees($demande));
        }

        return $demande->status === ApprovalStatus::Expired;
    }

    public function terminer(OperatorApproval $demande, ApprovalStatus $statut, ?string $decideurId, ?string $preuve, ?string $echec = null, bool $execute = false): void
    {
        $demande->forceFill([
            'status' => $statut,
            'decided_by_user_id' => $decideurId,
            'decided_proof' => $preuve,
            'decided_at' => $decideurId !== null || $preuve !== null ? now() : null,
            'executed_at' => $execute ? now() : null,
            'failure_code' => $echec,
            'lock_version' => $demande->lock_version + 1,
        ])->save();
    }

    /**
     * @return array<string, string|null>
     */
    public function metadonnees(OperatorApproval $demande): array
    {
        return ['approval_id' => $demande->id, 'approval_action' => $demande->action->value, 'subject_id' => $demande->subject_id];
    }
}
