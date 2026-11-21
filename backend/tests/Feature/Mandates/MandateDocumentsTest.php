<?php

declare(strict_types=1);

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Mandates\Models\MandateDocument;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;

beforeEach(function (): void {
    Storage::fake('documents');
    M::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = M::organisation();
    $this->p = O::proprietaire($this->org);
    $this->autre = O::proprietaire($this->org, 'bob@exemple.fr');
    $this->agent = M::titulaire($this->org);
    $this->actingAs($this->agent);
    $this->url = fn (string $suite = '') => M::url($this->org, "/{$this->p['mandate']->id}/documents{$suite}");
    $this->partager = fn (string $fichier, string $genre = 'diagnostic') => $this->postJson(($this->url)(), ['stored_file_id' => $fichier, 'kind' => $genre]);
    $this->etat = fn (): array => M::dans($this->org, fn (): array => [MandateDocument::query()->count(), StoredFile::query()->count()]);
});

it('partage une pièce du mandat avec le mandant : le mandant la voit, la télécharge et en est prévenu sans nom de fichier', function (): void {
    $fichier = M::pieceSignee($this->org, $this->p['mandate']);

    $reponse = ($this->partager)($fichier)->assertCreated()
        ->assertJsonPath('data.mandate_id', $this->p['mandate']->id)
        ->assertJsonPath('data.stored_file_id', $fichier)
        ->assertJsonPath('data.kind', 'diagnostic')
        ->assertJsonPath('data.uploaded_by_kind', 'agency')
        ->assertJsonPath('data.shared_by_user_id', $this->agent->id)
        ->assertJsonPath('data.revoked_at', null);
    $id = $reponse->json('data.id');

    expect($reponse->json('data.shared_at'))->not->toBeNull()->and(array_keys($reponse->json('data')))->toBe(['id', 'mandate_id', 'stored_file_id', 'kind', 'uploaded_by_kind', 'shared_by_user_id', 'shared_at', 'revoked_at']);

    $liste = R::lire($this, $this->p['user'], '/documents')->assertOk();
    expect(collect($liste->json('data'))->pluck('id')->all())->toBe([$id]);
    R::lire($this, $this->p['user'], "/documents/{$id}/download")->assertOk();

    $notification = N::premiere($this->p['user'], NotificationType::OwnerDocumentShared);
    expect($notification->link)->toBe('/documents')
        ->and($notification->dedup_key)->toBe("mandate_document:{$id}")
        ->and($notification->title.' '.$notification->body)->not->toContain('avenant-signe')
        ->and(N::nombre($this->autre['user'], NotificationType::OwnerDocumentShared))->toBe(0);

    $journal = AcrossOrganizations::query(AuditLog::class)->where('action', 'mandates.document.shared')->get();
    expect($journal)->toHaveCount(1)->and(json_encode($journal[0]->metadata))->not->toContain($fichier)->not->toContain('avenant');
});

it('un fichier déjà partagé et non retiré ne se partage pas deux fois : même ligne, une seule alerte', function (): void {
    $fichier = M::pieceSignee($this->org, $this->p['mandate']);
    $premier = ($this->partager)($fichier)->assertCreated()->json('data.id');

    ($this->partager)($fichier)->assertOk()->assertJsonPath('data.id', $premier);

    expect(M::dans($this->org, fn () => MandateDocument::query()->count()))->toBe(1)
        ->and(N::nombre($this->p['user'], NotificationType::OwnerDocumentShared))->toBe(1);
});

it('accepte une pièce de catégorie certificat et refuse les autres catégories', function (): void {
    $certificat = M::dans($this->org, fn (): string => app(DocumentStore::class)->store(
        FileSource::contents(DocumentsContext::PDF), 'dpe.pdf', FileCategory::Certificate, new DocumentSubject('mandate', $this->p['mandate']->id),
    )->id);
    $emis = M::dans($this->org, fn (): string => app(DocumentStore::class)->store(
        FileSource::contents(DocumentsContext::PDF), 'emis.pdf', FileCategory::Issued, new DocumentSubject('mandate', $this->p['mandate']->id),
    )->id);

    ($this->partager)($certificat)->assertCreated();
    ($this->partager)($emis)->assertUnprocessable()->assertJsonPath('code', 'mandate_document_invalid');
});

