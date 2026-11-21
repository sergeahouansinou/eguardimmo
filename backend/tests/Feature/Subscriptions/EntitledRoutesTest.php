<?php

declare(strict_types=1);

use App\Modules\Subscriptions\Enums\Feature;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\Feature\Documents\DocumentsContext as D;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Subscriptions\QuotaContext as Q;

const PREFIXES_ENTITLED_PAR_FONCTION = [
    'documents.' => 'documents',
    'rent.' => 'rent',
    'banking.' => 'banking',
    'recovery.' => 'recovery',
    'charges.' => 'charges',
    'reporting.' => 'reporting',
    'mandates.' => 'mandates',
    'invoicing.' => 'invoicing',
    'maintenance.' => 'maintenance',
    'ownerFunds.' => 'owner_funds',
    'messaging.conversations.' => 'messaging',
    'notifications.campaigns.' => 'campaigns',
];

/**
 * @return list<LaravelRoute>
 */
function routesEcritureOrganisationEntitled(): array
{
    $routes = [];

    foreach (Route::getRoutes()->getRoutes() as $route) {
        if (! str_starts_with($route->uri(), 'api/v1/org/{organization}/') || array_diff($route->methods(), ['GET', 'HEAD']) === []) {
            continue;
        }

        $routes[] = $route;
    }

    return $routes;
}

function fonctionEntitledDeLaRoute(LaravelRoute $route): ?string
{
    foreach (PREFIXES_ENTITLED_PAR_FONCTION as $prefixe => $fonction) {
        if (str_starts_with((string) $route->getName(), $prefixe)) {
            return $fonction;
        }
    }

    return null;
}

it('pose entitled sur chaque écriture d\'organisation des modules rattachés à une fonction, après organization', function (): void {
    $verifiees = [];

    foreach (routesEcritureOrganisationEntitled() as $route) {
        $fonction = fonctionEntitledDeLaRoute($route);

        if ($fonction === null) {
            continue;
        }

        $middleware = $route->gatherMiddleware();
        $position = array_search("entitled:{$fonction}", $middleware, true);
        $organisation = array_values(array_filter(array_keys($middleware), fn (int $i): bool => is_string($middleware[$i]) && Str::startsWith($middleware[$i], 'organization')));

        expect($position)->not->toBeFalse("{$route->getName()} sans entitled:{$fonction}")
            ->and($organisation)->not->toBe([])
            ->and($position)->toBeGreaterThan($organisation[0]);
        $verifiees[$fonction] = true;
    }

    expect(array_keys($verifiees))->toEqualCanonicalizing(array_values(PREFIXES_ENTITLED_PAR_FONCTION));
});

it('ne référence que des fonctions de l\'enum', function (): void {
    foreach (PREFIXES_ENTITLED_PAR_FONCTION as $fonction) {
        expect(Feature::tryFrom($fonction))->not->toBeNull();
    }
});

it('refuse avec 403 feature_not_in_plan une écriture de chaque module quand la fonction est désactivée, sans bloquer la lecture', function (): void {
    Q::demarrer();
    $org = Q::organisation();
    $titulaire = L::titulaire($org);
    $parFonction = [];

    foreach (routesEcritureOrganisationEntitled() as $route) {
        $fonction = fonctionEntitledDeLaRoute($route);

        if ($fonction !== null && ! isset($parFonction[$fonction]) && in_array('POST', $route->methods(), true)) {
            $parFonction[$fonction] = $route;
        }
    }

    expect($parFonction)->toHaveCount(count(PREFIXES_ENTITLED_PAR_FONCTION));

    foreach ($parFonction as $fonction => $route) {
        Q::deroger($org, Feature::from($fonction), null, false);
        $uri = preg_replace_callback('/\{[^}]+\}/', fn (array $m): string => $m[0] === '{organization}' ? $org->id : (string) Str::uuid7(), $route->uri());

        Q::comme($this, $titulaire)->postJson('/'.$uri, [])->assertForbidden()
            ->assertJsonPath('code', 'feature_not_in_plan')->assertJsonPath('feature', $fonction);
    }

    Q::comme($this, $titulaire)->getJson(D::url($org, '/library'))->assertOk();
});

it('laisse passer l\'écriture d\'une organisation dont la fonction est active', function (): void {
    Q::demarrer();
    $org = Q::organisation();
    $titulaire = L::titulaire($org);
    Q::deroger($org, Feature::Rent, null, false);

    Q::comme($this, $titulaire)->postJson(D::url($org, '/files'), [])->assertUnprocessable();
});
