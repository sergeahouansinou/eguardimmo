<?php

declare(strict_types=1);

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseDocument;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantWriteContext as W;

beforeEach(function (): void {
    $this->w = W::monde($this);
    $this->org = $this->w['org'];
    $this->moi = $this->w['moi'];
    $this->base = "/api/v1/tenant/leases/{$this->moi['lease']->id}/documents";
    $this->partager = function (array $attributs = [], string $nom = 'diagnostic.pdf', $org = null, $lease = null): LeaseDocument {
        $org ??= $this->org;
        $fichier = W::fichier($org, $nom);

        return L::dans($org, fn (): LeaseDocument => LeaseDocument::factory()->create([
            'lease_id' => ($lease ?? $this->moi['lease'])->id,
            'stored_file_id' => $fichier->id,
            'shared_by_user_id' => $this->w['owner']->id,
            ...$attributs,
        ]));
    };
});

it('liste les pièces partagées et télécharge le contenu exact, journalisé, en privé', function (): void {
    $piece = ($this->partager)([], 'Diagnostic électrique.pdf');

    $liste = $this->actingAs($this->moi['user'])->getJson($this->base)->assertOk();
    expect($liste->json('data'))->toHaveCount(1)
        ->and($liste->json('data.0'))->toMatchArray(['id' => $piece->id, 'kind' => 'diagnostic'])
        ->and($liste->json('data.0.file'))->toMatchArray(['name' => 'Diagnostic électrique.pdf', 'mime_type' => 'application/pdf']);

    $reponse = T::comme($this, $this->moi['user'])->get("{$this->base}/{$piece->id}/download")->assertOk();
    expect($reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')
        ->and($reponse->headers->get('Content-Disposition'))->toContain('attachment')
        ->and($reponse->streamedContent())->toBe(W::PDF)
        ->and(AuditLog::query()->where('action', 'documents.file.downloaded')->count())->toBe(1);
});

it('montre d\'office la pièce signée du bail, sans partage', function (): void {
    $signe = W::fichier($this->org, 'bail-signe.pdf');
    L::dans($this->org, fn () => Lease::query()->whereKey($this->moi['lease']->id)->update(['signed_file_id' => $signe->id]));

    $liste = $this->actingAs($this->moi['user'])->getJson($this->base)->assertOk();
    expect($liste->json('data.0'))->toMatchArray(['id' => $signe->id, 'kind' => 'signed_lease']);

    expect(T::comme($this, $this->moi['user'])->get("{$this->base}/{$signe->id}/download")->assertOk()->streamedContent())->toBe(W::PDF);
});

it('ne montre ni une pièce retirée, ni une pièce adressée à un colocataire, ni celle d\'un autre bail', function (): void {
    $coloc = T::colocataire($this->org, $this->moi['lease']);
    ($this->partager)(['revoked_at' => now()]);
    $adressee = ($this->partager)(['party_id' => $coloc->id]);
    $autreBail = T::locataire($this->org);
    $ailleurs = ($this->partager)([], 'autre.pdf', null, $autreBail['lease']);
    $miennes = ($this->partager)(['party_id' => $this->moi['party']->id]);

    $liste = $this->actingAs($this->moi['user'])->getJson($this->base)->assertOk();
    expect(collect($liste->json('data'))->pluck('id')->all())->toBe([$miennes->id]);

    foreach ([$adressee->id, $ailleurs->id] as $id) {
        T::comme($this, $this->moi['user'])->getJson("{$this->base}/{$id}/download")->assertNotFound()->assertJsonPath('code', 'lease_document_not_found');
    }
});

it('refuse sans session, sans profil locataire et avec un jeton opérateur', function (): void {
    $this->getJson($this->base)->assertUnauthorized();
    T::comme($this, User::factory()->create())->getJson($this->base)->assertForbidden()->assertJsonPath('code', 'space_forbidden');

    $operateur = $this->moi['user'];
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    T::comme($this, null);
    $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)->getJson($this->base)->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
});

