<?php

declare(strict_types=1);

namespace App\Modules\Operations\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Enums\ApprovableAction;
use App\Modules\Operations\Enums\ApprovalStatus;
use App\Modules\Operations\Enums\ErrorCode;
use App\Modules\Operations\Models\OperatorApproval;
use App\Modules\Operations\Notifications\ApprovalPendingNotification;
use App\Modules\Operations\Support\ApprovalTransitions;
use App\Shared\Approval\ApprovalHandlers;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use SensitiveParameter;

final readonly class RequestApproval
{
    public function __construct(
        private ApprovalHandlers $handlers,
        private RecordAudit $audit,
        private ApprovalTransitions $transitions,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function handle(
        User $demandeur,
        ApprovableAction $action,
        string $subjectId,
        array $payload,
        #[SensitiveParameter] string $reason,
        ?string $ticketReference,
        string $proof,
    ): OperatorApproval {
        if (! $action->canBeRequestedBy($demandeur->operatorRoles())) {
            throw ErrorCode::ApprovalRoleForbidden->problem();
        }

        $sujet = $this->handlers->prepare($action->value, strtolower($subjectId), $payload);

        $demande = $this->enregistrer($demandeur, $action, $sujet->type, $sujet->id, $sujet->organizationId, $sujet->payload, $reason, $ticketReference, $proof);

        $adresse = config('operations.team_address');

        if (is_string($adresse) && $adresse !== '') {
            Notification::route('mail', $adresse)->notify(new ApprovalPendingNotification);
        }

        return $demande->load(['requester', 'decider']);
    }

    /**
     * @param  array<string, string|int|bool>  $payload
     */
    private function enregistrer(User $demandeur, ApprovableAction $action, string $type, string $subjectId, ?string $organizationId, array $payload, string $reason, ?string $ticket, string $proof): OperatorApproval
    {
        try {
            return DB::transaction(function () use ($demandeur, $action, $type, $subjectId, $organizationId, $payload, $reason, $ticket, $proof): OperatorApproval {
                $echues = OperatorApproval::query()
                    ->where('action', $action->value)->where('subject_id', $subjectId)
                    ->where('status', ApprovalStatus::Pending)->where('expires_at', '<=', now())
                    ->lockForUpdate()->get();

                foreach ($echues as $echue) {
                    $this->transitions->expireIfDue($echue);
                }

                if (OperatorApproval::query()->where('action', $action->value)->where('subject_id', $subjectId)->where('status', ApprovalStatus::Pending)->exists()) {
                    throw ErrorCode::ApprovalPendingExists->problem();
                }

                $demande = OperatorApproval::query()->create([
                    'action' => $action,
                    'subject_type' => $type,
                    'subject_id' => $subjectId,
                    'organization_id' => $organizationId,
                    'payload' => $payload,
                    'reason' => $reason,
                    'ticket_reference' => $ticket,
                    'requested_by_user_id' => $demandeur->id,
                    'requested_proof' => $proof,
                    'status' => ApprovalStatus::Pending,
                    'expires_at' => now()->addHours($this->dureeDeVieEnHeures()),
                ]);

                $this->audit->handle('operations.approval.requested', $demandeur->id, ['approval_id' => $demande->id, 'approval_action' => $action->value, 'subject_id' => $subjectId, 'ticket_reference' => $ticket]);

                return $demande;
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::ApprovalPendingExists->problem();
        }
    }

    private function dureeDeVieEnHeures(): int
    {
        $heures = config('operations.approval_ttl_hours');

        return is_int($heures) && $heures > 0 ? $heures : 24;
    }
}
