<?php

declare(strict_types=1);

function invSources(string $racine = 'app/Modules/Investments'): array
{
    $iterateur = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(base_path($racine), FilesystemIterator::SKIP_DOTS));
    $fichiers = [];

    foreach ($iterateur as $fichier) {
        if ($fichier->isFile() && $fichier->getExtension() === 'php') {
            $fichiers[$fichier->getPathname()] = (string) file_get_contents($fichier->getPathname());
        }
    }

    return $fichiers;
}

it('aucun float, round, pow ni conversion en flottant dans Investments', function (): void {
    $fautifs = [];

    foreach (invSources() as $chemin => $code) {
        if (preg_match('/\(float\)|\(double\)|floatval\(|\bfloat\s+\$|:\s*\??float\b|\bround\(|\bpow\(|number_format\(/', $code) === 1) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});

it('l\'arithmétique de taux (bc*) reste dans Support/AmortizationCalculator', function (): void {
    $fautifs = [];

    foreach (invSources() as $chemin => $code) {
        if (! str_ends_with($chemin, 'Support/AmortizationCalculator.php') && preg_match('/\bbc(add|sub|mul|div|pow|comp|mod|sqrt)\(/', $code) === 1) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});

it('Investments n\'importe jamais Accounting, Tax ni Reporting', function (): void {
    $fautifs = [];

    foreach (invSources() as $chemin => $code) {
        if (preg_match('/use App\\\\Modules\\\\(Accounting|Tax|Reporting)\\\\/', $code) === 1) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});

it('Investments ne dépend que des modules de l\'ADR 0039 et n\'importe que PublicApi, Data, Enums et Events', function (): void {
    $autorises = ['Properties', 'Organizations', 'Documents', 'Identity'];
    $fautifs = [];

    foreach (invSources() as $chemin => $code) {
        preg_match_all('/use App\\\\Modules\\\\(?!Investments)([A-Za-z]+)\\\\([A-Za-z]+)\\\\(\w+)/', $code, $m, PREG_SET_ORDER);

        foreach ($m as [$ligne, $module, $dossier]) {
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

it('aucun fichier ne dépasse 400 lignes, tous déclarent le typage strict, aucune ressource ne sort de clé d\'idempotence ni d\'empreinte', function (): void {
    $fautifs = [];

    foreach (invSources() as $chemin => $code) {
        if (substr_count($code, "\n") > 400 || ! str_contains($code, 'declare(strict_types=1);')) {
            $fautifs[] = $chemin;
        }

        if (str_contains($chemin, '/Http/Resources/') && preg_match('/[\'"](idempotency_key|fingerprint)[\'"]/', $code) === 1) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});

it('seuls Tax et Reporting importent Investments, uniquement par PublicApi, Data et Enums', function (): void {
    $fautifs = [];

    foreach (invSources('app') as $chemin => $code) {
        if (str_contains($chemin, '/Modules/Investments/')) {
            continue;
        }

        preg_match_all('/use App\\\\Modules\\\\Investments\\\\([A-Za-z]+)\\\\/', $code, $m);
        $module = explode('/', explode('/Modules/', $chemin)[1] ?? '')[0];

        if ($m[1] !== [] && (! in_array($module, ['Tax', 'Reporting'], true) || array_diff($m[1], ['PublicApi', 'Data', 'Enums']) !== [])) {
            $fautifs[] = $chemin;
        }
    }

    expect($fautifs)->toBe([]);
});
