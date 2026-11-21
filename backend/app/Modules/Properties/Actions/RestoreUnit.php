<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Queries\Properties;
use App\Modules\Properties\Queries\Units;
use App\Modules\Properties\Support\UnitPlacement;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\PublicApi\Entitlements;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class RestoreUnit
{
    public function __construct(
        private Properties $properties,
        private Units $units,
        private UnitPlacement $placement,
        private Entitlements $droits,
        private CurrentOrganization $organisation,
    ) {}

    /**
     * Un lot restauré compte de nouveau dans le plafond du plan. Le verrou de l'abonnement se prend avant celui du site, comme à la création.
     */
    public function handle(Unit $unit): Unit
    {
        return DB::transaction(function () use ($unit): Unit {
            $plafonne = $unit->archived_at !== null;

            if ($plafonne) {
                $this->plafonner();
            }

            $site = $this->properties->locked($unit->property_id);
            $lot = $this->units->locked($unit->id);

            if ($lot->archived_at === null) {
                return $lot;
            }

            if (! $plafonne) {
                $this->plafonner();
            }

            if ($site->archived_at !== null) {
                throw ErrorCode::PropertyArchived->problem();
            }

            if ($lot->parent_unit_id === null) {
                $this->placement->assertRootRoom($site, $lot->id);
            } elseif ($this->units->get($lot->parent_unit_id)->archived_at !== null) {
                throw ErrorCode::UnitArchived->problem();
            }

            $lot->archived_at = null;
            $lot->save();

            return $lot;
        });
    }

    private function plafonner(): void
    {
        $this->droits->assertWithin($this->organisation->id(), Feature::Properties, fn (): int => Unit::query()->whereNull('archived_at')->count());
    }
}