it('refuse un fichier inconnu, d\'un autre mandat, d\'une autre organisation ou sans objet : rien n\'est écrit', function (): void {
    $autreMandat = M::pieceSignee($this->org, $this->autre['mandate']);
    $etrangere = M::organisation();
    $mandatEtranger = O::mandat($etrangere, O::mandant($etrangere, 'x@exemple.fr'));
    $etranger = M::pieceSignee($etrangere, $mandatEtranger);
    $sansObjet = M::dans($this->org, fn (): string => app(DocumentStore::class)->store(FileSource::contents(DocumentsContext::PDF), 'libre.pdf', FileCategory::Supporting)->id);
    $avant = ($this->etat)();

    foreach ([(string) fake()->uuid(), $autreMandat, $etranger, $sansObjet] as $fichier) {
        ($this->partager)($fichier)->assertUnprocessable()->assertJsonPath('code', 'mandate_document_invalid');
    }

    expect(($this->etat)())->toBe($avant);
    expect(N::nombre($this->p['user'], NotificationType::OwnerDocumentShared))->toBe(0);
});

it('refuse tant que la pièce n\'est pas saine : 409 document_not_clean, ni partage ni alerte', function (string $statut): void {
    $fichier = M::pieceSignee($this->org, $this->p['mandate']);
    AcrossOrganizations::query(StoredFile::class)->whereKey($fichier)->update(['scan_status' => $statut]);

    ($this->partager)($fichier)->assertConflict()->assertJsonPath('code', 'document_not_clean');

    expect(M::dans($this->org, fn () => MandateDocument::query()->count()))->toBe(0)
        ->and(N::nombre($this->p['user'], NotificationType::OwnerDocumentShared))->toBe(0);
})->with(['pending', 'unverifiable', 'infected']);

it('valide le corps : fichier uuid et nature connue, aucun champ d\'autorité accepté', function (): void {
    $fichier = M::pieceSignee($this->org, $this->p['mandate']);

    $this->postJson(($this->url)(), ['kind' => 'other'])->assertUnprocessable()->assertJsonValidationErrors('stored_file_id');
    $this->postJson(($this->url)(), ['stored_file_id' => 'abc', 'kind' => 'other'])->assertUnprocessable()->assertJsonValidationErrors('stored_file_id');
    $this->postJson(($this->url)(), ['stored_file_id' => $fichier])->assertUnprocessable()->assertJsonValidationErrors('kind');
    $this->postJson(($this->url)(), ['stored_file_id' => $fichier, 'kind' => 'inconnue'])->assertUnprocessable()->assertJsonValidationErrors('kind');

    $this->postJson(($this->url)(), ['stored_file_id' => $fichier, 'kind' => 'other', 'organization_id' => (string) fake()->uuid(), 'shared_at' => '2000-01-01', 'uploaded_by_kind' => 'owner', 'shared_by_user_id' => (string) fake()->uuid()])->assertCreated();
    $ligne = M::dans($this->org, fn () => MandateDocument::query()->firstOrFail());

    expect($ligne->organization_id)->toBe($this->org->id)->and($ligne->uploaded_by_kind->value)->toBe('agency')
        ->and($ligne->shared_by_user_id)->toBe($this->agent->id)->and($ligne->shared_at?->year)->toBe(2026);
});

