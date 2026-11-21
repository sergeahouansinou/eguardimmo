<?php

declare(strict_types=1);

namespace App\Modules\Charges\PublicApi;

use App\Modules\Charges\Data\ExpenseFactData;
use App\Modules\Charges\Queries\ExpenseFactReader;
use Carbon\CarbonImmutable;

/**
 * Catégorie, bien, lot, part récupérable et règlement des pièces de dépense de l'organisation courante : les faits qu'une pièce figée
 * ne perd pas (ADR 0034, 11), pour Tax. Le montant comptabilisé se lit au grand livre, pas ici.
 */
final readonly class ExpenseFacts
{
    public function __construct(private ExpenseFactReader $lecteur) {}

    /**
     * @param  list<string>  $ids
     * @return array<string, ExpenseFactData> par identifiant
     */
    public function byIds(array $ids): array
    {
        return $this->lecteur->byIds($ids);
    }

    /**
     * @param  list<string>|null  $unitIds  null : tous les lots ; liste vide : aucun
     * @return list<ExpenseFactData>
     */
    public function coOwnershipStatements(CarbonImmutable $from, CarbonImmutable $toExclusive, ?array $unitIds = null): array
    {
        return $this->lecteur->statements($from, $toExclusive, $unitIds);
    }
}
