<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class LedgerSettings
{
    public function __construct(private CurrentOrganization $contexte) {}

    public function ownerFundsCutoverAt(): ?CarbonImmutable
    {
        $valeur = DB::table('accounting_settings')->where('organization_id', $this->contexte->id())->value('owner_funds_cutover_at');

        return is_string($valeur) ? CarbonImmutable::parse($valeur) : null;
    }

    /**
     * Pose la date d'activation une seule fois : un second appel ne la déplace pas.
     */
    public function activateOwnerFunds(CarbonImmutable $at): void
    {
        $organisation = $this->contexte->id();
        $maintenant = now()->format('Y-m-d H:i:s.u');
        DB::table('accounting_settings')->insertOrIgnore(['organization_id' => $organisation, 'owner_funds_cutover_at' => null, 'created_at' => $maintenant, 'updated_at' => $maintenant]);
        DB::table('accounting_settings')->where('organization_id', $organisation)->whereNull('owner_funds_cutover_at')
            ->update(['owner_funds_cutover_at' => $at->format('Y-m-d H:i:s.u'), 'updated_at' => $maintenant]);
    }
}
