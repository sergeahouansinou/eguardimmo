<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Own;

use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

/**
 * Sérialise les écritures de comptes rendus d'un même mandant : numérotation, chevauchement et rectificatif se décident
 * sous ce verrou, dans la transaction de l'appelant.
 */
final readonly class MandantLock
{
    public function __construct(private CurrentOrganization $organisation) {}

    public function acquire(string $mandantId): void
    {
        $cle = ['organization_id' => $this->organisation->id(), 'mandant_party_id' => $mandantId];

        DB::table('reporting_mandant_locks')->insertOrIgnore($cle);
        DB::table('reporting_mandant_locks')->where($cle)->lockForUpdate()->first();
    }
}
