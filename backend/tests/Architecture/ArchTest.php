<?php

declare(strict_types=1);

use App\Modules\Identity\Models\Operator;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\SocialIdentity;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserDevice;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\AcrossOrganizations;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Console\Command;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\ServiceProvider;

// Modèles qui n'appartiennent à aucune organisation ; toute autre entrée est une décision d'architecture.
$horsOrganisation = [User::class, Operator::class, SocialIdentity::class, UserDevice::class, PersonalAccessToken::class];

$modules = array_map('basename', glob(__DIR__.'/../../app/Modules/*', GLOB_ONLYDIR) ?: []);

$dansChaqueModule = fn (string $suffixe): array => array_map(
    fn (string $module): string => "App\\Modules\\{$module}\\{$suffixe}",
    $modules,
);

arch()->preset()->php();
arch()->preset()->security();
// Eloquent impose casts() en protected.
arch()->preset()->strict()->ignoring($dansChaqueModule('Models'));

// Le preset laravel de Pest suppose App\Models, App\Http… : ses règles sont reprises ici, module par module.
arch('aucun helper de debug ni env() hors config')
    ->expect(['dd', 'ddd', 'dump', 'env', 'exit', 'ray'])
    ->not->toBeUsed();

// Le journal d'audit est technique et transverse : seul modèle autorisé hors d'un module.
arch('modèles Eloquent uniquement dans Models')
    ->expect('App')
    ->not->toExtend(Model::class)
    ->ignoring([...$dansChaqueModule('Models'), 'App\\Shared\\Audit\\AuditLog']);

// ADR 0015 : clés UUID v7 partout.
arch('journal d\'audit en UUID')
    ->expect(AuditLog::class)
    ->toUseTrait(HasUuids::class);

arch('FormRequest uniquement dans Http\Requests')
    ->expect('App')
    ->not->toExtend(FormRequest::class)
    ->ignoring($dansChaqueModule('Http\Requests'));

arch('contrôleurs uniquement dans Http\Controllers')
    ->expect('App')
    ->not->toHaveSuffix('Controller')
    ->ignoring($dansChaqueModule('Http\Controllers'));

arch('enums uniquement dans Enums')
    ->expect('App')
    ->not->toBeEnums()
    ->ignoring($dansChaqueModule('Enums'));

arch('commandes artisan')
    ->expect('App\Console\Commands')
    ->classes()
    ->toExtend(Command::class)
    ->toHaveSuffix('Command');

arch('Shared ne dépend d\'aucun module')
    ->expect('App\Shared')
    ->not->toUse('App\Modules');

// Une lecture inter-organisations ne se fait que depuis les Queries d'un module (séparateur final : « Lease » n'autorise pas « Leases »).
arch('AcrossOrganizations réservé aux Queries des modules')
    ->expect(AcrossOrganizations::class)
    ->toOnlyBeUsedIn([...$dansChaqueModule('Queries\\'), 'Tests\\']);

// Pest ne voit pas les appels de méthode : sans ce test, withoutGlobalScope() contournerait le cloisonnement.
test('aucun contournement du scope d\'organisation hors Shared\Tenancy', function (): void {
    $fichiers = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(__DIR__.'/../../app/Modules', FilesystemIterator::SKIP_DOTS));
    $fautifs = [];

    foreach ($fichiers as $fichier) {
        if ($fichier->getExtension() === 'php' && preg_match('/withoutGlobalScopes?\s*\(/', (string) file_get_contents($fichier->getPathname()))) {
            $fautifs[] = $fichier->getPathname();
        }
    }

    expect($fautifs)->toBe([]);
});

// ADR 0014 : une erreur métier se lève par ErrorCode::X->problem(), le rendu est centralisé dans ProblemRenderer.
arch('aucune exception propre à un module')
    ->expect('App\Modules')
    ->not->toImplement(Throwable::class);

