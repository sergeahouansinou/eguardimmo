<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schema;

const LIMITE_IDENTIFIANT_MYSQL = 64;

it('aucun index du schéma ne dépasse la limite MySQL de 64 caractères', function (): void {
    $trop = [];

    foreach (Schema::getTables() as $table) {
        foreach (Schema::getIndexes($table['name']) as $index) {
            if (strlen((string) $index['name']) > LIMITE_IDENTIFIANT_MYSQL) {
                $trop[] = $table['name'].'.'.$index['name'].' ('.strlen((string) $index['name']).')';
            }
        }
    }

    expect($trop)->toBe([], 'Nommer explicitement ces index (64 caractères maximum) : '.implode(', ', $trop));
});

it('aucune clé étrangère sans nom explicite ne dépasse la limite MySQL de 64 caractères', function (): void {
    $trop = [];

    foreach (glob(app_path('Modules/*/Database/Migrations/*.php')) ?: [] as $fichier) {
        $table = null;

        foreach (file($fichier, FILE_IGNORE_NEW_LINES) ?: [] as $ligne) {
            if (preg_match("/Schema::(?:create|table)\('(\w+)'/", $ligne, $m) === 1) {
                $table = $m[1];
            }

            $noms = [];

            if (preg_match_all("/->foreign\((\[[^\]]*\]|'\w+')\)/", $ligne, $m) > 0) {
                foreach ($m[1] as $colonnes) {
                    preg_match_all("/'(\w+)'/", $colonnes, $c);
                    $noms[] = $table.'_'.implode('_', $c[1]).'_foreign';
                }
            }

            if (preg_match_all("/(?:foreignUuid|foreignId)\('(\w+)'\)(?:->\w+\(\))*->constrained\(\s*(?:'\w+')?\s*\)/", $ligne, $m) > 0) {
                foreach ($m[1] as $colonne) {
                    $noms[] = $table.'_'.$colonne.'_foreign';
                }
            }

            foreach ($noms as $nom) {
                if (strlen($nom) > LIMITE_IDENTIFIANT_MYSQL) {
                    $trop[] = basename($fichier).' : '.$nom.' ('.strlen($nom).')';
                }
            }
        }
    }

    expect($trop)->toBe([], 'Nommer explicitement ces clés étrangères (64 caractères maximum) : '.implode(', ', $trop));
});
