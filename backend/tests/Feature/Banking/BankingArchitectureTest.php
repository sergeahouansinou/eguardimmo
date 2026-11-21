<?php

declare(strict_types=1);

function bkSources(string $racine = 'app/Modules/Banking'): array
{
    $iterateur = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(base_path($racine)));
    $fichiers = [];

    foreach ($iterateur as $fichier) {
        if ($fichier->isFile() && $fichier->getExtension() === 'php') {
            $fichiers[$fichier->getPathname()] = (string) file_get_contents($fichier->getPathname());
        }
    }

    return $fichiers;
}

it('aucune valeur monétaire en flottant dans Banking', function (): void {
    $fautifs = [];

    foreach (bkSources() as $chemin => $code) {
        if (preg_match('/\(float\)|\(double\)|floatval\(|\bfloat\s+\$|:\s*\??float\b|\bround\(|number_format\(/', $code) === 1) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});

it('aucun fichier du module ne dépasse 400 lignes et tous déclarent le typage strict', function (): void {
    $fautifs = [];

    foreach (bkSources() as $chemin => $code) {
        if (substr_count($code, "\n") > 400 || ! str_contains($code, 'declare(strict_types=1);')) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});

it('aucune ressource ne sort l\'IBAN ni son empreinte, aucun journal ne trace de libellé', function (): void {
    $fautifs = [];

    foreach (bkSources() as $chemin => $code) {
        if (str_contains($chemin, '/Http/Resources/') && preg_match('/[\'"](iban|identifier|identifier_hash|counterparty_hash|dedup_key)[\'"]/', $code) === 1) {
            $fautifs[] = $chemin;
        }

        if (preg_match('/(Log::\w+|logger)\([^;]*(label|counterparty|remittance|iban|identifier)/i', $code) === 1) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});

it('seul OwnerFunds importe Banking (ADR 0005), uniquement par sa PublicApi', function (): void {
    $modules = [];

    foreach (bkSources('app') as $chemin => $code) {
        if (! str_contains($chemin, '/Modules/Banking/') && preg_match_all('/use App\\\\Modules\\\\Banking\\\\([A-Za-z]+)\\\\/', $code, $m) > 0) {
            $modules[explode('/', explode('/app/', $chemin)[1])[1] ?? $chemin] = array_diff($m[1], ['PublicApi']);
        }
    }

    expect(array_keys($modules))->toBe(['OwnerFunds'])->and(array_filter($modules))->toBe([]);
});

it('Banking ne dépend d\'aucun module hors de l\'ADR 0005 et n\'importe que PublicApi, Data, Enums et Events', function (): void {
    $autorises = ['Accounting', 'Documents', 'Invoicing', 'Identity', 'Organizations', 'Parties', 'Rent'];
    $fautifs = [];

    foreach (bkSources() as $chemin => $code) {
        preg_match_all('/use App\\\\Modules\\\\(?!Banking)([A-Za-z]+)\\\\([A-Za-z]+)\\\\(\\w+)/', $code, $m, PREG_SET_ORDER);

        foreach ($m as [$ligne, $module, $dossier, $classe]) {
            if ($ligne === 'use App\\Modules\\Identity\\Models\\User') {
                continue;
            }

            if (! in_array($module, $autorises, true) || ! in_array($dossier, ['PublicApi', 'Data', 'Enums', 'Events'], true)) {
                $fautifs[] = "{$chemin} : {$ligne}";
            }
        }
    }

    expect($fautifs)->toBe([]);
});
