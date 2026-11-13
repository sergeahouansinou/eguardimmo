<?php

declare(strict_types=1);

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as Routes;

// Toute route publique est une décision explicite : elle doit figurer ici.
const ROUTES_PUBLIQUES = [];

/**
 * @return list<Route>
 */
function routesApi(): array
{
    return array_values(array_filter(
        Routes::getRoutes()->getRoutes(),
        fn (Route $route): bool => str_starts_with($route->uri(), 'api/'),
    ));
}

it('protège chaque route API par auth:sanctum sauf liste blanche', function (): void {
    $nonProtegees = array_map(
        fn (Route $route): string => $route->uri(),
        array_filter(
            routesApi(),
            fn (Route $route): bool => ! in_array('auth:sanctum', $route->gatherMiddleware(), true)
                && ! in_array($route->uri(), ROUTES_PUBLIQUES, true),
        ),
    );

    expect(array_values($nonProtegees))->toBe([]);
});

it('nomme chaque route API avec le préfixe de son module, sans doublon', function (): void {
    $noms = [];

    foreach (routesApi() as $route) {
        $nom = $route->getName();
        preg_match('/^App\\\\Modules\\\\(\w+)\\\\/', $route->getActionName(), $m);

        expect($nom)->not->toBeNull()
            ->and($m)->not->toBeEmpty()
            ->and($nom)->toStartWith(lcfirst($m[1]).'.');

        $noms[] = $nom;
    }

    expect($noms)->toBe(array_values(array_unique($noms)));
});
