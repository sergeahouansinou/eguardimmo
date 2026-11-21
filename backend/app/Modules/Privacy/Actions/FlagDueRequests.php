<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Notifications\PrivacyDeadlineNotification;
use App\Modules\Privacy\Support\RequestJournal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

final readonly class FlagDueRequests
{
    public const PREAVIS_JOURS = 7;

    public function __construct(private RequestJournal $journal) {}

    /**
     * Signale une seule fois chaque demande ouverte à moins de sept jours de son échéance ; l'équipe reçoit un compte, jamais un contenu.
     */
    public function handle(): int
    {
        $signalees = 0;

        PrivacyRequest::query()
            ->whereIn('status', [RequestStatus::Received, RequestStatus::InProgress])
            ->whereNull('overdue_flagged_at')
            ->whereRaw('COALESCE(extended_until, due_at) <= ?', [now()->addDays(self::PREAVIS_JOURS)->format('Y-m-d H:i:s.u')])
            ->each(function (PrivacyRequest $demande) use (&$signalees): void {
                DB::transaction(function () use ($demande, &$signalees): void {
                    $demande->forceFill(['overdue_flagged_at' => now()])->save();
                    $this->journal->record($demande, EventKind::DueFlagged, null);
                    $signalees++;
                });
            });

        $adresse = config('privacy.team_address');

        if ($signalees > 0 && is_string($adresse) && $adresse !== '') {
            Notification::route('mail', $adresse)->notify(new PrivacyDeadlineNotification($signalees));
        }

        return $signalees;
    }
}
