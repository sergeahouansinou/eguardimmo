<?php

declare(strict_types=1);

namespace App\Shared\Database;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Déclencheurs d'immuabilité (ADR 0017) : même règle sous SQLite et MySQL, la condition est écrite une fois par le pilote.
 */
final class RowGuards
{
    /**
     * Condition vraie quand l'une des colonnes change.
     *
     * @param  list<string>  $colonnes
     */
    public static function changed(array $colonnes): string
    {
        $sqlite = self::sqlite();

        return implode(' OR ', array_map(fn (string $c): string => $sqlite ? "NEW.{$c} IS NOT OLD.{$c}" : "NOT (NEW.{$c} <=> OLD.{$c})", $colonnes));
    }

    /**
     * Seules les colonnes `$modifiables` peuvent changer ; la suppression est refusée.
     *
     * @param  list<string>  $toutes
     * @param  list<string>  $modifiables
     * @return list<array{string, string, string, string, string}>
     */
    public static function frozenExcept(string $table, array $toutes, array $modifiables): array
    {
        return [
            ["{$table}_figee", 'BEFORE UPDATE', $table, self::changed(array_values(array_diff($toutes, $modifiables))), "{$table} : colonnes figees"],
            ["{$table}_sans_suppression", 'BEFORE DELETE', $table, '1 = 1', "{$table} ne se supprime pas"],
        ];
    }

    /**
     * @param  list<array{string, string, string, string, string}>  $regles  nom, moment, table, condition, message (sans apostrophe)
     */
    public static function install(array $regles): void
    {
        $sqlite = self::sqlite();

        foreach ($regles as [$nom, $moment, $table, $condition, $message]) {
            $instruction = $sqlite
                ? "CREATE TRIGGER {$nom} {$moment} ON {$table} FOR EACH ROW WHEN ({$condition}) BEGIN SELECT RAISE(ABORT, '{$message}'); END"
                : "CREATE TRIGGER {$nom} {$moment} ON {$table} FOR EACH ROW IF ({$condition}) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$message}'; END IF";

            DB::connection()->getPdo()->exec($instruction);
        }
    }

    private static function sqlite(): bool
    {
        $pilote = DB::getDriverName();

        if ($pilote !== 'sqlite' && ! in_array($pilote, ['mysql', 'mariadb'], true)) {
            throw new RuntimeException("Pilote de base sans verrou : {$pilote}");
        }

        return $pilote === 'sqlite';
    }
}
