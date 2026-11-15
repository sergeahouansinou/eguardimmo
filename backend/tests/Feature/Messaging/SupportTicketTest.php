<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Shared\Audit\AuditLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    Notification::fake();
    Storage::fake('local');
    $this->operateur = User::factory()->create(['name' => 'Ops Support']);
    $this->operateur->operator()->create(['granted_at' => now()]);
    activerDeuxFacteurs($this->operateur);
    $this->jeton = $this->operateur->createToken('console', ['operator'])->plainTextToken;
});

function ouvrirDemande(mixed $test, User $user, array $surcharges = []): string
{
    return (string) $test->actingAs($user)->post('/api/v1/support/tickets', [
        'space' => 'tenant',
        'category' => 'account',
        'subject' => 'Je ne vois pas ma quittance',
        'body' => 'Bonjour, la quittance de mars est absente.',
        ...$surcharges,
    ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
}

it('refuse le support sans compte', function (): void {
    $this->getJson('/api/v1/support/tickets')->assertUnauthorized();
    $this->postJson('/api/v1/support/tickets', [])->assertUnauthorized();
    $this->getJson('/api/v1/console/support/tickets')->assertUnauthorized();
});

it('ouvre une demande avec pièce jointe, référencée et ouverte', function (): void {
    $user = User::factory()->create(['name' => 'Koffi Mensah']);
    $pdf = UploadedFile::fake()->createWithContent('quittance.pdf', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

    $reponse = $this->actingAs($user)->post('/api/v1/support/tickets', [
        'space' => 'tenant', 'category' => 'documents', 'subject' => 'Quittance', 'body' => 'Voir pièce jointe', 'attachments' => [$pdf],
        'status' => 'resolved', 'priority' => 'high',
    ], ['Accept' => 'application/json'])->assertCreated();

    $reponse->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.priority', 'normal')
        ->assertJsonPath('data.requester.name', 'Koffi Mensah')
        ->assertJsonPath('data.messages.0.attachments.0.name', 'quittance.pdf')
        ->assertJsonPath('data.messages.0.attachments.0.mime_type', 'application/pdf');
    expect($reponse->json('data.reference'))->toMatch('/^SUP-\d{4}-00001$/');

    $piece = $reponse->json('data.messages.0.attachments.0.id');
    $this->get("/api/v1/support/attachments/{$piece}")->assertOk()->assertHeader('Content-Type', 'application/pdf');
});

it('refuse une pièce jointe dont le contenu n\'est pas un PDF ou une image', function (): void {
    $faux = UploadedFile::fake()->createWithContent('facture.pdf', '<?php echo "x";');

    $this->actingAs(User::factory()->create())->post('/api/v1/support/tickets', [
        'space' => 'tenant', 'category' => 'documents', 'subject' => 'X', 'body' => 'Y', 'attachments' => [$faux],
    ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('attachments.0');
});

it('refuse de rattacher une demande à une organisation dont on n\'est pas membre', function (): void {
    $titulaire = User::factory()->create();
    $org = app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Individual, 'Mes biens', 'FR'), 'A', 'B');

    $this->actingAs(User::factory()->create())->postJson('/api/v1/support/tickets', [
        'space' => 'organization', 'organization_id' => $org->id, 'category' => 'billing', 'subject' => 'X', 'body' => 'Y',
    ])->assertUnprocessable()->assertJsonPath('code', 'organization_not_member');

    auth()->forgetGuards();
    $id = ouvrirDemande($this, $titulaire, ['space' => 'organization', 'organization_id' => $org->id]);
    expect(SupportTicket::query()->findOrFail($id)->organization_name)->toBe('Mes biens');
});

it('cache la demande d\'un autre compte et ses pièces jointes', function (): void {
    $auteur = User::factory()->create();
    $id = ouvrirDemande($this, $auteur);

    auth()->forgetGuards();
    $autre = User::factory()->create();
    $this->actingAs($autre)->getJson("/api/v1/support/tickets/{$id}")->assertNotFound()->assertJsonPath('code', 'ticket_not_found');
    $this->postJson("/api/v1/support/tickets/{$id}/messages", ['body' => 'intrus'])->assertNotFound();
    $this->getJson('/api/v1/support/tickets')->assertOk()->assertJsonCount(0, 'data');
});

it('réserve la console au jeton opérateur', function (): void {
    $simple = User::factory()->create();

    $this->actingAs($simple)->getJson('/api/v1/console/support/tickets')->assertForbidden();
    auth()->forgetGuards();
    $this->withToken($this->operateur->createToken('m', ['mobile'])->plainTextToken)->getJson('/api/v1/console/support/tickets')->assertForbidden();
});

it('traite une demande de bout en bout depuis la console', function (): void {
    $demandeur = User::factory()->create(['name' => 'Koffi Mensah']);
    $id = ouvrirDemande($this, $demandeur);
    auth()->forgetGuards();

    $this->withToken($this->jeton)->getJson('/api/v1/console/support/tickets?status=open&search=quittance')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('counts.open', 1)
        ->assertJsonPath('meta.total', 1);

    $this->withToken($this->jeton)->patchJson("/api/v1/console/support/tickets/{$id}", ['priority' => 'high', 'assignee_id' => $this->operateur->id])
        ->assertOk()->assertJsonPath('data.priority', 'high')->assertJsonPath('data.assignee.name', 'Ops Support');

    $this->withToken($this->jeton)->patchJson("/api/v1/console/support/tickets/{$id}", ['assignee_id' => $demandeur->id])
        ->assertUnprocessable()->assertJsonPath('code', 'assignee_not_operator');

    $this->withToken($this->jeton)->postJson("/api/v1/console/support/tickets/{$id}/messages", ['body' => 'Note interne', 'internal' => true])
        ->assertOk()->assertJsonPath('data.status', 'open')->assertJsonPath('data.first_response_at', null);

    $this->withToken($this->jeton)->postJson("/api/v1/console/support/tickets/{$id}/messages", ['body' => 'La quittance est en ligne.'])
        ->assertOk()->assertJsonPath('data.status', 'waiting')->assertJsonCount(3, 'data.messages');

    $this->withToken($this->jeton)->getJson('/api/v1/console/support/stats')
        ->assertOk()->assertJsonPath('data.waiting', 1)->assertJsonPath('data.first_response_minutes', 0);
    $this->withToken($this->jeton)->getJson('/api/v1/console/support/staff')->assertOk()->assertJsonFragment(['name' => 'Ops Support']);

    auth()->forgetGuards();
    $this->actingAs($demandeur)->getJson("/api/v1/support/tickets/{$id}")
        ->assertOk()
        ->assertJsonCount(2, 'data.messages')
        ->assertJsonMissing(['body' => 'Note interne']);

    $this->postJson("/api/v1/support/tickets/{$id}/messages", ['body' => 'Merci, réglé.'])->assertOk()->assertJsonPath('data.status', 'open');

    auth()->forgetGuards();
    $this->withToken($this->jeton)->patchJson("/api/v1/console/support/tickets/{$id}", ['status' => 'resolved'])->assertOk()->assertJsonPath('data.status', 'resolved');

    auth()->forgetGuards();
    $this->actingAs($demandeur)->postJson("/api/v1/support/tickets/{$id}/messages", ['body' => 'Encore'])->assertConflict()->assertJsonPath('code', 'ticket_resolved');
});

it('journalise l\'accès du support aux données du client', function (): void {
    $id = ouvrirDemande($this, User::factory()->create());
    auth()->forgetGuards();

    $this->withToken($this->jeton)->postJson("/api/v1/console/support/tickets/{$id}/access", ['reason' => 'court'])->assertUnprocessable();
    $this->withToken($this->jeton)->postJson("/api/v1/console/support/tickets/{$id}/access", ['reason' => 'Vérifier la quittance manquante de mars'])
        ->assertOk()->assertJsonPath('data.access.reason', 'Vérifier la quittance manquante de mars');

    expect(AuditLog::query()->where('action', 'messaging.support_access.granted')->where('subject_id', $id)->exists())->toBeTrue();
});

it('numérote les demandes en séquence continue', function (): void {
    $user = User::factory()->create();
    ouvrirDemande($this, $user);
    $deuxieme = ouvrirDemande($this, $user);

    expect(SupportTicket::query()->findOrFail($deuxieme)->reference)->toEndWith('-00002');
});
