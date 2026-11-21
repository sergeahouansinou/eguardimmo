<?php

declare(strict_types=1);

function sourcesFonds(): array
{
    $iterateur = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Modules/OwnerFunds')));
    $fichiers = [];

    foreach ($iterateur as $fichier) {
        if ($fichier->isFile() && $fichier->getExtension() === 'php') {
            $fichiers[$fichier->getPathname()] = (string) file_get_contents($fichier->getPathname());
        }
    }

    return $fichiers;
}

it('aucune valeur monétaire en flottant dans OwnerFunds', function (): void {
    $fautifs = [];

    foreach (sourcesFonds() as $chemin => $code) {
        if (preg_match('/\(float\)|\(double\)|floatval\(|\bfloat\s+\$|:\s*\??float\b|\bround\(|number_format\(/', $code) === 1) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});

it('aucun fichier du module ne dépasse 400 lignes et tous déclarent le typage strict', function (): void {
    $fautifs = [];

    foreach (sourcesFonds() as $chemin => $code) {
        if (substr_count($code, "\n") > 400 || ! str_contains($code, 'declare(strict_types=1);')) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});

it('aucune ressource ne sort l\'IBAN et aucun journal ne trace un montant brut', function (): void {
    $fautifs = [];

    foreach (sourcesFonds() as $chemin => $code) {
        if (str_contains($chemin, '/Http/Resources/') && preg_match('/[\'"]iban[\'"]/', $code) === 1) {
            $fautifs[] = $chemin;
        }

        if (preg_match('/Log::(info|debug|warning|error|critical)\([^;]*amount/i', $code) === 1) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});
