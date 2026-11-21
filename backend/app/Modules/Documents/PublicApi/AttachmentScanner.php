<?php

declare(strict_types=1);

namespace App\Modules\Documents\PublicApi;

use App\Modules\Documents\Enums\ScanVerdict;
use App\Modules\Documents\Support\MalwareScanner;

/**
 * Analyse antivirale d'une pièce stockée hors du stockage probant (pièces de messagerie historiques et du support).
 */
final readonly class AttachmentScanner
{
    public function __construct(private MalwareScanner $analyseur) {}

    public function enabled(): bool
    {
        return $this->analyseur->enabled();
    }

    /**
     * @param  resource  $flux
     */
    public function scan($flux): ScanVerdict
    {
        return $this->analyseur->scan($flux);
    }
}
