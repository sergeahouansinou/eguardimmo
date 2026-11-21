<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;

/**
 * @return list<array{name: string, verb: string, path: string, level: string}>
 */
function routesFonds(): array
{
    $b = '{b}';
    $i = '{i}';

    return [
        ['name' => 'ownerFunds.mandants.account', 'verb' => 'GET', 'path' => '/owner-funds/mandants/{m}/account', 'level' => 'read'],
        ['name' => 'ownerFunds.payouts.preview', 'verb' => 'GET', 'path' => '/owner-funds/payouts/preview', 'level' => 'read'],
        ['name' => 'ownerFunds.batches.index', 'verb' => 'GET', 'path' => '/owner-funds/batches', 'level' => 'read'],
        ['name' => 'ownerFunds.batches.show', 'verb' => 'GET', 'path' => "/owner-funds/batches/{$b}", 'level' => 'read'],
        ['name' => 'ownerFunds.holds.index', 'verb' => 'GET', 'path' => '/owner-funds/holds', 'level' => 'read'],
        ['name' => 'ownerFunds.fees.index', 'verb' => 'GET', 'path' => '/owner-funds/fees', 'level' => 'read'],
        ['name' => 'ownerFunds.fees.simulate', 'verb' => 'POST', 'path' => '/owner-funds/fees/simulations', 'level' => 'prepare'],
        ['name' => 'ownerFunds.trust.deposits.index', 'verb' => 'GET', 'path' => '/owner-funds/trust/deposits', 'level' => 'read'],
        ['name' => 'ownerFunds.trust.coverage', 'verb' => 'GET', 'path' => '/owner-funds/trust/coverage', 'level' => 'read'],
        ['name' => 'ownerFunds.payoutAccountRequests.index', 'verb' => 'GET', 'path' => '/owner-funds/payout-account-requests', 'level' => 'read'],
        ['name' => 'ownerFunds.batches.store', 'verb' => 'POST', 'path' => '/owner-funds/batches', 'level' => 'prepare'],
        ['name' => 'ownerFunds.items.include', 'verb' => 'POST', 'path' => "/owner-funds/batches/{$b}/items/{$i}/include", 'level' => 'prepare'],
        ['name' => 'ownerFunds.items.exclude', 'verb' => 'POST', 'path' => "/owner-funds/batches/{$b}/items/{$i}/exclude", 'level' => 'prepare'],
        ['name' => 'ownerFunds.holds.store', 'verb' => 'POST', 'path' => '/owner-funds/holds', 'level' => 'prepare'],
        ['name' => 'ownerFunds.holds.release', 'verb' => 'POST', 'path' => '/owner-funds/holds/{h}/release', 'level' => 'sensitive'],
        ['name' => 'ownerFunds.batches.validate', 'verb' => 'POST', 'path' => "/owner-funds/batches/{$b}/validate", 'level' => 'sensitive'],
        ['name' => 'ownerFunds.items.execute', 'verb' => 'POST', 'path' => "/owner-funds/batches/{$b}/items/{$i}/execute", 'level' => 'sensitive'],
        ['name' => 'ownerFunds.items.fail', 'verb' => 'POST', 'path' => "/owner-funds/batches/{$b}/items/{$i}/fail", 'level' => 'sensitive'],
        ['name' => 'ownerFunds.items.return', 'verb' => 'POST', 'path' => "/owner-funds/batches/{$b}/items/{$i}/return", 'level' => 'sensitive'],
        ['name' => 'ownerFunds.batches.cancel', 'verb' => 'POST', 'path' => "/owner-funds/batches/{$b}/cancel", 'level' => 'sensitive'],
        ['name' => 'ownerFunds.trust.withdrawals.store', 'verb' => 'POST', 'path' => '/owner-funds/trust/withdrawals', 'level' => 'sensitive'],
        ['name' => 'ownerFunds.trust.deposits.store', 'verb' => 'POST', 'path' => '/owner-funds/trust/deposits', 'level' => 'sensitive'],
        ['name' => 'ownerFunds.trust.deposits.confirm', 'verb' => 'POST', 'path' => '/owner-funds/trust/deposits/{h}/confirm', 'level' => 'sensitive'],
        ['name' => 'ownerFunds.periods.close', 'verb' => 'POST', 'path' => '/accounting/periods/close', 'level' => 'sensitive'],
        ['name' => 'ownerFunds.payoutAccountRequests.approve', 'verb' => 'POST', 'path' => '/owner-funds/payout-account-requests/{h}/approve', 'level' => 'sensitive'],
        ['name' => 'ownerFunds.payoutAccountRequests.reject', 'verb' => 'POST', 'path' => '/owner-funds/payout-account-requests/{h}/reject', 'level' => 'sensitive'],
        ['name' => 'ownerFunds.payoutAccountRequests.proof', 'verb' => 'GET', 'path' => '/owner-funds/payout-account-requests/{h}/proof', 'level' => 'sensitive'],
        ['name' => 'ownerFunds.batches.export', 'verb' => 'GET', 'path' => "/owner-funds/batches/{$b}/export", 'level' => 'sensitive'],
    ];
}

