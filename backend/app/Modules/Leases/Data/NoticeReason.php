<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

/**
 * Motif de préavis ouvert au locataire par la juridiction du bail : durée en mois et justificatif exigé ou non.
 */
final readonly class NoticeReason
{
    public function __construct(
        public string $key,
        public string $label,
        public int $months,
        public bool $proofRequired,
    ) {}
}
