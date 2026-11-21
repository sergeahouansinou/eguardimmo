<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Identity\Data\TwoFactorProofData;
use App\Modules\Maintenance\Enums\ApprovalDecision;

/**
 * Décision du mandant dans son espace : `accessId` et le mandant viennent de la clé de lecture, jamais du client ; la preuve 2FA,
 * l'adresse IP et le navigateur de la requête, de la session.
 */
final readonly class OwnerDecisionData
{
    public function __construct(
        public string $userId,
        public string $accessId,
        public ApprovalDecision $decision,
        public ?string $comment,
        public int $lockVersion,
        public string $quoteFingerprint,
        public string $statementVersion,
        public string $idempotencyKey,
        public TwoFactorProofData $proof,
        public ?string $ip,
        public ?string $userAgent,
    ) {}
}
