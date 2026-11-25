<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

/**
 * Objet auquel se rattache un fichier ou une pièce : alias de la morph map et identifiant.
 */
final readonly class DocumentSubject
{
    public const string TENANT_SPACE = 'tenant_space';

    public const string PAYOUT_ACCOUNT_REQUEST = 'payout_account_request';

    public function __construct(
        public string $type,
        public string $id,
    ) {}

    /**
     * Fichier venu de l'espace locataire ou réservé à son traitement (justificatif, attestation, photo, état des lieux) : il ne se sert que par la route dédiée de son module.
     */
    public static function tenantSpace(string $leaseId): self
    {
        return new self(self::TENANT_SPACE, $leaseId);
    }

    /**
     * Pièce justificative d'une demande de changement de compte de reversement : elle ne se sert que par la route dédiée d'OwnerFunds (double authentification).
     */
    public static function payoutAccountRequest(string $requestId): self
    {
        return new self(self::PAYOUT_ACCOUNT_REQUEST, $requestId);
    }
}
