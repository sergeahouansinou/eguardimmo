<?php

declare(strict_types=1);

namespace App\Shared\Database;

use BackedEnum;
use Illuminate\Support\Facades\DB;

/**
 * Contraintes CHECK de MySQL (ADR 0017) : SQLite ne sait pas les ajouter après la création de la table, elles ne
 * s'appliquent donc qu'en production.
 */
final class Checks
{
    /**
     * @param  class-string<BackedEnum>  $enum
     */
    public static function enum(string $column, string $enum, bool $nullable = false): string
    {
        $valeurs = implode(', ', array_map(
            fn (BackedEnum $cas): string => "'".str_replace("'", "''", (string) $cas->value)."'",
            $enum::cases(),
        ));

        return $nullable ? "({$column} IS NULL OR {$column} IN ({$valeurs}))" : "{$column} IN ({$valeurs})";
    }

    /**
     * Le motif se compare en respectant la casse : la collation `utf8mb4_0900_ai_ci` rendrait `[A-Z]` insensible à la casse.
     */
    public static function uppercase(string $column, int $length): string
    {
        return "REGEXP_LIKE({$column}, '^[A-Z]{{$length}}$', 'c')";
    }

    public static function statement(string $table, string $name, string $expression): string
    {
        return "ALTER TABLE {$table} ADD CONSTRAINT {$table}_{$name}_check CHECK ({$expression})";
    }

    public static function add(string $table, string $name, string $expression): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement(self::statement($table, $name, $expression));
        }
    }
}
