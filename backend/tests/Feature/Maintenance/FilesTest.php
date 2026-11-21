<?php

declare(strict_types=1);

use App\Modules\Maintenance\Models\InterventionFile;
use Illuminate\Http\UploadedFile;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
    $this->id = C::enDevis($this, $this->scene);
    $this->url = C::url($this->scene['org'], "/interventions/{$this->id}/files");
});

it('vérifie le type sur le contenu, jamais sur l\'extension ni sur le type déclaré', function (): void {
    $faux = UploadedFile::fake()->createWithContent('facture.pdf', "MZ\x90\x00 exécutable");
    $this->post($this->url, ['file' => $faux, 'kind' => 'invoice'], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('code', 'intervention_file_invalid');

    $image = C::photo();
    $this->post($this->url, ['file' => $image, 'kind' => 'quote'], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('code', 'intervention_file_invalid');

    $this->post($this->url, ['file' => C::pdf('devis.pdf'), 'kind' => 'quote'], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.kind', 'quote');
});

it('refuse un fichier trop lourd et un type de pièce inconnu', function (): void {
    $this->post($this->url, ['file' => UploadedFile::fake()->create('lourd.pdf', 11000, 'application/pdf'), 'kind' => 'quote'], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
    $this->post($this->url, ['file' => C::pdf(), 'kind' => 'inconnu'], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
});

it('une pièce comptable n\'est jamais visible du locataire, même demandée explicitement', function (): void {
    foreach (['quote', 'invoice', 'proof'] as $genre) {
        $reponse = $this->post($this->url, ['file' => C::pdf(), 'kind' => $genre, 'visible_to_tenant' => true], ['Accept' => 'application/json'])->assertCreated();
        expect(InterventionFile::query()->withoutGlobalScopes()->findOrFail($reponse->json('data.id'))->visible_to_tenant)->toBeFalse();
    }
});

it('partage une pièce avec le mandant, sans jamais la rendre visible du locataire', function (): void {
    $fichier = (string) $this->post($this->url, ['file' => C::pdf(), 'kind' => 'report'], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

    $this->patchJson("{$this->url}/{$fichier}", ['visible_to_owner' => true])->assertOk()->assertJsonPath('data.visible_to_owner', true);
    $this->patchJson("{$this->url}/{$fichier}", ['visible_to_owner' => true, 'visible_to_tenant' => true])->assertOk();
    expect(InterventionFile::query()->withoutGlobalScopes()->findOrFail($fichier)->visible_to_tenant)->toBeFalse();
});

it('sert les fichiers sans cache et sans détection de type par le navigateur', function (): void {
    $fichier = (string) $this->post($this->url, ['file' => C::pdf(), 'kind' => 'quote'], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

    $reponse = $this->get("{$this->url}/{$fichier}")->assertOk();
    expect($reponse->headers->get('Cache-Control'))->toContain('private')->toContain('no-store')
        ->and($reponse->headers->get('X-Content-Type-Options'))->toBe('nosniff');
});

it('le locataire reçoit aussi des réponses sans cache', function (): void {
    C::signaler($this, $this->scene)->assertCreated();

    expect($this->getJson(C::BASE.'/tenant/interventions')->assertOk()->headers->get('Cache-Control'))->toContain('no-store');
});

it('plafonne le nombre de pièces par intervention', function (): void {
    config(['maintenance.files_per_intervention' => 2]);
    $this->post($this->url, ['file' => C::pdf(), 'kind' => 'report'], ['Accept' => 'application/json'])->assertCreated();
    $this->post($this->url, ['file' => C::pdf(), 'kind' => 'report'], ['Accept' => 'application/json'])->assertCreated();
    $this->post($this->url, ['file' => C::pdf(), 'kind' => 'report'], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('code', 'intervention_files_limit');
});

it('limite le débit des dépôts de pièces par l\'équipe', function (): void {
    config(['maintenance.files_per_intervention' => 100]);

    for ($i = 0; $i < 30; $i++) {
        $this->post($this->url, ['file' => C::pdf(), 'kind' => 'report'], ['Accept' => 'application/json'])->assertCreated();
    }

    $this->post($this->url, ['file' => C::pdf(), 'kind' => 'report'], ['Accept' => 'application/json'])->assertStatus(429);
});
