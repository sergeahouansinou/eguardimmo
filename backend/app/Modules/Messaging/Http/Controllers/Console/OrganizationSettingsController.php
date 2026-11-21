<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Messaging\Http\Resources\Console\OrganizationSettingsResource;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Lecture sous `support-access:settings` : nom, pays et devise de l'organisation de la route.
 */
final class OrganizationSettingsController
{
    public function __invoke(string $organization, CurrentOrganization $contexte, OrganizationDirectory $organisations): OrganizationSettingsResource
    {
        $id = strtolower($organization);
        $nom = $organisations->names([$id])[$id] ?? throw ErrorCode::OrganizationNotFound->problem();

        return new OrganizationSettingsResource($contexte->run($id, fn (): array => [
            'id' => $id,
            'name' => $nom,
            'country' => $organisations->country(),
            'currency' => $organisations->currency()->getCode(),
        ]));
    }
}
