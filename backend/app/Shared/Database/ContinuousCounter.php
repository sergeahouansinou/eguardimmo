<?php

declare(strict_types=1);

namespace App\Shared\Database;

use Illuminate\Support\Facades\DB;

/**
 * Compteur continu sans trou : l'incrément se fait par un seul upsert, qui pose le verrou de ligne sans passer par un
 * verrou d'intervalle (le couple INSERT IGNORE puis SELECT … FOR UPDATE provoque des interblocages sous MySQL).
 * À appeler dans la transaction qui consomme le numéro : son annulation libère le numéro.
 */
final class ContinuousCounter
{
    /**
     * @param  array<string, string|int>  $key  colonnes de la clé primaire du compteur ; la table porte aussi `last_value`
     */
    public function next(string $table, array $key): int
    {
        $connexion = DB::connection();
        $grammaire = $connexion->getQueryGrammar();
        $colonnes = implode(', ', array_map($grammaire->wrap(...), [...array_keys($key), 'last_value']));
        $marques = implode(', ', array_fill(0, count($key), '?'));
        $cle = implode(', ', array_map($grammaire->wrap(...), array_keys($key)));
        $valeur = $grammaire->wrap('last_value');
        $cible = $grammaire->wrapTable($table);

        $mise = in_array($connexion->getDriverName(), ['mysql', 'mariadb'], true)
            ? "on duplicate key update {$valeur} = {$valeur} + 1"
            : "on conflict ({$cle}) do update set {$valeur} = {$valeur} + 1";

        $connexion->affectingStatement("insert into {$cible} ({$colonnes}) values ({$marques}, 1) {$mise}", array_values($key));

        return (int) $connexion->table($table)->where($key)->lockForUpdate()->value('last_value');
    }
}
