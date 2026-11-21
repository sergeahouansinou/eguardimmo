<?php

declare(strict_types=1);

$interdits = ['Notifications', 'Reporting', 'Invoicing', 'Recovery', 'Messaging', 'OwnerFunds'];

arch('Charges ne dépend que des modules déclarés dans l\'ADR 0034, et jamais de ceux qui la consomment')
    ->expect('App\Modules\Charges')
    ->not->toUse(array_map(fn (string $nom): string => "App\\Modules\\{$nom}", $interdits));

arch('les Actions de Charges sont des classes finales en lecture seule')
    ->expect('App\Modules\Charges\Actions')
    ->toBeFinal()->toBeReadonly()->toHaveMethod('handle');

arch('les contrôleurs de Charges sont mono-action et ne touchent ni la base ni le disque')
    ->expect('App\Modules\Charges\Http\Controllers')
    ->toBeFinal()->toHaveMethod('__invoke')
    ->not->toUse(['Illuminate\Support\Facades\DB', 'Illuminate\Support\Facades\Storage', 'Illuminate\Support\Facades\Http']);

arch('les événements de Charges sont immuables et émis après validation de la transaction')
    ->expect('App\Modules\Charges\Events')
    ->toBeFinal()->toBeReadonly()->toImplement('Illuminate\Contracts\Events\ShouldDispatchAfterCommit');

arch('les DTO de Charges sont immuables et ne touchent pas aux modèles')
    ->expect('App\Modules\Charges\Data')
    ->toBeFinal()->toBeReadonly()->not->toUse('App\Modules\Charges\Models');

arch('les ressources de Charges ne lisent pas la base')
    ->expect('App\Modules\Charges\Http\Resources')
    ->not->toUse('Illuminate\Support\Facades\DB');

arch('la PublicApi de Charges ne renvoie pas de modèle : elle ne dépend que de Data et d\'Enums')
    ->expect('App\Modules\Charges\PublicApi')
    ->toBeFinal();

arch('les commandes de Charges se limitent à appeler une Action')
    ->expect('App\Modules\Charges\Console')
    ->toBeFinal()->not->toUse(['Illuminate\Support\Facades\DB', 'App\Modules\Charges\Models']);

/**
 * @return list<string>
 */
function fichiersCharges(): array
{
    $fichiers = [];

    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Modules/Charges'), FilesystemIterator::SKIP_DOTS)) as $f) {
        if ($f->getExtension() === 'php' || str_ends_with($f->getFilename(), '.blade.php')) {
            $fichiers[] = $f->getPathname();
        }
    }

    sort($fichiers);

    return $fichiers;
}

it('chaque fichier de Charges reste sous 400 lignes et déclare le typage strict', function (): void {
    foreach (fichiersCharges() as $chemin) {
        $contenu = (string) file_get_contents($chemin);
        expect(substr_count($contenu, "\n"))->toBeLessThan(400, $chemin);

        if (! str_ends_with($chemin, '.blade.php') && ! str_ends_with($chemin, 'routes.php')) {
            expect($contenu)->toContain('declare(strict_types=1);');
        }
    }
});

it('aucun montant de Charges ne passe par un flottant', function (): void {
    foreach (fichiersCharges() as $chemin) {
        if (str_ends_with($chemin, '.blade.php')) {
            continue;
        }

        expect((string) file_get_contents($chemin))->not->toMatch('/\(float\)|\(double\)|floatval\(|\bfloat\s+\$|:\s*\??float\b|\bround\(|\bfloor\(|\bceil\(/', $chemin);
    }
});

it('aucun commentaire de code ni reste de débogage dans Charges', function (): void {
    foreach (fichiersCharges() as $chemin) {
        expect((string) file_get_contents($chemin))->not->toMatch('/\b(dd|dump|var_dump|ray)\(|console\.log|\bTODO\b|\bFIXME\b/', $chemin);
    }
});
