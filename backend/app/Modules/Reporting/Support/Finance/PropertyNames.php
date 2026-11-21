<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Finance;

use App\Modules\Reporting\Support\Reading;

final readonly class PropertyNames
{
    public function __construct(private Reading $lecture) {}

    /**
     * @param  list<string>  $ids
     * @return array<string, string> nom par bien de l'organisation courante
     */
    public function of(array $ids): array
    {
        $noms = [];

        foreach (array_chunk(array_values(array_unique($ids)), 500) as $lot) {
            foreach ($this->lecture->table('properties')->whereIn('id', $lot)->get(['id', 'name']) as $ligne) {
                $noms[(string) $ligne->id] = (string) $ligne->name;
            }
        }

        return $noms;
    }
}
