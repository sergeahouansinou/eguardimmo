<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Enums\NoticeRequestEventKind;
use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Modules\Leases\Events\NoticeRequestUnacknowledged;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Modules\Leases\Queries\UnacknowledgedNotices;
use App\Modules\Leases\Support\NoticeJournal;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class FlagUnacknowledgedNotices
{
    public function __construct(
        private UnacknowledgedNotices $organisations,
        private CurrentOrganization $contexte,
        private NoticeJournal $journal,
    ) {}

    /**
     * Signale une seule fois chaque demande restée sans accusé après N jours ouvrés (samedis et dimanches exclus, jours fériés non
     * connus). Rejouable : une demande déjà signalée est ignorée.
     */
    public function handle(CarbonImmutable $now): int
    {
        $limite = $now->subWeekdays(max(1, (int) config('leases.notice.ack_business_days')));
        $signalees = 0;

        foreach ($this->organisations->organizations($limite) as $organisation) {
            $this->contexte->run($organisation, function () use ($limite, &$signalees): void {
                LeaseNoticeRequest::query()
                    ->where('status', NoticeRequestStatus::Submitted->value)
                    ->whereNull('late_flagged_at')
                    ->where('created_at', '<=', $limite)
                    ->lazyById(100)
                    ->each(function (LeaseNoticeRequest $demande) use (&$signalees): void {
                        DB::transaction(function () use ($demande, &$signalees): void {
                            $verrouillee = LeaseNoticeRequest::query()->whereKey($demande->id)->lockForUpdate()->firstOrFail();

                            if ($verrouillee->status !== NoticeRequestStatus::Submitted || $verrouillee->late_flagged_at !== null) {
                                return;
                            }

                            $verrouillee->forceFill(['late_flagged_at' => now()])->save();
                            $this->journal->record($verrouillee, NoticeRequestEventKind::LateFlagged, null);
                            NoticeRequestUnacknowledged::dispatch($verrouillee->id, $verrouillee->lease_id, $verrouillee->organization_id, $verrouillee->party_id);
                            $signalees++;
                        });
                    });
            });
        }

        return $signalees;
    }
}
