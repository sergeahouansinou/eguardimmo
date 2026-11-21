<?php

declare(strict_types=1);

use App\Modules\Messaging\Actions\StartExternalConversation;
use App\Modules\Messaging\Data\NewExternalConversationData;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Sleep;
use Illuminate\Support\Str;
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

function ouvertureAvecPiece(mixed $test, array $surcharge = []): array
{
    return ['lease_id' => $test->moi['lease']->id, 'subject' => 'Sujet', 'body' => 'Bonjour', 'client_id' => M::cle(), ...$surcharge];
}

function semerPieces(mixed $test, string $filId, int $nombre, int $octets): void
{
    $message = M::repondre($test->org, $test->moi['user'], Conversation::query()->withoutGlobalScopes()->findOrFail($filId), 'Pièces', MessageSide::Tenant);
    L::dans($test->org, function () use ($message, $nombre, $octets): void {
        for ($i = 0; $i < $nombre; $i++) {
            ConversationAttachment::query()->create(['conversation_message_id' => $message->id, 'original_name' => "p{$i}.pdf", 'mime_type' => 'application/pdf', 'size_bytes' => $octets]);
        }
    });
}

it('garantit un seul fil par ouverture rejouée : clé unique (auteur, client_id)', function (): void {
    $cle = M::cle();
    $fil = fn (string $client): array => [
        'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'subject' => 'S', 'created_by_user_id' => $this->equipe->id,
        'last_message_at' => now(), 'last_author_user_id' => $this->equipe->id, 'client_id' => $client, 'created_at' => now(), 'updated_at' => now(),
    ];
    DB::table('conversations')->insert($fil($cle));

    expect(fn () => DB::table('conversations')->insert($fil($cle)))->toThrow(UniqueConstraintViolationException::class);
    DB::table('conversations')->insert($fil(M::cle()));
    DB::table('conversations')->insert([...$fil(M::cle()), 'client_id' => null]);
    DB::table('conversations')->insert([...$fil(M::cle()), 'client_id' => null]);

    expect(DB::table('conversations')->count())->toBe(4);
});

