<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Seul point d'entrée des lectures SQL des tables d'autres modules (faits : comptes, dates, statuts, références ; jamais un
 * montant). Le cloisonnement est posé ici : sans contexte d'organisation, l'appel lève une exception (ADR 0006, 0030).
 */
final readonly class Reading
{
    public function __construct(private CurrentOrganization $organisation) {}

    public function table(string $table, ?string $alias = null): Builder
    {
        $nom = $alias ?? $table;

        return DB::table($alias === null ? $table : "{$table} as {$alias}")->where("{$nom}.organization_id", $this->organisation->id());
    }
}
