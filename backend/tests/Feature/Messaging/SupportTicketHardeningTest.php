<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\UpdateSupportTicket;
use App\Modules\Messaging\Data\TicketPatchData;
use App\Modules\Messaging\Enums\TicketPriority;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Messaging\MessagingContext as M;

const SUJET_CONFIDENTIEL = 'Sujet très confidentiel';

beforeEach(function (): void {
    Notification::fake();
    Storage::fake('local');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00:00'));
    $this->operateur = User::factory()->create(['name' => 'Julie Martin']);
    $this->operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($this->operateur);
    $this->jeton = $this->operateur->createToken('console', ['operator'])->plainTextToken;
    $this->demandeur = User::factory()->create();

    $this->ouvrir = function (array $corps = []): string {
        auth()->forgetGuards();

        return (string) $this->actingAs($this->demandeur)->postJson('/api/v1/support/tickets', [
            'space' => 'marketplace', 'category' => 'account', 'subject' => SUJET_CONFIDENTIEL, 'body' => 'Bonjour, la quittance est absente.', ...$corps,
        ])->assertCreated()->json('data.id');
    };
    $this->support = function (string $id, array $corps, string $methode = 'post', string $suite = '/messages') {
        auth()->forgetGuards();

        $url = "/api/v1/console/support/tickets/{$id}{$suite}";

        return $methode === 'post' ? $this->withToken($this->jeton)->post($url, avecPreuve($this->jeton, $corps), ['Accept' => 'application/json']) : $this->withToken($this->jeton)->json($methode, $url, avecPreuve($this->jeton, $corps));
    };
    $this->demandeurRepond = function (string $id, string $corps) {
        auth()->forgetGuards();

        return $this->actingAs($this->demandeur)->postJson("/api/v1/support/tickets/{$id}/messages", ['body' => $corps]);
    };
    $this->pdf = fn (string $nom = 'piece.pdf', string $suffixe = '') => UploadedFile::fake()->createWithContent($nom, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF{$suffixe}");
    $this->ticket = fn (string $id): SupportTicket => SupportTicket::query()->findOrFail($id);
});

it('mesure les 7 jours depuis le passage à waiting, pas depuis le dernier message', function (): void {
    $id = ($this->ouvrir)();
    $this->travelTo(now()->addDays(8));
    ($this->support)($id, ['status' => 'waiting'], 'patch', '')->assertOk()->assertJsonPath('data.status', 'waiting');

    $this->artisan('messaging:resolve-stale-tickets')->expectsOutputToContain('0 demande(s) résolue(s).')->assertSuccessful();
    expect(($this->ticket)($id)->status)->toBe(TicketStatus::Waiting);

    $this->travelTo(now()->addDays(6));
    $this->artisan('messaging:resolve-stale-tickets')->assertSuccessful();
    expect(($this->ticket)($id)->status)->toBe(TicketStatus::Waiting);

    $this->travelTo(now()->addDays(1)->addMinute());
    $this->artisan('messaging:resolve-stale-tickets')->expectsOutputToContain('1 demande(s) résolue(s).')->assertSuccessful();
    expect(($this->ticket)($id)->status)->toBe(TicketStatus::Resolved);
});

it('pose waiting_since au passage à waiting, le garde aux relances et l\'efface au retour du demandeur', function (): void {
    $id = ($this->ouvrir)();
    expect(($this->ticket)($id)->waiting_since)->toBeNull();

    ($this->support)($id, ['body' => 'Pouvez-vous confirmer ?'])->assertOk();
    $depuis = ($this->ticket)($id)->waiting_since?->toIso8601String();
    expect($depuis)->toBe(now()->toIso8601String());

    $this->travelTo(now()->addDays(2));
    ($this->support)($id, ['body' => 'Relance'])->assertOk();
    expect(($this->ticket)($id)->waiting_since?->toIso8601String())->toBe($depuis);

    ($this->demandeurRepond)($id, 'Voici.')->assertOk();
    expect(($this->ticket)($id)->waiting_since)->toBeNull();

    ($this->support)($id, ['body' => 'Merci'])->assertOk();
    ($this->support)($id, ['status' => 'resolved'], 'patch', '')->assertOk();
    expect(($this->ticket)($id)->waiting_since)->toBeNull();
});

it('refuse de rejouer un client_id avec une autre visibilité ou d\'autres pièces', function (): void {
    $id = ($this->ouvrir)();
    $cle = M::cle();
    ($this->support)($id, ['body' => 'Réponse', 'client_id' => $cle, 'attachments' => [($this->pdf)()]])->assertOk();

    ($this->support)($id, ['body' => 'Réponse', 'client_id' => $cle, 'attachments' => [($this->pdf)()]])->assertOk();
    ($this->support)($id, ['body' => 'Réponse', 'client_id' => $cle, 'attachments' => [($this->pdf)()], 'internal' => true])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    ($this->support)($id, ['body' => 'Réponse', 'client_id' => $cle])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    ($this->support)($id, ['body' => 'Réponse', 'client_id' => $cle, 'attachments' => [($this->pdf)('autre.pdf')]])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    ($this->support)($id, ['body' => 'Réponse', 'client_id' => $cle, 'attachments' => [($this->pdf)(), ($this->pdf)()]])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');

    expect(SupportTicketMessage::query()->where('support_ticket_id', $id)->count())->toBe(2)->and(SupportAttachment::query()->count())->toBe(1);
});

it('refuse de rejouer l\'ouverture d\'une demande avec d\'autres pièces ou une autre organisation', function (): void {
    $cle = M::cle();
    $titulaire = User::factory()->create();
    $creer = fn (string $nom) => app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Agency, $nom, 'FR'), 'A', 'B');
    $premiere = $creer('Agence Une');
    $seconde = $creer('Agence Deux');
    $ouvrir = function (string $organisation, array $surcharges = []) use ($titulaire, $cle) {
        auth()->forgetGuards();

        return $this->actingAs($titulaire)->post('/api/v1/support/tickets', [
            'space' => 'organization', 'organization_id' => $organisation, 'category' => 'billing', 'subject' => 'Facture', 'body' => 'Bonjour', 'client_id' => $cle, ...$surcharges,
        ], ['Accept' => 'application/json']);
    };

    $id = $ouvrir($premiere->id, ['attachments' => [($this->pdf)()]])->assertCreated()->json('data.id');
    $ouvrir($premiere->id, ['attachments' => [($this->pdf)()]])->assertOk()->assertJsonPath('data.id', $id);
    $ouvrir($seconde->id, ['attachments' => [($this->pdf)()]])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    $ouvrir($premiere->id)->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');

    expect(SupportTicket::query()->count())->toBe(1)->and(SupportAttachment::query()->count())->toBe(1);
});

