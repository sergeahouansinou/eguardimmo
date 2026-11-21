<?php

declare(strict_types=1);

use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\SupportTicket;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00:00'));
    $this->operateur = User::factory()->create(['name' => 'Julie Martin']);
    $this->operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($this->operateur);
    $this->jeton = $this->operateur->createToken('console', ['operator'])->plainTextToken;
    $this->demandeur = User::factory()->create();

    $this->ouvrir = function (array $corps = []): string {
        auth()->forgetGuards();

        return (string) $this->actingAs($this->demandeur)->postJson('/api/v1/support/tickets', [
            'space' => 'marketplace', 'category' => 'account', 'subject' => 'Quittance absente', 'body' => 'Bonjour, la quittance est absente.', ...$corps,
        ])->assertCreated()->json('data.id');
    };
    $this->support = function (string $id, array $corps) {
        auth()->forgetGuards();

        return $this->withToken($this->jeton)->postJson("/api/v1/console/support/tickets/{$id}/messages", avecPreuve($this->jeton, $corps));
    };
    $this->demandeurRepond = function (string $id, string $corps) {
        auth()->forgetGuards();

        return $this->actingAs($this->demandeur)->postJson("/api/v1/support/tickets/{$id}/messages", ['body' => $corps]);
    };
});

it('accuse la lecture du demandeur seulement quand le support a répondu, et la rejoue sans la déplacer', function (): void {
    $id = ($this->ouvrir)();
    $url = "/api/v1/support/tickets/{$id}";

    $ouverture = $this->actingAs($this->demandeur)->patchJson($url, ['read' => true])->assertOk()->json('data.requester_last_read_at');
    expect($ouverture)->toBe(now()->toIso8601String());

    $this->travelTo(now()->addMinutes(1));
    ($this->support)($id, ['body' => 'Nous regardons.'])->assertOk();
    ($this->support)($id, ['body' => 'Note à usage interne', 'internal' => true])->assertOk();

    $this->travelTo(now()->addMinutes(5));
    auth()->forgetGuards();
    $lu = $this->actingAs($this->demandeur)->patchJson($url, ['read' => true])->assertOk()->json('data.requester_last_read_at');
    expect($lu)->not->toBe($ouverture);

    $this->travelTo(now()->addMinutes(5));
    auth()->forgetGuards();
    $this->actingAs($this->demandeur)->patchJson($url, ['read' => true])->assertOk()->assertJsonPath('data.requester_last_read_at', $lu);
});

it('ne compte jamais une note interne comme lisible par le demandeur', function (): void {
    $id = ($this->ouvrir)();
    $ouverture = SupportTicket::query()->findOrFail($id)->requester_last_read_at->toIso8601String();
    $this->travelTo(now()->addMinutes(1));
    ($this->support)($id, ['body' => 'Note à usage interne', 'internal' => true])->assertOk();

    $this->travelTo(now()->addMinutes(1));
    auth()->forgetGuards();
    $this->actingAs($this->demandeur)->patchJson("/api/v1/support/tickets/{$id}", ['read' => true])->assertOk()->assertJsonPath('data.requester_last_read_at', $ouverture);
});

it('accuse la lecture du support et la montre au demandeur', function (): void {
    $id = ($this->ouvrir)();

    auth()->forgetGuards();
    $this->withToken($this->jeton)->patchJson("/api/v1/console/support/tickets/{$id}", avecPreuve($this->jeton, ['read' => true]))->assertOk();
    expect(SupportTicket::query()->findOrFail($id)->support_last_read_at)->not->toBeNull();

    auth()->forgetGuards();
    $this->actingAs($this->demandeur)->getJson("/api/v1/support/tickets/{$id}")->assertOk()->assertJsonPath('data.support_last_read_at', fn (?string $v): bool => $v !== null);
});

