<?php

declare(strict_types=1);

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as Routes;

// Toute route publique est une décision explicite : elle doit figurer ici.
const ROUTES_PUBLIQUES = [
    'api/v1/auth/token',
    'api/v1/auth/email/verify/{id}/{hash}',
    'api/v1/auth/email/verification-notification',
    'api/v1/auth/password-reset/status',
    'api/v1/auth/token/two-factor',
    'api/v1/auth/social/{provider}/token',
    'api/v1/console/auth/token',
];

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

it('limite chaque route publique par throttle:auth', function (): void {
    foreach (routesApi() as $route) {
        if (! in_array('auth:sanctum', $route->gatherMiddleware(), true)) {
            expect($route->gatherMiddleware())->toContain('throttle:auth');
        }
    }
});

it('limite chaque route d\'authentification web par throttle:auth ou par le limiteur 2FA', function (string $nom, string $limiteur): void {
    $route = Routes::getRoutes()->getByName($nom);

    expect($route)->not->toBeNull()
        ->and($route?->gatherMiddleware())->toContain($limiteur);
})->with([
    ['login.store', 'throttle:auth'],
    ['identity.register', 'throttle:auth'],
    ['password.email', 'throttle:auth'],
    ['password.update', 'throttle:auth'],
    ['password.confirm.store', 'throttle:auth'],
    ['verification.send', 'throttle:auth'],
    ['user-password.update', 'throttle:auth'],
    ['two-factor.confirm', 'throttle:auth'],
    ['identity.reauthenticate.two-factor', 'throttle:auth'],
    ['identity.social.redirect', 'throttle:auth'],
    ['identity.social.link', 'throttle:auth'],
    ['identity.social.callback', 'throttle:auth'],
    ['two-factor.login.store', 'throttle:two-factor'],
]);

it('ne réserve /console qu\'aux jetons opérateur', function (): void {
    foreach (routesApi() as $route) {
        if (str_starts_with($route->uri(), 'api/v1/console/') && ! in_array($route->uri(), ROUTES_PUBLIQUES, true)) {
            expect($route->gatherMiddleware())->toContain('space:operator');
        }
    }
});
