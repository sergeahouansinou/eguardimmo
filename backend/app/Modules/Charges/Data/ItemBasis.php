<?php

declare(strict_types=1);

namespace App\Modules\Charges\Data;

final readonly class ItemBasis
{
    /**
     * @param  string  $kind  genre de la clé, ou `unit` pour un poste au lot
     * @param  array<string, int>  $weights  poids par lot ; quantité en millièmes pour une consommation
     * @param  int  $denominator  somme des poids de tous les lots, vacants compris
     */
    public function __construct(
        public string $kind,
        public array $weights,
        public int $denominator,
    ) {}
}
