<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Models\Party;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    L::semer();
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->org = T::organisation();
    $this->equipe = L::membre($this->org, MemberRole::Manager);
    $this->moi = T::locataire($this->org);
});

function corpsOuverture(mixed $test, array $surcharge = []): array
{
    return ['lease_id' => $test->moi['lease']->id, 'subject' => 'Fuite dans la salle de bain', 'body' => 'Bonjour, il y a une fuite.', 'client_id' => M::cle(), ...$surcharge];
}

it('ouvre un fil vers son agence, la liste, la lit et y répond', function (): void {
    $cree = T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', corpsOuverture($this))
        ->assertCreated()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('data.subject', 'Fuite dans la salle de bain')
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.agency.id', $this->org->id)
        ->assertJsonPath('data.lease.id', $this->moi['lease']->id)
        ->assertJsonPath('data.last_author', 'me')
        ->assertJsonPath('data.unread', false)
        ->assertJsonPath('data.can_reply', true)
        ->assertJsonCount(1, 'data.messages');
    $id = (string) $cree->json('data.id');

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:05:00'));
    M::repondre($this->org, $this->equipe, Conversation::query()->withoutGlobalScopes()->findOrFail($id), 'Nous envoyons un plombier demain.');

    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/conversations')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $id)
        ->assertJsonPath('data.0.last_author', 'agency')
        ->assertJsonPath('data.0.unread', true)
        ->assertJsonPath('data.0.message_count', 2);
    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/conversations/unread')->assertOk()->assertJsonPath('data.unread', 1);

    $detail = T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/conversations/{$id}")->assertOk()->assertJsonCount(2, 'data.messages');
    expect($detail->json('data.messages.1.author.side'))->toBe('agency')->and($detail->json('data.messages.1.mine'))->toBeFalse();

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:10:00'));
    T::comme($this, $this->moi['user'])->patchJson("/api/v1/tenant/conversations/{$id}", ['read' => true])->assertOk()->assertJsonPath('data.unread', false);
    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/conversations/unread')->assertOk()->assertJsonPath('data.unread', 0);

    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$id}/messages", ['body' => 'Merci.', 'client_id' => M::cle()])
        ->assertCreated()->assertJsonPath('data.mine', true)->assertJsonPath('data.author.side', 'me');
    expect(ConversationMessage::query()->withoutGlobalScopes()->where('conversation_id', $id)->count())->toBe(3);
});

it('affiche l\'accusé de lecture de l\'agence', function (): void {
    $id = (string) T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', corpsOuverture($this))->assertCreated()->json('data.id');
    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/conversations/{$id}")->assertJsonPath('data.agency_last_read_at', null);

    $this->travelTo(CarbonImmutable::parse('2026-11-16 11:00:00'));
    M::lire($this->org, $this->equipe, Conversation::query()->withoutGlobalScopes()->findOrFail($id), MessageSide::Staff);

    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/conversations/{$id}")->assertJsonPath('data.agency_last_read_at', '2026-11-16T11:00:00+00:00');
    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/conversations/{$id}/messages")->assertJsonPath('meta.agency_last_read_at', '2026-11-16T11:00:00+00:00');
});

it('rejoue une ouverture et une réponse avec le même client_id sans doublon', function (): void {
    $ouverture = corpsOuverture($this);
    $premier = T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', $ouverture)->assertCreated();
    $second = T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', $ouverture)->assertOk();
    expect($second->json('data.id'))->toBe($premier->json('data.id'))->and(Conversation::query()->withoutGlobalScopes()->count())->toBe(1);

    $id = (string) $premier->json('data.id');
    $reponse = ['body' => 'Une seule fois.', 'client_id' => M::cle()];
    $a = T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$id}/messages", $reponse)->assertCreated();
    $b = T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$id}/messages", $reponse)->assertOk();
    expect($b->json('data.id'))->toBe($a->json('data.id'))->and(ConversationMessage::query()->withoutGlobalScopes()->count())->toBe(2);

    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$id}/messages", [...$reponse, 'body' => 'Autre texte.'])
        ->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
});

it('exige un client_id à l\'ouverture et à la réponse', function (): void {
    T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', collect(corpsOuverture($this))->except('client_id')->all())
        ->assertUnprocessable()->assertJsonValidationErrors('client_id');
    $id = (string) T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', corpsOuverture($this))->json('data.id');
    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$id}/messages", ['body' => 'x'])->assertUnprocessable()->assertJsonValidationErrors('client_id');
});

