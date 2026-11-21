<?php

declare(strict_types=1);

namespace App\Modules\Tax\Data;

final readonly class FactEntryData
{
    public const string RENT = 'rent_collected';

    public const string ADVANCE = 'advance_collected';

    public const string EXPENSE = 'expense';

    public const string DECLARED_EXPENSE = 'declared_expense';

    public const string SUPPLIER_INVOICE = 'supplier_invoice';

    public const string LOAN_ATTESTATION = 'loan_attestation';

    public const string LOAN_SCHEDULE = 'loan_schedule';

    public const string CO_OWNERSHIP_STATEMENT = 'co_ownership_statement';

    public const string FEES = 'management_fees';

    public const string FLAT_FEE = 'flat_fee';

    /**
     * Un montant exact, en unités mineures et signé, rattaché à un bien et à une ligne de formulaire, avec sa source.
     */
    public function __construct(
        public string $propertyId,
        public string $lineCode,
        public int $amount,
        public string $kind,
        public ?string $ref = null,
    ) {}
}
