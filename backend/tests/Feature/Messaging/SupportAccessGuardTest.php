<?php

declare(strict_types=1);

use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Events\SupportAccessEmergencyOpened;
use App\Modules\Messaging\Events\SupportAccessUsed;
use App\Modules\Messaging\Models\SupportTicket;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\SupportAccessContext as A;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->travelTo(CarbonImmutable::parse(A::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->op = A::operateur();
    O::navigateurAgence($this);
    $this->ticket = A::demande($this, $this->titulaire, $this->org);
    $this->lire = fn (string $ressource, ?string $organisation = null, ?string $jeton = null) => A::console($this, $jeton ?? $this->op['jeton'], $organisation ?? $this->org->id, $ressource);
});

it('refuse la lecture des données d\'une organisation sans compte, sans jeton opérateur ou sans accès', function (): void {
    $url = "/api/v1/console/organizations/{$this->org->id}/team";

    A::jeton($this);
    $this->getJson($url)->assertUnauthorized();
    A::jeton($this);
    $this->actingAs($this->titulaire, 'web')->getJson($url)->assertForbidden();

    foreach (['team', 'settings'] as $ressource) {
        ($this->lire)($ressource)->assertForbidden()->assertJsonPath('code', 'support_access_required');
    }
    ($this->lire)('team', '0199aaaa-0000-7000-8000-000000000000')->assertForbidden()->assertJsonPath('code', 'support_access_required');
});

it('journalise le refus faute d\'accès', function (): void {
    ($this->lire)('team')->assertForbidden();

    $ligne = AuditLog::query()->where('action', 'console.support_access.denied')->first();
    expect($ligne)->not->toBeNull()->and($ligne->metadata['scope'] ?? null)->toBe('team');
});

it('ouvre la lecture avec un accès consenti, journalise chaque lecture et compte les lectures', function (): void {
    Event::fake([SupportAccessUsed::class]);
    $id = A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire, ['team', 'settings']);

    ($this->lire)('team')->assertOk()->assertJsonPath('data.0.role', 'owner')->assertJsonStructure(['data' => [['first_name', 'last_name', 'role']]]);
    ($this->lire)('team')->assertOk();
    ($this->lire)('settings')->assertOk()->assertJsonPath('data.id', $this->org->id)->assertJsonPath('data.name', 'Agence du Port')->assertJsonPath('data.country', 'FR');

    expect(A::grant($id)->read_count)->toBe(3)
        ->and(AuditLog::query()->where('action', 'console.support_access.read')->count())->toBe(3)
        ->and(AuditLog::query()->where('action', 'console.support_access.read')->pluck('metadata')->pluck('scope')->sort()->values()->all())->toBe(['settings', 'team', 'team']);
    Event::assertDispatchedTimes(SupportAccessUsed::class, 1);
});

it('garde le périmètre fermé : un accès « team » n\'ouvre pas « settings »', function (): void {
    $id = A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire, ['team']);

    ($this->lire)('team')->assertOk();
    ($this->lire)('settings')->assertForbidden()->assertJsonPath('code', 'support_access_required');
    expect(A::grant($id)->read_count)->toBe(1);
});

it('ne sert que l\'organisation du consentement et que l\'opérateur qui l\'a demandé', function (): void {
    A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire);
    $autre = T::organisation('Agence Rivale');
    $second = A::operateur('Paul Durand');

    ($this->lire)('team', $autre->id)->assertForbidden()->assertJsonPath('code', 'support_access_required');
    ($this->lire)('team', null, $second['jeton'])->assertForbidden()->assertJsonPath('code', 'support_access_required');
    ($this->lire)('team')->assertOk();
});

it('ne compte pas une lecture refusée ni une lecture qui échoue', function (): void {
    $id = A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire, ['team']);

    ($this->lire)('settings')->assertForbidden();

    expect(A::grant($id)->read_count)->toBe(0)->and(AuditLog::query()->where('action', 'console.support_access.read')->count())->toBe(0);
});

