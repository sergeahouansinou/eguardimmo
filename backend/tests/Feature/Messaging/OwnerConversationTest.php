<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    L::semer();
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->equipe = L::membre($this->org, MemberRole::Manager);
    $this->moi = O::proprietaire($this->org);
});

function ecrireProprietaire(mixed $test, ?User $compte, string $methode, string $chemin, array $corps = []): mixed
{
    O::comme($test, $compte);

    return $test->{$methode.'Json'}('/api/v1/owner'.$chemin, $corps, O::ORIGINE);
}

function ouvertureProprietaire(mixed $test, array $surcharge = []): array
{
    return ['access_id' => $test->moi['access']->id, 'subject' => 'Relevé du trimestre', 'body' => 'Pouvez-vous me renvoyer le relevé ?', 'client_id' => M::cle(), ...$surcharge];
}

it('ouvre un fil vers l\'agence, la liste, y répond et retire son message', function (): void {
    $cree = ecrireProprietaire($this, $this->moi['user'], 'post', '/conversations', ouvertureProprietaire($this))
        ->assertCreated()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('data.agency.id', $this->org->id)
        ->assertJsonPath('data.last_author', 'me')
        ->assertJsonPath('data.can_reply', true)
        ->assertJsonCount(1, 'data.messages');
    $id = (string) $cree->json('data.id');

    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:05:00'));
    M::repondre($this->org, $this->equipe, Conversation::query()->withoutGlobalScopes()->findOrFail($id), 'Le relevé part ce soir.');

    O::comme($this, $this->moi['user'])->getJson('/api/v1/owner/conversations')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.unread', true)->assertJsonPath('data.0.last_author', 'agency');
    O::comme($this, $this->moi['user'])->getJson('/api/v1/owner/conversations/unread')->assertOk()->assertJsonPath('data.unread', 1);

    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:10:00'));
    O::comme($this, $this->moi['user'])->getJson("/api/v1/owner/conversations/{$id}")->assertOk()->assertJsonCount(2, 'data.messages');
    ecrireProprietaire($this, $this->moi['user'], 'patch', "/conversations/{$id}", ['read' => true])->assertOk()->assertJsonPath('data.unread', false);
    O::comme($this, $this->moi['user'])->getJson('/api/v1/owner/conversations/unread')->assertJsonPath('data.unread', 0);

    $reponse = ecrireProprietaire($this, $this->moi['user'], 'post', "/conversations/{$id}/messages", ['body' => 'Merci.', 'client_id' => M::cle()])->assertCreated()->assertJsonPath('data.mine', true);
    ecrireProprietaire($this, $this->moi['user'], 'post', "/conversations/{$id}/messages/{$reponse->json('data.id')}/redaction")->assertOk()->assertJsonPath('data.redacted', true);
});

it('liste ses accès pour écrire, avec le nom de l\'agence et du mandant', function (): void {
    O::comme($this, $this->moi['user'])->getJson('/api/v1/owner/conversations/options')->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.access_id', $this->moi['access']->id)
        ->assertJsonPath('data.0.agency.name', 'Agence du Port');
});

it('rejoue une ouverture et une réponse avec le même client_id sans doublon', function (): void {
    $corps = ouvertureProprietaire($this);
    $a = ecrireProprietaire($this, $this->moi['user'], 'post', '/conversations', $corps)->assertCreated();
    $b = ecrireProprietaire($this, $this->moi['user'], 'post', '/conversations', $corps)->assertOk();
    expect($b->json('data.id'))->toBe($a->json('data.id'))->and(Conversation::query()->withoutGlobalScopes()->count())->toBe(1);

    $id = (string) $a->json('data.id');
    $reponse = ['body' => 'Une seule fois.', 'client_id' => M::cle()];
    ecrireProprietaire($this, $this->moi['user'], 'post', "/conversations/{$id}/messages", $reponse)->assertCreated();
    ecrireProprietaire($this, $this->moi['user'], 'post', "/conversations/{$id}/messages", $reponse)->assertOk();
    expect(ConversationMessage::query()->withoutGlobalScopes()->count())->toBe(2);
});

