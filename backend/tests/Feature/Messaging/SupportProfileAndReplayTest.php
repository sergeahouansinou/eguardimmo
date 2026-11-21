<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use App\Modules\Messaging\Support\SupportHours;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->org = T::organisation();
    $this->ouvrir = fn (User $user, array $corps = []) => $this->actingAs($user)->postJson('/api/v1/support/tickets', [
        'space' => 'marketplace', 'category' => 'account', 'subject' => 'Quittance absente', 'body' => 'Bonjour, la quittance de mars est absente.', ...$corps,
    ]);
});

it('refuse un profil locataire ou propriétaire que le compte ne détient pas, sans rien écrire', function (): void {
    $compte = User::factory()->create();

    foreach (['tenant', 'owner'] as $espace) {
        ($this->ouvrir)($compte, ['space' => $espace])->assertForbidden()->assertJsonPath('code', 'support_space_forbidden');
        auth()->forgetGuards();
    }

    expect(SupportTicket::query()->count())->toBe(0);
});

it('accepte un profil locataire et un profil propriétaire réellement détenus', function (): void {
    $locataire = T::locataire($this->org)['user'];
    $proprietaire = O::proprietaire($this->org)['user'];

    ($this->ouvrir)($locataire, ['space' => 'tenant'])->assertCreated()->assertJsonPath('data.space', 'tenant');
    auth()->forgetGuards();
    ($this->ouvrir)($proprietaire, ['space' => 'owner'])->assertCreated()->assertJsonPath('data.space', 'owner');
});

it('refuse l\'espace marketplace à un compte dont l\'e-mail n\'est pas vérifié', function (): void {
    ($this->ouvrir)(User::factory()->unverified()->create())->assertForbidden();
});

it('interdit organization_id hors de l\'espace organisation et ne lit jamais l\'organisation chez le client', function (): void {
    ($this->ouvrir)(L::titulaire($this->org), ['organization_id' => $this->org->id])->assertUnprocessable()->assertJsonValidationErrors('organization_id');
});

it('rejoue une ouverture avec le même client_id sans rien dupliquer, et refuse un autre contenu', function (): void {
    $user = User::factory()->create();
    $cle = M::cle();

    $premier = ($this->ouvrir)($user, ['client_id' => $cle])->assertCreated()->json('data.id');
    auth()->forgetGuards();
    ($this->ouvrir)($user, ['client_id' => $cle])->assertOk()->assertJsonPath('data.id', $premier);
    auth()->forgetGuards();
    ($this->ouvrir)($user, ['client_id' => $cle, 'body' => 'Autre contenu'])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');

    expect(SupportTicket::query()->count())->toBe(1)->and(SupportTicketMessage::query()->count())->toBe(1);
});

it('ne rejoue pas le client_id d\'un autre compte', function (): void {
    $cle = M::cle();
    $premier = ($this->ouvrir)(User::factory()->create(), ['client_id' => $cle])->assertCreated()->json('data.id');
    auth()->forgetGuards();

    expect(($this->ouvrir)(User::factory()->create(), ['client_id' => $cle])->assertCreated()->json('data.id'))->not->toBe($premier);
});

it('rejoue une réponse avec le même client_id et refuse un contenu différent', function (): void {
    $user = User::factory()->create();
    $id = ($this->ouvrir)($user)->assertCreated()->json('data.id');
    $cle = M::cle();
    $url = "/api/v1/support/tickets/{$id}/messages";

    auth()->forgetGuards();
    $this->actingAs($user)->postJson($url, ['body' => 'Précision', 'client_id' => $cle])->assertOk();
    auth()->forgetGuards();
    $this->actingAs($user)->postJson($url, ['body' => 'Précision', 'client_id' => $cle])->assertOk();
    auth()->forgetGuards();
    $this->actingAs($user)->postJson($url, ['body' => 'Autre', 'client_id' => $cle])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');

    expect(SupportTicketMessage::query()->where('support_ticket_id', $id)->count())->toBe(2);
});

it('limite l\'ouverture à 5 demandes par heure et par compte', function (): void {
    RateLimiter::clear('support-tickets-open');
    $user = User::factory()->create();

    foreach (range(1, 5) as $i) {
        ($this->ouvrir)($user, ['subject' => "Demande {$i}"])->assertCreated();
        auth()->forgetGuards();
    }

    ($this->ouvrir)($user, ['subject' => 'Demande 6'])->assertStatus(429);
    expect(SupportTicket::query()->count())->toBe(5);
});

it('sert l\'état du support depuis le serveur, horaires et fuseau compris', function (): void {
    config(['messaging.support.hours' => '1-5 09:00-18:00', 'messaging.support.timezone' => 'Europe/Paris']);
    $user = User::factory()->create();
    $this->getJson('/api/v1/support/status')->assertUnauthorized();

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00', 'Europe/Paris'));
    $this->actingAs($user)->getJson('/api/v1/support/status')->assertOk()
        ->assertJsonPath('data.online', true)->assertJsonPath('data.timezone', 'Europe/Paris')
        ->assertJsonStructure(['data' => ['online', 'hours_label', 'response_label', 'timezone', 'hours']]);

    $this->travelTo(CarbonImmutable::parse('2026-11-15 10:00:00', 'Europe/Paris'));
    $this->getJson('/api/v1/support/status')->assertOk()->assertJsonPath('data.online', false);

    $this->travelTo(CarbonImmutable::parse('2026-11-16 19:00:00', 'Europe/Paris'));
    $this->getJson('/api/v1/support/status')->assertOk()->assertJsonPath('data.online', false);
});

it('refuse des horaires ou un fuseau illisibles plutôt que d\'en inventer', function (): void {
    expect(fn () => SupportHours::parse('lundi matin', 'Europe/Paris'))->toThrow(InvalidArgumentException::class)
        ->and(fn () => SupportHours::parse('1-5 09:00-18:00', 'Mars/Olympus'))->toThrow(InvalidArgumentException::class);
});