it('le retrait du partage cache la pièce au mandant sans rien supprimer, se rejoue sans effet et se partage de nouveau', function (): void {
    $fichier = M::pieceSignee($this->org, $this->p['mandate']);
    $id = ($this->partager)($fichier)->assertCreated()->json('data.id');

    M::basculer($this, $this->agent);
    $this->deleteJson(($this->url)("/{$id}"))->assertOk()->assertJsonPath('data.id', $id);
    $retire = M::dans($this->org, fn () => MandateDocument::query()->findOrFail($id)->revoked_at);
    $this->deleteJson(($this->url)("/{$id}"))->assertOk();

    expect($retire)->not->toBeNull()
        ->and(M::dans($this->org, fn () => MandateDocument::query()->findOrFail($id)->revoked_at?->equalTo($retire)))->toBeTrue()
        ->and(M::dans($this->org, fn () => StoredFile::query()->whereKey($fichier)->exists()))->toBeTrue()
        ->and(AcrossOrganizations::query(AuditLog::class)->where('action', 'mandates.document.unshared')->count())->toBe(1);

    expect(R::lire($this, $this->p['user'], '/documents')->assertOk()->json('data'))->toBe([]);
    R::lire($this, $this->p['user'], "/documents/{$id}/download")->assertNotFound()->assertJsonPath('code', 'owner_document_not_found');

    M::basculer($this, $this->agent);
    $nouveau = ($this->partager)($fichier)->assertCreated()->json('data.id');
    expect($nouveau)->not->toBe($id)->and(M::dans($this->org, fn () => MandateDocument::query()->count()))->toBe(2);
});

it('un autre mandant de la même agence ne voit rien de la pièce', function (): void {
    $id = ($this->partager)(M::pieceSignee($this->org, $this->p['mandate']))->assertCreated()->json('data.id');

    expect(R::lire($this, $this->autre['user'], '/documents')->assertOk()->json('data'))->toBe([]);
    R::lire($this, $this->autre['user'], "/documents/{$id}/download")->assertNotFound();
});

it('liste les pièces du mandat, retirées comprises, par curseur, sans celles des autres mandats', function (): void {
    $a = ($this->partager)(M::pieceSignee($this->org, $this->p['mandate']))->assertCreated()->json('data.id');
    $b = ($this->partager)(M::pieceSignee($this->org, $this->p['mandate'], DocumentsContext::PDF."\n%b"), 'other')->assertCreated()->json('data.id');
    $this->deleteJson(($this->url)("/{$a}"))->assertOk();
    $this->postJson(M::url($this->org, "/{$this->autre['mandate']->id}/documents"), ['stored_file_id' => M::pieceSignee($this->org, $this->autre['mandate']), 'kind' => 'other'])->assertCreated();

    $premiere = $this->getJson(($this->url)().'?per_page=1')->assertOk();
    $suite = $this->getJson(($this->url)().'?per_page=1&cursor='.$premiere->json('meta.next_cursor'))->assertOk();

    expect($premiere->json('data'))->toHaveCount(1)->and($premiere->json('data.0.id'))->toBe($b)
        ->and($suite->json('data.0.id'))->toBe($a)->and($suite->json('data.0.revoked_at'))->not->toBeNull()
        ->and($suite->json('meta.next_cursor'))->toBeNull();
    $this->getJson(($this->url)().'?cursor=nimporte')->assertUnprocessable();
});

it('404 sur la pièce d\'un autre mandat et sur un mandat étranger', function (): void {
    $sienne = $this->postJson(M::url($this->org, "/{$this->autre['mandate']->id}/documents"), ['stored_file_id' => M::pieceSignee($this->org, $this->autre['mandate']), 'kind' => 'other'])->assertCreated()->json('data.id');

    $this->deleteJson(($this->url)("/{$sienne}"))->assertNotFound()->assertJsonPath('code', 'mandate_document_not_found');
    $this->deleteJson(($this->url)('/'.fake()->uuid()))->assertNotFound()->assertJsonPath('code', 'mandate_document_not_found');
    expect(M::dans($this->org, fn () => MandateDocument::query()->findOrFail($sienne)->revoked_at))->toBeNull();

    $etrangere = M::organisation();
    $mandatEtranger = O::mandat($etrangere, O::mandant($etrangere, 'x@exemple.fr'));
    $this->getJson(M::url($this->org, "/{$mandatEtranger->id}/documents"))->assertNotFound()->assertJsonPath('code', 'mandate_not_found');
    $this->postJson(M::url($this->org, "/{$mandatEtranger->id}/documents"), ['stored_file_id' => (string) fake()->uuid(), 'kind' => 'other'])->assertNotFound()->assertJsonPath('code', 'mandate_not_found');
});

