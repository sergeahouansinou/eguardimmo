<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Support;

use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Queries\Interventions;

final readonly class Presenter
{
    public function __construct(private Interventions $interventions) {}

    /**
     * Fiche complète relue après une écriture : la réponse reflète l'état validé, pas l'objet en mémoire de l'Action.
     */
    public function show(string $id): InterventionResource
    {
        $intervention = $this->interventions->detail($id);

        return new InterventionResource($intervention, $this->interventions->lookups([$intervention]), true);
    }
}
