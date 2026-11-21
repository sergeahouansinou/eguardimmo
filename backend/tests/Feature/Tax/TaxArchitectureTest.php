<?php

declare(strict_types=1);

/**
 * @return list<string>
 */
function fichiersTax(): array
{
    $iterateur = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Modules/Tax'), FilesystemIterator::SKIP_DOTS));
    $fichiers = [];

    foreach ($iterateur as $f) {
        if ($f instanceof SplFileInfo && in_array($f->getExtension(), ['php'], true)) {
            $fichiers[] = $f->getPathname();
        }
    }

    sort($fichiers);

    return $fichiers;
}

function texteTax(string $fichier): string
{
    return (string) file_get_contents($fichier);
}

function horsMillesime(string $f): bool
{
    return ! str_contains($f, '/Jurisdictions/Fr/Millesimes/');
}

it('Tax n\'importe jamais l\'écriture du grand livre (Accounting\\PublicApi\\Ledger) ni un autre module hors PublicApi, Data, Enums, Events', function (): void {
    $fautifs = [];

    foreach (fichiersTax() as $f) {
        $texte = texteTax($f);

        preg_match_all('/^use App\\\\Modules\\\\Accounting\\\\PublicApi\\\\Ledger;/m', $texte, $ecriture);
        preg_match_all('/^use App\\\\Modules\\\\(?!Tax)(?!Identity\\\\Models\\\\User;)(\w+)\\\\(Models|Actions|Http|Policies|Database|Listeners|Queries|Support|Jurisdictions)\\\\/m', $texte, $prives, PREG_SET_ORDER);

        foreach ($ecriture[0] as $ligne) {
            $fautifs[] = basename($f).' : '.$ligne;
        }

        foreach ($prives as $ligne) {
            $fautifs[] = basename($f).' : '.$ligne[0];
        }
    }

    expect($fautifs)->toBe([]);
});

it('Tax n\'appelle aucun client HTTP : le PDF passe par app/Shared/Pdf', function (): void {
    $fautifs = array_filter(fichiersTax(), fn (string $f): bool => preg_match('/Facades\\\\Http;|GuzzleHttp|Http::|curl_init|file_get_contents\(\s*[\'"]http/', texteTax($f)) === 1);

    expect(array_values($fautifs))->toBe([]);
});

it('aucune année ni aucun montant fiscal en dur hors des millésimes : seuls les nombres de moins de quatre chiffres et la constante des points de base', function (): void {
    $fautifs = [];

    foreach (array_filter(fichiersTax(), horsMillesime(...)) as $f) {
        if (str_contains($f, '/Database/Migrations/') || str_ends_with($f, '/Support/Rounding.php')) {
            continue;
        }

        foreach (token_get_all(texteTax($f)) as $jeton) {
            if (! is_array($jeton)) {
                continue;
            }

            $gros = $jeton[0] === T_LNUMBER && (int) $jeton[1] >= 1000;
            $annee = in_array($jeton[0], [T_CONSTANT_ENCAPSED_STRING, T_ENCAPSED_AND_WHITESPACE], true) && preg_match('/\b(19|20)\d{2}\b|\b\d{4,}\b/', $jeton[1]) === 1;

            if ($gros || $annee) {
                $fautifs[] = basename($f).':'.$jeton[2].' : '.$jeton[1];
            }
        }
    }

    expect($fautifs)->toBe([]);
});

it('Tax ne manipule aucun montant en virgule flottante : ni littéral décimal, ni conversion, ni arrondi natif', function (): void {
    $fautifs = [];

    foreach (array_filter(fichiersTax(), fn (string $f): bool => ! str_contains($f, '/Views/')) as $f) {
        foreach (token_get_all(texteTax($f)) as $jeton) {
            if (! is_array($jeton)) {
                continue;
            }

            $nom = strtolower($jeton[1]);

            if ($jeton[0] === T_DNUMBER || $jeton[0] === T_DOUBLE_CAST || ($jeton[0] === T_STRING && in_array($nom, ['float', 'floatval', 'round', 'floor', 'ceil', 'fdiv'], true))) {
                $fautifs[] = basename($f).':'.$jeton[2].' : '.$jeton[1];
            }
        }
    }

    expect($fautifs)->toBe([]);
});

it('Tax ne branche aucune règle sur le pays : les règles passent par le contrat RentalIncomeRules', function (): void {
    $fautifs = array_filter(fichiersTax(), fn (string $f): bool => ! str_contains($f, '/Jurisdictions/') && preg_match('/\$pays\s*[=!]==|country\(\)\s*[=!]==|[\'"]FR[\'"]/', texteTax($f)) === 1);

    expect(array_values($fautifs))->toBe([]);
});

it('Tax ne dépend que des modules de la décision 2 de l\'ADR 0039', function (): void {
    $autorises = ['Tax', 'Accounting', 'Charges', 'Catalog', 'Documents', 'Identity', 'Investments', 'Leases', 'Maintenance', 'Mandates', 'Notifications', 'Organizations', 'Parties', 'Properties'];
    $fautifs = [];

    foreach (fichiersTax() as $f) {
        preg_match_all('/^use App\\\\Modules\\\\(\w+)\\\\/m', texteTax($f), $m);

        foreach ($m[1] as $module) {
            in_array($module, $autorises, true) || $fautifs[] = basename($f).' : '.$module;
        }
    }

    expect($fautifs)->toBe([]);
});

it('aucun fichier de Tax ne dépasse 400 lignes et aucune vue n\'échappe une donnée', function (): void {
    $longs = array_filter(fichiersTax(), fn (string $f): bool => substr_count(texteTax($f), "\n") > 400);
    $bruts = array_filter(glob(app_path('Modules/Tax/Views/*.blade.php')) ?: [], fn (string $f): bool => str_contains(texteTax($f), '{!!'));

    expect(array_values($longs))->toBe([])->and(array_values($bruts))->toBe([]);
});

it('Tax n\'écrit jamais en dur une adresse e-mail ni un rôle opérateur', function (): void {
    $fautifs = array_filter(fichiersTax(), fn (string $f): bool => preg_match('/@[a-z0-9-]+\.(com|fr|org)|operators/i', texteTax($f)) === 1);

    expect(array_values($fautifs))->toBe([]);
});