it('interroge les messages après un repère, sans jamais servir une note interne ni l\'identité de l\'opérateur', function (): void {
    $id = ($this->ouvrir)();
    $premier = SupportTicket::query()->findOrFail($id)->messages()->firstOrFail()->id;
    ($this->support)($id, ['body' => 'Note à usage interne', 'internal' => true])->assertOk();
    ($this->support)($id, ['body' => 'Réponse du support'])->assertOk();

    auth()->forgetGuards();
    $reponse = $this->actingAs($this->demandeur)->getJson("/api/v1/support/tickets/{$id}/messages?after={$premier}")->assertOk();

    expect($reponse->json('data'))->toHaveCount(1)
        ->and($reponse->json('data.0.body'))->toBe('Réponse du support')
        ->and($reponse->json('data.0.author.id'))->toBeNull()
        ->and($reponse->json('data.0.author.name'))->toBe('Support eGuardImmo')
        ->and($reponse->json('meta.has_more'))->toBeFalse()
        ->and($reponse->getContent())->not->toContain('Julie Martin')->not->toContain('Note à usage interne');
    $reponse->assertHeader('Cache-Control');
    expect($reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');
});

it('sert au support les notes internes dans l\'interrogation, et refuse un repère inconnu ou d\'un autre fil', function (): void {
    $id = ($this->ouvrir)();
    $autre = ($this->ouvrir)(['subject' => 'Autre fil']);
    ($this->support)($id, ['body' => 'Note à usage interne', 'internal' => true])->assertOk();
    $repereAutre = SupportTicket::query()->findOrFail($autre)->messages()->firstOrFail()->id;

    auth()->forgetGuards();
    $this->withToken($this->jeton)->getJson("/api/v1/console/support/tickets/{$id}/messages")->assertOk()->assertJsonCount(2, 'data');

    auth()->forgetGuards();
    $this->withToken($this->jeton)->getJson("/api/v1/console/support/tickets/{$id}/messages?after={$repereAutre}")->assertNotFound();
});

it('ne laisse pas un autre compte interroger un fil qui n\'est pas le sien', function (): void {
    $id = ($this->ouvrir)();

    auth()->forgetGuards();
    $this->actingAs(User::factory()->create())->getJson("/api/v1/support/tickets/{$id}/messages")->assertNotFound();
    auth()->forgetGuards();
    $this->getJson("/api/v1/support/tickets/{$id}/messages")->assertUnauthorized();
});

it('résout après 7 jours sans réponse du demandeur, journalise, et le demandeur rouvre pendant 14 jours', function (): void {
    $id = ($this->ouvrir)();
    ($this->support)($id, ['body' => 'Pouvez-vous confirmer ?'])->assertOk();
    expect(SupportTicket::query()->findOrFail($id)->status->value)->toBe('waiting');

    $this->travelTo(now()->addDays(6));
    $this->artisan('messaging:resolve-stale-tickets')->assertSuccessful();
    expect(SupportTicket::query()->findOrFail($id)->status->value)->toBe('waiting');

    $this->travelTo(now()->addDays(2));
    $this->artisan('messaging:resolve-stale-tickets')->expectsOutputToContain('1 demande(s) résolue(s).')->assertSuccessful();
    $ticket = SupportTicket::query()->findOrFail($id);
    expect($ticket->status->value)->toBe('resolved')->and($ticket->resolved_at)->not->toBeNull();
    expect(AuditLog::query()->where('action', 'messaging.ticket.auto_resolved')->where('subject_id', $id)->count())->toBe(1);

    $this->artisan('messaging:resolve-stale-tickets')->expectsOutputToContain('0 demande(s) résolue(s).')->assertSuccessful();
    expect(AuditLog::query()->where('action', 'messaging.ticket.auto_resolved')->count())->toBe(1);

    $this->travelTo(now()->addDays(13));
    ($this->demandeurRepond)($id, 'Oui, c\'est bien cela.')->assertOk()->assertJsonPath('data.status', 'open');
});

it('ne résout jamais une demande ouverte ni une demande où le demandeur a répondu récemment', function (): void {
    $ouverte = ($this->ouvrir)();
    $attente = ($this->ouvrir)(['subject' => 'En attente']);
    ($this->support)($attente, ['body' => 'Question'])->assertOk();

    $this->travelTo(now()->addDays(10));
    $recente = ($this->ouvrir)(['subject' => 'Récente']);
    ($this->support)($recente, ['body' => 'Question'])->assertOk();
    $this->travelTo(now()->addDays(3));
    ($this->demandeurRepond)($recente, 'Réponse')->assertOk();
    ($this->support)($recente, ['body' => 'Merci'])->assertOk();
    $this->travelTo(now()->addDays(5));

    $this->artisan('messaging:resolve-stale-tickets')->assertSuccessful();

    expect(SupportTicket::query()->findOrFail($ouverte)->status->value)->toBe('open')
        ->and(SupportTicket::query()->findOrFail($attente)->status->value)->toBe('resolved')
        ->and(SupportTicket::query()->findOrFail($recente)->status->value)->toBe('waiting');
});

it('résout les demandes d\'un compte supprimé sans toucher aux autres', function (): void {
    $mienne = ($this->ouvrir)();
    $autre = User::factory()->create();
    auth()->forgetGuards();
    $idAutre = (string) $this->actingAs($autre)->postJson('/api/v1/support/tickets', ['space' => 'marketplace', 'category' => 'account', 'subject' => 'Autre', 'body' => 'Autre compte'])->json('data.id');

    AccountDeleted::dispatch($this->demandeur->id);

    expect(SupportTicket::query()->findOrFail($mienne)->status->value)->toBe('resolved')
        ->and(SupportTicket::query()->findOrFail($idAutre)->status->value)->toBe('open');
});

it('refuse au demandeur la console et au jeton opérateur le support du demandeur', function (): void {
    $id = ($this->ouvrir)();

    auth()->forgetGuards();
    $this->actingAs($this->demandeur)->getJson('/api/v1/console/support/tickets')->assertForbidden();
    auth()->forgetGuards();
    $this->withToken($this->jeton)->getJson("/api/v1/support/tickets/{$id}")->assertForbidden();
    auth()->forgetGuards();
    $this->withToken($this->jeton)->getJson('/api/v1/support/status')->assertForbidden();
});