it('n\'expose aucune conversation à la console : toute route d\'opérateur portant une organisation est gardée et aucune ne porte sur les conversations', function (): void {
    $routes = collect(Route::getRoutes()->getRoutes())->filter(fn ($r): bool => in_array('space:operator', $r->gatherMiddleware(), true) && preg_match('/\{organization[^}]*\}/', $r->uri()) === 1 && ! in_array($r->getName(), ['messaging.console.organizations.support_accesses', 'organizations.console.index', 'organizations.console.show', 'subscriptions.console.entitlements.show'], true));

    expect($routes->count())->toBeGreaterThanOrEqual(2);
    foreach ($routes as $route) {
        expect($route->uri())->not->toContain('conversation')->not->toContain('message');
        expect(collect($route->gatherMiddleware())->contains(fn ($m): bool => is_string($m) && str_starts_with($m, 'support-access:')))->toBeTrue("{$route->uri()} sans garde support-access");
    }
});

it('ne laisse aucune route d\'opérateur lire une organisation sans passer par le garde', function (): void {
    $sansGarde = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($r): bool => str_starts_with($r->uri(), 'api/v1/console/') && in_array('GET', $r->methods(), true) && str_contains($r->uri(), 'organization'))
        ->reject(fn ($r): bool => in_array($r->getName(), ['messaging.console.organizations.support_accesses', 'organizations.console.index', 'organizations.console.show', 'subscriptions.console.entitlements.show'], true) || collect($r->gatherMiddleware())->contains(fn ($m): bool => is_string($m) && str_starts_with($m, 'support-access:')));

    expect($sansGarde->map(fn ($r): string => $r->uri())->values()->all())->toBe([]);
});

it('refuse les fils de conversation d\'une organisation à un jeton opérateur, accès consenti ou non', function (): void {
    A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire);
    A::jeton($this);

    foreach (['conversations', 'conversations/'.str_repeat('0', 8).'-0000-7000-8000-000000000000'] as $suite) {
        $this->withToken($this->op['jeton'])->getJson("/api/v1/org/{$this->org->id}/{$suite}")->assertNotFound()->assertJsonPath('code', 'organization_not_found');
        A::jeton($this);
    }
});

it('ouvre un accès d\'urgence d\'une heure, notifié, limité à settings et team, sans consentement', function (): void {
    Event::fake([SupportAccessEmergencyOpened::class]);

    $reponse = A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated()
        ->assertJsonPath('data.kind', 'emergency')->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.scopes', ['settings', 'team'])->assertJsonPath('data.duration_hours', 1)
        ->assertJsonPath('data.emergency_basis', 'security_incident')
        ->assertJsonPath('data.expires_at', now()->addHour()->toIso8601String())->assertJsonPath('data.reviewed', false);
    $id = $reponse->json('data.id');
    Event::assertDispatched(SupportAccessEmergencyOpened::class, fn (SupportAccessEmergencyOpened $e): bool => $e->organizationId === $this->org->id && $e->grantId === $id);

    ($this->lire)('team')->assertOk();
    ($this->lire)('settings')->assertOk();
    A::organisation($this, $this->org, $this->titulaire)->assertOk()->assertJsonPath('data.0.kind', 'emergency')->assertJsonPath('data.0.status', 'active')->assertJsonPath('data.0.emergency_basis', 'security_incident');

    $this->travelTo(now()->addMinutes(61));
    ($this->lire)('team')->assertForbidden();
    expect(AuditLog::query()->where('action', 'messaging.support_access.emergency')->count())->toBe(1);
});

it('journalise chaque lecture d\'un accès d\'urgence sans prévenir deux fois', function (): void {
    $id = A::urgence($this, $this->op['jeton'], $this->ticket, 'legal_requisition')->assertCreated()->assertJsonPath('data.emergency_basis', 'legal_requisition')->json('data.id');

    ($this->lire)('team')->assertOk();
    ($this->lire)('team')->assertOk();

    expect(A::grant($id)->read_count)->toBe(2)->and(AuditLog::query()->where('action', 'console.support_access.read')->count())->toBe(2);
});

