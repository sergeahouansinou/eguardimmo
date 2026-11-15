<?php

declare(strict_types=1);

use App\Modules\Documents\Models\StoredFile;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\AuditLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Documents\DocumentsContext as D;

beforeEach(function (): void {
    Storage::fake('documents');
    $this->org = D::organisation();
    $this->titulaire = D::titulaire($this->org);
    $this->url = D::url($this->org, '/files');
});

it('protège le téléversement et le téléchargement : 401, 403 en écriture pour un comptable, 404 hors organisation', function (): void {
    $this->postJson($this->url, ['file' => D::pdf()])->assertUnauthorized();
    $this->getJson("{$this->url}/".fake()->uuid().'/download')->assertUnauthorized();

    $this->actingAs(D::titulaire(D::organisation()))->postJson($this->url, ['file' => D::pdf()])->assertNotFound();

    D::changerDeCompte($this, D::membre($this->org, MemberRole::Accountant));
    $this->postJson($this->url, ['file' => D::pdf()])->assertForbidden();
    $this->getJson("{$this->url}/".fake()->uuid().'/download')->assertNotFound()->assertJsonPath('code', 'file_not_found');
});

it('téléverse un PDF : nom régénéré, type détecté, taille et empreinte SHA-256 exactes, disque privé', function (): void {
    $this->actingAs($this->titulaire);

    $reponse = $this->postJson($this->url, ['file' => D::pdf('Mon bail.pdf'), 'category' => 'supporting'])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Mon bail.pdf')
        ->assertJsonPath('data.mime_type', 'application/pdf')
        ->assertJsonPath('data.size_bytes', strlen(D::PDF))
        ->assertJsonPath('data.sha256', hash('sha256', D::PDF))
        ->assertJsonPath('data.category', 'supporting');

    $fichier = D::dans($this->org, fn () => StoredFile::query()->findOrFail($reponse->json('data.id')));

    expect($fichier->disk)->toBe('documents')
        ->and($fichier->path)->toEndWith('.pdf')->not->toContain('bail')
        ->and($fichier->path)->toStartWith($this->org->id.'/')
        ->and(Storage::disk('documents')->get($fichier->path))->toBe(D::PDF)
        ->and(hash('sha256', (string) Storage::disk('documents')->get($fichier->path)))->toBe($fichier->sha256)
        ->and($fichier->uploaded_by_user_id)->toBe($this->titulaire->id)
        ->and(config('filesystems.disks.documents.serve'))->toBeFalse()
        ->and(config('filesystems.disks.documents.root'))->not->toStartWith(public_path());
});

it('autorise un gestionnaire en écriture et rattache le fichier à l\'organisation comme objet', function (): void {
    D::changerDeCompte($this, D::membre($this->org, MemberRole::Manager));

    $this->postJson($this->url, ['file' => D::pdf(), 'subject_type' => 'organization', 'subject_id' => $this->org->id, 'retention_until' => now()->addYears(5)->toDateString()])
        ->assertCreated()
        ->assertJsonPath('data.subject.type', 'organization')
        ->assertJsonPath('data.subject.id', $this->org->id);
});

it('refuse un objet inconnu, d\'une autre organisation ou d\'un type non autorisé', function (): void {
    $this->actingAs($this->titulaire);
    $autre = D::organisation();

    $this->postJson($this->url, ['file' => D::pdf(), 'subject_type' => 'organization', 'subject_id' => $autre->id])->assertNotFound()->assertJsonPath('code', 'subject_not_found');
    $this->postJson($this->url, ['file' => D::pdf(), 'subject_type' => 'lease', 'subject_id' => fake()->uuid()])->assertNotFound()->assertJsonPath('code', 'subject_not_found');
    $this->postJson($this->url, ['file' => D::pdf(), 'subject_type' => 'user', 'subject_id' => fake()->uuid()])->assertUnprocessable()->assertJsonValidationErrors('subject_type');
    $this->postJson($this->url, ['file' => D::pdf(), 'subject_type' => 'organization'])->assertUnprocessable()->assertJsonValidationErrors('subject_id');
});

it('refuse un faux PDF contenant du PHP, même précédé d\'un en-tête PDF', function (string $contenu): void {
    $this->actingAs($this->titulaire);

    $this->postJson($this->url, ['file' => D::pdf('facture.pdf', $contenu)])->assertUnprocessable()->assertJsonValidationErrors('file');

    expect(Storage::disk('documents')->allFiles())->toBe([])
        ->and(D::dans($this->org, fn () => StoredFile::query()->count()))->toBe(0);
})->with([
    'PHP pur nommé .pdf' => ["<?php system(\$_GET['c']); ?>"],
    'polyglotte PDF puis PHP' => ["%PDF-1.4\n<?php system(\$_GET['c']); ?>\n%%EOF"],
    'balise courte' => ["%PDF-1.4\n<?= `ls` ?>"],
]);

