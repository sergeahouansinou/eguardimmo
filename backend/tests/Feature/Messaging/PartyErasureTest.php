<?php

declare(strict_types=1);

use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Listeners\ErasePartyMessagesOnAnonymization;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Actions\AnonymizeParty;
use App\Modules\Parties\Models\Party;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
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

function filOuvertParLeLocataire(mixed $test): string
{
    $cree = T::comme($test, $test->moi['user'])->post('/api/v1/tenant/conversations', [
        'lease_id' => $test->moi['lease']->id,
        'subject' => 'Mon arrêt maladie et mes dettes',
        'body' => 'Mon IBAN est FR76 3000 6000 0112 3456 7890 189',
        'client_id' => M::cle(),
        'attachments' => [UploadedFile::fake()->image('passeport-awa.png')],
    ], ['Accept' => 'application/json'])->assertCreated();

    return (string) $cree->json('data.id');
}

function anonymiser(mixed $test): void
{
    L::dans($test->org, fn () => app(AnonymizeParty::class)->handle(Party::query()->findOrFail($test->moi['party']->id), 'requested'));
}

function audit(): string
{
    return (string) json_encode(DB::table('audit_logs')->get()->all(), JSON_UNESCAPED_UNICODE);
}

it('efface textes, pièces, sujet du fil ouvert par la contrepartie et motif de restriction, sans rien laisser dans le journal', function (): void {
    $id = filOuvertParLeLocataire($this);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:05:00'));
    M::repondre($this->org, $this->equipe, Conversation::query()->withoutGlobalScopes()->findOrFail($id), 'Bien reçu.');
    DB::table('conversations')->where('id', $id)->update(['counterpart_muted_until' => now()->addDays(3), 'counterpart_muted_reason' => 'Propos injurieux envers Mme Durand']);
    expect(DB::table('stored_files')->count())->toBe(1);

    anonymiser($this);

    $fil = DB::table('conversations')->where('id', $id)->first();
    expect($fil->subject)->toBe('[effacé]')
        ->and($fil->counterpart_muted_reason)->toBeNull()
        ->and(DB::table('conversation_messages')->where('conversation_id', $id)->where('author_side', 'tenant')->value('body'))->toBe('[effacé]')
        ->and(DB::table('conversation_messages')->where('conversation_id', $id)->where('author_side', 'staff')->value('body'))->toBe('Bien reçu.')
        ->and(ConversationAttachment::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(DB::table('stored_files')->count())->toBe(0);

    foreach (['IBAN', 'FR76', 'passeport', 'arrêt maladie', 'dettes', 'injurieux', 'Durand'] as $secret) {
        expect(audit())->not->toContain($secret);
    }
});

it('garde le sujet d\'un fil ouvert par l\'équipe', function (): void {
    $fil = M::filLocataire($this->org, $this->equipe, $this->moi, 'Quittance de novembre');
    anonymiser($this);

    expect(DB::table('conversations')->where('id', $fil->id)->value('subject'))->toBe('Quittance de novembre');
});

it('traite l\'effacement en file, avec reprises', function (): void {
    expect(ErasePartyMessagesOnAnonymization::class)->toImplement(ShouldQueue::class);
    $ecouteur = app(ErasePartyMessagesOnAnonymization::class);
    expect($ecouteur->tries)->toBeGreaterThan(1)->and($ecouteur->backoff())->not->toBeEmpty();
});

it('rattrape un effacement perdu avec la commande planifiée, sans rien refaire au second passage', function (): void {
    $id = filOuvertParLeLocataire($this);
    Queue::fake();

    anonymiser($this);

    Queue::assertPushed(CallQueuedListener::class, fn (CallQueuedListener $job): bool => $job->class === ErasePartyMessagesOnAnonymization::class);
    expect(DB::table('conversation_messages')->where('conversation_id', $id)->value('body'))->toContain('IBAN');

    Artisan::call('messaging:erase-anonymized-parties');

    expect(DB::table('conversation_messages')->where('conversation_id', $id)->value('body'))->toBe('[effacé]')
        ->and(DB::table('conversations')->where('id', $id)->value('subject'))->toBe('[effacé]')
        ->and(DB::table('stored_files')->count())->toBe(0);
    $journal = DB::table('audit_logs')->where('action', 'messaging.messages.erased')->count();

    Artisan::call('messaging:erase-anonymized-parties');

    expect(DB::table('audit_logs')->where('action', 'messaging.messages.erased')->count())->toBe($journal);
});

it('ne touche pas aux textes d\'une fiche qui n\'est pas anonymisée', function (): void {
    $id = filOuvertParLeLocataire($this);

    Artisan::call('messaging:erase-anonymized-parties');

    expect(DB::table('conversation_messages')->where('conversation_id', $id)->value('body'))->toContain('IBAN')
        ->and(DB::table('conversations')->where('id', $id)->value('subject'))->toBe('Mon arrêt maladie et mes dettes')
        ->and(ConversationMessage::query()->withoutGlobalScopes()->whereNotNull('redacted_at')->count())->toBe(0)
        ->and(MessageSide::Tenant->value)->toBe('tenant');
});
