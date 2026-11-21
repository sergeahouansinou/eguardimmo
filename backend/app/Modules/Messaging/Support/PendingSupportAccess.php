<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportAccessGrant;

/**
 * Une demande n'est décidable que non traitée, avant 7 jours et sur une demande de support ouverte : le délai se juge ici, à chaque
 * décision, jamais d'après la tâche planifiée qui éteint les demandes périmées.
 */
final class PendingSupportAccess
{
    public function lock(SupportAccessGrant $acces): SupportAccessGrant
    {
        $verrouille = SupportAccessGrant::query()->whereKey($acces->id)->lockForUpdate()->firstOrFail();

        $perimee = $verrouille->requested_at?->lte(now()->subDays(SupportRules::ACCES_DEMANDE_JOURS)) === true;

        if ($verrouille->status !== SupportAccessStatus::Requested || $perimee || $verrouille->ticket->status === TicketStatus::Resolved) {
            throw ErrorCode::SupportAccessNotPending->problem();
        }

        return $verrouille;
    }
}
