<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Queries\Leases;
use App\Modules\Leases\Queries\TenantCounts;
use App\Modules\Leases\Support\TenantQuota;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\PublicApi\Entitlements;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class RestoreLease
{
    public function __construct(
        private Leases $baux,
        private TenantCounts $comptes,
        private TenantQuota $locataires,
        private Entitlements $droits,
        private CurrentOrganization $organisation,
    ) {}

    /**
     * Un bail restauré compte de nouveau dans les plafonds du plan (baux, locataires). Le verrou de l'abonnement se prend avant celui du bail, comme à la création.
     */
    public function handle(Lease $bail): Lease
    {
        return DB::transaction(function () use ($bail): Lease {
            $plafonne = $bail->archived_at !== null;

            if ($plafonne) {
                $this->plafonner($bail);
            }

            $courant = $this->baux->locked($bail->id);

            if ($courant->archived_at === null) {
                return $courant;
            }

            if (! $plafonne) {
                $this->plafonner($bail);
            }

            $courant->archived_at = null;
            $courant->save();

            return $courant;
        });
    }

    private function plafonner(Lease $bail): void
    {
        $this->droits->assertWithin($this->organisation->id(), Feature::Leases, fn (): int => Lease::query()->whereNull('archived_at')->count());

        if (in_array($bail->status, [LeaseStatus::Draft, LeaseStatus::Signed], true)) {
            $this->locataires->assertRoom($this->comptes->ofLease($bail->id));
        }
    }
}
