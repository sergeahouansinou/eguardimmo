<?php

declare(strict_types=1);

use App\Modules\Documents\Models\LibraryDocument;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Documents\Support\FakeScanner;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Documents\DocumentsContext as D;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Mandates\MandatesSecurityContext as X;

beforeEach(function (): void {
    Storage::fake('documents');
    config(['documents.malware.scanner' => 'fake', 'documents.malware.fake_unavailable' => false]);
    M::semer();
    $this->org = D::organisation();
    $this->titulaire = D::titulaire($this->org);
    $this->url = D::url($this->org, '/library');
    $this->actingAs($this->titulaire);
    $this->deposer = fn (array $corps = [], ?UploadedFile $fichier = null) => $this->post($this->url, ['file' => $fichier ?? D::pdf(), 'kind' => 'other', ...$corps], ['Accept' => 'application/json']);
    $this->etat = fn (): array => D::dans($this->org, fn (): array => [LibraryDocument::query()->count(), StoredFile::query()->count(), count(Storage::disk('documents')->allFiles())]);
});

it('dépose une pièce : fichier et entrée créés ensemble, forme exacte, journal sans nom de fichier', function (): void {
    $reponse = ($this->deposer)(['kind' => 'diagnostic'], D::pdf('Diagnostic gaz.pdf'))->assertCreated();

    expect(array_keys($reponse->json('data')))->toBe(['id', 'kind', 'archived_at', 'filed_by_user_id', 'lock_version', 'created_at', 'file'])
        ->and(array_keys($reponse->json('data.file')))->toBe(['id', 'name', 'mime_type', 'size_bytes', 'scan_status', 'subject', 'retention_until'])
        ->and($reponse->json('data.kind'))->toBe('diagnostic')
        ->and($reponse->json('data.archived_at'))->toBeNull()
        ->and($reponse->json('data.lock_version'))->toBe(1)
        ->and($reponse->json('data.filed_by_user_id'))->toBe($this->titulaire->id)
        ->and($reponse->json('data.file.name'))->toBe('Diagnostic gaz.pdf')
        ->and($reponse->json('data.file.mime_type'))->toBe('application/pdf')
        ->and($reponse->json('data.file.size_bytes'))->toBe(strlen(D::PDF))
        ->and($reponse->json('data.file.subject'))->toBeNull();

    $fichier = D::dans($this->org, fn () => StoredFile::query()->findOrFail($reponse->json('data.file.id')));
    expect($fichier->category->value)->toBe('supporting')->and($fichier->path)->not->toContain('gaz')
        ->and(($this->etat)())->toBe([1, 1, 1]);

    $ligne = AcrossOrganizations::query(AuditLog::class)->where('action', 'documents.library.filed')->sole();
    expect(json_encode($ligne->metadata))->not->toContain('gaz')->not->toContain($fichier->id)
        ->and($ligne->metadata['kind'])->toBe('diagnostic');
});

it('nettoie le nom d\'affichage et l\'aligne sur le type détecté, sinon garde le nom d\'origine', function (): void {
    expect(($this->deposer)(['display_name' => "Contrat d'été.html"])->assertCreated()->json('data.file.name'))->toBe("Contrat d'été.pdf")
        ->and(($this->deposer)(['display_name' => "a/b\\c\x00\u{202E}.pdf"])->assertCreated()->json('data.file.name'))->toBe('abc.pdf')
        ->and(($this->deposer)([], D::pdf('Origine.pdf'))->assertCreated()->json('data.file.name'))->toBe('Origine.pdf');

    ($this->deposer)(['display_name' => str_repeat('a', 121)])->assertUnprocessable()->assertJsonValidationErrors('display_name');
});

