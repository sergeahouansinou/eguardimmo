<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
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
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00:00'));
    $this->org = T::organisation();
    $this->base = "/api/v1/org/{$this->org->id}";
    $this->titulaire = L::titulaire($this->org);
    $this->admin = L::membre($this->org, MemberRole::Admin);
    $this->gestionnaire = L::membre($this->org, MemberRole::Manager);
    foreach ([$this->admin, $this->gestionnaire] as $compte) {
        activerDeuxFacteurs($compte);
    }
    $this->locataire = T::locataire($this->org);
    $this->mandant = O::proprietaire($this->org);
});

function ecrire(mixed $test, ?User $compte, string $url, array $corps): mixed
{
    O::comme($test, $compte);

    return $test->postJson($url, $corps, O::ORIGINE);
}

function ouvertureAgence(mixed $test, array $surcharge = []): array
{
    return ['kind' => 'tenant', 'party_id' => $test->locataire['party']->id, 'lease_id' => $test->locataire['lease']->id, 'subject' => 'Quittance', 'body' => 'Bonjour.', 'client_id' => M::cle(), ...$surcharge];
}

function pieceDuLocataire(mixed $test, string $nom = 'photo.png'): array
{
    $cree = T::comme($test, $test->locataire['user'])->post('/api/v1/tenant/conversations', [
        'lease_id' => $test->locataire['lease']->id, 'subject' => 'Photo', 'body' => 'Voir pièce', 'client_id' => M::cle(), 'attachments' => [UploadedFile::fake()->image($nom)],
    ], ['Accept' => 'application/json'])->assertCreated();

    return [(string) $cree->json('data.id'), (string) $cree->json('data.messages.0.attachments.0.id')];
}

it('refuse une clé d\'idempotence réutilisée pour un autre contenu, côté équipe', function (): void {
    $corps = ouvertureAgence($this);
    $id = (string) ecrire($this, $this->gestionnaire, "{$this->base}/conversations", $corps)->assertCreated()->json('data.id');

    ecrire($this, $this->gestionnaire, "{$this->base}/conversations", [...$corps, 'body' => 'Autre texte.'])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    ecrire($this, $this->gestionnaire, "{$this->base}/conversations", [...$corps, 'subject' => 'Autre objet'])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');

    $reponse = ['body' => 'Premier texte.', 'client_id' => M::cle()];
    ecrire($this, $this->gestionnaire, "{$this->base}/conversations/{$id}/messages", $reponse)->assertCreated();
    ecrire($this, $this->gestionnaire, "{$this->base}/conversations/{$id}/messages", [...$reponse, 'body' => 'Second texte.'])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    expect(ConversationMessage::query()->withoutGlobalScopes()->count())->toBe(2);
});

it('refuse une clé d\'idempotence réutilisée pour un autre contenu, côté mandant', function (): void {
    $corps = ['access_id' => $this->mandant['access']->id, 'subject' => 'Relevé', 'body' => 'Bonjour.', 'client_id' => M::cle()];
    $id = (string) ecrire($this, $this->mandant['user'], '/api/v1/owner/conversations', $corps)->assertCreated()->json('data.id');

    ecrire($this, $this->mandant['user'], '/api/v1/owner/conversations', [...$corps, 'body' => 'Autre texte.'])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');

    $reponse = ['body' => 'Premier texte.', 'client_id' => M::cle()];
    ecrire($this, $this->mandant['user'], "/api/v1/owner/conversations/{$id}/messages", $reponse)->assertCreated();
    ecrire($this, $this->mandant['user'], "/api/v1/owner/conversations/{$id}/messages", [...$reponse, 'body' => 'Second texte.'])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    expect(ConversationMessage::query()->withoutGlobalScopes()->count())->toBe(2);
});

it('n\'assigne un fil qu\'à un gestionnaire de la même organisation', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $ailleurs = T::organisation('Agence Ailleurs');
    $etranger = L::membre($ailleurs, MemberRole::Manager);

    O::comme($this, $this->titulaire);
    $this->patchJson("{$this->base}/conversations/{$fil->id}", ['assignee_id' => $etranger->id], O::ORIGINE)->assertUnprocessable()->assertJsonPath('code', 'assignee_invalid');
    expect(DB::table('conversations')->where('id', $fil->id)->value('assignee_user_id'))->toBeNull();
});