it('refuse de partager sur un mandat archivé', function (): void {
    $fichier = M::pieceSignee($this->org, $this->p['mandate']);
    M::dans($this->org, fn () => $this->p['mandate']->forceFill(['archived_at' => now()])->save());

    ($this->partager)($fichier)->assertStatus(409)->assertJsonPath('code', 'mandate_archived');
    expect(M::dans($this->org, fn () => MandateDocument::query()->count()))->toBe(0);
});

it('le gestionnaire partage, le comptable ne lit ni n\'écrit', function (): void {
    $fichier = M::pieceSignee($this->org, $this->p['mandate']);

    M::basculer($this, M::membre($this->org, MemberRole::Manager));
    ($this->partager)($fichier)->assertCreated();
    $this->getJson(($this->url)())->assertOk()->assertJsonCount(1, 'data');

    M::basculer($this, M::membre($this->org, MemberRole::Accountant));
    ($this->partager)($fichier)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    $this->getJson(($this->url)())->assertForbidden()->assertJsonPath('code', 'role_forbidden');
});

it('limite à 60 appels par minute', function (): void {
    Cache::flush();
    $codes = [];

    foreach (range(1, 61) as $_) {
        $codes[] = $this->postJson(($this->url)(), [])->getStatusCode();
    }

    expect($codes[59])->toBe(422)->and($codes[60])->toBe(429);
});

it('l\'avenant signé ne se retire pas du partage : 409, la ligne reste visible du mandant', function (): void {
    $signe = M::pieceSignee($this->org, $this->p['mandate']);
    $this->postJson(M::url($this->org, "/{$this->p['mandate']->id}/terms"), [
        'lock_version' => M::relire($this->org, $this->p['mandate'])->lock_version,
        'effective_on' => '2027-01-01',
        'fee_basis_points' => 650,
        'signed_file_id' => $signe,
    ])->assertSuccessful();
    $avenant = M::dans($this->org, fn () => MandateDocument::query()->where('kind', 'amendment')->firstOrFail());

    $this->deleteJson(($this->url)("/{$avenant->id}"))->assertConflict()->assertJsonPath('code', 'mandate_amendment_document_locked');

    $apres = M::dans($this->org, fn () => MandateDocument::query()->findOrFail($avenant->id));
    expect($apres->revoked_at)->toBeNull();
});

it('refuse de partager à la main une pièce de nature avenant : 422, rien n\'est écrit', function (): void {
    $fichier = M::pieceSignee($this->org, $this->p['mandate']);
    $avant = ($this->etat)();

    ($this->partager)($fichier, 'amendment')->assertUnprocessable()->assertJsonValidationErrors('kind');

    expect(($this->etat)())->toBe($avant);
    foreach (['mandate', 'diagnostic', 'insurance', 'other'] as $genre) {
        ($this->partager)(M::pieceSignee($this->org, $this->p['mandate'], DocumentsContext::PDF."\n%{$genre}"), $genre)->assertCreated();
    }
});

it('la base refuse deux lignes vivantes pour le même fichier, mais accepte une ligne retirée puis un nouveau partage', function (): void {
    $fichier = M::pieceSignee($this->org, $this->p['mandate']);
    ($this->partager)($fichier)->assertCreated();
    $ligne = fn (?CarbonImmutable $retire) => [
        'id' => (string) fake()->uuid(), 'organization_id' => $this->org->id, 'mandate_id' => $this->p['mandate']->id, 'stored_file_id' => $fichier,
        'kind' => 'other', 'uploaded_by_kind' => 'agency', 'shared_at' => now(), 'revoked_at' => $retire, 'created_at' => now(), 'updated_at' => now(),
    ];

    expect(fn () => DB::table('mandate_documents')->insert($ligne(null)))->toThrow(QueryException::class);

    DB::table('mandate_documents')->insert($ligne(CarbonImmutable::now()));
    DB::table('mandate_documents')->insert($ligne(CarbonImmutable::now()));

    expect(DB::table('mandate_documents')->where('stored_file_id', $fichier)->count())->toBe(3);
});