it('interroge les nouveautés par ?after= en ordre chronologique', function (): void {
    $id = (string) T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', corpsOuverture($this))->json('data.id');
    $fil = Conversation::query()->withoutGlobalScopes()->findOrFail($id);
    $premier = (string) T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/conversations/{$id}/messages")->assertOk()->json('data.0.id');
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:05:00'));
    M::repondre($this->org, $this->equipe, $fil, 'Première réponse');
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:06:00'));
    M::repondre($this->org, $this->equipe, $fil, 'Seconde réponse');

    $suite = T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/conversations/{$id}/messages?after={$premier}")->assertOk();
    expect(array_column($suite->json('data'), 'body'))->toBe(['Première réponse', 'Seconde réponse']);
});

it('filtre par ?since= sur le dernier message d\'un fil', function (): void {
    T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', corpsOuverture($this))->assertCreated();

    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/conversations?since=2026-11-16T10:30:00Z')->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/conversations?since=2026-11-16T09:30:00Z')->assertOk()->assertJsonCount(1, 'data');
});

it('retire son message sous 15 minutes, pas après, et pas celui de l\'agence', function (): void {
    $id = (string) T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', corpsOuverture($this))->json('data.id');
    $mien = (string) T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/conversations/{$id}/messages")->json('data.0.id');
    $agence = M::repondre($this->org, $this->equipe, Conversation::query()->withoutGlobalScopes()->findOrFail($id), 'Réponse de l\'agence');

    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$id}/messages/{$agence->id}/redaction")->assertForbidden()->assertJsonPath('code', 'message_redaction_forbidden');

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:14:59'));
    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$id}/messages/{$mien}/redaction")
        ->assertOk()->assertJsonPath('data.redacted', true)->assertJsonPath('data.body', '[message retiré]');

    $autre = (string) T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$id}/messages", ['body' => 'Tard', 'client_id' => M::cle()])->json('data.id');
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:15:00')->addMinutes(16));
    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$id}/messages/{$autre}/redaction")->assertConflict()->assertJsonPath('code', 'message_redaction_expired');
});

it('joint une pièce via le stockage des documents et la sert au seul locataire du fil', function (): void {
    $cree = T::comme($this, $this->moi['user'])->post('/api/v1/tenant/conversations', [...corpsOuverture($this), 'attachments' => [UploadedFile::fake()->image('fuite.png')]], ['Accept' => 'application/json'])->assertCreated();
    $piece = (string) $cree->json('data.messages.0.attachments.0.id');

    T::comme($this, $this->moi['user'])->get("/api/v1/tenant/conversation-attachments/{$piece}")->assertOk();

    $autre = T::locataire($this->org);
    T::comme($this, $autre['user'])->getJson("/api/v1/tenant/conversation-attachments/{$piece}")->assertNotFound()->assertJsonPath('code', 'attachment_not_found');
});

it('cache le fil d\'un colocataire sur le même bail', function (): void {
    $colocataire = User::factory()->create();
    $fiche = T::colocataire($this->org, $this->moi['lease']);
    Party::query()->withoutGlobalScopes()->whereKey($fiche->id)->update(['user_id' => $colocataire->id]);
    $fil = M::filLocataire($this->org, $this->equipe, ['party' => $this->moi['party'], 'lease' => $this->moi['lease']]);

    T::comme($this, $colocataire)->getJson('/api/v1/tenant/conversations')->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $colocataire)->getJson("/api/v1/tenant/conversations/{$fil->id}")->assertNotFound()->assertJsonPath('code', 'conversation_not_found');
    T::comme($this, $colocataire)->getJson("/api/v1/tenant/conversations/{$fil->id}/messages")->assertNotFound();
    T::comme($this, $colocataire)->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", ['body' => 'Je m\'invite.', 'client_id' => M::cle()])->assertNotFound();
    T::comme($this, $colocataire)->patchJson("/api/v1/tenant/conversations/{$fil->id}", ['read' => true])->assertNotFound();
    T::comme($this, $colocataire)->getJson('/api/v1/tenant/conversations/unread')->assertOk()->assertJsonPath('data.unread', 0);
});

it('ne laisse ouvrir un fil que sur un bail visible du compte', function (): void {
    $autre = T::locataire($this->org);

    T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', corpsOuverture($this, ['lease_id' => $autre['lease']->id]))
        ->assertNotFound()->assertJsonPath('code', 'conversation_link_not_found');
    T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', corpsOuverture($this, ['lease_id' => M::cle()]))->assertNotFound();
});

it('n\'affiche jamais le fil d\'une autre organisation ni d\'un autre locataire', function (): void {
    $ailleurs = T::organisation('Agence Ailleurs');
    $equipeAilleurs = L::membre($ailleurs, MemberRole::Manager);
    $etranger = T::locataire($ailleurs);
    $filEtranger = M::filLocataire($ailleurs, $equipeAilleurs, $etranger);
    $filMoi = M::filLocataire($this->org, $this->equipe, $this->moi);

    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/conversations/{$filEtranger->id}")->assertNotFound();
    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/conversations')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $filMoi->id);
    T::comme($this, $etranger['user'])->getJson("/api/v1/tenant/conversations/{$filMoi->id}")->assertNotFound();
});