it('partage le fil entre les comptes du même mandant, et lit le message d\'un autre compte comme celui d\'un autre', function (): void {
    $representant = User::factory()->create(['email' => 'rep@exemple.fr']);
    O::acces($this->org, $this->moi['party'], $representant, OwnerAccessRole::Representative);
    $fil = M::filMandant($this->org, $this->equipe, $this->moi['party']->id);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:30:00'));
    ecrireProprietaire($this, $this->moi['user'], 'post', "/conversations/{$fil->id}/messages", ['body' => 'Bien reçu.', 'client_id' => M::cle()])->assertCreated();

    O::comme($this, $representant)->getJson("/api/v1/owner/conversations/{$fil->id}")->assertOk()
        ->assertJsonPath('data.last_author', 'other')->assertJsonPath('data.unread', true)->assertJsonPath('data.messages.1.author.side', 'other');
    ecrireProprietaire($this, $representant, 'post', "/conversations/{$fil->id}/messages", ['body' => 'Moi aussi.', 'client_id' => M::cle()])->assertCreated();
});

it('refuse à un co_owner d\'ouvrir ou de lire un fil', function (): void {
    $co = O::proprietaire($this->org, 'co@exemple.fr', OwnerAccessRole::CoOwner);
    $fil = M::filMandant($this->org, $this->equipe, $co['party']->id);

    ecrireProprietaire($this, $co['user'], 'post', '/conversations', ouvertureProprietaire($this, ['access_id' => $co['access']->id]))->assertForbidden()->assertJsonPath('code', 'owner_role_forbidden');
    O::comme($this, $co['user'])->getJson('/api/v1/owner/conversations')->assertOk()->assertJsonCount(0, 'data');
    O::comme($this, $co['user'])->getJson("/api/v1/owner/conversations/{$fil->id}")->assertNotFound()->assertJsonPath('code', 'conversation_not_found');
    ecrireProprietaire($this, $co['user'], 'post', "/conversations/{$fil->id}/messages", ['body' => 'x', 'client_id' => M::cle()])->assertNotFound();
});

it('cloisonne par mandant et par organisation', function (): void {
    $autre = O::proprietaire($this->org, 'autre@exemple.fr');
    $filAutre = M::filMandant($this->org, $this->equipe, $autre['party']->id);
    $ailleurs = T::organisation('Agence Ailleurs');
    $etranger = O::proprietaire($ailleurs, 'etranger@exemple.fr');
    $filEtranger = M::filMandant($ailleurs, L::membre($ailleurs, MemberRole::Manager), $etranger['party']->id);
    $filMoi = M::filMandant($this->org, $this->equipe, $this->moi['party']->id);

    O::comme($this, $this->moi['user'])->getJson('/api/v1/owner/conversations')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $filMoi->id);
    O::comme($this, $this->moi['user'])->getJson("/api/v1/owner/conversations/{$filAutre->id}")->assertNotFound();
    O::comme($this, $this->moi['user'])->getJson("/api/v1/owner/conversations/{$filEtranger->id}")->assertNotFound();
    O::comme($this, $this->moi['user'])->getJson("/api/v1/owner/conversations/{$filAutre->id}/messages")->assertNotFound();
    ecrireProprietaire($this, $this->moi['user'], 'post', "/conversations/{$filAutre->id}/messages", ['body' => 'x', 'client_id' => M::cle()])->assertNotFound();
    ecrireProprietaire($this, $this->moi['user'], 'patch', "/conversations/{$filAutre->id}", ['read' => true])->assertNotFound();
    ecrireProprietaire($this, $this->moi['user'], 'post', '/conversations', ouvertureProprietaire($this, ['access_id' => $autre['access']->id]))->assertNotFound()->assertJsonPath('code', 'conversation_link_not_found');
});