it('relit la demande sous verrou : une résolution concurrente n\'est ni ignorée ni écrasée', function (): void {
    $id = ($this->ouvrir)();
    $resolueA = now()->subHour();
    $resoudre = fn () => SupportTicket::query()->whereKey($id)->update(['status' => TicketStatus::Resolved, 'resolved_at' => $resolueA->format('Y-m-d H:i:s.u')]);

    $perimee = ($this->ticket)($id);
    $resoudre();
    $reouvre = app(UpdateSupportTicket::class)->handle($perimee, new TicketPatchData(TicketStatus::Open, null, false, null));
    expect(($this->ticket)($id)->status)->toBe(TicketStatus::Open)->and(($this->ticket)($id)->resolved_at)->toBeNull()->and($reouvre->status)->toBe(TicketStatus::Open);

    $perimee = ($this->ticket)($id);
    $resoudre();
    app(UpdateSupportTicket::class)->handle($perimee, new TicketPatchData(TicketStatus::Resolved, TicketPriority::High, false, null));
    expect(($this->ticket)($id)->resolved_at?->toIso8601String())->toBe($resolueA->toIso8601String())->and(($this->ticket)($id)->priority)->toBe(TicketPriority::High);
});

it('ne laisse pas une note interne toucher l\'activité ni la lecture du support servies au demandeur', function (): void {
    $id = ($this->ouvrir)();
    $avant = ($this->ticket)($id);
    $activite = $avant->last_activity_at->toIso8601String();

    $this->travelTo(now()->addHours(3));
    ($this->support)($id, ['body' => 'Note à usage interne', 'internal' => true])->assertOk();

    $apres = ($this->ticket)($id);
    expect($apres->last_activity_at->toIso8601String())->toBe($activite)->and($apres->support_last_read_at)->toBeNull()->and($apres->status)->toBe(TicketStatus::Open);
    auth()->forgetGuards();
    $this->actingAs($this->demandeur)->getJson("/api/v1/support/tickets/{$id}")->assertOk()
        ->assertJsonPath('data.updated_at', $activite)->assertJsonPath('data.support_last_read_at', null);
});

it('cache au demandeur la pièce d\'une note interne et la sert au support', function (): void {
    $id = ($this->ouvrir)();
    ($this->support)($id, ['body' => 'Note à usage interne', 'internal' => true, 'attachments' => [($this->pdf)('interne.pdf')]])->assertOk();
    $piece = SupportAttachment::query()->firstOrFail();

    auth()->forgetGuards();
    $this->actingAs($this->demandeur)->getJson("/api/v1/support/attachments/{$piece->id}")->assertNotFound()->assertJsonPath('code', 'attachment_not_found');
    auth()->forgetGuards();
    $this->withToken($this->jeton)->get("/api/v1/console/support/attachments/{$piece->id}")->assertOk();
});