it('une nature impose son sujet : mandat sur un mandat, bail sur un bail, sinon 422 library_kind_subject_mismatch sans rien écrire', function (): void {
    $mandat = M::actif($this->org, M::lot($this->org), M::partie($this->org));
    $avant = ($this->etat)();

    ($this->deposer)(['kind' => 'mandate'])->assertUnprocessable()->assertJsonPath('code', 'library_kind_subject_mismatch');
    ($this->deposer)(['kind' => 'lease'])->assertUnprocessable()->assertJsonPath('code', 'library_kind_subject_mismatch');
    ($this->deposer)(['kind' => 'mandate', 'subject_type' => 'organization', 'subject_id' => $this->org->id])->assertUnprocessable()->assertJsonPath('code', 'library_kind_subject_mismatch');
    ($this->deposer)(['kind' => 'lease', 'subject_type' => 'mandate', 'subject_id' => $mandat->id])->assertUnprocessable()->assertJsonPath('code', 'library_kind_subject_mismatch');
    expect(($this->etat)())->toBe($avant);

    $ok = ($this->deposer)(['kind' => 'mandate', 'subject_type' => 'mandate', 'subject_id' => $mandat->id])->assertCreated();
    expect($ok->json('data.file.subject'))->toBe(['type' => 'mandate', 'id' => $mandat->id]);

    ($this->deposer)(['kind' => 'photo', 'subject_type' => 'mandate', 'subject_id' => $mandat->id])->assertCreated();
    ($this->deposer)(['kind' => 'diagnostic', 'subject_type' => 'organization', 'subject_id' => $this->org->id])->assertCreated();
    ($this->deposer)(['kind' => 'diagnostic'])->assertCreated();
});

