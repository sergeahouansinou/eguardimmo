<?php

declare(strict_types=1);

namespace App\Modules\Leases\Jurisdictions;

final readonly class RegimeField
{
    /**
     * @param  list<string>  $rules
     * @param  list<string>  $options
     */
    private function __construct(
        public string $key,
        public string $type,
        public array $rules,
        public array $options = [],
    ) {}

    public static function boolean(string $key): self
    {
        return new self($key, 'boolean', ['nullable', 'boolean']);
    }

    /**
     * @param  list<string>  $options
     */
    public static function choice(string $key, array $options): self
    {
        return new self($key, 'enum', ['nullable', 'string', 'in:'.implode(',', $options)], $options);
    }

    public static function integer(string $key, int $min, int $max): self
    {
        return new self($key, 'integer', ['nullable', 'integer', 'between:'.$min.','.$max]);
    }

    public static function text(string $key, string $pattern): self
    {
        return new self($key, 'string', ['nullable', 'string', 'regex:'.$pattern]);
    }

    /**
     * @param  list<self>  $fields
     * @return array<string, list<string>>
     */
    public static function rulesOf(array $fields): array
    {
        $regles = [];

        foreach ($fields as $champ) {
            $regles[$champ->key] = $champ->rules;
        }

        return $regles;
    }
}
