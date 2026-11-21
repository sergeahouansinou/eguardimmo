<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Actions\AnonymizeParty;
use App\Modules\Parties\Models\Party;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    Mail::fake();
    config(['notifications.push.driver' => 'fake']);
    L::semer();
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00:00'));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->gestionnaire = L::membre($this->org, MemberRole::Manager);
    $this->comptable = L::membre($this->org, MemberRole::Accountant);
    $this->locataire = T::locataire($this->org);
    $this->mandant = O::proprietaire($this->org);
});

function notifications(string $type, ?string $compte = null): array
{
    $requete = DB::table('notifications')->where('type', $type);

    return ($compte === null ? $requete : $requete->where('user_id', $compte))->get()->all();
}

function ecrireLocataire(mixed $test, string $filId, string $corps = 'Bonjour'): void
{
    T::comme($test, $test->locataire['user'])->postJson("/api/v1/tenant/conversations/{$filId}/messages", ['body' => $corps, 'client_id' => M::cle()])->assertCreated();
}

it('prévient l\'équipe habilitée d\'un message du locataire, pas le comptable ni l\'auteur', function (): void {
    $id = (string) T::comme($this, $this->locataire['user'])->postJson('/api/v1/tenant/conversations', [
        'lease_id' => $this->locataire['lease']->id, 'subject' => 'Fuite', 'body' => 'Texte secret du message', 'client_id' => M::cle(),
    ])->assertCreated()->json('data.id');

    $lignes = notifications('messaging.message_received');
    $destinataires = array_column($lignes, 'user_id');
    expect($destinataires)->toContain($this->titulaire->id, $this->gestionnaire->id)
        ->not->toContain($this->comptable->id, $this->locataire['user']->id)
        ->and($lignes[0]->link)->toBe("/messages/{$id}")
        ->and(json_encode($lignes))->not->toContain('Texte secret du message');
});

it('ne prévient que le gestionnaire assigné', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $fil->forceFill(['assignee_user_id' => $this->gestionnaire->id])->saveQuietly();

    ecrireLocataire($this, $fil->id);

    expect(array_column(notifications('messaging.message_received'), 'user_id'))->toBe([$this->gestionnaire->id]);
});

it('regroupe les messages d\'un fil en une notification tant qu\'elle n\'est pas lue, puis en recrée une après lecture', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $fil->forceFill(['assignee_user_id' => $this->gestionnaire->id])->saveQuietly();

    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:05:00'));
    ecrireLocataire($this, $fil->id, 'Un');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:06:00'));
    ecrireLocataire($this, $fil->id, 'Deux');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:07:00'));
    ecrireLocataire($this, $fil->id, 'Trois');
    expect(notifications('messaging.message_received'))->toHaveCount(1);

    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:10:00'));
    M::lire($this->org, $this->gestionnaire, $fil, MessageSide::Staff);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:11:00'));
    ecrireLocataire($this, $fil->id, 'Quatre');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:12:00'));
    ecrireLocataire($this, $fil->id, 'Cinq');

    expect(notifications('messaging.message_received'))->toHaveCount(2);
});

it('prévient le seul compte de la fiche du locataire, pas son colocataire', function (): void {
    $colocataire = User::factory()->create();
    $fiche = T::colocataire($this->org, $this->locataire['lease']);
    Party::query()->withoutGlobalScopes()->whereKey($fiche->id)->update(['user_id' => $colocataire->id]);
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);

    $lignes = notifications('tenant.message_received');

    expect(array_column($lignes, 'user_id'))->toBe([$this->locataire['user']->id])
        ->and($lignes[0]->lease_id)->toBe($this->locataire['lease']->id)
        ->and($lignes[0]->title)->toBe('Nouveau message de votre agence')
        ->and($lignes[0]->link)->toBe("/messages/{$fil->id}")
        ->and((bool) $lignes[0]->push)->toBeTrue();
});

it('prévient les comptes du mandant dans un fil propriétaire', function (): void {
    $representant = User::factory()->create(['email' => 'rep@exemple.fr']);
    O::acces($this->org, $this->mandant['party'], $representant, OwnerAccessRole::Representative);
    $coproprietaire = User::factory()->create(['email' => 'co@exemple.fr']);
    O::acces($this->org, $this->mandant['party'], $coproprietaire, OwnerAccessRole::CoOwner);

    M::filMandant($this->org, $this->gestionnaire, $this->mandant['party']->id);

    $lignes = notifications('owner.message_received');
    expect(array_column($lignes, 'user_id'))->toContain($this->mandant['user']->id, $representant->id)->not->toContain($coproprietaire->id)
        ->and($lignes[0]->party_id)->toBe($this->mandant['party']->id);
});

it('ne notifie pas deux fois un rejeu avec le même client_id', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $corps = ['body' => 'Une seule fois', 'client_id' => M::cle()];

    T::comme($this, $this->locataire['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", $corps)->assertCreated();
    $apres = count(notifications('messaging.message_received'));
    T::comme($this, $this->locataire['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages", $corps)->assertOk();

    expect(count(notifications('messaging.message_received')))->toBe($apres)->and(ConversationMessage::query()->withoutGlobalScopes()->count())->toBe(2);
});

it('ne montre la notification d\'un fil locataire qu\'à son destinataire', function (): void {
    M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $autre = T::locataire($this->org);

    T::comme($this, $this->locataire['user'])->getJson('/api/v1/notifications')->assertOk()->assertJsonCount(1, 'data');
    T::comme($this, $autre['user'])->getJson('/api/v1/notifications')->assertOk()->assertJsonCount(0, 'data');
});

it('efface les textes et les pièces de la contrepartie quand sa fiche est anonymisée', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire, 'Quittance', 'Message de l\'équipe');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:05:00'));
    ecrireLocataire($this, $fil->id, 'Mon IBAN est FR76 3000 6000 0112 3456 7890 189');

    L::dans($this->org, fn () => app(AnonymizeParty::class)->handle(Party::query()->findOrFail($this->locataire['party']->id), 'requested'));

    $messages = ConversationMessage::query()->withoutGlobalScopes()->where('conversation_id', $fil->id)->orderBy('sent_at')->get();
    expect($messages[0]->body)->toBe('Message de l\'équipe')
        ->and($messages[1]->body)->toBe('[effacé]')
        ->and($messages[1]->isRedacted())->toBeTrue()
        ->and(DB::table('audit_logs')->where('action', 'messaging.messages.erased')->count())->toBe(1);
});