function appelerFonds(object $test, array $route, object $org, array $ids = []): TestResponse
{
    $chemin = str_replace(['{b}', '{i}', '{m}', '{h}'], [$ids['b'] ?? (string) Str::uuid(), $ids['i'] ?? (string) Str::uuid(), $ids['m'] ?? (string) Str::uuid(), $ids['h'] ?? (string) Str::uuid()], $route['path']);

    return $test->json($route['verb'], "/api/v1/org/{$org->id}{$chemin}", [], ['Idempotency-Key' => 'cle-acces-'.bin2hex(random_bytes(4))]);
}

beforeEach(function (): void {
    ['org' => $this->org] = F::agence($this);
    $this->routes = routesFonds();
});

it('couvre toutes les routes ownerFunds.* du routeur', function (): void {
    $noms = collect(Route::getRoutes()->getRoutes())->map(fn ($r) => $r->getName())->filter(fn ($n) => is_string($n) && str_starts_with($n, 'ownerFunds.') && ! str_starts_with($n, 'ownerFunds.owner.'))->values()->all();
    $couvertes = array_column($this->routes, 'name');

    expect(array_diff($noms, $couvertes))->toBe([])->and(array_diff($couvertes, $noms))->toBe([]);
});

it('401 sans jeton sur chaque route', function (): void {
    auth()->forgetGuards();
    $echecs = [];

    foreach ($this->routes as $route) {
        $statut = appelerFonds($this, $route, $this->org)->getStatusCode();
        $statut === 401 || $echecs[] = "{$route['name']} : {$statut}";
    }

    expect($echecs)->toBe([]);
});

it('403 operator_token_forbidden pour un jeton opérateur, même membre', function (): void {
    $compte = L::membre($this->org, MemberRole::Owner);
    X::changer();
    $this->withToken(X::jetonOperateur($compte));
    $echecs = [];

    foreach ($this->routes as $route) {
        $r = appelerFonds($this, $route, $this->org);
        ($r->getStatusCode() === 403 && $r->json('code') === 'operator_token_forbidden') || $echecs[] = "{$route['name']} : {$r->getStatusCode()}";
    }

    expect($echecs)->toBe([]);
});

it('404 organization_not_found pour un compte non membre', function (): void {
    $autre = C::organisation(nom: 'Autre agence');
    X::changer();
    $this->actingAs(L::titulaire($autre));
    $echecs = [];

    foreach ($this->routes as $route) {
        $r = appelerFonds($this, $route, $this->org);
        ($r->getStatusCode() === 404 && $r->json('code') === 'organization_not_found') || $echecs[] = "{$route['name']} : {$r->getStatusCode()}";
    }

    expect($echecs)->toBe([]);
});

it('403 owner_funds_agency_only pour une organisation de particulier', function (): void {
    $perso = C::organisation(OrganizationKind::Individual, 'Mon patrimoine');
    X::changer();
    $this->actingAs(L::titulaire($perso));
    $echecs = [];

    foreach ($this->routes as $route) {
        $r = appelerFonds($this, $route, $perso);
        ($r->getStatusCode() === 403 && $r->json('code') === 'owner_funds_agency_only') || $echecs[] = "{$route['name']} : {$r->getStatusCode()} ".$r->json('code');
    }

    expect($echecs)->toBe([]);
});

it('un gestionnaire lit et prépare mais ne touche ni aux validations, ni aux virements, ni à la clôture, ni à l\'export', function (): void {
    X::changer();
    $this->actingAs(L::membre($this->org, MemberRole::Manager));
    $echecs = [];

    foreach ($this->routes as $route) {
        $statut = appelerFonds($this, $route, $this->org)->getStatusCode();
        $interdit = $route['level'] === 'sensitive';
        ($interdit ? $statut === 403 : $statut !== 403) || $echecs[] = "{$route['name']} ({$route['level']}) : {$statut}";
    }

    expect($echecs)->toBe([]);
});

it('un comptable sans double authentification est refusé sur les routes sensibles et l\'export, pas sur la lecture ni la préparation', function (): void {
    X::changer();
    $this->actingAs(L::membre($this->org, MemberRole::Accountant));
    $echecs = [];

    foreach ($this->routes as $route) {
        $r = appelerFonds($this, $route, $this->org);
        $interdit = $route['level'] === 'sensitive';
        $ok = $interdit
            ? $r->getStatusCode() === 403 && $r->json('code') === 'two_factor_required'
            : $r->json('code') !== 'two_factor_required';
        $ok || $echecs[] = "{$route['name']} ({$route['level']}) : {$r->getStatusCode()} ".$r->json('code');
    }

    expect($echecs)->toBe([]);
});

it('un comptable et un administrateur accèdent à toutes les routes', function (MemberRole $role): void {
    X::changer();
    $compte = L::membre($this->org, $role);
    activerDeuxFacteurs($compte);
    $this->actingAs($compte);
    $echecs = [];

    foreach ($this->routes as $route) {
        $statut = appelerFonds($this, $route, $this->org)->getStatusCode();
        in_array($statut, [401, 403], true) && $echecs[] = "{$route['name']} : {$statut}";
    }

    expect($echecs)->toBe([]);
})->with([MemberRole::Accountant, MemberRole::Admin, MemberRole::Owner]);
