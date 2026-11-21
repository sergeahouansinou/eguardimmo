<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
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
    $this->base = "/api/v1/org/{$this->org->id}/conversations";
    $this->titulaire = L::titulaire($this->org);
    $this->admin = L::membre($this->org, MemberRole::Admin);
    $this->gestionnaire = L::membre($this->org, MemberRole::Manager);
    $this->comptable = L::membre($this->org, MemberRole::Accountant);
    foreach ([$this->admin, $this->gestionnaire, $this->comptable] as $compte) {
        activerDeuxFacteurs($compte);
    }
    $this->locataire = T::locataire($this->org);
    $this->mandant = O::proprietaire($this->org);
});

function agence(mixed $test, User $compte): mixed
{
    return O::comme($test, $compte);
}

function ecrireAgence(mixed $test, User $compte, string $methode, string $url, array $corps = []): mixed
{
    O::comme($test, $compte);

    return $test->{$methode.'Json'}($url, $corps, O::ORIGINE);
}

function ouvertureLocataire(mixed $test, array $surcharge = []): array
{
    return ['kind' => 'tenant', 'party_id' => $test->locataire['party']->id, 'lease_id' => $test->locataire['lease']->id, 'subject' => 'Quittance', 'body' => 'Bonjour.', 'client_id' => M::cle(), ...$surcharge];
}

it('liste les fils par type, avec les compteurs d\'onglet', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    M::filMandant($this->org, $this->gestionnaire, $this->mandant['party']->id);

    $liste = agence($this, $this->titulaire)->getJson("{$this->base}?kind=tenant")->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $fil->id)
        ->assertJsonPath('data.0.kind', 'tenant')
        ->assertJsonPath('data.0.party.id', $this->locataire['party']->id)
        ->assertJsonPath('data.0.lease.id', $this->locataire['lease']->id)
        ->assertJsonPath('meta.counts.all', 1);
    expect($liste->json('data.0.awaiting_reply'))->toBeFalse();

    agence($this, $this->titulaire)->getJson("{$this->base}?kind=owner")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.kind', 'owner');
    agence($this, $this->titulaire)->getJson($this->base)->assertOk()->assertJsonCount(0, 'data');
});

it('affiche un fil sans le marquer lu, puis le marque lu à la demande', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:05:00'));
    M::repondre($this->org, $this->locataire['user'], $fil, 'Merci, et mon dépôt ?', MessageSide::Tenant);

    agence($this, $this->titulaire)->getJson("{$this->base}/{$fil->id}")->assertOk()->assertJsonPath('data.unread', true)->assertJsonCount(2, 'data.messages');
    agence($this, $this->titulaire)->getJson("{$this->base}?kind=tenant")->assertJsonPath('data.0.unread', true)->assertJsonPath('data.0.awaiting_reply', true);

    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:10:00'));
    ecrireAgence($this, $this->titulaire, 'patch', "{$this->base}/{$fil->id}", ['read' => true])->assertOk()->assertJsonPath('data.unread', false);
    agence($this, $this->titulaire)->getJson("{$this->base}/unread")->assertOk()->assertJsonPath('data.tenant', 0);
});

it('ouvre un fil vers un locataire, vérifie la fiche, le compte et le bail', function (): void {
    $cree = ecrireAgence($this, $this->gestionnaire, 'post', $this->base, ouvertureLocataire($this))
        ->assertCreated()->assertJsonPath('data.kind', 'tenant')->assertJsonPath('data.last_author_side', 'staff')->assertJsonCount(1, 'data.messages');
    $id = (string) $cree->json('data.id');

    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:30:00'));
    T::comme($this, $this->locataire['user'])->getJson("/api/v1/tenant/conversations/{$id}")->assertOk()->assertJsonPath('data.unread', true);

    $sansCompte = T::partie($this->org);
    ecrireAgence($this, $this->gestionnaire, 'post', $this->base, ouvertureLocataire($this, ['party_id' => $sansCompte->id]))->assertUnprocessable()->assertJsonPath('code', 'recipient_not_found');

    $autre = T::locataire($this->org);
    ecrireAgence($this, $this->gestionnaire, 'post', $this->base, ouvertureLocataire($this, ['lease_id' => $autre['lease']->id]))->assertNotFound()->assertJsonPath('code', 'conversation_link_not_found');
    ecrireAgence($this, $this->gestionnaire, 'post', $this->base, ouvertureLocataire($this, ['lease_id' => M::cle()]))->assertNotFound();
    ecrireAgence($this, $this->gestionnaire, 'post', $this->base, ouvertureLocataire($this, ['lease_id' => null]))->assertUnprocessable();
});