it('répond 404 sur le bail d\'un autre locataire, d\'une autre organisation ou inconnu', function (): void {
    $voisin = T::locataire($this->org);
    $autre = T::locataire(T::organisation('Immo Loire'));

    foreach ([$voisin['lease']->id, $autre['lease']->id, (string) Str::uuid7()] as $id) {
        T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/leases/{$id}/documents")->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    }
});

it('reste lisible pendant la grâce et se ferme au douzième mois plus un jour', function (): void {
    $fini = T::locataire($this->org, ['starts_on' => '2024-01-01', 'ends_on' => '2025-11-17'], [], $this->moi['user']);
    $ferme = T::locataire($this->org, ['starts_on' => '2024-01-01', 'ends_on' => '2025-11-16'], [], $this->moi['user']);

    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/leases/{$fini['lease']->id}/documents")->assertOk();
    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/leases/{$ferme['lease']->id}/documents")->assertNotFound();
});

it('lit les pièces en un nombre de requêtes indépendant de leur nombre', function (): void {
    ($this->partager)();
    $peu = W::requetes(fn () => T::comme($this, $this->moi['user'])->getJson($this->base.'?per_page=100')->assertOk());

    foreach (range(1, 9) as $_) {
        ($this->partager)();
    }
    $beaucoup = W::requetes(fn () => T::comme($this, $this->moi['user'])->getJson($this->base.'?per_page=100')->assertOk());

    expect($beaucoup)->toBe($peu);
});

it('ne journalise aucun téléchargement quand le contenu est absent', function (): void {
    $piece = ($this->partager)();
    $fichier = DB::table('stored_files')->where('id', $piece->stored_file_id)->first();
    Storage::disk($fichier->disk)->delete($fichier->path);

    T::comme($this, $this->moi['user'])->getJson("{$this->base}/{$piece->id}/download")->assertStatus(500)->assertJsonPath('code', 'file_unavailable');

    expect(AuditLog::query()->where('action', 'documents.file.downloaded')->count())->toBe(0);
});

it('ne sérialise aucun identifiant de fiche ni de compte dans la liste', function (): void {
    $coloc = T::colocataire($this->org, $this->moi['lease']);
    $piece = ($this->partager)(['party_id' => $this->moi['party']->id]);

    $corps = (string) $this->actingAs($this->moi['user'])->getJson($this->base)->assertOk()->getContent();

    foreach ([$this->moi['party']->id, $coloc->id, $this->w['owner']->id, 'party_id', 'shared_by', 'stored_file_id'] as $interdit) {
        expect($corps)->not->toContain($interdit);
    }
    expect($corps)->toContain($piece->id);
});

it('laisse l\'équipe partager une pièce, la cibler, puis retirer le partage', function (): void {
    $fichier = W::fichierDuBail($this->org, $this->moi['lease']->id, 'avenant.pdf');
    $url = R::url($this->org, "/{$this->moi['lease']->id}/documents");

    $cree = R::changerDeCompte($this, $this->w['manager'])->postJson($url, ['stored_file_id' => $fichier->id, 'kind' => 'amendment'])
        ->assertCreated()->assertJsonPath('data.kind', 'amendment')->assertJsonPath('data.party_id', null);
    $id = $cree->json('data.id');

    R::changerDeCompte($this, $this->w['manager'])->getJson($url)->assertOk()->assertJsonPath('data.0.id', $id);
    T::comme($this, $this->moi['user'])->getJson($this->base)->assertOk()->assertJsonPath('data.0.id', $id);

    R::changerDeCompte($this, $this->w['manager'])->deleteJson("{$url}/{$id}")->assertOk()->assertJsonPath('data.revoked_at', fn ($v): bool => $v !== null);
    R::changerDeCompte($this, $this->w['manager'])->deleteJson("{$url}/{$id}")->assertOk();
    T::comme($this, $this->moi['user'])->getJson("{$this->base}/{$id}/download")->assertNotFound();
    T::comme($this, $this->moi['user'])->getJson($this->base)->assertOk()->assertJsonCount(0, 'data');
    expect(DB::table('stored_files')->where('id', $fichier->id)->exists())->toBeTrue()
        ->and(W::actions())->toContain('leases.document.shared')->toContain('leases.document.unshared');
});

it('refuse à l\'équipe un fichier étranger, une fiche non locataire, un bail non signé, et le comptable', function (): void {
    $url = R::url($this->org, "/{$this->moi['lease']->id}/documents");
    $etranger = W::fichier(T::organisation('Immo Loire'));
    $fichier = W::fichierDuBail($this->org, $this->moi['lease']->id);
    $garant = T::partie($this->org);
    $brouillon = L::bail($this->org);

    R::changerDeCompte($this, $this->w['owner']);
    $this->postJson($url, ['stored_file_id' => $etranger->id, 'kind' => 'other'])->assertUnprocessable()->assertJsonPath('code', 'lease_document_invalid');
    $this->postJson($url, ['stored_file_id' => $fichier->id, 'kind' => 'other', 'party_id' => $garant->id])->assertUnprocessable()->assertJsonPath('code', 'lease_document_invalid');
    $this->postJson(R::url($this->org, "/{$brouillon->id}/documents"), ['stored_file_id' => $fichier->id, 'kind' => 'other'])->assertConflict()->assertJsonPath('code', 'lease_not_signed');
    $this->postJson($url, ['stored_file_id' => $fichier->id, 'kind' => 'inconnu'])->assertUnprocessable();

    R::changerDeCompte($this, $this->w['accountant'])->getJson($url)->assertForbidden();
    R::changerDeCompte($this, $this->w['accountant'])->postJson($url, ['stored_file_id' => $fichier->id, 'kind' => 'other'])->assertForbidden();
    auth()->forgetGuards();
    $this->postJson($url, [])->assertUnauthorized();
});

it('cloisonne l\'équipe d\'une autre organisation sur le bail et la pièce', function (): void {
    $autre = T::organisation('Immo Loire');
    $piece = ($this->partager)();
    $url = R::url($this->org, "/{$this->moi['lease']->id}/documents");
    $titulaireAutre = L::titulaire($autre);

    R::changerDeCompte($this, $titulaireAutre)->getJson(R::url($autre, "/{$this->moi['lease']->id}/documents"))->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    R::changerDeCompte($this, $titulaireAutre)->getJson($url)->assertNotFound();
    R::changerDeCompte($this, $titulaireAutre)->deleteJson(R::url($autre, "/{$this->moi['lease']->id}/documents/{$piece->id}"))->assertNotFound();
});

it('refuse de partager un fichier qui n\'a pas été téléversé pour ce bail : sans objet, autre bail, espace locataire, messagerie, relevé bancaire', function (): void {
    $url = R::url($this->org, "/{$this->moi['lease']->id}/documents");
    $autreBail = (string) Str::uuid7();
    $interdits = [
        'sans objet' => W::fichier($this->org, 'libre.pdf'),
        'autre bail' => W::fichierDuBail($this->org, $autreBail),
        'espace locataire' => W::fichier($this->org, 'justificatif.pdf', W::PDF, DocumentSubject::tenantSpace($this->moi['lease']->id)),
        'messagerie' => W::fichier($this->org, 'message.pdf', W::PDF, new DocumentSubject('conversation_message', (string) Str::uuid7())),
        'relevé bancaire' => W::fichier($this->org, 'releve.csv', "date;libelle;montant\n2026-11-02;Loyer;650.00\n", new DocumentSubject('lease', $this->moi['lease']->id), FileCategory::BankStatement),
    ];

    R::changerDeCompte($this, $this->w['manager']);

    foreach ($interdits as $cas => $fichier) {
        $this->postJson($url, ['stored_file_id' => $fichier->id, 'kind' => 'other'])->assertUnprocessable()->assertJsonPath('code', 'lease_document_invalid');
        expect(DB::table('lease_documents')->count())->toBe(0, $cas);
    }

    expect(W::actions())->not->toContain('leases.document.shared');
});

it('ne sert jamais par le téléchargement locataire un fichier de l\'espace locataire, même si une ligne de partage le désigne', function (): void {
    $justificatif = W::fichier($this->org, 'justificatif.pdf', W::PDF, DocumentSubject::tenantSpace($this->moi['lease']->id));
    $partage = L::dans($this->org, fn (): LeaseDocument => LeaseDocument::factory()->create([
        'lease_id' => $this->moi['lease']->id,
        'stored_file_id' => $justificatif->id,
        'shared_by_user_id' => $this->w['owner']->id,
    ]));

    T::comme($this, $this->moi['user'])->getJson("{$this->base}/{$partage->id}/download")->assertNotFound()->assertJsonPath('code', 'file_not_found');
});

it('refuse par le téléchargement générique un fichier de l\'espace locataire à toute l\'équipe, comptable compris', function (): void {
    $reserve = W::fichier($this->org, 'justificatif.pdf', W::PDF, DocumentSubject::tenantSpace($this->moi['lease']->id));
    $ordinaire = W::fichier($this->org, 'ordinaire.pdf');

    foreach (['manager', 'accountant', 'owner'] as $role) {
        R::changerDeCompte($this, $this->w[$role])->getJson("/api/v1/org/{$this->org->id}/documents/files/{$reserve->id}/download")->assertNotFound()->assertJsonPath('code', 'file_not_found');
    }

    R::changerDeCompte($this, $this->w['accountant'])->get("/api/v1/org/{$this->org->id}/documents/files/{$ordinaire->id}/download")->assertOk();
});

it('ne montre pas une pièce partagée à partir du jour où ma propre ligne a pris fin', function (): void {
    $avant = ($this->partager)(['shared_at' => '2026-05-31 23:00:00'], 'avant.pdf');
    $apres = ($this->partager)(['shared_at' => '2026-06-01 08:00:00'], 'apres.pdf');
    DB::table('lease_parties')->where('lease_id', $this->moi['lease']->id)->where('party_id', $this->moi['party']->id)->update(['valid_to' => '2026-06-01']);
    $this->travelTo(CarbonImmutable::parse('2026-07-01'));

    $ids = collect($this->actingAs($this->moi['user'])->getJson($this->base)->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$avant->id]);
    T::comme($this, $this->moi['user'])->get("{$this->base}/{$avant->id}/download")->assertOk();
    T::comme($this, $this->moi['user'])->get("{$this->base}/{$apres->id}/download")->assertNotFound();
});
