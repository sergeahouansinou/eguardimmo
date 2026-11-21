<?php

declare(strict_types=1);

namespace App\Modules\Messaging\PublicApi;

use App\Modules\Messaging\Queries\SupportTicketExport;
use App\Shared\Privacy\ExportSection;

/**
 * Demandes d'assistance d'un compte pour un export de données personnelles : jamais les notes internes de l'équipe ni le chemin d'une pièce.
 */
final readonly class SupportTicketsOf
{
    public function __construct(private SupportTicketExport $lecture) {}

    public function forAccount(string $userId): ExportSection
    {
        return $this->lecture->forAccount($userId);
    }
}