it('refuse un second accès d\'urgence vivant, un fondement inconnu et une demande sans organisation', function (): void {
    A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated();
    A::urgence($this, $this->op['jeton'], $this->ticket)->assertConflict()->assertJsonPath('code', 'support_access_already_open');
    A::urgence($this, $this->op['jeton'], $this->ticket, 'curiosite')->assertUnprocessable()->assertJsonValidationErrors('basis');

    $hors = A::demande($this, T::locataire($this->org)['user'], null);
    A::urgence($this, $this->op['jeton'], $hors)->assertUnprocessable()->assertJsonPath('code', 'support_access_organization_required');
});

it('réserve l\'urgence à un opérateur, avec un motif', function (): void {
    $url = "/api/v1/console/support/tickets/{$this->ticket}/emergency-access";

    A::jeton($this);
    $this->postJson($url, [])->assertUnauthorized();
    A::jeton($this);
    $this->actingAs($this->titulaire, 'web')->postJson($url, ['reason' => 'Compte compromis', 'basis' => 'security_incident'])->assertForbidden();
    A::jeton($this);
    $this->withToken($this->op['jeton'])->postJson($url, avecPreuve($this->op['jeton'], ['basis' => 'security_incident', 'reason' => 'court']))->assertUnprocessable()->assertJsonValidationErrors('reason');
});

it('fait relire l\'urgence par un autre opérateur, jamais par celui qui l\'a ouverte, et rejoue la revue', function (): void {
    $id = A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated()->json('data.id');
    $second = A::operateur('Paul Durand');
    $revue = function (string $jeton, string $acces) {
        A::jeton($this);

        return $this->withToken($jeton)->postJson("/api/v1/console/support/access/{$acces}/review", avecPreuve($jeton));
    };

    $revue($this->op['jeton'], $id)->assertForbidden()->assertJsonPath('code', 'support_access_review_forbidden');
    $revue($second['jeton'], $id)->assertOk()->assertJsonPath('data.reviewed', true);
    $revue($second['jeton'], $id)->assertOk()->assertJsonPath('data.reviewed', true);

    expect(AuditLog::query()->where('action', 'messaging.support_access.reviewed')->count())->toBe(1)
        ->and(A::grant($id)->reviewed_by_user_id)->toBe($second['user']->id);
    A::organisation($this, $this->org, $this->titulaire)->assertOk()->assertJsonPath('data.0.reviewed', true);
});

it('refuse la revue d\'un accès consenti et réserve la revue à un opérateur', function (): void {
    $id = A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire);
    $second = A::operateur('Paul Durand');

    A::jeton($this);
    $this->withToken($second['jeton'])->postJson("/api/v1/console/support/access/{$id}/review", avecPreuve($second['jeton']))->assertConflict()->assertJsonPath('code', 'support_access_not_emergency');
    A::jeton($this);
    $this->postJson("/api/v1/console/support/access/{$id}/review")->assertUnauthorized();
    A::jeton($this);
    $this->actingAs($this->titulaire, 'web')->postJson("/api/v1/console/support/access/{$id}/review")->assertForbidden();
});

it('met fin à l\'accès d\'urgence quand la demande est résolue', function (): void {
    $id = A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated()->json('data.id');

    A::jeton($this);
    $this->withToken($this->op['jeton'])->patchJson("/api/v1/console/support/tickets/{$this->ticket}", avecPreuve($this->op['jeton'], ['status' => 'resolved']))->assertOk();

    expect(A::grant($id)->status->value)->toBe('expired');
    ($this->lire)('team')->assertForbidden();
});

it('refuse la lecture dès que la demande est résolue, même si l\'accès n\'a pas encore été expiré', function (): void {
    A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire);
    ($this->lire)('team')->assertOk();

    SupportTicket::query()->whereKey($this->ticket)->update(['status' => TicketStatus::Resolved]);

    ($this->lire)('team')->assertForbidden()->assertJsonPath('code', 'support_access_required');
});