it('restreint la liste à une agence par ?agency= sans jamais élargir', function (): void {
    $filMoi = M::filMandant($this->org, $this->equipe, $this->moi['party']->id);

    O::comme($this, $this->moi['user'])->getJson("/api/v1/owner/conversations?agency={$this->org->id}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $filMoi->id);
    O::comme($this, $this->moi['user'])->getJson('/api/v1/owner/conversations?agency='.M::cle())->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
});

it('ouvre un fil rattaché à un mandat du mandant seulement', function (): void {
    $corps = ouvertureProprietaire($this, ['mandate_id' => $this->moi['mandate']->id]);
    ecrireProprietaire($this, $this->moi['user'], 'post', '/conversations', $corps)->assertCreated()->assertJsonPath('data.mandate.id', $this->moi['mandate']->id);

    $autre = O::proprietaire($this->org, 'autre@exemple.fr');
    ecrireProprietaire($this, $this->moi['user'], 'post', '/conversations', ouvertureProprietaire($this, ['mandate_id' => $autre['mandate']->id, 'client_id' => M::cle()]))->assertNotFound();
});

it('met le mandant en lecture seule pendant la grâce, sauf réponse tant que le compte à reverser n\'est pas soldé', function (): void {
    $fin = O::proprietaire($this->org, 'fin@exemple.fr', OwnerAccessRole::Holder, MandateStatus::Terminated);
    $fin['mandate']->forceFill(['starts_on' => '2025-01-01', 'ends_on' => '2026-01-01'])->saveQuietly();
    $fil = M::filMandant($this->org, $this->equipe, $fin['party']->id);
    $this->travelTo(CarbonImmutable::parse('2026-12-31 09:00:00'));

    O::comme($this, $fin['user'])->getJson("/api/v1/owner/conversations/{$fil->id}")->assertOk()->assertJsonPath('data.can_reply', false);
    ecrireProprietaire($this, $fin['user'], 'post', '/conversations', ouvertureProprietaire($this, ['access_id' => $fin['access']->id]))->assertForbidden()->assertJsonPath('code', 'conversation_read_only');
    ecrireProprietaire($this, $fin['user'], 'post', "/conversations/{$fil->id}/messages", ['body' => 'Et mes fonds ?', 'client_id' => M::cle()])->assertForbidden()->assertJsonPath('code', 'conversation_read_only');
    ecrireProprietaire($this, $fin['user'], 'patch', "/conversations/{$fil->id}", ['read' => true])->assertOk();

    M::crediterMandant($this->org, $fin['party']->id);
    O::comme($this, $fin['user'])->getJson("/api/v1/owner/conversations/{$fil->id}")->assertOk()->assertJsonPath('data.can_reply', true);
    ecrireProprietaire($this, $fin['user'], 'post', "/conversations/{$fil->id}/messages", ['body' => 'Et mes fonds ?', 'client_id' => M::cle()])->assertCreated();
    ecrireProprietaire($this, $fin['user'], 'post', '/conversations', ouvertureProprietaire($this, ['access_id' => $fin['access']->id, 'client_id' => M::cle()]))->assertForbidden()->assertJsonPath('code', 'conversation_read_only');
});

it('ferme le fil du mandant 12 mois après la fin du mandat, le lendemain inclus', function (): void {
    $fin = O::proprietaire($this->org, 'fin@exemple.fr', OwnerAccessRole::Holder, MandateStatus::Terminated);
    $fin['mandate']->forceFill(['starts_on' => '2025-01-01', 'ends_on' => '2026-01-01'])->saveQuietly();
    $fil = M::filMandant($this->org, $this->equipe, $fin['party']->id);

    $this->travelTo(CarbonImmutable::parse('2026-12-31 23:00:00'));
    O::comme($this, $fin['user'])->getJson("/api/v1/owner/conversations/{$fil->id}")->assertOk();
    $this->travelTo(CarbonImmutable::parse('2027-01-01 00:00:01'));
    O::comme($this, $fin['user'])->getJson("/api/v1/owner/conversations/{$fil->id}")->assertNotFound();
    O::comme($this, $fin['user'])->getJson('/api/v1/owner/conversations')->assertOk()->assertJsonCount(0, 'data');
});

it('applique la grâce du mandant autour du 29 février', function (): void {
    $fin = O::proprietaire($this->org, 'fin@exemple.fr', OwnerAccessRole::Holder, MandateStatus::Terminated);
    $fin['mandate']->forceFill(['starts_on' => '2027-01-01', 'ends_on' => '2028-02-29'])->saveQuietly();
    $fil = M::filMandant($this->org, $this->equipe, $fin['party']->id);

    $this->travelTo(CarbonImmutable::parse('2029-02-28 12:00:00'));
    O::comme($this, $fin['user'])->getJson("/api/v1/owner/conversations/{$fil->id}")->assertOk();
    $this->travelTo(CarbonImmutable::parse('2029-03-01 00:00:01'));
    O::comme($this, $fin['user'])->getJson("/api/v1/owner/conversations/{$fil->id}")->assertNotFound();
});

it('joint une pièce et la sert aux seuls comptes du mandant', function (): void {
    O::comme($this, $this->moi['user']);
    $cree = $this->post('/api/v1/owner/conversations', [...ouvertureProprietaire($this), 'attachments' => [UploadedFile::fake()->image('releve.png')]], [...O::ORIGINE, 'Accept' => 'application/json'])->assertCreated();
    $piece = (string) $cree->json('data.messages.0.attachments.0.id');

    O::comme($this, $this->moi['user'])->get("/api/v1/owner/conversation-attachments/{$piece}")->assertOk();

    $autre = O::proprietaire($this->org, 'autre@exemple.fr');
    O::comme($this, $autre['user'])->getJson("/api/v1/owner/conversation-attachments/{$piece}")->assertNotFound()->assertJsonPath('code', 'attachment_not_found');
});

it('retire seulement son propre message, dans les 15 minutes', function (): void {
    $fil = M::filMandant($this->org, $this->equipe, $this->moi['party']->id);
    $agence = ConversationMessage::query()->withoutGlobalScopes()->where('conversation_id', $fil->id)->firstOrFail();

    ecrireProprietaire($this, $this->moi['user'], 'post', "/conversations/{$fil->id}/messages/{$agence->id}/redaction")->assertForbidden()->assertJsonPath('code', 'message_redaction_forbidden');

    $mien = (string) ecrireProprietaire($this, $this->moi['user'], 'post', "/conversations/{$fil->id}/messages", ['body' => 'Erreur', 'client_id' => M::cle()])->json('data.id');
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI)->addMinutes(16));
    ecrireProprietaire($this, $this->moi['user'], 'post', "/conversations/{$fil->id}/messages/{$mien}/redaction")->assertConflict()->assertJsonPath('code', 'message_redaction_expired');
});