// Seuls ces dossiers d'un module sont visibles des autres ; tout le reste lui est privé.
$publics = ['PublicApi', 'Data', 'Enums', 'Events'];

foreach ($modules as $module) {
    $ns = "App\\Modules\\{$module}";
    $dossierModule = __DIR__."/../../app/Modules/{$module}";
    $internes = array_diff(array_map('basename', glob($dossierModule.'/*', GLOB_ONLYDIR) ?: []), $publics);

    foreach ($internes as $interne) {
        $cible = "{$ns}\\{$interne}";
        // Le séparateur final empêche « Lease » d'autoriser « Leases ».
        $regle = arch("{$module} : {$interne} reste privé au module")
            ->expect($cible)
            ->toOnlyBeUsedIn(["{$ns}\\", 'Tests\\']);

        if ($cible === 'App\Modules\Identity\Models') {
            $regle->ignoring('App\Modules\Identity\Models\User');
        }
    }

    arch("{$module} : aucun middleware ne construit de réponse d'erreur")
        ->expect("{$ns}\\Http\\Middleware")
        ->not->toUse(JsonResponse::class);

    // Une règle par namespace : avec un tableau en cible, Pest ne détecte pas la négation.
    foreach (['Data', 'Events', 'PublicApi'] as $public) {
        arch("{$module} : {$public} n'expose pas de modèle")
            ->expect("{$ns}\\{$public}")
            ->not->toUse("{$ns}\\Models");
    }

    test("{$module} : routes.php ne référence aucun autre module", function () use ($module, $dossierModule): void {
        $routes = $dossierModule.'/Http/routes.php';
        $source = is_file($routes) ? (string) file_get_contents($routes) : '';

        preg_match_all('/App\\\\Modules\\\\(\w+)\\\\/', $source, $m);

        expect(array_values(array_diff(array_unique($m[1]), [$module])))->toBe([]);
    });

    arch("{$module} : contrôleurs mono-action")
        ->expect("{$ns}\\Http\\Controllers")
        ->toHaveSuffix('Controller')
        ->toHaveMethod('__invoke');

    arch("{$module} : actions avec handle()")
        ->expect("{$ns}\\Actions")
        ->toHaveMethod('handle');

    arch("{$module} : FormRequest")
        ->expect("{$ns}\\Http\\Requests")
        ->toExtend(FormRequest::class)
        ->toHaveSuffix('Request')
        ->toHaveMethod('rules');

    arch("{$module} : API Resources")
        ->expect("{$ns}\\Http\\Resources")
        ->toExtend(JsonResource::class)
        ->toHaveSuffix('Resource');

    arch("{$module} : DTO immuables")
        ->expect("{$ns}\\Data")
        ->toBeReadonly();

    arch("{$module} : événements dispatchés après commit")
        ->expect("{$ns}\\Events")
        ->toImplement(ShouldDispatchAfterCommit::class);

    arch("{$module} : modèles cloisonnés par organisation")
        ->expect("{$ns}\\Models")
        ->toUseTrait(BelongsToOrganization::class)
        ->ignoring($horsOrganisation);

    arch("{$module} : modèles identifiés par UUID")
        ->expect("{$ns}\\Models")
        ->toUseTrait(HasUuids::class);

    arch("{$module} : modèles Eloquent")
        ->expect("{$ns}\\Models")
        ->toExtend(Model::class)
        ->not->toHaveSuffix('Model');

    arch("{$module} : enums")
        ->expect("{$ns}\\Enums")
        ->toBeEnums();

    arch("{$module} : policies")
        ->expect("{$ns}\\Policies")
        ->toHaveSuffix('Policy');

    arch("{$module} : listeners")
        ->expect("{$ns}\\Listeners")
        ->toHaveMethod('handle');

    arch("{$module} : provider")
        ->expect("{$ns}\\{$module}ServiceProvider")
        ->toExtend(ServiceProvider::class);
}
