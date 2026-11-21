<?php

declare(strict_types=1);

namespace Tests\Feature\Mandates;

use Closure;
use Illuminate\Database\Connection;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\Grammars\SQLiteGrammar;
use Illuminate\Support\Facades\DB;

/**
 * Trace l'ordre des requêtes d'un appel. SQLite n'écrit pas `FOR UPDATE` : la grammaire de la trace le marque en
 * commentaire pour que les lectures verrouillantes se distinguent des lectures simples.
 */
final class MandatesQueryTrace
{
    public const string BEGIN = 'begin';

    public const string LOCK = 'verrou-lot';

    public const string LOCKED_READ = 'lecture-verrouillee';

    public const string READ = 'lecture';

    public const string WRITE = 'ecriture';

    /**
     * @param  Closure(): mixed  $appel
     * @return list<array{0: string, 1: string}> [genre, SQL]
     */
    public static function run(Closure $appel): array
    {
        $connexion = DB::connection();
        self::marquer($connexion);
        $evenements = [];
        $actif = true;

        app('events')->listen(TransactionBeginning::class, function () use (&$evenements, &$actif): void {
            if ($actif) {
                $evenements[] = [self::BEGIN, ''];
            }
        });
        app('events')->listen(QueryExecuted::class, function (QueryExecuted $requete) use (&$evenements, &$actif): void {
            if ($actif) {
                $evenements[] = [self::kind($requete->sql), $requete->sql];
            }
        });

        try {
            $appel();
        } finally {
            $actif = false;
        }

        return $evenements;
    }

    /**
     * @param  list<array{0: string, 1: string}>  $evenements
     * @return array{avant: list<string>, apres: list<string>}
     */
    public static function split(array $evenements): array
    {
        $genres = array_map(fn (array $e): string => $e[0], $evenements);
        $debut = array_search(self::BEGIN, $genres, true);
        $verrou = array_search(self::LOCK, $genres, true);

        if ($debut === false || $verrou === false) {
            return ['avant' => ['pas de transaction ou pas de verrou de lot'], 'apres' => []];
        }

        return ['avant' => array_slice($genres, $debut + 1, $verrou - $debut - 1), 'apres' => array_slice($genres, $verrou)];
    }

    private static function marquer(Connection $connexion): void
    {
        $connexion->setQueryGrammar(new class($connexion) extends SQLiteGrammar
        {
            protected function compileLock(Builder $query, $value)
            {
                return $value === true ? ' /* for update */' : '';
            }
        });
    }

    private static function kind(string $sql): string
    {
        $sql = strtolower(ltrim($sql));

        return match (true) {
            str_starts_with($sql, 'insert into "mandate_unit_locks"') => self::LOCK,
            str_starts_with($sql, 'select') && str_contains($sql, '/* for update */') => self::LOCKED_READ,
            str_starts_with($sql, 'select') => self::READ,
            default => self::WRITE,
        };
    }
}
