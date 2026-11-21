<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\OrganizationKind;

final readonly class ConsoleOrganizationFilters
{
    /**
     * @param  list<string>|null  $onlyIds  restriction à ces organisations (filtre plan ou statut d'abonnement) ; liste vide = aucun résultat
     */
    public function __construct(
        public ?OrganizationKind $kind,
        public ?string $state,
        public ?string $namePrefix,
        public ?array $onlyIds,
        public ?string $cursor,
        public int $perPage,
    ) {}
}
