<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as R;

/**
 * @return list<array{name: string, verb: string, path: string, level: string, individual?: true}>
 */
function routesReporting(): array
{
    return [
        ['name' => 'reporting.home.landlord', 'verb' => 'GET', 'path' => '/home/landlord', 'level' => 'read', 'individual' => true],
        ['name' => 'reporting.finance.aging', 'verb' => 'GET', 'path' => '/finance/aging', 'level' => 'read', 'individual' => true],
        ['name' => 'reporting.finance.revenueExpenses', 'verb' => 'GET', 'path' => '/finance/revenue-expenses?from=2026-01-01&to=2026-03-31', 'level' => 'read', 'individual' => true],
        ['name' => 'reporting.finance.occupancy', 'verb' => 'GET', 'path' => '/finance/occupancy?from=2026-01-01&to=2026-03-31', 'level' => 'read', 'individual' => true],
        ['name' => 'reporting.home.agencyKpis', 'verb' => 'GET', 'path' => '/home/agency-kpis', 'level' => 'read'],
        ['name' => 'reporting.home.agencyPayouts', 'verb' => 'GET', 'path' => '/home/agency-payouts', 'level' => 'read'],
        ['name' => 'reporting.home.agencyAlerts', 'verb' => 'GET', 'path' => '/home/agency-alerts', 'level' => 'read'],
        ['name' => 'reporting.reports.index', 'verb' => 'GET', 'path' => '/management-reports', 'level' => 'read'],
        ['name' => 'reporting.reports.show', 'verb' => 'GET', 'path' => '/management-reports/{r}', 'level' => 'read'],
        ['name' => 'reporting.mandants.statement', 'verb' => 'GET', 'path' => '/mandants/{m}/statement', 'level' => 'read'],
        ['name' => 'reporting.reports.store', 'verb' => 'POST', 'path' => '/management-reports', 'level' => 'prepare'],
        ['name' => 'reporting.reports.update', 'verb' => 'PATCH', 'path' => '/management-reports/{r}', 'level' => 'prepare'],
        ['name' => 'reporting.reports.generate', 'verb' => 'POST', 'path' => '/management-reports/{r}/generate', 'level' => 'prepare'],
        ['name' => 'reporting.reports.discard', 'verb' => 'POST', 'path' => '/management-reports/{r}/discard', 'level' => 'prepare'],
        ['name' => 'reporting.reports.pdf', 'verb' => 'GET', 'path' => '/management-reports/{r}/pdf', 'level' => 'read'],
        ['name' => 'reporting.reports.publish', 'verb' => 'POST', 'path' => '/management-reports/{r}/publish', 'level' => 'publish'],
        ['name' => 'reporting.reports.unschedule', 'verb' => 'DELETE', 'path' => '/management-reports/{r}/schedule', 'level' => 'publish'],
        ['name' => 'reporting.reports.rectify', 'verb' => 'POST', 'path' => '/management-reports/{r}/rectify', 'level' => 'publish'],
        ['name' => 'reporting.reports.lines', 'verb' => 'GET', 'path' => '/management-reports/{r}/lines.csv', 'level' => 'export'],
    ];
}

/**
 * Routes réservées au bailleur autonome : leur accès (403 `reporting_landlord_only` pour une agence, rôles, exports) est couvert par FinanceAccessTest.
 *
 * @return list<string>
 */
function routesReportingBailleur(): array
{
    return ['reporting.finance.profitability', 'reporting.finance.forecast', 'reporting.forecast.assumptions', 'reporting.finance.exports'];
}

function appelerReporting(object $test, array $route, object $org): TestResponse
{
    $chemin = str_replace(['{r}', '{m}'], [(string) Str::uuid(), (string) Str::uuid()], $route['path']);

    return $test->json($route['verb'], R::url($org, $chemin), [], ['Idempotency-Key' => 'cle-acces-'.bin2hex(random_bytes(4))]);
}

beforeEach(function (): void {
    ['org' => $this->org] = R::agence($this);
    $this->routes = routesReporting();
});

