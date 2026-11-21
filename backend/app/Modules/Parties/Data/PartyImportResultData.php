<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

final readonly class PartyImportResultData
{
    /**
     * @param  list<string>  $partyIds  dans l'ordre des lignes du fichier
     */
    public function __construct(
        public string $id,
        public int $count,
        public array $partyIds,
        public bool $replayed,
    ) {}
}
