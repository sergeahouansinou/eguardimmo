<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Models\InterventionEvent;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Models\InterventionVisit;

/**
 * Ce que le locataire peut voir d'une intervention, déjà filtré : jamais de montant, de devis, de facture ni de prestataire.
 */
final readonly class TenantView
{
    /**
     * @param  list<InterventionVisit>  $visits
     * @param  list<InterventionEvent>  $events
     * @param  list<InterventionFile>  $files
     */
    public function __construct(
        public ?string $natureKey,
        public ?string $natureLabel,
        public string $place,
        public array $visits,
        public array $events,
        public array $files,
    ) {}
}
