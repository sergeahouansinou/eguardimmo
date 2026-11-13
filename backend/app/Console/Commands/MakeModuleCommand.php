<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;

final class MakeModuleCommand extends Command
{
    private const DOSSIERS = [
        'Actions',
        'Data',
        'Enums',
        'Events',
        'Listeners',
        'Models',
        'Policies',
        'PublicApi',
        'Queries',
        'Http/Controllers',
        'Http/Requests',
        'Http/Resources',
        'Database/Migrations',
        'Database/Factories',
    ];

    protected $signature = 'make:module {name : Nom du module en StudlyCase, ex. Leases}';

    protected $description = 'Crée le squelette d\'un module métier dans app/Modules';

    public function handle(Filesystem $fichiers): int
    {
        $nom = (string) $this->argument('name');

        if (preg_match('/^[A-Z][A-Za-z]+$/D', $nom) !== 1) {
            $this->error('Le nom doit être en StudlyCase, sans chiffre ni séparateur (ex. Leases).');

            return self::INVALID;
        }

        $racine = app_path('Modules/'.$nom);

        if ($fichiers->exists($racine)) {
            $this->error("Le module {$nom} existe déjà.");

            return self::FAILURE;
        }

        foreach (self::DOSSIERS as $dossier) {
            $fichiers->ensureDirectoryExists($racine.'/'.$dossier);
            $fichiers->put($racine.'/'.$dossier.'/.gitkeep', '');
        }

        $fichiers->put($racine.'/'.$nom.'ServiceProvider.php', $this->provider($nom));
        $fichiers->put($racine.'/Http/routes.php', $this->routes());

        $dossierTests = base_path('tests/Feature/'.$nom);
        $fichiers->ensureDirectoryExists($dossierTests);
        $fichiers->put($dossierTests.'/.gitkeep', '');

        $this->info("Module {$nom} créé dans app/Modules/{$nom}.");

        return self::SUCCESS;
    }

    private function provider(string $nom): string
    {
        return <<<PHP
            <?php

            declare(strict_types=1);

            namespace App\\Modules\\{$nom};

            use Illuminate\\Support\\ServiceProvider;

            final class {$nom}ServiceProvider extends ServiceProvider
            {
                public function boot(): void {}
            }

            PHP;
    }

    private function routes(): string
    {
        return <<<'PHP'
            <?php

            declare(strict_types=1);

            use Illuminate\Support\Facades\Route;

            PHP;
    }
}
