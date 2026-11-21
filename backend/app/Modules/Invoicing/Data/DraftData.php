<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

final readonly class DraftData
{
    /**
     * @param  string|null  $dueOn  Y-m-d ; calculé à l'émission si absent
     * @param  string|null  $serviceFrom  Y-m-d
     * @param  string|null  $serviceTo  Y-m-d
     * @param  list<NewLineData>  $lines
     * @param  int|null  $lockVersion  version lue, exigée pour modifier un brouillon
     * @param  string|null  $feeStatementId  relevé d'honoraires qui a produit la facture : posé par OwnerFunds seul, jamais lu d'une requête
     */
    public function __construct(
        public string $recipientPartyId,
        public ?string $leaseId,
        public ?string $mandateId,
        public ?string $dueOn,
        public ?string $serviceFrom,
        public ?string $serviceTo,
        public array $lines,
        public ?string $idempotencyKey = null,
        public ?int $lockVersion = null,
        public ?string $feeStatementId = null,
    ) {}
}
