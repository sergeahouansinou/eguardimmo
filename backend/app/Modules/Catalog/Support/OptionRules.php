<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Support;

final class OptionRules
{
    /**
     * @return array<string, list<mixed>>
     */
    public static function rules(): array
    {
        return [
            'options' => ['nullable', 'array', 'min:1', 'max:100'],
            'options.*' => ['array'],
            'options.*.key' => ['required', 'string', 'regex:/^[a-z0-9][a-z0-9_]{0,62}$/', 'distinct'],
            ...LabelRules::for('options.*.labels'),
        ];
    }

    /**
     * @return list<array{key: string, labels: array<string, string>}>|null
     */
    public static function options(mixed $valide): ?array
    {
        if (! is_array($valide)) {
            return null;
        }

        return array_values(array_map(
            fn (array $option): array => ['key' => (string) $option['key'], 'labels' => $option['labels']],
            $valide,
        ));
    }
}