it('sert une pièce en téléchargement privé, jamais interprétable', function (): void {
    [, $piece] = pieceDuLocataire($this);

    foreach ([
        fn () => O::comme($this, $this->gestionnaire)->get("{$this->base}/conversation-attachments/{$piece}"),
        fn () => T::comme($this, $this->locataire['user'])->get("/api/v1/tenant/conversation-attachments/{$piece}"),
    ] as $appel) {
        $reponse = $appel()->assertOk();
        expect($reponse->headers->get('Content-Disposition'))->toStartWith('attachment')
            ->and($reponse->headers->get('X-Content-Type-Options'))->toBe('nosniff')
            ->and($reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')
            ->and($reponse->headers->get('Content-Type'))->toStartWith('image/png');
    }
});

it('refuse une pièce HTML renommée en PDF, à l\'ouverture comme à la réponse', function (): void {
    $faux = fn (): UploadedFile => UploadedFile::fake()->createWithContent('facture.pdf', '<html><script>alert(document.cookie)</script></html>');
    $debut = DB::table('stored_files')->count();

    T::comme($this, $this->locataire['user'])->post('/api/v1/tenant/conversations', [
        'lease_id' => $this->locataire['lease']->id, 'subject' => 'Facture', 'body' => 'Voir pièce', 'client_id' => M::cle(), 'attachments' => [$faux()],
    ], ['Accept' => 'application/json'])->assertUnprocessable();

    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    T::comme($this, $this->locataire['user'])->post("/api/v1/tenant/conversations/{$fil->id}/messages", [
        'body' => 'Voir pièce', 'client_id' => M::cle(), 'attachments' => [$faux()],
    ], ['Accept' => 'application/json'])->assertUnprocessable();

    expect(DB::table('stored_files')->count())->toBe($debut)->and(DB::table('conversations')->where('subject', 'Facture')->count())->toBe(0);
});

it('ne sert pas une vraie pièce de messagerie par le téléchargement générique des documents', function (): void {
    [, $piece] = pieceDuLocataire($this);
    $fichier = (string) DB::table('conversation_attachments')->where('id', $piece)->value('stored_file_id');
    expect($fichier)->not->toBe('');

    foreach ([$this->titulaire, $this->gestionnaire, $this->admin] as $compte) {
        O::comme($this, $compte)->getJson("{$this->base}/documents/files/{$fichier}/download")->assertNotFound()->assertJsonPath('code', 'file_not_found');
    }
});

it('hérite de la restriction d\'une contrepartie sur un nouveau fil, et la lui applique à l\'ouverture', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    O::preuve($this);
    ecrire($this, $this->admin, "{$this->base}/conversations/{$fil->id}/mute", ['days' => 7, 'reason' => 'Messages répétés'])->assertOk();

    T::comme($this, $this->locataire['user'])->postJson('/api/v1/tenant/conversations', [
        'lease_id' => $this->locataire['lease']->id, 'subject' => 'Contournement', 'body' => 'Un autre fil', 'client_id' => M::cle(),
    ])->assertForbidden()->assertJsonPath('code', 'conversation_muted');
    expect(DB::table('conversations')->where('subject', 'Contournement')->count())->toBe(0);

    $neuf = ecrire($this, $this->gestionnaire, "{$this->base}/conversations", ouvertureAgence($this, ['subject' => 'Autre sujet']))->assertCreated();
    expect(DB::table('conversations')->where('id', $neuf->json('data.id'))->value('counterpart_muted_until'))->not->toBeNull();
});

it('refuse à un mandant restreint d\'ouvrir un nouveau fil', function (): void {
    $fil = M::filMandant($this->org, $this->gestionnaire, $this->mandant['party']->id);
    O::preuve($this);
    ecrire($this, $this->admin, "{$this->base}/conversations/{$fil->id}/mute", ['days' => 7, 'reason' => 'Messages répétés'])->assertOk();

    ecrire($this, $this->mandant['user'], '/api/v1/owner/conversations', ['access_id' => $this->mandant['access']->id, 'subject' => 'Contournement', 'body' => 'Un autre fil', 'client_id' => M::cle()])
        ->assertForbidden()->assertJsonPath('code', 'conversation_muted');
});

it('limite le retrait de son propre message à 15 minutes pour un gestionnaire, qui n\'est pas administrateur', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:20:00'));
    $recent = M::repondre($this->org, $this->gestionnaire, $fil, 'Message récent');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:34:00'));
    ecrire($this, $this->gestionnaire, "{$this->base}/conversations/{$fil->id}/messages/{$recent->id}/redaction", [])->assertOk();

    $ancien = M::repondre($this->org, $this->gestionnaire, $fil, 'Message plus ancien');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:51:00'));
    ecrire($this, $this->gestionnaire, "{$this->base}/conversations/{$fil->id}/messages/{$ancien->id}/redaction", ['reason' => 'Je me suis trompé'])
        ->assertConflict()->assertJsonPath('code', 'message_redaction_expired');
    expect(ConversationMessage::query()->withoutGlobalScopes()->whereKey($ancien->id)->value('body'))->toBe('Message plus ancien');
});

it('refuse un jeton opérateur, même d\'un membre, et masque l\'organisation à un compte étranger', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $urls = ["{$this->base}/conversations", "{$this->base}/conversations/{$fil->id}", "{$this->base}/conversations/unread", "{$this->base}/conversations/stats"];

    $operateur = User::factory()->create();
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    $this->gestionnaire->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    $sans = User::factory()->create();

    foreach ($urls as $url) {
        O::comme($this, null);
        $this->withToken($this->gestionnaire->createToken('console', ['operator'])->plainTextToken)->getJson($url)->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
        O::comme($this, null);
        $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)->getJson($url)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
        O::comme($this, $sans)->getJson($url)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }

    O::comme($this, null);
    $this->withToken($this->gestionnaire->createToken('console', ['operator'])->plainTextToken)->postJson("{$this->base}/conversations", ouvertureAgence($this))->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    expect(DB::table('conversations')->count())->toBe(1);
});
