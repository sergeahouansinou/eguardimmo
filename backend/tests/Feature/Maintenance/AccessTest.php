<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
});

/**
 * @return list<LaravelRoute>
 */
function routesMaintenance(string $espace): array
{
    return array_values(array_filter(
        Route::getRoutes()->getRoutes(),
        fn (LaravelRoute $route): bool => str_starts_with((string) $route->getName(), 'maintenance.') && str_contains($route->uri(), $espace === 'org' ? 'org/{organization}' : 'api/v1/tenant') || ($espace === 'tenant' && str_starts_with((string) $route->getName(), 'maintenance.tenant.')),
    ));
}

function adresse(LaravelRoute $route, ?string $organisation = null): string
{
    $uri = preg_replace('/\{organization\}/', $organisation ?? Str::uuid()->toString(), $route->uri());

    return '/'.preg_replace_callback('/\{[a-z]+\}/', fn (): string => Str::uuid()->toString(), (string) $uri);
}

function appeler(object $test, LaravelRoute $route, string $url): TestResponse
{
    return $test->json($route->methods()[0], $url, []);
}

/**
 * @return list<string>
 */
function rolesAutorises(LaravelRoute $route): array
{
    foreach ($route->gatherMiddleware() as $middleware) {
        if (is_string($middleware) && str_starts_with($middleware, 'organization:')) {
            return explode(',', substr($middleware, strlen('organization:')));
        }
    }

    return [];
}

it('expose 54 routes de maintenance, toutes nommées', function (): void {
    expect(count(routesMaintenance('org')))->toBe(44)
        ->and(count(array_filter(Route::getRoutes()->getRoutes(), fn (LaravelRoute $r): bool => str_starts_with((string) $r->getName(), 'maintenance.tenant.'))))->toBe(10);
});

it('401 sans jeton sur chaque route de maintenance', function (): void {
    auth()->forgetGuards();
    $verifiees = 0;

    foreach (Route::getRoutes()->getRoutes() as $route) {
        if (! str_starts_with((string) $route->getName(), 'maintenance.') || str_starts_with((string) $route->getName(), 'maintenance.owner.')) {
            continue;
        }

        appeler($this, $route, adresse($route, $this->scene['org']->id))->assertUnauthorized();
        $verifiees++;
    }

    expect($verifiees)->toBe(54);
});

it('404 sur l\'organisation pour un compte qui n\'en est pas membre, sur chaque route', function (): void {
    $etranger = L::titulaire(L::organisation());
    C::comme($this, $etranger);

    foreach (routesMaintenance('org') as $route) {
        appeler($this, $route, adresse($route, $this->scene['org']->id))->assertNotFound();
    }
});

it('applique la matrice de rôles déclarée sur chaque route d\'organisation', function (): void {
    $comptes = [];

    foreach (MemberRole::cases() as $role) {
        $comptes[$role->value] = L::membre($this->scene['org'], $role);

        if ($role->managesTeam() || $role === MemberRole::Accountant) {
            activerDeuxFacteurs($comptes[$role->value]);
        }
    }

    foreach (routesMaintenance('org') as $route) {
        $autorises = rolesAutorises($route);
        expect($autorises)->not->toBe([], "{$route->getName()} sans rôle déclaré");

        foreach ($comptes as $role => $compte) {
            C::comme($this, $compte);
            $reponse = appeler($this, $route, adresse($route, $this->scene['org']->id));

            if (in_array($role, $autorises, true)) {
                expect($reponse->status())->not->toBeIn([401, 403], "{$route->getName()} refusée à {$role}");
            } else {
                expect($reponse->status())->toBe(403, "{$route->getName()} ouverte à {$role}");
            }
        }
    }
});

it('refuse le jeton opérateur sur chaque route de maintenance', function (): void {
    $operateur = User::factory()->create();
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    C::comme($this, null);
    $jeton = $operateur->createToken('console', ['operator'])->plainTextToken;

    foreach (Route::getRoutes()->getRoutes() as $route) {
        if (! str_starts_with((string) $route->getName(), 'maintenance.')) {
            continue;
        }

        $reponse = $this->withToken($jeton)->json($route->methods()[0], adresse($route, $this->scene['org']->id), []);

        if (str_starts_with((string) $route->getName(), 'maintenance.tenant.')) {
            $reponse->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
        } else {
            expect($reponse->status())->toBeIn([403, 404]);
        }
    }
});

it('un compte d\'organisation n\'entre pas dans l\'espace locataire et inversement', function (): void {
    C::comme($this, $this->scene['owner']);
    $this->getJson(C::BASE.'/tenant/interventions')->assertForbidden()->assertJsonPath('code', 'space_forbidden');

    C::comme($this, $this->scene['tenant']);
    $this->getJson(C::url($this->scene['org'], '/interventions'))->assertNotFound();
});

