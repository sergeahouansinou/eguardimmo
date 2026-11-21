<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Data\ProofContext;
use App\Modules\Leases\Enums\NoticeRequestEventKind;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Modules\Leases\Models\LeaseNoticeRequestEvent;

/**
 * Écrit le journal de preuve d'une demande de congé ; à appeler dans la transaction de l'acte.
 */
final class NoticeJournal
{
    /**
     * @param  array<string, mixed>|null  $data  jamais de motif ni d'adresse : empreintes, dates, issue
     */
    public function record(LeaseNoticeRequest $demande, NoticeRequestEventKind $genre, ?string $acteurId, ?ProofContext $contexte = null, ?string $consentement = null, ?array $data = null): void
    {
        LeaseNoticeRequestEvent::query()->create([
            'notice_request_id' => $demande->id,
            'kind' => $genre,
            'actor_user_id' => $acteurId,
            'ip' => $contexte?->ip,
            'user_agent' => $contexte?->userAgent === null ? null : mb_substr($contexte->userAgent, 0, 255),
            'reauth_method' => $contexte?->reauthMethod,
            'consent_version' => $consentement,
            'data' => $data,
            'occurred_at' => now(),
        ]);
    }
}
