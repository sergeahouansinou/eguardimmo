<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Support;

use App\Modules\Maintenance\Http\Resources\Tenant\TenantInterventionResource;
use App\Modules\Maintenance\Queries\TenantInterventionViews;
use App\Modules\Maintenance\Support\TenantAccess;

final readonly class TenantPresenter
{
    public function __construct(
        private TenantAccess $acces,
        private TenantInterventionViews $vues,
    ) {}

    /**
     * Fiche relue après une écriture, avec la clé de lecture du compte : la réponse ne montre que ce que le locataire peut voir.
     */
    public function show(string $userId, string $id): TenantInterventionResource
    {
        $intervention = $this->acces->intervention($userId, $id);

        return new TenantInterventionResource($intervention, $this->vues->build([$intervention], true)[$intervention->id], true);
    }
}