it('cloisonne par organisation : une intervention d\'une autre agence reste introuvable, sans fuite', function (): void {
    $id = C::enDevis($this, $this->scene);
    $devis = (string) C::devis($this, $this->scene, $id, 10000)->assertCreated()->json('data.id');
    $autre = C::agence();
    C::comme($this, $autre['owner']);

    $this->getJson(C::url($autre['org'], "/interventions/{$id}"))->assertNotFound();
    $this->postJson(C::url($autre['org'], "/interventions/{$id}/cancel"), ['lock_version' => 3])->assertNotFound();
    $this->postJson(C::url($autre['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertNotFound();
    $this->postJson(C::url($autre['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertNotFound();
    $this->postJson(C::url($autre['org'], "/interventions/{$id}/visits/".Str::uuid().'/done'))->assertNotFound();
    $this->getJson(C::url($autre['org'], "/interventions/{$id}/invoices/".Str::uuid()))->assertNotFound();

    foreach ([['PATCH', ''], ['POST', '/qualify'], ['POST', '/comments'], ['POST', '/assign'], ['POST', '/complete'], ['POST', '/invoices'], ['POST', '/visits']] as [$verbe, $suffixe]) {
        expect($this->json($verbe, C::url($autre['org'], "/interventions/{$id}{$suffixe}"), ['lock_version' => 1])->status())->toBeIn([404, 422]);
    }

    $this->getJson(C::url($autre['org'], '/interventions'))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(C::url($this->scene['org'], "/interventions/{$id}"))->assertNotFound();
});

it('un locataire ne voit que les demandes de son bail : 404 pour celle d\'un autre locataire, même organisation', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    $voisin = C::voisin($this->scene['org']);
    C::comme($this, $voisin['tenant']);

    $this->getJson(C::BASE."/tenant/interventions/{$id}")->assertNotFound();
    $this->postJson(C::BASE."/tenant/interventions/{$id}/comments", ['text' => 'Bonjour'])->assertNotFound();
    $this->postJson(C::BASE."/tenant/interventions/{$id}/cancel")->assertNotFound();
    $this->getJson(C::BASE.'/tenant/interventions')->assertOk()->assertJsonCount(0, 'data');
});

it('les rôles sensibles sont fixés en clair, indépendamment de la déclaration des routes', function (): void {
    $comptes = [];

    foreach (MemberRole::cases() as $role) {
        $comptes[$role->value] = L::membre($this->scene['org'], $role);

        if ($role->managesTeam() || $role === MemberRole::Accountant) {
            activerDeuxFacteurs($comptes[$role->value]);
        }
    }

    $attendus = [
        'maintenance.allocations.store' => ['owner' => true, 'admin' => true, 'manager' => false, 'accountant' => true],
        'maintenance.allocations.cancel' => ['owner' => true, 'admin' => true, 'manager' => false, 'accountant' => true],
        'maintenance.payments.store' => ['owner' => true, 'admin' => true, 'manager' => false, 'accountant' => true],
        'maintenance.payments.cancel' => ['owner' => true, 'admin' => true, 'manager' => false, 'accountant' => true],
        'maintenance.invoices.store' => ['owner' => true, 'admin' => true, 'manager' => true, 'accountant' => true],
        'maintenance.interventions.store' => ['owner' => true, 'admin' => true, 'manager' => true, 'accountant' => false],
        'maintenance.interventions.engage' => ['owner' => true, 'admin' => true, 'manager' => true, 'accountant' => false],
        'maintenance.quotes.accept' => ['owner' => true, 'admin' => true, 'manager' => true, 'accountant' => false],
        'maintenance.approvals.record-decision' => ['owner' => true, 'admin' => true, 'manager' => true, 'accountant' => false],
        'maintenance.suppliers.store' => ['owner' => true, 'admin' => true, 'manager' => true, 'accountant' => false],
        'maintenance.interventions.index' => ['owner' => true, 'admin' => true, 'manager' => true, 'accountant' => true],
        'maintenance.quotes.index' => ['owner' => true, 'admin' => true, 'manager' => true, 'accountant' => true],
        'maintenance.files.download' => ['owner' => true, 'admin' => true, 'manager' => true, 'accountant' => true],
    ];

    foreach ($attendus as $nom => $roles) {
        $route = Route::getRoutes()->getByName($nom);

        foreach ($roles as $role => $autorise) {
            C::comme($this, $comptes[$role]);
            $statut = appeler($this, $route, adresse($route, $this->scene['org']->id))->status();

            if ($autorise) {
                expect($statut)->not->toBeIn([401, 403], "{$nom} refusée à {$role}");
            } else {
                expect($statut)->toBe(403, "{$nom} ouverte à {$role}");
            }
        }
    }
});
