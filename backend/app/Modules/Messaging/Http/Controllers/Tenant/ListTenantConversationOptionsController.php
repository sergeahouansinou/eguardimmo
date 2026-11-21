<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Messaging\Queries\TenantThreads;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Baux sur lesquels le locataire peut écrire à son agence : la clé de lecture de l'espace, jamais un identifiant du client.
 */
final class ListTenantConversationOptionsController
{
    public function __invoke(Request $request, TenantThreads $fils, LeaseDirectory $baux, OrganizationDirectory $organisations, CurrentOrganization $contexte): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $cles = $fils->keys($user->id, CarbonImmutable::today());
        $noms = $organisations->names(array_map('strval', array_keys($cles)));
        $options = [];

        foreach ($cles as $organisation => $cle) {
            $contexte->run((string) $organisation, function () use ($baux, $cle, $organisation, $noms, &$options): void {
                foreach ($baux->findMany($cle['leases']) as $bail) {
                    $options[] = self::option((string) $organisation, $noms[$organisation] ?? null, $bail);
                }
            });
        }

        return new JsonResponse(['data' => $options]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function option(string $organisation, ?string $nom, LeaseData $bail): array
    {
        return ['agency' => ['id' => $organisation, 'name' => $nom], 'lease' => ['id' => $bail->id, 'reference' => $bail->reference]];
    }
}
