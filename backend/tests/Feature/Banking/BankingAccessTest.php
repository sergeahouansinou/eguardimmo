<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\Rent\RentContext as C;

/**
 * @return list<array{name: string, verb: string, path: string, level: string}>
 */
function bkRoutes(): array
{
    return [
        ['name' => 'banking.accounts.index', 'verb' => 'GET', 'path' => '/accounts', 'level' => 'read'],
        ['name' => 'banking.accounts.show', 'verb' => 'GET', 'path' => '/accounts/{u}', 'level' => 'read'],
        ['name' => 'banking.statements.index', 'verb' => 'GET', 'path' => '/statements', 'level' => 'read'],
        ['name' => 'banking.statements.show', 'verb' => 'GET', 'path' => '/statements/{u}', 'level' => 'read'],
        ['name' => 'banking.lines.index', 'verb' => 'GET', 'path' => '/lines', 'level' => 'read'],
        ['name' => 'banking.lines.show', 'verb' => 'GET', 'path' => '/lines/{u}', 'level' => 'read'],
        ['name' => 'banking.suggestions.index', 'verb' => 'GET', 'path' => '/suggestions', 'level' => 'read'],
        ['name' => 'banking.bookLines.index', 'verb' => 'GET', 'path' => '/book-lines?account_id={u}', 'level' => 'read'],
        ['name' => 'banking.matches.show', 'verb' => 'GET', 'path' => '/matches/{u}', 'level' => 'read'],
        ['name' => 'banking.reconciliations.index', 'verb' => 'GET', 'path' => '/reconciliations', 'level' => 'read'],
        ['name' => 'banking.reconciliations.show', 'verb' => 'GET', 'path' => '/reconciliations/{u}', 'level' => 'read'],
        ['name' => 'banking.rules.index', 'verb' => 'GET', 'path' => '/rules', 'level' => 'read'],
        ['name' => 'banking.statements.preview', 'verb' => 'POST', 'path' => '/accounts/{u}/statements/preview', 'level' => 'write'],
        ['name' => 'banking.statements.import', 'verb' => 'POST', 'path' => '/accounts/{u}/statements', 'level' => 'write'],
        ['name' => 'banking.lines.match', 'verb' => 'POST', 'path' => '/lines/{u}/match', 'level' => 'write'],
        ['name' => 'banking.lines.settle', 'verb' => 'POST', 'path' => '/lines/{u}/settle', 'level' => 'write'],
        ['name' => 'banking.lines.ignore', 'verb' => 'POST', 'path' => '/lines/{u}/ignore', 'level' => 'write'],
        ['name' => 'banking.lines.restore', 'verb' => 'POST', 'path' => '/lines/{u}/restore', 'level' => 'write'],
        ['name' => 'banking.suggestions.accept', 'verb' => 'POST', 'path' => '/suggestions/accept', 'level' => 'write'],
        ['name' => 'banking.reconciliations.store', 'verb' => 'POST', 'path' => '/reconciliations', 'level' => 'write'],
        ['name' => 'banking.rules.store', 'verb' => 'POST', 'path' => '/rules', 'level' => 'write'],
        ['name' => 'banking.rules.update', 'verb' => 'PUT', 'path' => '/rules/{u}', 'level' => 'write'],
        ['name' => 'banking.matches.undo', 'verb' => 'POST', 'path' => '/matches/{u}/undo', 'level' => 'sensitive'],
        ['name' => 'banking.statements.void', 'verb' => 'POST', 'path' => '/statements/{u}/void', 'level' => 'sensitive'],
        ['name' => 'banking.reconciliations.validate', 'verb' => 'POST', 'path' => '/reconciliations/{u}/validate', 'level' => 'sensitive'],
        ['name' => 'banking.statements.file', 'verb' => 'GET', 'path' => '/statements/{u}/file', 'level' => 'sensitive'],
        ['name' => 'banking.reconciliations.proof', 'verb' => 'GET', 'path' => '/reconciliations/{u}/proof', 'level' => 'sensitive'],
        ['name' => 'banking.accounts.store', 'verb' => 'POST', 'path' => '/accounts', 'level' => 'accounts'],
        ['name' => 'banking.accounts.update', 'verb' => 'PATCH', 'path' => '/accounts/{u}', 'level' => 'accounts'],
        ['name' => 'banking.accounts.replace', 'verb' => 'POST', 'path' => '/accounts/{u}/replace', 'level' => 'accounts'],
        ['name' => 'banking.accounts.close', 'verb' => 'POST', 'path' => '/accounts/{u}/close', 'level' => 'accounts'],
    ];
}

function bkAppeler(object $test, array $route, object $org): TestResponse
{
    $chemin = str_replace('{u}', (string) Str::uuid(), $route['path']);

    return $test->json($route['verb'], "/api/v1/org/{$org->id}/banking{$chemin}", [], ['Idempotency-Key' => 'cle-acces-'.bin2hex(random_bytes(4))]);
}

/**
 * @param  list<array{name: string, verb: string, path: string, level: string}>  $routes
 * @return list<string>
 */
