<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Resources\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Enums\ApprovalStatus;
use App\Modules\Operations\Models\OperatorApproval;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property OperatorApproval $resource
 */
final class ApprovalResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $demande = $this->resource;
        $operateur = $request->user();
        $roles = $operateur instanceof User ? $operateur->operatorRoles() : [];
        $enAttente = $demande->isLivePending();
        $estDemandeur = $operateur instanceof User && $operateur->id === $demande->requested_by_user_id;

        return [
            'id' => $demande->id,
            'action' => $demande->action->value,
            'subject' => ['type' => $demande->subject_type, 'id' => $demande->subject_id],
            'organization_id' => $demande->organization_id,
            'status' => $demande->status === ApprovalStatus::Pending && ! $enAttente ? ApprovalStatus::Expired->value : $demande->status->value,
            'reason' => $demande->reason,
            'ticket_reference' => $demande->ticket_reference,
            'payload' => $demande->payload,
            'requested_by' => ['id' => $demande->requested_by_user_id, 'name' => $demande->requester->name],
            'requested_proof' => $demande->requested_proof,
            'decided_by' => $demande->decided_by_user_id === null ? null : ['id' => $demande->decided_by_user_id, 'name' => $demande->decider?->name],
            'decided_proof' => $demande->decided_proof,
            'decided_at' => $demande->decided_at?->toIso8601String(),
            'executed_at' => $demande->executed_at?->toIso8601String(),
            'failure_code' => $demande->failure_code,
            'expires_at' => $demande->expires_at->toIso8601String(),
            'created_at' => $demande->created_at->toIso8601String(),
            'lock_version' => $demande->lock_version,
            'permissions' => [
                'can_decide' => $enAttente && ! $estDemandeur && $demande->action->canBeDecidedBy($roles),
                'can_cancel' => $enAttente && $estDemandeur,
            ],
        ];
    }
}