it('exige une session sur toute écriture et un client_id', function (): void {
    $fil = M::filMandant($this->org, $this->equipe, $this->moi['party']->id);
    O::comme($this, null);
    $this->postJson('/api/v1/owner/conversations', ouvertureProprietaire($this))->assertUnauthorized();
    $this->getJson('/api/v1/owner/conversations')->assertUnauthorized();

    O::comme($this, $this->moi['user']);
    $this->flushHeaders();
    $jeton = $this->moi['user']->createToken('mobile')->plainTextToken;
    O::comme($this, null);
    $this->withToken($jeton)->postJson("/api/v1/owner/conversations/{$fil->id}/messages", ['body' => 'x', 'client_id' => M::cle()])->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    ecrireProprietaire($this, $this->moi['user'], 'post', "/conversations/{$fil->id}/messages", ['body' => 'x'])->assertUnprocessable()->assertJsonValidationErrors('client_id');
});

it('refuse un compte sans profil propriétaire et un jeton opérateur', function (): void {
    $sans = User::factory()->create();
    O::comme($this, $sans)->getJson('/api/v1/owner/conversations')->assertForbidden()->assertJsonPath('code', 'space_forbidden');

    $operateur = User::factory()->create();
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    O::comme($this, null);
    $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)->getJson('/api/v1/owner/conversations')->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
});
