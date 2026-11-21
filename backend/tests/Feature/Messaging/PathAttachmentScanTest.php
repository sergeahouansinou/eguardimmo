<?php

declare(strict_types=1);

use App\Modules\Documents\Support\FakeScanner;
use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    Notification::fake();
    Storage::fake('local');
    config(['documents.malware.scanner' => 'fake', 'documents.malware.fake_unavailable' => false]);
    $this->demandeur = User::factory()->create();
    $this->operateur = User::factory()->create();
    $this->operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($this->operateur);
    $this->jeton = $this->operateur->createToken('console', ['operator'])->plainTextToken;
});

function pdfDePiece(string $contenu = ''): UploadedFile
{
    return UploadedFile::fake()->createWithContent('piece.pdf', "%PDF-1.4\n{$contenu}\n%%EOF");
}

function pieceDuSupport(mixed $test, string $contenu = ''): SupportAttachment
{
    $test->actingAs($test->demandeur)->post('/api/v1/support/tickets', [
        'space' => 'marketplace', 'category' => 'documents', 'subject' => 'Quittance', 'body' => 'Voir pièce', 'attachments' => [pdfDePiece($contenu)],
    ], ['Accept' => 'application/json'])->assertCreated();
    auth()->forgetGuards();

    return SupportAttachment::query()->firstOrFail();
}

function pieceDeFilAncienne(mixed $test, string $contenu = ''): array
{
    $titulaire = User::factory()->create();
    activerDeuxFacteurs($titulaire);
    $org = app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Agency, 'Agence du Port', 'FR'), 'Awa', 'Diallo');
    $collegue = User::factory()->create();
    app(CurrentOrganization::class)->run($org->id, fn () => OrganizationMember::query()->create([
        'user_id' => $collegue->id, 'email' => mb_strtolower($collegue->email), 'first_name' => 'Marc', 'last_name' => 'Chevalier',
        'role' => MemberRole::Manager, 'status' => MemberStatus::Active, 'joined_at' => now(),
    ]));
    $base = "/api/v1/org/{$org->id}/conversations";

    $test->actingAs($titulaire)->post($base, [
        'recipient_id' => $collegue->id, 'subject' => 'Plan', 'body' => 'Voir pièce', 'attachments' => [pdfDePiece($contenu)],
    ], ['Accept' => 'application/json'])->assertCreated();

    $piece = ConversationAttachment::query()->withoutGlobalScopes()->firstOrFail();
    $chemin = 'conversation-attachments/'.$piece->id.'.pdf';
    Storage::disk('local')->put($chemin, "%PDF-1.4\n{$contenu}\n%%EOF");
    $piece->forceFill(['stored_file_id' => null, 'path' => $chemin])->save();
    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);

    return [$collegue, $org->id, $piece->id];
}

it('sert une pièce du support saine après analyse et conserve le verdict', function (): void {
    $piece = pieceDuSupport($this);
    expect($piece->scan_status->value)->toBe('pending');

    $this->actingAs($this->demandeur)->get("/api/v1/support/attachments/{$piece->id}")->assertOk();

    expect($piece->fresh()->scan_status->value)->toBe('clean')->and($piece->fresh()->scanned_at)->not->toBeNull();
});

it('refuse une pièce du support infectée (410), la met en quarantaine et ne la sert à personne', function (): void {
    $piece = pieceDuSupport($this, FakeScanner::EICAR);

    $this->actingAs($this->demandeur)->get("/api/v1/support/attachments/{$piece->id}")->assertStatus(410)->assertJsonPath('code', 'attachment_infected');
    expect($piece->fresh()->scan_status->value)->toBe('infected')->and(Storage::disk('local')->exists($piece->path))->toBeFalse();

    auth()->forgetGuards();
    $this->withToken($this->jeton)->get("/api/v1/console/support/attachments/{$piece->id}")->assertNotFound();
});

it('bloque une pièce du support tant que l\'analyseur est injoignable (409), puis la sert au retour', function (): void {
    $piece = pieceDuSupport($this);
    config(['documents.malware.fake_unavailable' => true]);

    $this->actingAs($this->demandeur)->get("/api/v1/support/attachments/{$piece->id}")->assertStatus(409)->assertJsonPath('code', 'attachment_not_ready');
    expect($piece->fresh()->scan_status->value)->toBe('unverifiable');

    config(['documents.malware.fake_unavailable' => false]);
    auth()->forgetGuards();
    $this->withToken($this->jeton)->get("/api/v1/console/support/attachments/{$piece->id}")->assertOk();
    expect($piece->fresh()->scan_status->value)->toBe('clean');
});

it('ne sert pas une pièce du support déjà infectée même si le fichier est encore là', function (): void {
    $piece = pieceDuSupport($this);
    $piece->forceFill(['scan_status' => 'infected'])->save();

    $this->actingAs($this->demandeur)->get("/api/v1/support/attachments/{$piece->id}")->assertStatus(410);
});

it('analyse aussi la pièce d\'un fil ancien (path) : infectée 410, injoignable 409, saine 200', function (): void {
    [$collegue, $org, $piece] = pieceDeFilAncienne($this);
    $url = "/api/v1/org/{$org}/conversation-attachments/{$piece}";

    config(['documents.malware.fake_unavailable' => true]);
    $this->actingAs($collegue)->get($url)->assertStatus(409)->assertJsonPath('code', 'attachment_not_ready');

    config(['documents.malware.fake_unavailable' => false]);
    auth()->forgetGuards();
    $this->actingAs($collegue)->get($url)->assertOk();
    expect(ConversationAttachment::query()->withoutGlobalScopes()->find($piece)->scan_status->value)->toBe('clean');
});

it('refuse la pièce infectée d\'un fil ancien', function (): void {
    [$collegue, $org, $piece] = pieceDeFilAncienne($this, FakeScanner::EICAR);

    $this->actingAs($collegue)->get("/api/v1/org/{$org}/conversation-attachments/{$piece}")->assertStatus(410)->assertJsonPath('code', 'attachment_infected');
});

it('ne bloque pas les pièces à path quand aucun analyseur n\'est actif', function (): void {
    config(['documents.malware.scanner' => 'none']);
    $piece = pieceDuSupport($this, FakeScanner::EICAR);

    $this->actingAs($this->demandeur)->get("/api/v1/support/attachments/{$piece->id}")->assertOk();
    expect($piece->fresh()->scan_status->value)->toBe('pending');
});
