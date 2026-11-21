<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Events\OrganizationTimezoneChanged;
use App\Modules\Organizations\Models\Organization;
use Illuminate\Support\Facades\DB;

final readonly class UpdateOrganizationTimezone
{
    /**
     * Les événements déjà saisis gardent le fuseau copié à leur création : ce changement ne déplace rien. Seuls les rappels calculés
     * dans le fuseau de l'organisation sont recalculés, par Planning, une fois la transaction validée.
     */
    public function handle(Organization $organisation, string $timezone): Organization
    {
        return DB::transaction(function () use ($organisation, $timezone): Organization {
            $precedent = (string) $organisation->timezone;
            $organisation->forceFill(['timezone' => $timezone])->save();

            if ($precedent !== $timezone) {
                OrganizationTimezoneChanged::dispatch($organisation->id, $precedent, $timezone);
            }

            return $organisation;
        });
    }
}