it('ouvre un fil vers un mandant, et refuse un mandat qui n\'est pas le sien', function (): void {
    ecrireAgence($this, $this->gestionnaire, 'post', $this->base, ['kind' => 'owner', 'party_id' => $this->mandant['party']->id, 'mandate_id' => $this->mandant['mandate']->id, 'subject' => 'Relevé', 'body' => 'Bonjour.', 'client_id' => M::cle()])
        ->assertCreated()->assertJsonPath('data.kind', 'owner')->assertJsonPath('data.mandate.id', $this->mandant['mandate']->id);

    $autre = O::proprietaire($this->org, 'autre@exemple.fr');
    ecrireAgence($this, $this->gestionnaire, 'post', $this->base, ['kind' => 'owner', 'party_id' => $this->mandant['party']->id, 'mandate_id' => $autre['mandate']->id, 'subject' => 'Relevé', 'body' => 'x', 'client_id' => M::cle()])
        ->assertNotFound()->assertJsonPath('code', 'conversation_link_not_found');

    $sansAcces = O::mandant($this->org, 'sans@exemple.fr');
    ecrireAgence($this, $this->gestionnaire, 'post', $this->base, ['kind' => 'owner', 'party_id' => $sansAcces->id, 'subject' => 'Relevé', 'body' => 'x', 'client_id' => M::cle()])
        ->assertUnprocessable()->assertJsonPath('code', 'recipient_not_found');
});

it('rejoue une ouverture et une réponse de l\'équipe sans doublon', function (): void {
    $corps = ouvertureLocataire($this);
    $a = ecrireAgence($this, $this->gestionnaire, 'post', $this->base, $corps)->assertCreated();
    $b = ecrireAgence($this, $this->gestionnaire, 'post', $this->base, $corps)->assertOk();
    expect($b->json('data.id'))->toBe($a->json('data.id'))->and(Conversation::query()->withoutGlobalScopes()->count())->toBe(1);

    $id = (string) $a->json('data.id');
    $reponse = ['body' => 'Une fois.', 'client_id' => M::cle()];
    ecrireAgence($this, $this->gestionnaire, 'post', "{$this->base}/{$id}/messages", $reponse)->assertCreated();
    ecrireAgence($this, $this->gestionnaire, 'post', "{$this->base}/{$id}/messages", $reponse)->assertOk();
    expect(ConversationMessage::query()->withoutGlobalScopes()->count())->toBe(2);
});

it('ferme un fil, puis le rouvre quand l\'équipe répond', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    ecrireAgence($this, $this->gestionnaire, 'patch', "{$this->base}/{$fil->id}", ['status' => 'closed'])->assertOk()->assertJsonPath('data.status', 'closed');
    T::comme($this, $this->locataire['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", ['body' => 'Une question', 'client_id' => M::cle()])->assertConflict()->assertJsonPath('code', 'conversation_closed');

    ecrireAgence($this, $this->gestionnaire, 'post', "{$this->base}/{$fil->id}/messages", ['body' => 'Je reviens vers vous.', 'client_id' => M::cle()])->assertCreated();
    expect($fil->refresh()->status->value)->toBe('open');
    T::comme($this, $this->locataire['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", ['body' => 'Merci', 'client_id' => M::cle()])->assertCreated();
    expect(DB::table('audit_logs')->whereIn('action', ['messaging.conversation.closed', 'messaging.conversation.reopened'])->count())->toBe(2);
});

it('assigne un fil à un gestionnaire seulement', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);

    ecrireAgence($this, $this->titulaire, 'patch', "{$this->base}/{$fil->id}", ['assignee_id' => $this->gestionnaire->id])->assertOk()->assertJsonPath('data.assignee.id', $this->gestionnaire->id);
    ecrireAgence($this, $this->titulaire, 'patch', "{$this->base}/{$fil->id}", ['assignee_id' => $this->comptable->id])->assertUnprocessable()->assertJsonPath('code', 'assignee_invalid');
    ecrireAgence($this, $this->titulaire, 'patch', "{$this->base}/{$fil->id}", ['assignee_id' => null])->assertOk()->assertJsonPath('data.assignee', null);
});

it('exclut le comptable des fils avec une contrepartie, pas des fils internes', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $piece = (string) agence($this, $this->titulaire)->getJson("{$this->base}/{$fil->id}")->json('data.id');

    agence($this, $this->comptable)->getJson("{$this->base}?kind=tenant")->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    agence($this, $this->comptable)->getJson("{$this->base}?kind=owner")->assertForbidden();
    agence($this, $this->comptable)->getJson("{$this->base}/{$piece}")->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    agence($this, $this->comptable)->getJson("{$this->base}/{$piece}/messages")->assertForbidden();
    ecrireAgence($this, $this->comptable, 'post', "{$this->base}/{$piece}/messages", ['body' => 'x', 'client_id' => M::cle()])->assertForbidden();
    ecrireAgence($this, $this->comptable, 'patch', "{$this->base}/{$piece}", ['read' => true])->assertForbidden();
    ecrireAgence($this, $this->comptable, 'post', $this->base, ouvertureLocataire($this))->assertForbidden();
    agence($this, $this->comptable)->getJson($this->base)->assertOk();
    agence($this, $this->comptable)->getJson("{$this->base}/unread")->assertOk()->assertJsonPath('data.tenant', 0)->assertJsonPath('data.owner', 0);
});

