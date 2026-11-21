<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Data\CampaignInput;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Queries\CampaignAudiences;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

final readonly class CampaignComposition
{
    public function __construct(
        private CampaignAccess $acces,
        private CampaignAudiences $audiences,
    ) {}

    /**
     * Rôle de l'auteur, audience permise à son organisation, et immeubles reçus du client comparés à ceux de l'organisation : un
     * identifiant étranger n'y figure pas.
     */
    public function assertAllowed(User $auteur, CampaignInput $entree): void
    {
        $adhesion = $this->acces->assertManager($auteur);
        $this->acces->assertAudience($adhesion, $entree->audience);

        if ($entree->audience === CampaignAudience::Mandants && $entree->buildingIds !== []) {
            throw ValidationException::withMessages(['building_ids' => 'Ces destinataires ne se composent pas par immeuble.']);
        }

        if ($entree->buildingIds === []) {
            return;
        }

        $connus = array_map(fn (array $immeuble): string => $immeuble['id'], $this->audiences->tenantSummary(CarbonImmutable::today())['buildings']);

        if (array_diff($entree->buildingIds, $connus) !== []) {
            throw ValidationException::withMessages(['building_ids' => 'Immeuble introuvable.']);
        }
    }
}