it('refuse un type hors liste blanche malgré une extension .pdf', function (): void {
    $this->actingAs($this->titulaire);

    $this->postJson($this->url, ['file' => D::pdf('rapport.pdf', "#!/bin/sh\necho bonjour\n")])->assertUnprocessable()->assertJsonValidationErrors('file');
    $this->postJson($this->url, ['file' => D::pdf('page.pdf', '<html><body>x</body></html>')])->assertUnprocessable();
    $this->postJson($this->url, ['file' => UploadedFile::fake()->create('a.zip', 1, 'application/zip')])->assertUnprocessable();
    $this->postJson($this->url, [])->assertUnprocessable()->assertJsonValidationErrors('file');
    $this->postJson($this->url, ['file' => D::pdf(), 'category' => 'issued'])->assertUnprocessable()->assertJsonValidationErrors('category');
});

it('refuse un fichier de plus de 10 Mo et accepte 10 Mo pile', function (): void {
    $this->actingAs($this->titulaire);

    $entete = "%PDF-1.4\n";
    $this->postJson($this->url, ['file' => D::pdf('gros.pdf', $entete.str_repeat(' ', 10 * 1024 * 1024 + 1))])->assertUnprocessable()->assertJsonValidationErrors('file');
    $this->postJson($this->url, ['file' => D::pdf('limite.pdf', $entete.str_repeat(' ', 10 * 1024 * 1024 - strlen($entete)))])->assertCreated();
});

it('accepte une image PNG', function (): void {
    $this->actingAs($this->titulaire);

    $this->postJson($this->url, ['file' => UploadedFile::fake()->image('photo.png', 20, 20)])->assertCreated()->assertJsonPath('data.mime_type', 'image/png');
});

it('télécharge en pièce jointe privée, sans sniffing ni cache, et journalise sans donnée personnelle', function (): void {
    $this->actingAs($this->titulaire);
    $id = $this->postJson($this->url, ['file' => D::pdf('Dupont Jean.pdf')])->json('data.id');

    $reponse = $this->get("{$this->url}/{$id}/download")->assertOk();

    expect($reponse->headers->get('Content-Disposition'))->toStartWith('attachment')->toContain('Dupont Jean.pdf')
        ->and($reponse->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')
        ->and($reponse->headers->get('Content-Type'))->toStartWith('application/pdf')
        ->and($reponse->streamedContent())->toBe(D::PDF);

    $journal = AuditLog::query()->where('action', 'documents.file.downloaded')->get();

    expect($journal)->toHaveCount(1)
        ->and($journal[0]->subject_id)->toBe($id)
        ->and($journal[0]->actor_user_id)->toBe($this->titulaire->id)
        ->and($journal[0]->organization_id)->toBe($this->org->id)
        ->and($journal[0]->metadata)->toBe(['category' => 'supporting', 'size_bytes' => strlen(D::PDF)])
        ->and(json_encode($journal[0]->metadata))->not->toContain('Dupont');
});

it('laisse tout membre, comptable compris, télécharger', function (): void {
    $this->actingAs($this->titulaire);
    $id = $this->postJson($this->url, ['file' => D::pdf()])->json('data.id');

    D::changerDeCompte($this, D::membre($this->org, MemberRole::Accountant));
    $this->get("{$this->url}/{$id}/download")->assertOk();
});

it('répond 404 pour le fichier d\'une autre organisation, sans rien journaliser', function (): void {
    $this->actingAs($this->titulaire);
    $id = $this->postJson($this->url, ['file' => D::pdf()])->json('data.id');

    $autre = D::organisation();
    D::changerDeCompte($this, D::titulaire($autre));
    $this->getJson(D::url($autre, "/files/{$id}/download"))->assertNotFound()->assertJsonPath('code', 'file_not_found');
    $this->getJson(D::url($this->org, "/files/{$id}/download"))->assertNotFound();

    expect(AuditLog::query()->where('action', 'documents.file.downloaded')->count())->toBe(0);
});

it('signale un contenu disparu du disque sans le journaliser comme téléchargé', function (): void {
    $this->actingAs($this->titulaire);
    $id = $this->postJson($this->url, ['file' => D::pdf()])->json('data.id');
    Storage::disk('documents')->delete(D::dans($this->org, fn () => StoredFile::query()->findOrFail($id))->path);

    $this->getJson("{$this->url}/{$id}/download")->assertStatus(500)->assertJsonPath('code', 'file_unavailable');

    expect(AuditLog::query()->where('action', 'documents.file.downloaded')->count())->toBe(0);
});
