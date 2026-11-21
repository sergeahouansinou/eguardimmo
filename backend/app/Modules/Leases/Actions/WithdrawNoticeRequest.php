<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Data\ProofContext;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\NoticeRequestEventKind;
use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Modules\Leases\Support\NoticeJournal;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class WithdrawNoticeRequest
{
    public function __construct(
        private CurrentOrganization $contexte,
        private NoticeJournal $journal,
        private RecordAudit $audit,
    ) {}

    /**
     * Seulement tant que l'agence n'a pas accusé réception : ensuite, le retrait passe par un accord avec l'agence.
     * Rejouable : une demande déjà retirée est renvoyée telle quelle.
     */
    public function handle(string $organizationId, string $requestId, User $user, ProofContext $contexte): LeaseNoticeRequest
    {
        return $this->contexte->run($organizationId, fn (): LeaseNoticeRequest => DB::transaction(function () use ($requestId, $user, $contexte): LeaseNoticeRequest {
            $demande = LeaseNoticeRequest::query()->whereKey($requestId)->lockForUpdate()->firstOrFail();

            if ($demande->status === NoticeRequestStatus::Withdrawn) {
                return $demande;
            }

            if ($demande->status !== NoticeRequestStatus::Submitted) {
                throw ErrorCode::NoticeRequestLocked->problem();
            }

            $demande->forceFill(['status' => NoticeRequestStatus::Withdrawn, 'withdrawn_at' => now()])->save();
            $this->journal->record($demande, NoticeRequestEventKind::Withdrawn, $user->id, $contexte);
            $this->audit->handle('leases.notice_request.withdrawn', $user->id, [], $demande);

            return $demande;
        }));
    }
}
