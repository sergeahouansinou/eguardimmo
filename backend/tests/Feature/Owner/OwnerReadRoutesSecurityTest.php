<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;

const ROUTES_LECTURE_PROPRIETAIRE = [
    'mandates.owner.agencies.index', 'ownerFunds.owner.account.show', 'mandates.owner.mandates.index', 'mandates.owner.mandates.show', 'mandates.owner.properties.index', 'mandates.owner.properties.show',
    'mandates.owner.documents.index', 'mandates.owner.documents.download', 'leases.owner.index', 'leases.owner.show', 'reporting.owner.reports.index',
    'reporting.owner.reports.show', 'reporting.owner.reports.pdf', 'reporting.owner.rent.show', 'reporting.owner.payouts.index', 'reporting.owner.home', 'reporting.owner.statement', 'invoicing.owner.invoices.index',
    'invoicing.owner.invoices.show', 'invoicing.owner.invoices.download', 'maintenance.owner.interventions.index', 'maintenance.owner.interventions.show',
    'maintenance.owner.files.download', 'parties.owner.links.index', 'charges.owner.statements.index', 'charges.owner.statements.show',
    'messaging.owner.conversations.index', 'messaging.owner.conversations.options', 'messaging.owner.conversations.show', 'messaging.owner.conversations.unread',
    'messaging.owner.conversations.messages.index', 'messaging.owner.conversations.attachments.show',
    'notifications.owner.announcements.index', 'notifications.owner.announcements.show', 'notifications.owner.announcements.attachments.show',
    'tax.owner.statements.index', 'tax.owner.statements.show', 'tax.owner.statements.pdf',
];

const LIMITES_MESSAGERIE_PROPRIETAIRE = [
    'messaging.owner.conversations.index' => 'throttle:60,1,owner-conversations-read',
    'messaging.owner.conversations.options' => 'throttle:60,1,owner-conversations-read',
    'messaging.owner.conversations.show' => 'throttle:60,1,owner-conversations-read',
    'messaging.owner.conversations.unread' => 'throttle:120,1,owner-conversations-poll',
    'messaging.owner.conversations.messages.index' => 'throttle:120,1,owner-conversations-poll',
    'messaging.owner.conversations.attachments.show' => 'throttle:30,1,owner-conversations-download',
    'notifications.owner.announcements.index' => 'throttle:60,1,owner-announcements-read',
    'notifications.owner.announcements.show' => 'throttle:60,1,owner-announcements-read',
    'notifications.owner.announcements.attachments.show' => 'throttle:30,1,owner-announcements-download',
    'tax.owner.statements.index' => 'throttle:60,1,tax-owner-lecture',
    'tax.owner.statements.show' => 'throttle:60,1,tax-owner-lecture',
    'tax.owner.statements.pdf' => 'throttle:30,1,tax-owner-pdf',
];

/**
 * @return list<LaravelRoute>
 */
function routesLectureProprietaire(): array
{
    return array_values(array_filter(Route::getRoutes()->getRoutes(), fn (LaravelRoute $r): bool => str_starts_with($r->uri(), 'api/v1/owner/') && in_array('GET', $r->methods(), true)));
}

function adresseLectureProprietaire(LaravelRoute $route): string
{
    return '/'.preg_replace(['/\{month\}/', '/\{[a-z_]+\}/'], ['2026-11', '01a1f34a-279f-729e-b590-d7aa76a8d560'], $route->uri());
}

beforeEach(function (): void {
    L::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->p = R::proprietaire($this->org);
});

it('ne laisse aucune route de lecture propriétaire hors de la liste contrôlée', function (): void {
    $noms = array_map(fn (LaravelRoute $r): ?string => $r->getName(), routesLectureProprietaire());

    expect($noms)->toEqualCanonicalizing(ROUTES_LECTURE_PROPRIETAIRE);
});

it('protège chaque route de lecture : session, e-mail vérifié, jeton opérateur refusé, espace propriétaire, limite de débit', function (): void {
    foreach (routesLectureProprietaire() as $route) {
        $telechargement = str_ends_with($route->uri(), '/download') || str_ends_with($route->uri(), '/pdf');
        $limite = LIMITES_MESSAGERIE_PROPRIETAIRE[$route->getName()] ?? ($telechargement ? 'throttle:30,1,owner-downloads' : (str_contains((string) $route->getName(), 'links') ? 'throttle:30,1,owner-links' : 'throttle:60,1,owner-reads'));

        expect($route->gatherMiddleware())->toContain('auth:sanctum', 'no-operator-token', 'space:owner', 'verified', $limite);
    }
});

it('refuse un compte sans profil propriétaire sur chaque route, avant toute lecture', function (): void {
    $quelconque = User::factory()->create();
    $locataire = T::locataire($this->org)['user'];

    foreach (routesLectureProprietaire() as $route) {
        foreach ([$quelconque, $locataire, L::titulaire($this->org)] as $compte) {
            O::comme($this, $compte)->getJson(adresseLectureProprietaire($route))->assertForbidden()->assertJsonPath('code', 'space_forbidden');
        }
        O::comme($this, null)->getJson(adresseLectureProprietaire($route))->assertUnauthorized();
    }
});

it('refuse un jeton opérateur et une adresse non vérifiée sur chaque route', function (): void {
    $operateur = User::factory()->create();
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    O::comme($this, null);
    $this->flushHeaders();

    foreach (routesLectureProprietaire() as $route) {
        $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)->getJson(adresseLectureProprietaire($route))->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }

    $this->p['user']->forceFill(['email_verified_at' => null])->save();

    foreach (routesLectureProprietaire() as $route) {
        O::comme($this, $this->p['user'])->getJson(adresseLectureProprietaire($route))->assertForbidden()->assertJsonPath('code', 'email_unverified');
    }
});

it('ne met jamais en cache partagé : private, no-store sur chaque route, y compris les 404', function (): void {
    foreach (routesLectureProprietaire() as $route) {
        $reponse = O::comme($this, $this->p['user'])->getJson(adresseLectureProprietaire($route));

        expect($reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');
    }
});

it('ne répond jamais une trace ni un chemin interne, même sur un identifiant inconnu', function (): void {
    foreach (routesLectureProprietaire() as $route) {
        $texte = O::comme($this, $this->p['user'])->getJson(adresseLectureProprietaire($route))->getContent();

        foreach (['vendor/', 'app/Modules', 'Stack trace', 'SQLSTATE', 'select ', 'Illuminate\\'] as $interdit) {
            expect($texte)->not->toContain($interdit);
        }
    }
});

it('coupe les lectures au-delà de 60 requêtes par minute', function (): void {
    $statuts = [];

    foreach (range(1, 62) as $i) {
        $statuts[] = R::lire($this, $this->p['user'], '/invoices')->status();
    }

    expect(array_slice($statuts, 0, 60))->each->toBe(200)->and($statuts[61])->toBe(429);
});
