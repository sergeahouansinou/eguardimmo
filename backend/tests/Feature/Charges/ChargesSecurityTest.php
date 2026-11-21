<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Routing\Route;
use Tests\Feature\Charges\ChargesContext as C;

beforeEach(function (): void {
    C::preparer($this);
});

/**
 * @return list<Route>
 */
function routesCharges(): array
{
    return array_values(array_filter(
        iterator_to_array(app('router')->getRoutes()),
        fn (Route $r): bool => str_starts_with((string) $r->getName(), 'charges.'),
    ));
}

function adresseCharges(Route $route, ?string $organisation): string
{
    $uri = '/'.ltrim($route->uri(), '/');
    $uri = str_replace('{organization}', $organisation ?? '0197f0a0-0000-7000-8000-000000000001', $uri);

    return (string) preg_replace('/\{[^}]+\}/', '0197f0a0-0000-7000-8000-000000000002', $uri);
}

it('toute route de Charges exige une authentification, un nom préfixé et une réponse privée', function (): void {
    $routes = routesCharges();

    expect(count($routes))->toBeGreaterThanOrEqual(7);

    foreach ($routes as $route) {
        $methode = $route->methods()[0];
        $this->json($methode, adresseCharges($route, null))->assertUnauthorized();
        expect($route->gatherMiddleware())->toContain('auth:sanctum');
    }
});

it('un compte étranger à l\'organisation n\'atteint aucune route de Charges', function (): void {
    $scene = C::agence();
    $etranger = User::factory()->create();
    C::comme($this, $etranger);

    foreach (routesCharges() as $route) {
        if (! str_contains($route->uri(), '{organization}')) {
            continue;
        }

        $reponse = $this->json($route->methods()[0], adresseCharges($route, $scene['org']->id));
        expect($reponse->status())->toBeIn([403, 404], $route->getName().' -> '.$reponse->status());
    }
});

it('une dépense d\'une autre organisation reste introuvable', function (): void {
    $a = C::autonome();
    C::comme($this, $a['owner']);
    $id = C::depense($this, $a)->assertCreated()->json('data.id');

    $b = C::autonome();
    C::comme($this, $b['owner']);

    $this->getJson(C::url($b['org'], "/expenses/{$id}"))->assertNotFound()->assertJsonPath('code', 'expense_not_found');
    $this->postJson(C::url($b['org'], "/expenses/{$id}/cancel"), ['reason' => 'Intrusion'])->assertNotFound();
    $this->postJson(C::url($b['org'], "/expenses/{$id}/approve"))->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    C::avecPreuve($this, $b['owner']);
    $this->postJson(C::url($b['org'], "/expenses/{$id}/approve"))->assertNotFound();
    $this->getJson(C::url($a['org'], "/expenses/{$id}"))->assertNotFound();
    expect($this->getJson(C::url($b['org'], '/expenses'))->assertOk()->json('data'))->toBe([]);
});

it('un lot ou un bien d\'une autre organisation est refusé à la saisie', function (): void {
    $a = C::autonome();
    $b = C::autonome();
    C::comme($this, $a['owner']);

    C::depense($this, [...$a, 'property' => $b['property'], 'unit' => $b['unit']])->assertNotFound();
});

it('tous les rôles de l\'équipe lisent, aucun compte hors équipe n\'écrit', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    $id = C::depense($this, $scene)->assertCreated()->json('data.id');

    foreach ([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager, MemberRole::Accountant] as $role) {
        C::comme($this, $role === MemberRole::Owner ? $scene['owner'] : C::membre($scene['org'], $role));
        $this->getJson(C::url($scene['org'], "/expenses/{$id}"))->assertOk();
        $this->getJson(C::url($scene['org'], '/expenses'))->assertOk();
    }
});

it('refuse le jeton opérateur sur les routes de Charges', function (): void {
    foreach (routesCharges() as $route) {
        expect($route->gatherMiddleware())->toContain('no-operator-token');
    }
});

it('chaque réponse de Charges est privée et jamais mise en cache', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);

    $this->getJson(C::url($scene['org'], '/expenses'))->assertOk()->assertHeader('Cache-Control', 'no-store, private');
});
