<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Identity\PublicApi\AccountErasure;
use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Enums\RequestKind;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Support\RequestJournal;
use App\Shared\Approval\ApprovalExecution;
use App\Shared\Approval\ApprovalStale;
use App\Shared\Http\ApiProblem;
use Illuminate\Support\Facades\DB;

final readonly class ExecuteErasure
{
    public function __construct(private AccountErasure $effacement, private RequestJournal $journal) {}

    /**
     * Exécuteur de `privacy.erasure.execute` : le flux de suppression de compte, puis la clôture de la demande dans la même transaction.
     */
    public function handle(ApprovalExecution $execution): void
    {
        DB::transaction(function () use ($execution): void {
            $demande = PrivacyRequest::query()->lockForUpdate()->find($execution->subjectId);

            if ($demande === null || ! $demande->status->isOpen() || $demande->kind !== RequestKind::Erasure || $demande->requester_user_id === null || ! $demande->isIdentityVerified()) {
                throw new ApprovalStale;
            }

            try {
                $this->effacement->erase($demande->requester_user_id);
            } catch (ApiProblem) {
                throw new ApprovalStale;
            }

            $demande->forceFill(['status' => RequestStatus::Completed, 'completed_at' => now(), 'handled_by_user_id' => $execution->decidedByUserId])->save();

            $this->journal->record($demande, EventKind::ErasureExecuted, $execution->decidedByUserId, ['approval_id' => $execution->approvalId]);
            $this->journal->record($demande, EventKind::Completed, $execution->decidedByUserId, ['export' => false, 'approval_id' => $execution->approvalId], 'privacy.request.completed');
        });
    }
}
