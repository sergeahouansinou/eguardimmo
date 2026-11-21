<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;

const ROUTES_ECRITURE_PROPRIETAIRE = [
    'maintenance.owner.approvals.decide' => ['throttle:10,1,owner-decision', true],
    'mandates.owner.end-request.store' => ['throttle:10,1,owner-mandate-end', true],
    'mandates.owner.end-request.destroy' => ['throttle:10,1,owner-mandate-end', true],
    'ownerFunds.owner.requests.store' => ['throttle:3,60,owner-payout-request', true],
    'ownerFunds.owner.requests.confirm' => ['throttle:10,1,owner-payout-sensible', false],
    'ownerFunds.owner.requests.destroy' => ['throttle:10,1,owner-payout-sensible', false],
    'ownerFunds.owner.contest' => ['throttle:10,1,owner-payout-sensible', false],
    'parties.owner.links.destroy' => ['throttle:30,1,owner-links', null],
    'reporting.owner.reports.read' => ['throttle:60,1,owner-report-read', null],
    'messaging.owner.conversations.store' => ['throttle:5,60,owner-conversations-open', null],
    'messaging.owner.conversations.update' => ['throttle:60,1,owner-conversations-state', null],
    'messaging.owner.conversations.reply' => ['throttle:20,1,owner-conversations-reply', null],
    'messaging.owner.conversations.messages.redact' => ['throttle:20,1,owner-conversations-redact', null],
    'notifications.owner.announcements.read' => ['throttle:120,1,owner-announcements-read-mark', null],
];

/**
 * @return list<LaravelRoute>
 */
function routesEcritureProprietaire(): array
{
    return array_values(array_filter(
        Route::getRoutes()->getRoutes(),
        fn (LaravelRoute $r): bool => str_starts_with($r->uri(), 'api/v1/owner/') && ! in_array('GET', $r->methods(), true) && $r->getName() !== null && ! str_contains($r->uri(), 'invitations'),
    ));
}

function adresseEcritureProprietaire(LaravelRoute $route): string
{
    return '/'.preg_replace('/\{[A-Za-z_]+\}/', '01a1f34a-279f-729e-b590-d7aa76a8d560', $route->uri());
}

function appelerEcritureProprietaire(object $test, LaravelRoute $route, array $en_tetes = []): TestResponse
{
    return $test->json($route->methods()[0], adresseEcritureProprietaire($route), [], $en_tetes);
}

beforeEach(function (): void {
    L::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
    $this->org = T::organisation();
    $this->p = R::proprietaire($this->org);
    activerDeuxFacteurs($this->p['user']);
});

it('ne laisse aucune route d\'écriture propriétaire hors de la liste contrôlée', function (): void {
    expect(array_map(fn (LaravelRoute $r): ?string => $r->getName(), routesEcritureProprietaire()))->toEqualCanonicalizing(array_keys(ROUTES_ECRITURE_PROPRIETAIRE));
});

it('protège chaque route d\'écriture : session, e-mail vérifié, jeton opérateur refusé, espace propriétaire, limite dédiée, 2FA', function (): void {
    foreach (routesEcritureProprietaire() as $route) {
        [$limite, $preuve] = ROUTES_ECRITURE_PROPRIETAIRE[$route->getName()];
        $middlewares = $route->gatherMiddleware();

        expect($middlewares)->toContain('auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'web-session', $limite);

        if ($preuve !== null) {
            expect($middlewares)->toContain('two-factor');
            expect(in_array('reauthenticated:two-factor', $middlewares, true))->toBe($preuve);
        }
    }
});

it('répond 401 sans session sur chaque route d\'écriture', function (): void {
    O::comme($this, null);

    foreach (routesEcritureProprietaire() as $route) {
        appelerEcritureProprietaire($this, $route)->assertUnauthorized();
    }
});

it('refuse un compte sans profil propriétaire sur chaque route, avant toute écriture', function (): void {
    $locataire = T::locataire($this->org)['user'];
    $comptes = [User::factory()->create(), $locataire, L::titulaire($this->org)];

    foreach ($comptes as $compte) {
        activerDeuxFacteurs($compte);
    }

    foreach (routesEcritureProprietaire() as $route) {
        foreach ($comptes as $compte) {
            O::preuve($this);
            O::comme($this, $compte);
            appelerEcritureProprietaire($this, $route, O::ORIGINE)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
        }
    }
});

it('refuse un jeton opérateur et une adresse non vérifiée sur chaque route', function (): void {
    $operateur = User::factory()->create();
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    O::comme($this, null);
    $this->flushHeaders();

    foreach (routesEcritureProprietaire() as $route) {
        $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)->json($route->methods()[0], adresseEcritureProprietaire($route))
            ->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }

    $this->p['user']->forceFill(['email_verified_at' => null])->save();

    foreach (routesEcritureProprietaire() as $route) {
        O::preuve($this);
        O::comme($this, $this->p['user']);
        appelerEcritureProprietaire($this, $route, O::ORIGINE)->assertForbidden()->assertJsonPath('code', 'email_unverified');
    }
});

it('refuse un jeton Sanctum personnel (mobile) sur chaque route d\'écriture : 403 reauthentication_required', function (): void {
    O::comme($this, null);
    $jeton = $this->p['user']->createToken('mobile')->plainTextToken;
    $this->flushSession();
    $this->flushHeaders();

    foreach (routesEcritureProprietaire() as $route) {
        $this->withToken($jeton)->json($route->methods()[0], adresseEcritureProprietaire($route))
            ->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    }
});

it('exige la 2FA confirmée avant toute écriture dès qu\'une route la demande', function (): void {
    $sans = User::factory()->create(['email' => 'sans@exemple.fr']);
    $mandant = O::mandant($this->org, 'sans@exemple.fr');
    O::mandat($this->org, $mandant);
    O::acces($this->org, $mandant, $sans);

    foreach (routesEcritureProprietaire() as $route) {
        if (ROUTES_ECRITURE_PROPRIETAIRE[$route->getName()][1] === null) {
            continue;
        }

        O::preuve($this);
        O::comme($this, $sans);
        appelerEcritureProprietaire($this, $route, O::ORIGINE)->assertForbidden()->assertJsonPath('code', 'two_factor_required');
    }
});

it('ne répond ni trace, ni chemin interne, ni cache partagé sur un identifiant inconnu', function (): void {
    foreach (routesEcritureProprietaire() as $route) {
        O::preuve($this);
        O::comme($this, $this->p['user']);
        $reponse = appelerEcritureProprietaire($this, $route, O::ORIGINE);

        expect($reponse->status())->toBeGreaterThanOrEqual(400)->toBeLessThan(500)
            ->and($reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');

        foreach (['vendor/', 'app/Modules', 'Stack trace', 'SQLSTATE', 'select ', 'Illuminate\\'] as $interdit) {
            expect($reponse->getContent())->not->toContain($interdit);
        }
    }
});
