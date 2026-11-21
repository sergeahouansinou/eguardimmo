<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Verrou du compte d'un mandant : une ligne par (organisation, partie), prise après la ligne du bail et avant la facture (ADR 0031, 7 bis).
 */
final readonly class PartyLocks
{
    public function __construct(private CurrentOrganization $contexte) {}

    public function lock(string $partyId): void
    {
        if (DB::transactionLevel() < 1) {
            throw new LogicException('Le verrou du compte mandant se prend dans une transaction.');
        }

        $organisation = $this->contexte->id();
        DB::table('ledger_party_locks')->insertOrIgnore(['organization_id' => $organisation, 'party_id' => $partyId, 'last_value' => 0]);
        DB::table('ledger_party_locks')->where('organization_id', $organisation)->where('party_id', $partyId)->lockForUpdate()->first();
    }
}
