<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

/**
 * Position d'un compte locataire sur un bail qu'il peut lire (ADR 0036, invariant 1) : sa fiche dans l'organisation du bail et
 * `active` faux pendant la période de grâce (bail, ou sa ligne, terminé). `exitedOn` est la date de sortie de sa propre ligne
 * (Y-m-d, semi-ouverte : ce jour-là il n'occupe plus) ; ni échéance due à partir de ce jour, ni pièce partagée après lui n'est la sienne.
 */
final readonly class TenantStandingData
{
    public function __construct(
        public string $organizationId,
        public string $leaseId,
        public string $partyId,
        public bool $active,
        public ?string $exitedOn = null,
    ) {}

    public function ownsDueDate(string $dueDate): bool
    {
        return $this->exitedOn === null || $dueDate < $this->exitedOn;
    }
}