it('réserve les fils mandant aux agences', function (): void {
    $titulaire = User::factory()->create();
    activerDeuxFacteurs($titulaire);
    $bailleur = app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Individual, 'Bailleur', 'FR'), 'Awa', 'Diallo');

    O::comme($this, $titulaire)->getJson("/api/v1/org/{$bailleur->id}/conversations?kind=owner")->assertForbidden()->assertJsonPath('code', 'conversation_kind_unavailable');
    O::comme($this, $titulaire)->getJson("/api/v1/org/{$bailleur->id}/conversations?kind=tenant")->assertOk();
});

it('cloisonne par organisation', function (): void {
    $ailleurs = T::organisation('Agence Ailleurs');
    $equipeAilleurs = L::membre($ailleurs, MemberRole::Manager);
    activerDeuxFacteurs($equipeAilleurs);
    $etranger = T::locataire($ailleurs);
    $filEtranger = M::filLocataire($ailleurs, $equipeAilleurs, $etranger);
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);

    agence($this, $this->titulaire)->getJson("{$this->base}?kind=tenant")->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $fil->id);
    agence($this, $this->titulaire)->getJson("{$this->base}/{$filEtranger->id}")->assertNotFound();
    agence($this, $this->titulaire)->getJson("{$this->base}/{$filEtranger->id}/messages")->assertNotFound();
    ecrireAgence($this, $this->titulaire, 'post', "{$this->base}/{$filEtranger->id}/messages", ['body' => 'x', 'client_id' => M::cle()])->assertNotFound();
    ecrireAgence($this, $this->titulaire, 'patch', "{$this->base}/{$filEtranger->id}", ['status' => 'closed'])->assertNotFound();
    agence($this, $equipeAilleurs)->getJson("{$this->base}?kind=tenant")->assertNotFound();
});

it('lit les messages après un repère et restreint par ?since=', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $premier = (string) agence($this, $this->titulaire)->getJson("{$this->base}/{$fil->id}/messages")->assertOk()->json('data.0.id');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:05:00'));
    M::repondre($this->org, $this->locataire['user'], $fil, 'Réponse du locataire', MessageSide::Tenant);

    $suite = agence($this, $this->titulaire)->getJson("{$this->base}/{$fil->id}/messages?after={$premier}")->assertOk();
    expect(array_column($suite->json('data'), 'body'))->toBe(['Réponse du locataire'])->and($suite->json('data.0.author.side'))->toBe('tenant');
    agence($this, $this->titulaire)->getJson("{$this->base}?kind=tenant&since=2026-11-19T10:02:00Z")->assertJsonCount(1, 'data');
    agence($this, $this->titulaire)->getJson("{$this->base}?kind=tenant&since=2026-11-19T10:06:00Z")->assertJsonCount(0, 'data');
});