it('couvre toutes les routes reporting.* du routeur', function (): void {
    $noms = collect(Route::getRoutes()->getRoutes())->map(fn ($r) => $r->getName())->filter(fn ($n) => is_string($n) && str_starts_with($n, 'reporting.') && ! str_starts_with($n, 'reporting.owner.') && ! str_starts_with($n, 'reporting.console.') && ! in_array($n, routesReportingBailleur(), true))->values()->all();

    expect(array_diff($noms, array_column($this->routes, 'name')))->toBe([])->and(array_diff(array_column($this->routes, 'name'), $noms))->toBe([]);
});

it('401 sans jeton sur chaque route', function (): void {
    auth()->forgetGuards();
    $echecs = [];

    foreach ($this->routes as $route) {
        $statut = appelerReporting($this, $route, $this->org)->getStatusCode();
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
        $r = appelerReporting($this, $route, $this->org);
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
        $r = appelerReporting($this, $route, $this->org);
        ($r->getStatusCode() === 404 && $r->json('code') === 'organization_not_found') || $echecs[] = "{$route['name']} : {$r->getStatusCode()}";
    }

    expect($echecs)->toBe([]);
});

it('403 reporting_agency_only pour une organisation de particulier', function (): void {
    $perso = C::organisation(OrganizationKind::Individual, 'Mon patrimoine');
    X::changer();
    $this->actingAs(L::titulaire($perso));
    $echecs = [];

    foreach ($this->routes as $route) {
        $r = appelerReporting($this, $route, $perso);
        $ok = isset($route['individual']) ? $r->getStatusCode() === 200 : $r->getStatusCode() === 403 && $r->json('code') === 'reporting_agency_only';
        $ok || $echecs[] = "{$route['name']} : {$r->getStatusCode()} ".$r->json('code');
    }

    expect($echecs)->toBe([]);
});

it('un comptable lit et prépare mais ne publie ni ne rectifie', function (): void {
    X::changer();
    $compte = L::membre($this->org, MemberRole::Accountant);
    activerDeuxFacteurs($compte);
    $this->actingAs($compte);
    $echecs = [];

    foreach ($this->routes as $route) {
        $statut = appelerReporting($this, $route, $this->org)->getStatusCode();
        ($route['level'] === 'publish' ? $statut === 403 : $statut !== 403) || $echecs[] = "{$route['name']} ({$route['level']}) : {$statut}";
    }

    expect($echecs)->toBe([]);
});

it('un gestionnaire publie mais n\'exporte pas les lignes', function (): void {
    X::changer();
    $this->actingAs(L::membre($this->org, MemberRole::Manager));
    $echecs = [];

    foreach ($this->routes as $route) {
        $statut = appelerReporting($this, $route, $this->org)->getStatusCode();
        ($route['level'] === 'export' ? $statut === 403 : $statut !== 403) || $echecs[] = "{$route['name']} ({$route['level']}) : {$statut}";
    }

    expect($echecs)->toBe([]);
});

it('l\'export exige la double authentification', function (): void {
    X::changer();
    $this->actingAs(L::membre($this->org, MemberRole::Accountant));
    $r = appelerReporting($this, ['verb' => 'GET', 'path' => '/management-reports/{r}/lines.csv'], $this->org);

    expect($r->getStatusCode())->toBe(403)->and($r->json('code'))->toBe('two_factor_required');
});

it('un administrateur et un propriétaire accèdent à toutes les routes', function (MemberRole $role): void {
    X::changer();
    $compte = L::membre($this->org, $role);
    activerDeuxFacteurs($compte);
    $this->actingAs($compte);
    $echecs = [];

    foreach ($this->routes as $route) {
        $statut = appelerReporting($this, $route, $this->org)->getStatusCode();
        in_array($statut, [401, 403], true) && $echecs[] = "{$route['name']} : {$statut}";
    }

    expect($echecs)->toBe([]);
})->with([MemberRole::Admin, MemberRole::Owner]);

it('toute réponse du module est privée et sans mise en cache', function (): void {
    $r = $this->getJson(R::url($this->org, '/management-reports'))->assertOk();

    expect($r->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');
    $this->getJson(R::url($this->org, '/management-reports/'.Str::uuid()))->assertNotFound()->assertHeader('Cache-Control', 'no-store, private');
});
