<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\RegistrationIntents;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Support\AccountNameSplitter;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ProvisionIndividualOrganization
{
    private const PAYS = 'FR';

    private const LONGUEUR_NOM_ORGANISATION_MAX = 160;

    public function __construct(
        private RegistrationIntents $intentions,
        private CreateOrganization $creer,
        private RecordAudit $audit,
    ) {}

    public function handle(User $user, string $declencheur = 'email_verified'): ?Organization
    {
        if ($this->intentions->intendedProfile($user->id) !== IntendedProfile::IndividualLandlord) {
            return null;
        }

        return DB::transaction(function () use ($user, $declencheur): ?Organization {
            // Le verrou de la ligne users sérialise deux vérifications concurrentes du même compte.
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            $existe = Organization::query()
                ->where('kind', OrganizationKind::Individual)
                ->where('created_by_user_id', $user->id)
                ->exists();

            if ($existe) {
                return null;
            }

            [$prenom, $nom] = AccountNameSplitter::split($user->name);

            $organisation = $this->creer->handle(
                $user,
                new NewOrganizationData(OrganizationKind::Individual, mb_substr(trim($user->name), 0, self::LONGUEUR_NOM_ORGANISATION_MAX), self::PAYS),
                $prenom,
                $nom,
            );

            $this->audit->handle('organizations.individual.provisioned', $user->id, ['trigger' => $declencheur], $organisation);

            return $organisation;
        });
    }
}
