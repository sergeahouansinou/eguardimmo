<?php

declare(strict_types=1);

namespace App\Modules\Listings\Data;

final readonly class ListingChangesData
{
    /**
     * @param  array<string, mixed>  $fields  champs validés, déjà limités à la liste blanche
     */
    public function __construct(
        public int $lockVersion,
        public array $fields,
    ) {}
}
