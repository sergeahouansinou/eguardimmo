<?php

declare(strict_types=1);

namespace App\Shared\Approval;

/**
 * Ce que le module propriétaire d'une action sensible a validé d'une demande : sujet existant, organisation concernée, identifiants et codes
 * retenus (jamais de texte libre).
 */
final readonly class ApprovalSubject
{
    /**
     * @param  array<string, string|int|bool>  $payload
     */
    public function __construct(
        public string $type,
        public string $id,
        public ?string $organizationId = null,
        public array $payload = [],
    ) {}
}
