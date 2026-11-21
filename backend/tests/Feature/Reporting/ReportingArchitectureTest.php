<?php

declare(strict_types=1);
use App\Modules\Reporting\Http\Middleware\RequireLandlordOrganization;
use Illuminate\Support\Facades\Route;

/**
 * @return list<string>
 */
function fichiersReporting(): array
{
    $iterateur = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Modules/Reporting'), FilesystemIterator::SKIP_DOTS));
    $fichiers = [];

    foreach ($iterateur as $f) {
        if ($f instanceof SplFileInfo && in_array($f->getExtension(), ['php'], true)) {
            $fichiers[] = $f->getPathname();
        }
    }

    sort($fichiers);

    return $fichiers;
}

function contenu(string $fichier): string
{
    return (string) file_get_contents($fichier);
}

it('Reporting ne lit jamais le grand livre en SQL : aucune référence à journal_* ni à accounts', function (): void {
    $fautifs = array_filter(fichiersReporting(), fn (string $f): bool => preg_match('/journal_(entries|lines)|[\'"` ]accounts[\'"` ]/', contenu($f)) === 1);

    expect(array_values($fautifs))->toBe([]);
});

it('Reporting n\'écrit en SQL que dans Support/Own et ses migrations', function (): void {
    $motif = '/->(insert|insertOrIgnore|insertGetId|upsert|update|delete|truncate|increment|decrement)\(|DB::(statement|unprepared|insert|update|delete)\(/';
    $fautifs = array_filter(fichiersReporting(), fn (string $f): bool => ! str_contains($f, '/Support/Own/') && ! str_contains($f, '/Database/') && preg_match($motif, contenu($f)) === 1);

    expect(array_values($fautifs))->toBe([]);
});

it('Reporting n\'importe aucun modèle, action, listener ni requête d\'un autre module', function (): void {
    $fautifs = [];

    foreach (fichiersReporting() as $f) {
        preg_match_all('/^use App\\\\Modules\\\\(?!Reporting)(?!Identity\\\\Models\\\\User;)(\w+)\\\\(Models|Actions|Http|Policies|Database|Listeners|Queries|Support)\\\\/m', contenu($f), $m, PREG_SET_ORDER);

        foreach ($m as $ligne) {
            $fautifs[] = basename($f).' : '.$ligne[0];
        }
    }

    expect($fautifs)->toBe([]);
});

it('Reporting ne manipule aucun montant en virgule flottante', function (): void {
    $fautifs = array_filter(fichiersReporting(), fn (string $f): bool => ! str_contains($f, '/Views/') && preg_match('/\(float\)|floatval|\bfloat\b|\bround\(|\bdouble\b/', contenu($f)) === 1);

    expect(array_values($fautifs))->toBe([]);
});

it('aucun fichier de Reporting ne dépasse 400 lignes et aucune vue n\'échappe une donnée', function (): void {
    $longs = array_filter(fichiersReporting(), fn (string $f): bool => substr_count(contenu($f), "\n") > 400);
    $bruts = array_filter(glob(app_path('Modules/Reporting/Views/*.blade.php')) ?: [], fn (string $f): bool => str_contains(contenu($f), '{!!'));

    expect(array_values($longs))->toBe([])->and(array_values($bruts))->toBe([]);
});

it('Reporting ne mentionne jamais e-MECeF ni ne code une adresse e-mail ou un rôle opérateur en dur', function (): void {
    $fautifs = array_filter(fichiersReporting(), fn (string $f): bool => preg_match('/mecef|@[a-z0-9-]+\.(com|fr|org)|operators/i', contenu($f)) === 1);

    expect(array_values($fautifs))->toBe([]);
});

it('Reporting n\'importe Investments et Leases que par PublicApi, Data et Enums', function (): void {
    $fautifs = [];

    foreach (fichiersReporting() as $f) {
        preg_match_all('/^use App\\\\Modules\\\\(Investments|Leases)\\\\(?!(PublicApi|Data|Enums)\\\\)[\w\\\\]+;/m', contenu($f), $m, PREG_SET_ORDER);

        foreach ($m as $ligne) {
            $fautifs[] = basename($f).' : '.$ligne[0];
        }
    }

    expect($fautifs)->toBe([]);
});

it('les routes du bailleur autonome portent reporting.landlord, celles de l\'agence ne le portent pas', function (): void {
    $routes = ['reporting.finance.profitability', 'reporting.finance.forecast', 'reporting.forecast.assumptions', 'reporting.finance.exports'];
    $libres = ['reporting.finance.revenueExpenses', 'reporting.finance.occupancy', 'reporting.finance.aging'];
    $middlewares = fn (string $nom): array => array_map(strval(...), app('router')->gatherRouteMiddleware(Route::getRoutes()->getByName($nom) ?? throw new RuntimeException($nom)));

    foreach ($routes as $nom) {
        expect($middlewares($nom))->toContain(RequireLandlordOrganization::class);
    }

    foreach ($libres as $nom) {
        expect($middlewares($nom))->not->toContain(RequireLandlordOrganization::class);
    }
});

it('les requêtes financières n\'acceptent jamais de montant, de devise ni d\'identifiant d\'organisation du client', function (): void {
    $sources = array_filter(fichiersReporting(), fn (string $f): bool => str_contains($f, '/Http/Requests/') && preg_match('/Finance|Profitability|ForecastAssumptions/', basename($f)) === 1);
    $fautifs = array_filter($sources, fn (string $f): bool => preg_match("/'(organization_id|currency|rate_bp|gross_bp|net_bp)'\\s*=>/", contenu($f)) === 1);

    expect($sources)->not->toBe([])->and(array_values($fautifs))->toBe([]);
});
