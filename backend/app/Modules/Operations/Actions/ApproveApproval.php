<?php

declare(strict_types=1);

namespace App\Modules\Operations\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Enums\ApprovalStatus;
use App\Modules\Operations\Enums\ErrorCode;
use App\Modules\Operations\Models\OperatorApproval;
use App\Modules\Operations\Support\ApprovalTransitions;
use App\Shared\Approval\ApprovalExecution;
use App\Shared\Approval\ApprovalHandlers;
use App\Shared\Approval\ApprovalStale;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ApproveApproval
{
    public function __construct(
        private ApprovalHandlers $handlers,
        private ApprovalTransitions $transitions,
        private RecordAudit $audit,
    ) {}

    /**
     * Valide et exécute dans une seule transaction. Sans `$decideur` (commande de secours sur le serveur), seule la preuve `artisan` est admise.
     * Rejouer la validation du même opérateur renvoie la demande sans la réexécuter.
     *
     * @param  array<string, string>  $contexte
     */
    public function handle(OperatorApproval $demande, ?User $decideur, string $preuve, array $contexte = []): OperatorApproval
    {
        /** @var array{OperatorApproval, ErrorCode|null} $issue */
        $issue = DB::transaction(fn (): array => $this->decider($demande->id, $decideur, $preuve, $contexte));

        if ($issue[1] !== null) {
            throw $issue[1]->problem();
        }

        return $issue[0]->load(['requester', 'decider']);
    }

    /**
     * @param  array<string, string>  $contexte
     * @return array{OperatorApproval, ErrorCode|null}
     */
    private function decider(string $id, ?User $decideur, string $preuve, array $contexte): array
    {
        $demande = $this->transitions->locked($id);

        if ($decideur !== null && $demande->status === ApprovalStatus::Approved && $demande->decided_by_user_id === $decideur->id) {
            return [$demande, null];
        }

        if ($this->transitions->expireIfDue($demande)) {
            return [$demande, ErrorCode::ApprovalExpired];
        }

        if ($demande->status !== ApprovalStatus::Pending) {
            throw ErrorCode::ApprovalNotPending->problem();
        }

        if ($decideur !== null) {
            if ($decideur->id === $demande->requested_by_user_id) {
                throw ErrorCode::ApprovalSelfForbidden->problem();
            }

            if (! $demande->action->canBeDecidedBy($decideur->operatorRoles())) {
                throw ErrorCode::ApprovalRoleForbidden->problem();
            }
        }

        $metadonnees = [...$this->transitions->metadonnees($demande), ...$contexte];
        $decideurId = $decideur?->id;

        try {
            DB::transaction(fn () => $this->handlers->execute(new ApprovalExecution(
                $demande->id, $demande->action->value, $demande->subject_id, $demande->organization_id, $demande->payload, $demande->requested_by_user_id, $decideurId,
            )));
        } catch (ApprovalStale) {
            $this->transitions->terminer($demande, ApprovalStatus::Failed, $decideurId, $preuve, ErrorCode::ApprovalStale->value);
            $this->audit->handle('operations.approval.failed', $decideurId, [...$metadonnees, 'failure_code' => ErrorCode::ApprovalStale->value]);

            return [$demande, ErrorCode::ApprovalStale];
        }

        $this->transitions->terminer($demande, ApprovalStatus::Approved, $decideurId, $preuve, execute: true);
        $this->audit->handle('operations.approval.approved', $decideurId, $metadonnees);
        $this->audit->handle('operations.approval.executed', $decideurId, $metadonnees);

        return [$demande, null];
    }
}
