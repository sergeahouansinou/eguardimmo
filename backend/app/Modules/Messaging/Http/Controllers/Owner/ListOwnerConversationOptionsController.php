<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Messaging\Queries\OwnerThreads;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Accès sur lesquels le mandant peut écrire à son agence : la clé de lecture de l'espace, jamais un identifiant du client.
 */
final class ListOwnerConversationOptionsController
{
    public function __invoke(Request $request, MandateDirectory $mandats, OrganizationDirectory $organisations): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $ouverts = array_values(array_filter(
            $mandats->visibleToOwner($user->id),
            fn (OwnerVisibleData $v): bool => in_array($v->role, OwnerThreads::ROLES, true) && ! $v->inGrace,
        ));
        $noms = $organisations->names(array_values(array_unique(array_map(fn (OwnerVisibleData $v): string => $v->organizationId, $ouverts))));

        return new JsonResponse(['data' => array_map(fn (OwnerVisibleData $v): array => [
            'access_id' => $v->accessId,
            'agency' => ['id' => $v->organizationId, 'name' => $noms[$v->organizationId] ?? null],
            'mandant_name' => $v->mandantName,
        ], $ouverts)]);
    }
}
