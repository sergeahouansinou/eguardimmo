<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\User;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as Routes;
use Tests\Feature\Console\ConsoleContext as C;

/**
 * @return list<Route>
 */
function routesProtegeesDeLaConsole(): array
{
    return array_values(array_filter(
        Routes::getRoutes()->getRoutes(),
        fn (Route $route): bool => str_starts_with($route->uri(), 'api/v1/console/') && in_array('space:operator', $route->gatherMiddleware(), true),
    ));
}

/**
 * @return list<string>
 */
function rolesAutorisesDeLaRoute(Route $route): array
{
    $autorises = array_map(fn (OperatorRole $r): string => $r->value, OperatorRole::cases());

    foreach ($route->gatherMiddleware() as $middleware) {
        if (is_string($middleware) && str_starts_with($middleware, 'operator:')) {
            $liste = explode(',', substr($middleware, strlen('operator:')));
            $autorises = array_values(array_intersect($autorises, $liste === ['any'] ? $autorises : $liste));
        }
    }

    return $autorises;
}

function urlDeLaRoute(Route $route): string
{
    return '/'.preg_replace('/\{[^}]+\}/', C::UUID_INCONNU, $route->uri());
}

function methodeDeLaRoute(Route $route): string
{
    return $route->methods()[0];
}

function estUneEcriture(Route $route): bool
{
    return ! in_array(methodeDeLaRoute($route), ['GET', 'HEAD'], true);
}

function estLaDeconnexion(Route $route): bool
{
    return $route->getName() === 'identity.console.token.destroy';
}

it('exige operator:{rôles}, un débit et, pour une écriture, la preuve 2FA sur chaque route console', function (): void {
    foreach (routesProtegeesDeLaConsole() as $route) {
        $middleware = $route->gatherMiddleware();

        expect(collect($middleware)->contains(fn ($m): bool => is_string($m) && str_starts_with($m, 'operator:')))->toBeTrue("{$route->uri()} sans operator:")
            ->and(collect($middleware)->contains(fn ($m): bool => is_string($m) && str_starts_with($m, 'throttle:')) || estLaDeconnexion($route))->toBeTrue("{$route->uri()} sans débit");

        if (estUneEcriture($route) && ! estLaDeconnexion($route)) {
            expect(in_array('operator-proof', $middleware, true))->toBeTrue("{$route->uri()} : écriture sans preuve 2FA");
        }
    }
});

it('répond 401 sans jeton et 403 à une session par cookie, sur chaque route console', function (): void {
    $operateur = C::operateur();

    foreach (routesProtegeesDeLaConsole() as $route) {
        C::reinitialiser($this);
        $this->json(methodeDeLaRoute($route), urlDeLaRoute($route))->assertUnauthorized();

        auth()->forgetGuards();
        $this->actingAs($operateur['user'], 'web')->withHeader('Referer', 'http://localhost:3000/')
            ->json(methodeDeLaRoute($route), urlDeLaRoute($route))->assertForbidden()->assertJsonPath('code', 'operator_token_required');
    }
});

it('refuse un jeton console sans double authentification confirmée ou d\'un compte non opérateur', function (): void {
    $sans2fa = C::operateur(['admin'], 'Sans 2FA', false)['jeton'];
    $simple = User::factory()->create();
    $jetonSimple = $simple->createToken('console', ['operator'])->plainTextToken;

    foreach (routesProtegeesDeLaConsole() as $route) {
        C::reinitialiser($this);
        $this->withToken($sans2fa)->json(methodeDeLaRoute($route), urlDeLaRoute($route))->assertForbidden()->assertJsonPath('code', 'operator_token_required');

        C::reinitialiser($this);
        $this->withToken($jetonSimple)->json(methodeDeLaRoute($route), urlDeLaRoute($route))->assertForbidden()->assertJsonPath('code', 'operator_token_required');
    }
});

it('refuse 403 operator_role_required à un opérateur sans rôle ou dont aucun rôle n\'est autorisé, sur chaque route console', function (): void {
    $sansRole = C::operateur([], 'Sans rôle')['jeton'];
    $parRole = [];

    foreach (OperatorRole::cases() as $role) {
        $parRole[$role->value] = C::operateur([$role->value], 'Rôle '.$role->value)['jeton'];
    }

    foreach (routesProtegeesDeLaConsole() as $route) {
        C::reinitialiser($this);
        $this->withToken($sansRole)->json(methodeDeLaRoute($route), urlDeLaRoute($route))->assertForbidden()->assertJsonPath('code', 'operator_role_required');

        foreach (array_diff(array_keys($parRole), rolesAutorisesDeLaRoute($route)) as $interdit) {
            C::reinitialiser($this);
            $this->withToken($parRole[$interdit])->json(methodeDeLaRoute($route), urlDeLaRoute($route))->assertForbidden()->assertJsonPath('code', 'operator_role_required');
        }
    }
});

it('exige la preuve 2FA à chaque écriture console : absente ou fausse, 422 avant toute autre vérification', function (): void {
    foreach (routesProtegeesDeLaConsole() as $route) {
        if (! estUneEcriture($route) || estLaDeconnexion($route)) {
            continue;
        }

        $role = rolesAutorisesDeLaRoute($route)[0];
        $operateur = C::operateur([$role], 'Écrivain');

        C::ecrireBrut($this, $operateur['jeton'], methodeDeLaRoute($route), urlDeLaRoute($route))->assertUnprocessable()->assertJsonPath('code', 'operator_proof_required');
        C::ecrireBrut($this, $operateur['jeton'], methodeDeLaRoute($route), urlDeLaRoute($route), ['two_factor_code' => '000000'])->assertUnprocessable()->assertJsonPath('code', 'operator_proof_invalid');
    }
});