it('restreint une contrepartie avec la 2FA et un motif, pour owner et admin seulement', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $url = "{$this->base}/{$fil->id}/mute";

    O::preuve($this);
    ecrireAgence($this, $this->gestionnaire, 'post', $url, ['reason' => 'Messages répétés', 'days' => 7])->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    O::preuve($this);
    ecrireAgence($this, $this->admin, 'post', $url, ['days' => 7])->assertUnprocessable()->assertJsonValidationErrors('reason');
    ecrireAgence($this, $this->admin, 'post', $url, ['days' => 31, 'reason' => 'Messages répétés'])->assertUnprocessable();

    O::comme($this, $this->admin);
    $this->flushSession();
    $this->postJson($url, ['days' => 7, 'reason' => 'Messages répétés'], O::ORIGINE)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    O::preuve($this);
    ecrireAgence($this, $this->admin, 'post', $url, ['days' => 7, 'reason' => 'Messages répétés'])->assertOk()->assertJsonPath('data.muted_reason', 'Messages répétés');
    T::comme($this, $this->locataire['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", ['body' => 'Encore', 'client_id' => M::cle()])->assertForbidden()->assertJsonPath('code', 'conversation_muted');
    T::comme($this, $this->locataire['user'])->getJson("/api/v1/tenant/conversations/{$fil->id}")->assertOk()->assertJsonPath('data.muted', true);

    ecrireAgence($this, $this->admin, 'delete', $url)->assertOk()->assertJsonPath('data.muted_until', null);
    T::comme($this, $this->locataire['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", ['body' => 'Revoilà', 'client_id' => M::cle()])->assertCreated();
    expect(DB::table('audit_logs')->whereIn('action', ['messaging.conversation.muted', 'messaging.conversation.unmuted'])->count())->toBe(2);
});

it('laisse l\'équipe retirer le message d\'un locataire avec 2FA, preuve récente et motif, sans consigner le texte', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 11:00:00'));
    $message = M::repondre($this->org, $this->locataire['user'], $fil, 'Texte injurieux', MessageSide::Tenant);
    $url = "{$this->base}/{$fil->id}/messages/{$message->id}/redaction";

    O::preuve($this);
    ecrireAgence($this, $this->gestionnaire, 'post', $url, ['reason' => 'Injure'])->assertForbidden()->assertJsonPath('code', 'message_redaction_forbidden');

    O::comme($this, $this->admin);
    $this->flushSession();
    $this->postJson($url, ['reason' => 'Injure'], O::ORIGINE)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    O::preuve($this);
    ecrireAgence($this, $this->admin, 'post', $url, [])->assertUnprocessable()->assertJsonValidationErrors('reason');

    O::preuve($this);
    ecrireAgence($this, $this->admin, 'post', $url, ['reason' => 'Injure'])->assertOk()->assertJsonPath('data.redacted', true)->assertJsonPath('data.body', '[message retiré]')->assertJsonPath('data.redaction_reason', 'Injure');

    $audit = DB::table('audit_logs')->where('action', 'messaging.message.redacted')->get();
    expect($audit)->toHaveCount(1)->and(json_encode($audit))->not->toContain('Texte injurieux');
    T::comme($this, $this->locataire['user'])->getJson("/api/v1/tenant/conversations/{$fil->id}")->assertJsonPath('data.messages.1.body', '[message retiré]');
});

it('retire aussi les pièces d\'un message retiré', function (): void {
    $id = (string) T::comme($this, $this->locataire['user'])->post('/api/v1/tenant/conversations', ['lease_id' => $this->locataire['lease']->id, 'subject' => 'Photo', 'body' => 'Voir pièce', 'client_id' => M::cle(), 'attachments' => [UploadedFile::fake()->image('p.png')]], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    $message = (string) ConversationMessage::query()->withoutGlobalScopes()->where('conversation_id', $id)->value('id');
    $piece = (string) T::comme($this, $this->locataire['user'])->getJson("/api/v1/tenant/conversations/{$id}")->json('data.messages.0.attachments.0.id');

    agence($this, $this->gestionnaire)->get("/api/v1/org/{$this->org->id}/conversation-attachments/{$piece}")->assertOk();
    agence($this, $this->comptable)->getJson("/api/v1/org/{$this->org->id}/conversation-attachments/{$piece}")->assertForbidden();

    O::preuve($this);
    ecrireAgence($this, $this->admin, 'post', "{$this->base}/{$id}/messages/{$message}/redaction", ['reason' => 'Contenu inapproprié'])->assertOk()->assertJsonCount(0, 'data.attachments');
    agence($this, $this->gestionnaire)->getJson("/api/v1/org/{$this->org->id}/conversation-attachments/{$piece}")->assertNotFound();
});

it('refuse sans jeton', function (): void {
    O::comme($this, null);
    $this->getJson("{$this->base}?kind=tenant")->assertUnauthorized();
    $this->getJson("{$this->base}/unread")->assertUnauthorized();
    $this->postJson("{$this->base}/".M::cle().'/mute', [])->assertUnauthorized();
});