it('garde l\'accès en lecture et en écriture 12 mois après la fin, puis le retire le lendemain', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-11-16'));
    $fini = T::locataire($this->org, ['status' => LeaseStatus::Terminated, 'starts_on' => '2024-01-01', 'ends_on' => '2025-11-17'], ['valid_from' => '2024-01-01']);
    $fil = M::filLocataire($this->org, $this->equipe, $fini);

    T::comme($this, $fini['user'])->getJson("/api/v1/tenant/conversations/{$fil->id}")->assertOk()->assertJsonPath('data.can_reply', true);
    T::comme($this, $fini['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", ['body' => 'Et mon dépôt ?', 'client_id' => M::cle()])->assertCreated();

    $this->travelTo(CarbonImmutable::parse('2026-11-17 00:00:01'));
    T::comme($this, $fini['user'])->getJson("/api/v1/tenant/conversations/{$fil->id}")->assertNotFound();
    T::comme($this, $fini['user'])->getJson('/api/v1/tenant/conversations')->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $fini['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", ['body' => 'Trop tard.', 'client_id' => M::cle()])->assertNotFound();
});

it('applique la grâce de 12 mois autour du 29 février', function (): void {
    $this->travelTo(CarbonImmutable::parse('2025-02-28'));
    $fini = T::locataire($this->org, ['status' => LeaseStatus::Terminated, 'starts_on' => '2023-01-01', 'ends_on' => '2024-03-01'], ['valid_from' => '2023-01-01']);
    $fil = M::filLocataire($this->org, $this->equipe, $fini);

    T::comme($this, $fini['user'])->getJson("/api/v1/tenant/conversations/{$fil->id}")->assertOk();

    $this->travelTo(CarbonImmutable::parse('2025-03-01'));
    T::comme($this, $fini['user'])->getJson("/api/v1/tenant/conversations/{$fil->id}")->assertNotFound();
});

it('refuse l\'écriture d\'un fil fermé ou restreint par l\'agence', function (): void {
    $fil = M::filLocataire($this->org, $this->equipe, $this->moi);
    $fil->forceFill(['status' => 'closed'])->saveQuietly();
    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", ['body' => 'Encore ?', 'client_id' => M::cle()])
        ->assertConflict()->assertJsonPath('code', 'conversation_closed');

    $fil->forceFill(['status' => 'open', 'counterpart_muted_until' => now()->addDay()])->saveQuietly();
    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", ['body' => 'Encore ?', 'client_id' => M::cle()])
        ->assertForbidden()->assertJsonPath('code', 'conversation_muted');
    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/conversations/{$fil->id}")->assertOk()->assertJsonPath('data.can_reply', false)->assertJsonPath('data.muted', true);
});

it('plafonne à 10 fils ouverts par fiche', function (): void {
    for ($i = 0; $i < 10; $i++) {
        M::filLocataire($this->org, $this->equipe, $this->moi, "Sujet {$i}");
    }

    T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', corpsOuverture($this, ['subject' => 'Onzième']))->assertConflict()->assertJsonPath('code', 'conversation_open_limit');
});

it('liste les baux sur lesquels écrire avec le nom de l\'agence', function (): void {
    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/conversations/options')->assertOk()
        ->assertJsonPath('data.0.agency.id', $this->org->id)
        ->assertJsonPath('data.0.agency.name', 'Agence du Port')
        ->assertJsonPath('data.0.lease.id', $this->moi['lease']->id);
});

it('refuse sans jeton, sans profil locataire et avec un jeton opérateur', function (): void {
    $routes = ['getJson' => ['/api/v1/tenant/conversations', '/api/v1/tenant/conversations/unread', '/api/v1/tenant/conversations/options'], 'postJson' => ['/api/v1/tenant/conversations']];
    T::comme($this, null);

    foreach ($routes as $methode => $urls) {
        foreach ($urls as $url) {
            $this->{$methode}($url)->assertUnauthorized();
        }
    }

    $sansProfil = User::factory()->create();
    T::comme($this, $sansProfil)->getJson('/api/v1/tenant/conversations')->assertForbidden();

    $operateur = User::factory()->create();
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    T::comme($this, null);
    $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)
        ->getJson('/api/v1/tenant/conversations')->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
});

it('valide les entrées de l\'ouverture', function (): void {
    T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', [])->assertUnprocessable()->assertJsonValidationErrors(['lease_id', 'subject', 'body', 'client_id']);
    T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', corpsOuverture($this, ['body' => str_repeat('a', 5001)]))->assertUnprocessable()->assertJsonValidationErrors('body');
});
