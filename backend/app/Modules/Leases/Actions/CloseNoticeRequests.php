<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\NoticeRequestEventKind;
use App\Modules\Leases\Enums\NoticeRequestOutcome;
use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Modules\Leases\Events\NoticeRequestClosed;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Modules\Leases\Support\NoticeJournal;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Str;

/**
 * Clôture des demandes de congé quand l'équipe acte le départ par `notice` ou `parties/{leaseParty}/end` ; à appeler dans leur transaction.
 */
final readonly class CloseNoticeRequests
{
    public function __construct(
        private NoticeJournal $journal,
        private RecordAudit $audit,
    ) {}

    /**
     * La demande citée doit être vivante, du bail et, si précisé, de la fiche : sinon 404, rien n'est acté.
     * Avec `$solderLesAutres`, les autres demandes vivantes du bail (ou de la fiche) deviennent sans objet.
     */
    public function handle(string $leaseId, ?string $partyId, ?string $acteurId, ?string $requestId, bool $solderLesAutres): ?LeaseNoticeRequest
    {
        $citee = $requestId === null ? null : $this->cited($requestId, $leaseId, $partyId);

        if ($citee !== null) {
            $this->close($citee, NoticeRequestOutcome::Recorded, $acteurId);
        }

        if ($solderLesAutres) {
            LeaseNoticeRequest::query()
                ->where('lease_id', $leaseId)
                ->when($partyId !== null, fn ($q) => $q->where('party_id', $partyId))
                ->when($citee !== null, fn ($q) => $q->where('id', '!=', $citee?->id))
                ->whereIn('status', [NoticeRequestStatus::Submitted->value, NoticeRequestStatus::Acknowledged->value])
                ->lockForUpdate()
                ->get()
                ->each(fn (LeaseNoticeRequest $demande) => $this->close($demande, NoticeRequestOutcome::Superseded, $acteurId));
        }

        return $citee;
    }

    private function cited(string $requestId, string $leaseId, ?string $partyId): LeaseNoticeRequest
    {
        $demande = Str::isUuid($requestId) ? LeaseNoticeRequest::query()->whereKey($requestId)->lockForUpdate()->first() : null;

        if ($demande === null || $demande->lease_id !== $leaseId || ($partyId !== null && $demande->party_id !== $partyId) || ! $this->live($demande)) {
            throw ErrorCode::NoticeRequestNotFound->problem();
        }

        return $demande;
    }

    private function live(LeaseNoticeRequest $demande): bool
    {
        return in_array($demande->status, [NoticeRequestStatus::Submitted, NoticeRequestStatus::Acknowledged], true);
    }

    private function close(LeaseNoticeRequest $demande, NoticeRequestOutcome $issue, ?string $acteurId): void
    {
        $demande->forceFill(['status' => NoticeRequestStatus::Closed, 'closed_outcome' => $issue, 'closed_at' => now()])->save();
        $this->journal->record($demande, NoticeRequestEventKind::Closed, $acteurId, data: ['outcome' => $issue->value]);
        $this->audit->handle('leases.notice_request.closed', $acteurId, ['outcome' => $issue->value], $demande);
        NoticeRequestClosed::dispatch($demande->id, $demande->lease_id, $demande->organization_id, $demande->party_id, $issue);
    }
}
