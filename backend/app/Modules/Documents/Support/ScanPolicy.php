<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Enums\ScanStatus;

/**
 * Seuls les fichiers venus d'un tiers (justificatifs et pièces déposées) passent par l'analyseur ; un document produit par la plateforme
 * est `clean` d'emblée. Sans analyseur configuré (développement), tout est `clean`.
 */
final readonly class ScanPolicy
{
    public function __construct(private MalwareScanner $analyseur) {}

    public function initial(FileCategory $categorie): ScanStatus
    {
        return $this->analyseur->enabled() && in_array($categorie->value, FileCategory::scanned(), true) ? ScanStatus::Pending : ScanStatus::Clean;
    }
}
