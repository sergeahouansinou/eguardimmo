<?php

declare(strict_types=1);

use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    L::semer();
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00:00'));
    $this->org = T::organisation();
    $this->equipe = L::membre($this->org, MemberRole::Manager);
    $this->moi = T::locataire($this->org);
});

function filLocataireAvecPiece(mixed $test): string
{
    return (string) T::comme($test, $test->moi['user'])->post('/api/v1/tenant/conversations', [
        'lease_id' => $test->moi['lease']->id,
        'subject' => 'Mon dossier',
        'body' => 'Mon IBAN est FR76 3000 6000 0112 3456 7890 189',
        'client_id' => M::cle(),
        'attachments' => [UploadedFile::fake()->image('piece.png')],
    ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
}

function purger(): string
{
    Artisan::call('messaging:purge');

    return Artisan::output();
}

function corps(string $filId): array
{
    return DB::table('conversation_messages')->where('conversation_id', $filId)->orderBy('sent_at')->pluck('body')->all();
}

function contenuPurge(string $filId): bool
{
    return DB::table('conversations')->where('id', $filId)->value('content_purged_at') !== null;
}

it('n\'efface rien avant 5 ans après le dernier message', function (): void {
    $id = filLocataireAvecPiece($this);
    $this->travelTo(CarbonImmutable::parse('2031-11-18 10:00:00'));

    purger();

    expect(contenuPurge($id))->toBeFalse()
        ->and(corps($id))->toBe(['Mon IBAN est FR76 3000 6000 0112 3456 7890 189'])
        ->and(ConversationAttachment::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('attend 5 ans après la fin du bail quand elle est plus tardive que le dernier message', function (): void {
    $id = filLocataireAvecPiece($this);

    $this->travelTo(CarbonImmutable::parse('2031-11-20 10:00:00'));
    purger();
    expect(contenuPurge($id))->toBeFalse();

    $this->travelTo(CarbonImmutable::parse('2034-01-02 10:00:00'));
    purger();

    expect(contenuPurge($id))->toBeTrue();
});

it('ne purge jamais le fil d\'un bail sans fin', function (): void {
    $sansFin = T::locataire($this->org, ['ends_on' => null], [], User::factory()->create());
    $id = (string) T::comme($this, $sansFin['user'])->post('/api/v1/tenant/conversations', [
        'lease_id' => $sansFin['lease']->id, 'subject' => 'Bail en cours', 'body' => 'Bonjour', 'client_id' => M::cle(),
    ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

    $this->travelTo(CarbonImmutable::parse('2060-01-01 10:00:00'));
    purger();

    expect(contenuPurge($id))->toBeFalse()->and(corps($id))->toBe(['Bonjour']);
});

it('remplace les corps par [effacé], purge les pièces et garde le squelette du fil', function (): void {
    $id = filLocataireAvecPiece($this);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:05:00'));
    M::repondre($this->org, $this->equipe, Conversation::query()->withoutGlobalScopes()->findOrFail($id), 'Bien reçu, merci.');
    $avant = DB::table('conversation_messages')->where('conversation_id', $id)->orderBy('sent_at')->get(['id', 'author_user_id', 'author_side', 'sent_at'])->all();
    $fichier = DB::table('stored_files')->first();
    $this->travelTo(CarbonImmutable::parse('2034-01-02 10:00:00'));

    expect(purger())->toContain('1 fil(s) purgé(s)');

    $apres = DB::table('conversation_messages')->where('conversation_id', $id)->orderBy('sent_at')->get(['id', 'author_user_id', 'author_side', 'sent_at'])->all();
    $fil = DB::table('conversations')->where('id', $id)->first();

    expect(corps($id))->toBe(['[effacé]', '[effacé]'])
        ->and($apres)->toEqual($avant)
        ->and($fil->subject)->toBe('Mon dossier')
        ->and($fil->content_purged_at)->not->toBeNull()
        ->and(ConversationAttachment::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(Storage::disk('documents')->exists($fichier->path))->toBeFalse()
        ->and(DB::table('stored_files')->where('id', $fichier->id)->exists())->toBeFalse();

    $journal = DB::table('audit_logs')->where('action', 'messaging.conversation.content_purged')->get();
    expect($journal)->toHaveCount(1)
        ->and((string) json_encode($journal->all(), JSON_UNESCAPED_UNICODE))->not->toContain('FR76')->not->toContain('Bien reçu');
});

it('est rejouable : un fil déjà purgé n\'est pas retouché', function (): void {
    filLocataireAvecPiece($this);
    $this->travelTo(CarbonImmutable::parse('2034-01-02 10:00:00'));

    expect(purger())->toContain('1 fil(s) purgé(s)');
    $date = DB::table('conversations')->value('content_purged_at');
    $this->travelTo(CarbonImmutable::parse('2034-01-03 10:00:00'));

    expect(purger())->toContain('0 fil(s) purgé(s)')
        ->and(DB::table('conversations')->value('content_purged_at'))->toBe($date)
        ->and(DB::table('audit_logs')->where('action', 'messaging.conversation.content_purged')->count())->toBe(1);
});

it('purge un fil mandant 5 ans après son dernier message et celui d\'une autre organisation sous son propre contexte', function (): void {
    $proprietaire = O::proprietaire($this->org, 'prop@exemple.fr');
    $fil = M::filMandant($this->org, $this->equipe, $proprietaire['party']->id, 'Relevé', 'Votre relevé de gestion.');
    $ailleurs = T::organisation('Agence Ailleurs');
    $autre = O::proprietaire($ailleurs, 'autre@exemple.fr');
    $filAutre = M::filMandant($ailleurs, L::membre($ailleurs, MemberRole::Manager), $autre['party']->id, 'Relevé', 'Autre relevé.');

    $this->travelTo(CarbonImmutable::parse('2031-11-20 10:00:00'));
    expect(purger())->toContain('2 fil(s) purgé(s)')
        ->and(corps($fil->id))->toBe(['[effacé]'])
        ->and(corps($filAutre->id))->toBe(['[effacé]']);

    $organisations = DB::table('audit_logs')->where('action', 'messaging.conversation.content_purged')->pluck('organization_id')->sort()->values()->all();
    expect($organisations)->toBe(collect([$this->org->id, $ailleurs->id])->sort()->values()->all());
});

it('efface les pièces d\'une demande de support 1 an après sa résolution puis ses textes à 3 ans, sans toucher une demande ouverte ou rouverte', function (): void {
    $demandeur = User::factory()->create();
    $ouvrir = function (string $sujet) use ($demandeur): string {
        auth()->forgetGuards();

        return (string) $this->actingAs($demandeur)->postJson('/api/v1/support/tickets', [
            'space' => 'marketplace', 'category' => 'account', 'subject' => $sujet, 'body' => 'Voici mon IBAN FR76 3000.',
            'attachments' => [UploadedFile::fake()->createWithContent('justificatif.pdf', "%PDF-1.4\n% justificatif\n")],
        ])->assertCreated()->json('data.id');
    };
    $resolue = $ouvrir('Résolue');
    $ouverte = $ouvrir('Ouverte');
    $rouverte = $ouvrir('Rouverte');
    DB::table('support_tickets')->where('id', $resolue)->update(['status' => 'resolved', 'resolved_at' => now()]);
    DB::table('support_tickets')->where('id', $rouverte)->update(['status' => 'open', 'resolved_at' => null]);
    expect(SupportAttachment::query()->count())->toBe(3);

    $this->travelTo(CarbonImmutable::parse('2027-11-18 10:00:00'));
    purger();
    expect(SupportAttachment::query()->count())->toBe(3);

    $this->travelTo(CarbonImmutable::parse('2027-11-20 10:00:00'));
    expect(purger())->toContain('1 pièce(s) de support effacée(s)')
        ->and(SupportAttachment::query()->count())->toBe(2)
        ->and(SupportTicketMessage::query()->where('support_ticket_id', $resolue)->value('body'))->toContain('IBAN')
        ->and(Storage::disk('local')->allFiles())->toHaveCount(2);

    $this->travelTo(CarbonImmutable::parse('2029-11-20 10:00:00'));
    expect(purger())->toContain('1 demande(s) purgée(s)');

    $ticket = SupportTicket::query()->findOrFail($resolue);
    expect(SupportTicketMessage::query()->where('support_ticket_id', $resolue)->pluck('body')->all())->each->toBe('[effacé]')
        ->and($ticket->subject)->toBe('Résolue')
        ->and($ticket->content_purged_at)->not->toBeNull()
        ->and(SupportTicketMessage::query()->where('support_ticket_id', $ouverte)->value('body'))->toContain('IBAN')
        ->and(SupportTicketMessage::query()->where('support_ticket_id', $rouverte)->value('body'))->toContain('IBAN')
        ->and(SupportTicket::query()->count())->toBe(3);

    $journal = (string) json_encode(DB::table('audit_logs')->whereIn('action', ['messaging.ticket.content_purged', 'messaging.ticket.attachments_purged'])->get()->all(), JSON_UNESCAPED_UNICODE);
    expect($journal)->toContain('messaging.ticket.content_purged')->not->toContain('FR76');
});

it('purge sur le dernier message seul quand le bail du fil est introuvable', function (): void {
    $id = filLocataireAvecPiece($this);
    DB::table('conversations')->where('id', $id)->update(['lease_id' => '01a1f34a-279f-729e-b590-d7aa76a8d560']);

    $this->travelTo(CarbonImmutable::parse('2031-11-20 10:00:00'));
    purger();

    expect(contenuPurge($id))->toBeTrue();
});

it('saute le fil quand le bail ne peut pas être vérifié, sans le purger', function (): void {
    $id = filLocataireAvecPiece($this);
    Event::listen('eloquent.retrieved: '.Lease::class, fn () => throw ErrorCode::RetentionActive->problem());

    $this->travelTo(CarbonImmutable::parse('2040-01-01 10:00:00'));
    purger();

    expect(contenuPurge($id))->toBeFalse()->and(corps($id))->toBe(['Mon IBAN est FR76 3000 6000 0112 3456 7890 189']);
});