function bkEcarts(object $test, array $routes, object $org, Closure $attendu): array
{
    $echecs = [];

    foreach ($routes as $route) {
        $r = bkAppeler($test, $route, $org);
        $attendu($r, $route) || $echecs[] = "{$route['name']} : {$r->getStatusCode()} {$r->json('code')}";
    }

    return $echecs;
}

beforeEach(function (): void {
    $this->org = B::agence($this);
    $this->routes = bkRoutes();
});

it('couvre toutes les routes banking.* du routeur', function (): void {
    $noms = collect(Route::getRoutes()->getRoutes())->map(fn ($r) => $r->getName())->filter(fn ($n) => is_string($n) && str_starts_with($n, 'banking.'))->values()->all();
    $couvertes = array_column($this->routes, 'name');

    expect(array_diff($noms, $couvertes))->toBe([])->and(array_diff($couvertes, $noms))->toBe([]);
});

it('401 sans jeton sur chaque route', function (): void {
    auth()->forgetGuards();

    expect(bkEcarts($this, $this->routes, $this->org, fn ($r) => $r->getStatusCode() === 401))->toBe([]);
});

it('403 operator_token_forbidden pour un jeton opérateur', function (): void {
    $compte = L::membre($this->org, MemberRole::Owner);
    X::changer();
    $this->withToken(X::jetonOperateur($compte));

    expect(bkEcarts($this, $this->routes, $this->org, fn ($r) => $r->getStatusCode() === 403 && $r->json('code') === 'operator_token_forbidden'))->toBe([]);
});

it('404 organization_not_found pour un compte non membre', function (): void {
    $autre = C::organisation(nom: 'Autre agence');
    X::changer();
    $this->actingAs(L::titulaire($autre));

    expect(bkEcarts($this, $this->routes, $this->org, fn ($r) => $r->getStatusCode() === 404 && $r->json('code') === 'organization_not_found'))->toBe([]);
});

it('refuse le gestionnaire sur chaque route', function (): void {
    $this->actingAs(L::membre($this->org, MemberRole::Manager));
    B::reauthentifier($this);

    expect(bkEcarts($this, $this->routes, $this->org, fn ($r) => $r->getStatusCode() === 403 && $r->json('code') !== 'two_factor_required'))->toBe([]);
});

it('laisse le comptable lire, écrire et pointer, mais pas gérer les comptes', function (): void {
    $compte = L::membre($this->org, MemberRole::Accountant);
    activerDeuxFacteurs($compte);
    $this->actingAs($compte);
    B::reauthentifier($this);

    expect(bkEcarts($this, array_filter($this->routes, fn ($r) => $r['level'] !== 'accounts'), $this->org, fn ($r) => $r->getStatusCode() !== 403))->toBe([])
        ->and(bkEcarts($this, array_filter($this->routes, fn ($r) => $r['level'] === 'accounts'), $this->org, fn ($r) => $r->getStatusCode() === 403))->toBe([]);
});

it('exige un 2FA confirmé en agence pour toute écriture', function (): void {
    $this->actingAs(L::membre($this->org, MemberRole::Admin));
    B::reauthentifier($this);

    $ecritures = array_filter($this->routes, fn ($r) => $r['level'] !== 'read');

    expect(bkEcarts($this, $ecritures, $this->org, fn ($r) => $r->getStatusCode() === 403 && $r->json('code') === 'two_factor_required'))->toBe([]);
});

it('exige une preuve 2FA de moins de 10 minutes pour les comptes', function (): void {
    $comptes = array_filter($this->routes, fn ($r) => $r['level'] === 'accounts');
    $this->flushSession();

    expect(bkEcarts($this, $comptes, $this->org, fn ($r) => $r->getStatusCode() === 403 && $r->json('code') === 'reauthentication_required'))->toBe([]);

    $this->flushSession();
    $this->withSession([EnsureRecentReauthentication::CLE_2FA => now()->subMinutes(11)->getTimestamp()]);

    expect(bkEcarts($this, $comptes, $this->org, fn ($r) => $r->getStatusCode() === 403 && $r->json('code') === 'reauthentication_required'))->toBe([]);
});

it('404 sur la ressource d\'une autre organisation', function (): void {
    $compte = B::compte($this, $this->org);
    $import = B::importer($this, $this->org, $compte, B::csv([['02/11/2026', 'VIR', '10,00']]))->assertCreated();
    $ligne = $this->getJson(B::url($this->org, '/lines'))->json('data.0.id');
    $autre = C::organisation(nom: 'Autre agence');
    X::changer();
    $this->actingAs(L::titulaire($autre));
    B::reauthentifier($this);

    foreach (['/accounts/'.$compte, '/statements/'.$import->json('data.id'), '/lines/'.$ligne] as $chemin) {
        $this->getJson(B::url($autre, $chemin))->assertNotFound();
    }

    B::envoyer($this, 'POST', B::url($autre, "/lines/{$ligne}/ignore"), ['reason' => 'other', 'lock_version' => 1])->assertNotFound();
    $this->getJson(B::url($autre, '/lines'))->assertOk()->assertJsonCount(0, 'data');
});
