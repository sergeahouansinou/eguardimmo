<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Support;

trait ReadsSignatories
{
    /**
     * @return array<string, list<string>>
     */
    private function signatoryRules(): array
    {
        return [
            'signatories' => ['sometimes', 'array', 'max:10'],
            'signatories.*.name' => ['required', 'string', 'min:2', 'max:120'],
            'signatories.*.capacity' => ['required', 'string', 'min:2', 'max:60'],
            'signatories.*.date' => ['required', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return list<array{name: string, capacity: string, date: string}>
     */
    private function signatories(): array
    {
        /** @var list<array{name: string, capacity: string, date: string}> $liste */
        $liste = array_map(
            fn (array $s): array => ['name' => (string) $s['name'], 'capacity' => (string) $s['capacity'], 'date' => (string) $s['date']],
            array_values((array) ($this->validated('signatories') ?? [])),
        );

        return $liste;
    }
}