it('ne journalise ni le sujet ni le nom de l\'organisation d\'une demande', function (): void {
    $id = ($this->ouvrir)();
    ($this->support)($id, ['priority' => 'high'], 'patch', '')->assertOk();

    $lignes = AuditLog::query()->where('subject_type', 'support_ticket')->where('subject_id', $id)->get();
    expect($lignes)->not->toBeEmpty()
        ->and(json_encode($lignes->pluck('changes')->all(), JSON_UNESCAPED_UNICODE))->not->toContain(SUJET_CONFIDENTIEL)->not->toContain('organization_name')->not->toContain('"subject"')
        ->and(json_encode($lignes->pluck('metadata')->all(), JSON_UNESCAPED_UNICODE))->not->toContain(SUJET_CONFIDENTIEL);
});

it('répond 503 dédié, jamais 500, quand les horaires du support sont illisibles', function (string $horaires, string $fuseau): void {
    config(['messaging.support.hours' => $horaires, 'messaging.support.timezone' => $fuseau]);

    auth()->forgetGuards();
    $this->actingAs($this->demandeur)->getJson('/api/v1/support/status')->assertStatus(503)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('code', 'support_hours_unavailable')->assertJsonPath('status', 503);
})->with([
    'horaires illisibles' => ['lundi matin', 'Europe/Paris'],
    'fuseau inconnu' => ['1-5 09:00-18:00', 'Mars/Olympus'],
]);

it('borne le fil servi aux 200 derniers messages, dans l\'ordre, avec has_more', function (): void {
    $id = ($this->ouvrir)();
    $demande = ($this->ticket)($id);
    $debut = now()->addMinute();

    foreach (range(1, 205) as $n) {
        $demande->messages()->create(['author_user_id' => $this->demandeur->id, 'from_support' => false, 'internal' => false, 'body' => "Message {$n}", 'sent_at' => $debut->copy()->addSeconds($n)]);
    }
    $demande->messages()->create(['author_user_id' => $this->operateur->id, 'from_support' => true, 'internal' => true, 'body' => 'Note interne', 'sent_at' => $debut->copy()->addSeconds(300)]);

    auth()->forgetGuards();
    $demandeur = $this->actingAs($this->demandeur)->getJson("/api/v1/support/tickets/{$id}")->assertOk();
    expect($demandeur->json('data.messages'))->toHaveCount(200)
        ->and($demandeur->json('data.messages.0.body'))->toBe('Message 6')
        ->and($demandeur->json('data.messages.199.body'))->toBe('Message 205')
        ->and($demandeur->json('data.has_more'))->toBeTrue()
        ->and($demandeur->json('data.message_count'))->toBe(206)
        ->and($demandeur->getContent())->not->toContain('Note interne');

    auth()->forgetGuards();
    $support = $this->withToken($this->jeton)->getJson("/api/v1/console/support/tickets/{$id}")->assertOk();
    expect($support->json('data.messages'))->toHaveCount(200)
        ->and($support->json('data.messages.199.body'))->toBe('Note interne')
        ->and($support->json('data.has_more'))->toBeTrue()
        ->and($support->json('data.message_count'))->toBe(207);
});

it('sert tout un petit fil sans has_more', function (): void {
    $id = ($this->ouvrir)();

    auth()->forgetGuards();
    $this->actingAs($this->demandeur)->getJson("/api/v1/support/tickets/{$id}")->assertOk()->assertJsonCount(1, 'data.messages')->assertJsonPath('data.has_more', false)->assertJsonPath('data.message_count', 1);
});

it('pagine la liste du demandeur par curseur sans changer la première page', function (): void {
    foreach (range(1, 3) as $n) {
        $this->travelTo(now()->addMinute());
        ($this->ouvrir)(['subject' => "Demande {$n}"]);
    }

    auth()->forgetGuards();
    $liste = $this->actingAs($this->demandeur)->getJson('/api/v1/support/tickets')->assertOk();
    expect($liste->json('data.*.subject'))->toBe(['Demande 3', 'Demande 2', 'Demande 1'])->and($liste->json('meta.next_cursor'))->toBeNull();

    auth()->forgetGuards();
    $page = $this->actingAs($this->demandeur)->getJson('/api/v1/support/tickets?per_page=2')->assertOk();
    expect($page->json('data.*.subject'))->toBe(['Demande 3', 'Demande 2'])->and($page->json('meta.next_cursor'))->toBeString();

    auth()->forgetGuards();
    $suite = $this->actingAs($this->demandeur)->getJson('/api/v1/support/tickets?per_page=2&cursor='.$page->json('meta.next_cursor'))->assertOk();
    expect($suite->json('data.*.subject'))->toBe(['Demande 1'])->and($suite->json('meta.next_cursor'))->toBeNull();

    auth()->forgetGuards();
    $this->actingAs($this->demandeur)->getJson('/api/v1/support/tickets?cursor=forge')->assertUnprocessable()->assertJsonValidationErrors('cursor');
});
