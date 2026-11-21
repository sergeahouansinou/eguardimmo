<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Queries\DeliveryLookup;
use App\Modules\Notifications\Support\UnsubscribeToken;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;

final readonly class PreviewUnsubscription
{
    public function __construct(
        private UnsubscribeToken $jetons,
        private DeliveryLookup $envois,
        private OrganizationDirectory $organisations,
    ) {}

    /**
     * Ne change rien (un aperçu de lien par une messagerie ne désinscrit personne) : indique seulement l'organisation concernée.
     */
    public function handle(string $jeton): string
    {
        $id = $this->jetons->deliveryId($jeton);
        $ligne = $id === null ? null : $this->envois->byId($id);

        if ($ligne === null) {
            throw ErrorCode::UnsubscribeTokenInvalid->problem();
        }

        return $this->organisations->names([$ligne['organization_id']])[$ligne['organization_id']] ?? 'Votre agence';
    }
}
