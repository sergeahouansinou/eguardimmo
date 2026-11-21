<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Data\NoticeReason;
use Carbon\CarbonImmutable;

/**
 * Ce que l'écran de congé du locataire affiche : motifs ouverts avec leur premier jour de départ indicatif, textes à confirmer.
 */
final readonly class NoticeOptionsView
{
    /**
     * @param  list<NoticeReason>  $reasons
     * @param  array<string, CarbonImmutable>  $earliest  premier jour de départ indicatif par clé de motif, si la demande était reçue aujourd'hui
     */
    public function __construct(
        public bool $available,
        public ?string $unavailableReason,
        public array $reasons,
        public array $earliest,
        public string $consentVersion,
        public string $consentText,
        public string $legalNotice,
        public bool $toConfirm,
    ) {}
}
