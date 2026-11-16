<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Enums\LeaseStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Définition unique d'un bail qui occupe ses lots : signé, ou terminé avec une fin connue, jusqu'à la plus proche de
 * `ends_on` et de `notice_departure_on` (exclue). Chaque requête qui décide d'une occupation passe par ici.
 */
final class LeaseOccupancy
{
    /**
     * @param  Builder<*>|QueryBuilder  $requete
     */
    public static function status(Builder|QueryBuilder $requete, string $table = 'leases'): void
    {
        $requete->where(fn ($s) => $s
            ->where("{$table}.status", LeaseStatus::Signed->value)
            ->orWhere(fn ($t) => $t->where("{$table}.status", LeaseStatus::Terminated->value)->whereNotNull("{$table}.ends_on")));
    }

    /**
     * Baux qui occupent au moins un jour de [$from, $to] ; $to omis : le seul jour $from.
     *
     * @param  Builder<*>|QueryBuilder  $requete
     */
    public static function between(Builder|QueryBuilder $requete, string $from, ?string $to = null, string $table = 'leases'): void
    {
        self::status($requete, $table);

        $requete
            ->where("{$table}.starts_on", '<=', $to ?? $from)
            ->where(fn ($e) => $e->whereNull("{$table}.ends_on")->orWhere("{$table}.ends_on", '>', $from))
            ->where(fn ($e) => $e->whereNull("{$table}.notice_departure_on")->orWhere("{$table}.notice_departure_on", '>', $from));
    }
}