it('rend le fil déjà créé par une ouverture parallèle du même client_id', function (): void {
    $donnees = new NewExternalConversationData(ConversationKind::Tenant, $this->moi['party']->id, $this->moi['lease']->id, null, 'Sujet', 'Bonjour', [], M::cle());
    $concurrent = false;

    DB::listen(function ($requete) use (&$concurrent, $donnees): void {
        if (! $concurrent && str_contains($requete->sql, 'conversation_messages')) {
            $concurrent = true;
            L::dans($this->org, fn () => app(StartExternalConversation::class)->handle($this->equipe, MessageSide::Staff, $donnees));
        }
    });

    $reponse = L::dans($this->org, fn () => app(StartExternalConversation::class)->handle($this->equipe, MessageSide::Staff, $donnees));

    expect($reponse->replayed)->toBeTrue()->and(Conversation::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('répond 409 conversation_busy, jamais une 500, quand l\'ouverture sur la même fiche est déjà en cours', function (): void {
    Sleep::fake(syncWithCarbon: true);
    $verrou = Cache::lock('messaging:open:'.$this->moi['party']->id, 30);
    expect($verrou->get())->toBeTrue();

    T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', ouvertureAvecPiece($this))->assertStatus(409)->assertJsonPath('code', 'conversation_busy');
    expect(Conversation::query()->withoutGlobalScopes()->count())->toBe(0);

    $verrou->release();
    T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', ouvertureAvecPiece($this))->assertCreated();
});

it('plafonne à 10 fils ouverts par fiche, y compris sous verrou', function (): void {
    for ($i = 0; $i < 10; $i++) {
        M::filLocataire($this->org, $this->equipe, $this->moi, "Sujet {$i}");
    }

    T::comme($this, $this->moi['user'])->postJson('/api/v1/tenant/conversations', ouvertureAvecPiece($this))->assertStatus(409)->assertJsonPath('code', 'conversation_open_limit');
});

it('refuse au-delà de 30 pièces par jour et par compte avec 429 conversation_attachment_limit', function (): void {
    $fil = M::filLocataire($this->org, $this->equipe, $this->moi);
    semerPieces($this, $fil->id, 29, 1000);
    $url = "/api/v1/tenant/conversations/{$fil->id}/messages";
    $piece = fn () => UploadedFile::fake()->image('a.png', 10, 10);

    T::comme($this, $this->moi['user'])->post($url, ['body' => 'Deux pièces', 'client_id' => M::cle(), 'attachments' => [$piece(), $piece()]], ['Accept' => 'application/json'])
        ->assertStatus(429)->assertJsonPath('code', 'conversation_attachment_limit');
    T::comme($this, $this->moi['user'])->post($url, ['body' => 'Une pièce', 'client_id' => M::cle(), 'attachments' => [$piece()]], ['Accept' => 'application/json'])->assertCreated();
    T::comme($this, $this->moi['user'])->post($url, ['body' => 'Encore', 'client_id' => M::cle(), 'attachments' => [$piece()]], ['Accept' => 'application/json'])->assertStatus(429);

    $this->travelTo(CarbonImmutable::parse('2026-11-20 10:00:01'));
    T::comme($this, $this->moi['user'])->post($url, ['body' => 'Le lendemain', 'client_id' => M::cle(), 'attachments' => [$piece()]], ['Accept' => 'application/json'])->assertCreated();
});

it('sérialise le plafond de pièces par compte : verrou occupé, 409 conversation_busy', function (): void {
    Sleep::fake(syncWithCarbon: true);
    $fil = M::filLocataire($this->org, $this->equipe, $this->moi);
    $url = "/api/v1/tenant/conversations/{$fil->id}/messages";
    $verrou = Cache::lock('messaging:pieces:'.$this->moi['user']->id, 30);
    expect($verrou->get())->toBeTrue();

    T::comme($this, $this->moi['user'])->post($url, ['body' => 'Avec pièce', 'client_id' => M::cle(), 'attachments' => [UploadedFile::fake()->image('a.png', 10, 10)]], ['Accept' => 'application/json'])
        ->assertStatus(409)->assertJsonPath('code', 'conversation_busy');
    T::comme($this, $this->moi['user'])->postJson($url, ['body' => 'Sans pièce', 'client_id' => M::cle()])->assertCreated();
    T::comme($this, $this->moi['user'])->post('/api/v1/tenant/conversations', [...ouvertureAvecPiece($this), 'attachments' => [UploadedFile::fake()->image('a.png', 10, 10)]], ['Accept' => 'application/json'])
        ->assertStatus(409)->assertJsonPath('code', 'conversation_busy');

    $verrou->release();
    T::comme($this, $this->moi['user'])->post($url, ['body' => 'Avec pièce', 'client_id' => M::cle(), 'attachments' => [UploadedFile::fake()->image('a.png', 10, 10)]], ['Accept' => 'application/json'])->assertCreated();
});

it('refuse une pièce qui dépasse 200 Mo par fil avec 409 conversation_storage_full', function (): void {
    $fil = M::filLocataire($this->org, $this->equipe, $this->moi);
    semerPieces($this, $fil->id, 1, 200 * 1024 * 1024 - 10);
    $url = "/api/v1/tenant/conversations/{$fil->id}/messages";

    T::comme($this, $this->moi['user'])->postJson($url, ['body' => 'Sans pièce', 'client_id' => M::cle()])->assertCreated();
    T::comme($this, $this->moi['user'])->post($url, ['body' => 'Plein', 'client_id' => M::cle(), 'attachments' => [UploadedFile::fake()->image('a.png', 40, 40)]], ['Accept' => 'application/json'])
        ->assertStatus(409)->assertJsonPath('code', 'conversation_storage_full');
});