it('refuse un sujet inconnu ou d\'une autre organisation, un type de sujet non admis et une nature inconnue', function (): void {
    $autre = D::organisation();
    $mandatEtranger = M::actif($autre, M::lot($autre), M::partie($autre));
    $avant = ($this->etat)();

    ($this->deposer)(['kind' => 'mandate', 'subject_type' => 'mandate', 'subject_id' => $mandatEtranger->id])->assertNotFound()->assertJsonPath('code', 'subject_not_found');
    ($this->deposer)(['kind' => 'mandate', 'subject_type' => 'mandate', 'subject_id' => (string) fake()->uuid()])->assertNotFound()->assertJsonPath('code', 'subject_not_found');
    ($this->deposer)(['subject_type' => 'user', 'subject_id' => (string) fake()->uuid()])->assertUnprocessable()->assertJsonValidationErrors('subject_type');
    ($this->deposer)(['subject_type' => 'organization'])->assertUnprocessable()->assertJsonValidationErrors('subject_id');
    ($this->deposer)(['kind' => 'devis'])->assertUnprocessable()->assertJsonValidationErrors('kind');
    $this->post($this->url, ['file' => D::pdf()], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('kind');
    $this->post($this->url, ['kind' => 'other'], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');

    expect(($this->etat)())->toBe($avant);
});

it('vérifie le type sur le contenu et la taille : faux PDF, fichier trop gros, rien n\'est écrit', function (): void {
    $avant = ($this->etat)();

    ($this->deposer)([], D::pdf('facture.pdf', "<?php system(\$_GET['c']); ?>"))->assertUnprocessable()->assertJsonValidationErrors('file');
    ($this->deposer)([], UploadedFile::fake()->createWithContent('gros.pdf', D::PDF.str_repeat('0', 10 * 1024 * 1024)))->assertUnprocessable()->assertJsonValidationErrors('file');

    expect(($this->etat)())->toBe($avant);
});

it('ne reçoit du client ni la catégorie, ni l\'organisation, ni l\'auteur, ni la version', function (): void {
    $autre = D::organisation();
    $r = ($this->deposer)(['category' => 'issued', 'organization_id' => $autre->id, 'filed_by_user_id' => (string) fake()->uuid(), 'lock_version' => 9, 'archived_at' => '2000-01-01'])->assertCreated();

    $ligne = D::dans($this->org, fn () => LibraryDocument::query()->with('file')->findOrFail($r->json('data.id')));
    expect($ligne->organization_id)->toBe($this->org->id)->and($ligne->file->category->value)->toBe('supporting')
        ->and($ligne->filed_by_user_id)->toBe($this->titulaire->id)->and($ligne->lock_version)->toBe(1)->and($ligne->archived_at)->toBeNull();
});

it('analyse le fichier : le verdict apparaît dans la liste et le téléchargement est refusé tant que le fichier n\'est pas sain', function (): void {
    $sain = ($this->deposer)()->assertCreated()->json('data.file.id');
    $infecte = ($this->deposer)([], D::pdf('piege.pdf', "%PDF-1.4\n".FakeScanner::EICAR."\n%%EOF\n"))->assertCreated()->json('data.file.id');
    $attente = ($this->deposer)([], D::pdf('attente.pdf', D::PDF."\n%attente"))->assertCreated()->json('data.file.id');
    AcrossOrganizations::query(StoredFile::class)->whereKey($attente)->update(['scan_status' => 'pending']);

    $statuts = collect($this->getJson($this->url)->assertOk()->json('data'))->mapWithKeys(fn (array $e): array => [$e['file']['id'] => $e['file']['scan_status']])->all();

    expect($statuts)->toBe([$attente => 'pending', $infecte => 'infected', $sain => 'clean']);
    $this->getJson(D::url($this->org, "/files/{$sain}/download"))->assertOk();
    $this->getJson(D::url($this->org, "/files/{$infecte}/download"))->assertStatus(410)->assertJsonPath('code', 'attachment_infected');
    $this->getJson(D::url($this->org, "/files/{$attente}/download"))->assertConflict()->assertJsonPath('code', 'attachment_not_ready');
});

it('ne liste que les dépôts volontaires, jamais les autres fichiers stockés, avec filtres et curseur stable', function (): void {
    $mandat = M::actif($this->org, M::lot($this->org), M::partie($this->org));
    $this->postJson(D::url($this->org, '/files'), ['file' => D::pdf('libre.pdf', D::PDF."\n%libre")])->assertCreated();
    $a = ($this->deposer)(['kind' => 'diagnostic'], D::pdf('a.pdf', D::PDF."\n%a"))->assertCreated()->json('data.id');
    $b = ($this->deposer)(['kind' => 'mandate', 'subject_type' => 'mandate', 'subject_id' => $mandat->id], D::pdf('b.pdf', D::PDF."\n%b"))->assertCreated()->json('data.id');
    $c = ($this->deposer)(['kind' => 'other'], D::pdf('c.pdf', D::PDF."\n%c"))->assertCreated()->json('data.id');

    $ids = fn (string $requete = '') => collect($this->getJson($this->url.$requete)->assertOk()->json('data'))->pluck('id')->all();

    expect($ids())->toBe([$c, $b, $a])
        ->and($ids('?kind=mandate'))->toBe([$b])
        ->and($ids('?subject_type=mandate&subject_id='.$mandat->id))->toBe([$b])
        ->and($ids('?kind=lease'))->toBe([])
        ->and($ids('?archived=1'))->toBe([]);

    $page1 = $this->getJson($this->url.'?per_page=2')->assertOk();
    $page2 = $this->getJson($this->url.'?per_page=2&cursor='.$page1->json('meta.next_cursor'))->assertOk();
    expect($page1->json('data.*.id'))->toBe([$c, $b])->and($page2->json('data.*.id'))->toBe([$a])->and($page2->json('meta.next_cursor'))->toBeNull();

    $this->getJson($this->url.'?cursor=nimporte')->assertUnprocessable();
    $this->getJson($this->url.'?kind=devis')->assertUnprocessable();
    $this->getJson($this->url.'?subject_type=mandate')->assertUnprocessable();
});

it('le nombre de requêtes d\'une liste ne dépend pas du nombre d\'entrées', function (): void {
    $mesurer = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson($this->url)->assertOk();
        $n = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $n;
    };

    ($this->deposer)([], D::pdf('1.pdf', D::PDF."\n%1"))->assertCreated();
    $un = $mesurer();
    foreach (range(2, 12) as $i) {
        ($this->deposer)([], D::pdf("{$i}.pdf", D::PDF."\n%{$i}"))->assertCreated();
    }

    expect($mesurer())->toBe($un);
});

it('archive sans rien supprimer, rejoue sans effet, restaure, et journalise', function (): void {
    $id = ($this->deposer)()->assertCreated()->json('data.id');
    $fichier = D::dans($this->org, fn () => LibraryDocument::query()->findOrFail($id)->stored_file_id);

    $this->postJson("{$this->url}/{$id}/archive")->assertOk()->assertJsonPath('data.lock_version', 2)->assertJsonPath('data.id', $id);
    $archive = D::dans($this->org, fn () => LibraryDocument::query()->findOrFail($id)->archived_at);
    $this->postJson("{$this->url}/{$id}/archive")->assertOk()->assertJsonPath('data.lock_version', 2);

    expect($archive)->not->toBeNull()
        ->and($this->getJson($this->url)->json('data'))->toBe([])
        ->and($this->getJson($this->url.'?archived=1')->json('data.0.id'))->toBe($id)
        ->and(D::dans($this->org, fn () => StoredFile::query()->whereKey($fichier)->exists()))->toBeTrue()
        ->and(count(Storage::disk('documents')->allFiles()))->toBe(1);
    $this->getJson(D::url($this->org, "/files/{$fichier}/download"))->assertOk();

    $this->deleteJson("{$this->url}/{$id}/archive")->assertOk()->assertJsonPath('data.archived_at', null)->assertJsonPath('data.lock_version', 3);
    $this->deleteJson("{$this->url}/{$id}/archive")->assertOk()->assertJsonPath('data.lock_version', 3);

    expect($this->getJson($this->url)->json('data.0.id'))->toBe($id)
        ->and(AcrossOrganizations::query(AuditLog::class)->where('action', 'documents.library.archived')->count())->toBe(1)
        ->and(AcrossOrganizations::query(AuditLog::class)->where('action', 'documents.library.restored')->count())->toBe(1);
});

it('404 library_document_not_found pour une entrée inconnue ou d\'une autre organisation, sans rien modifier', function (): void {
    $autre = D::organisation();
    D::changerDeCompte($this, D::titulaire($autre));
    $etrangere = $this->post(D::url($autre, '/library'), ['file' => D::pdf(), 'kind' => 'other'], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

    D::changerDeCompte($this, $this->titulaire);
    $this->postJson("{$this->url}/{$etrangere}/archive")->assertNotFound()->assertJsonPath('code', 'library_document_not_found');
    $this->deleteJson("{$this->url}/{$etrangere}/archive")->assertNotFound()->assertJsonPath('code', 'library_document_not_found');
    $this->postJson("{$this->url}/".fake()->uuid().'/archive')->assertNotFound()->assertJsonPath('code', 'library_document_not_found');
    $this->getJson($this->url)->assertOk()->assertJsonPath('data', []);

    expect(AcrossOrganizations::query(LibraryDocument::class)->findOrFail($etrangere)->archived_at)->toBeNull();
});

it('401 sans session, 404 hors organisation, jeton opérateur refusé', function (): void {
    ($this->deposer)()->assertCreated();
    $uuid = (string) fake()->uuid();
    $appels = fn () => [
        $this->getJson($this->url), $this->postJson($this->url, []), $this->postJson("{$this->url}/{$uuid}/archive"), $this->deleteJson("{$this->url}/{$uuid}/archive"),
    ];

    X::changer();
    foreach ($appels() as $r) {
        $r->assertUnauthorized();
    }

    D::changerDeCompte($this, D::titulaire(D::organisation()));
    foreach ($appels() as $r) {
        $r->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }

    X::changer();
    $this->withToken(X::jetonOperateur(D::membre($this->org, MemberRole::Admin)));
    foreach ($appels() as $r) {
        $r->assertForbidden();
    }
});

it('le comptable lit sans écrire, le gestionnaire et l\'administrateur déposent', function (): void {
    $id = ($this->deposer)()->assertCreated()->json('data.id');

    D::changerDeCompte($this, D::membre($this->org, MemberRole::Accountant));
    $this->getJson($this->url)->assertOk()->assertJsonCount(1, 'data');
    ($this->deposer)()->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    $this->postJson("{$this->url}/{$id}/archive")->assertForbidden();
    $this->deleteJson("{$this->url}/{$id}/archive")->assertForbidden();

    foreach ([MemberRole::Manager, MemberRole::Admin] as $role) {
        $compte = D::membre($this->org, $role);
        activerDeuxFacteurs($compte);
        D::changerDeCompte($this, $compte);
        ($this->deposer)([], D::pdf("{$role->value}.pdf", D::PDF."\n%{$role->value}"))->assertCreated();
        $this->getJson($this->url)->assertOk();
    }
});

it('une organisation de particulier peut tenir sa bibliothèque', function (): void {
    $perso = M::organisation(OrganizationKind::Individual);
    D::changerDeCompte($this, M::titulaire($perso));

    $this->post(D::url($perso, '/library'), ['file' => D::pdf(), 'kind' => 'photo'], ['Accept' => 'application/json'])->assertCreated();
    $this->getJson(D::url($perso, '/library'))->assertOk()->assertJsonCount(1, 'data');
});

it('limite l\'écriture à 30 appels par minute et la lecture à 120', function (): void {
    Cache::flush();
    $codes = [];

    foreach (range(1, 31) as $_) {
        $codes[] = $this->postJson($this->url, [])->getStatusCode();
    }

    expect($codes[29])->toBe(422)->and($codes[30])->toBe(429);

    Cache::flush();
    $trop = 0;
    foreach (range(1, 120) as $_) {
        $trop += $this->getJson($this->url)->getStatusCode() === 429 ? 1 : 0;
    }

    expect($trop)->toBe(0)->and($this->getJson($this->url)->getStatusCode())->toBe(429);
});

it('la purge du fichier emporte son entrée de bibliothèque, avant échéance (retrait) comme à l\'échéance, sans erreur de clé étrangère', function (): void {
    $retrait = ($this->deposer)()->assertCreated()->json('data.file.id');
    $echu = ($this->deposer)([], D::pdf('echu.pdf'))->assertCreated()->json('data.file.id');
    D::dans($this->org, fn () => StoredFile::query()->whereKey($echu)->toBase()->update(['retention_until' => now()->subDay()]));

    D::dans($this->org, function () use ($retrait, $echu): void {
        app(DocumentStore::class)->purgeEarly($retrait);
        app(DocumentStore::class)->purge($echu);
    });

    expect(($this->etat)())->toBe([0, 0, 0]);
});

it('ne liste jamais l\'entrée d\'une autre organisation', function (): void {
    $sienne = ($this->deposer)()->assertCreated()->json('data.id');

    $etrangere = D::organisation();
    D::changerDeCompte($this, D::titulaire($etrangere));
    $leur = $this->post(D::url($etrangere, '/library'), ['file' => D::pdf('etranger.pdf'), 'kind' => 'other'], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

    $liste = $this->getJson(D::url($etrangere, '/library'))->assertOk();
    expect(collect($liste->json('data'))->pluck('id')->all())->toBe([$leur]);

    D::changerDeCompte($this, $this->titulaire);
    $liste = $this->getJson($this->url)->assertOk();
    expect(collect($liste->json('data'))->pluck('id')->all())->toBe([$sienne])
        ->and(json_encode($liste->json()))->not->toContain($leur);
});
