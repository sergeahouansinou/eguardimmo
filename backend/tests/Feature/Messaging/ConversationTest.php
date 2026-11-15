<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    Storage::fake('local');
    $this->titulaire = User::factory()->create(['name' => 'Awa Diallo']);
    activerDeuxFacteurs($this->titulaire);
    $this->org = app(CreateOrganization::class)->handle($this->titulaire, new NewOrganizationData(OrganizationKind::Agency, 'Agence du Port', 'FR'), 'Awa', 'Diallo');
    $this->collegue = User::factory()->create(['name' => 'Marc Chevalier']);
    equipier($this->org, $this->collegue, 'Marc', 'Chevalier');
});

function equipier(Organization $org, User $compte, string $prenom, string $nom): void
{
    app(CurrentOrganization::class)->run($org->id, fn () => OrganizationMember::query()->create([
        'user_id' => $compte->id, 'email' => mb_strtolower($compte->email), 'first_name' => $prenom, 'last_name' => $nom,
        'role' => MemberRole::Manager, 'status' => MemberStatus::Active, 'joined_at' => now(),
    ]));
}

function changerDeCompte(mixed $test, User $user): mixed
{
    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);

    return $test->actingAs($user);
}

it('protège les conversations : 401, 404 hors organisation', function (): void {
    $this->getJson("/api/v1/org/{$this->org->id}/conversations")->assertUnauthorized();

    $etranger = User::factory()->create();
    app(CreateOrganization::class)->handle($etranger, new NewOrganizationData(OrganizationKind::Individual, 'Autre', 'FR'), 'E', 'T');
    $this->actingAs($etranger)->getJson("/api/v1/org/{$this->org->id}/conversations")->assertNotFound();
});

it('écrit à un collègue, qui lit, répond et archive', function (): void {
    $base = "/api/v1/org/{$this->org->id}/conversations";

    $this->actingAs($this->titulaire)->getJson("{$base}/recipients")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Marc Chevalier');

    $photo = UploadedFile::fake()->image('fuite.png');
    $id = $this->post($base, [
        'recipient_id' => $this->collegue->id, 'subject' => 'Fuite au 3e', 'body' => 'Peux-tu passer ?', 'attachments' => [$photo],
    ], ['Accept' => 'application/json'])->assertCreated()
        ->assertJsonPath('data.counterpart.name', 'Marc Chevalier')
        ->assertJsonPath('data.messages.0.attachments.0.mime_type', 'image/png')
        ->json('data.id');

    $this->getJson("{$base}?tab=sent")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('counts.sent', 1)->assertJsonPath('counts.unread', 0);

    changerDeCompte($this, $this->collegue);
    $this->getJson("{$base}?tab=unread")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.unread', true);
    $this->getJson("{$base}/stats")->assertOk()->assertJsonPath('data.unread', 1);
    $this->getJson("{$base}/{$id}")->assertOk()->assertJsonPath('data.unread', false)->assertJsonCount(1, 'data.messages');
    $this->getJson("{$base}?tab=unread")->assertJsonCount(0, 'data');

    $piece = $this->getJson("{$base}/{$id}")->json('data.messages.0.attachments.0.id');
    $this->get("/api/v1/org/{$this->org->id}/conversation-attachments/{$piece}")->assertOk();

    $this->postJson("{$base}/{$id}/messages", ['body' => 'J\'y vais à 14 h.'])->assertOk()->assertJsonCount(2, 'data.messages');
    $this->patchJson("{$base}/{$id}", ['archived' => true])->assertOk()->assertJsonPath('data.archived', true);
    $this->getJson("{$base}?tab=archived")->assertJsonCount(1, 'data');

    changerDeCompte($this, $this->titulaire);
    $this->getJson("{$base}?tab=unread&search=fuite")->assertJsonCount(1, 'data')->assertJsonPath('data.0.preview', 'J\'y vais à 14 h.');
    $this->patchJson("{$base}/{$id}", ['read' => true])->assertOk()->assertJsonPath('data.unread', false);
});

it('refuse un destinataire hors équipe ou soi-même', function (): void {
    $base = "/api/v1/org/{$this->org->id}/conversations";

    $this->actingAs($this->titulaire)->postJson($base, ['recipient_id' => User::factory()->create()->id, 'subject' => 'X', 'body' => 'Y'])
        ->assertUnprocessable()->assertJsonPath('code', 'recipient_not_found');
    $this->postJson($base, ['recipient_id' => $this->titulaire->id, 'subject' => 'X', 'body' => 'Y'])
        ->assertUnprocessable()->assertJsonPath('code', 'recipient_not_found');
});

it('cache une conversation à un membre qui n\'y participe pas', function (): void {
    $base = "/api/v1/org/{$this->org->id}/conversations";
    $id = $this->actingAs($this->titulaire)->postJson($base, ['recipient_id' => $this->collegue->id, 'subject' => 'Privé', 'body' => 'Entre nous'])->json('data.id');

    $tiers = User::factory()->create();
    equipier($this->org, $tiers, 'Tiers', 'Membre');
    changerDeCompte($this, $tiers);

    $this->getJson("{$base}/{$id}")->assertNotFound()->assertJsonPath('code', 'conversation_not_found');
    $this->postJson("{$base}/{$id}/messages", ['body' => 'intrus'])->assertNotFound();
    $this->getJson($base)->assertJsonCount(0, 'data');
});
