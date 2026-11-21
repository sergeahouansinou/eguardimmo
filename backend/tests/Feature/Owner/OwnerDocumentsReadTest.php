<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\MandateStatus;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    L::semer();
    Storage::fake('documents');
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->p = R::proprietaire($this->org);
    $this->autre = R::proprietaire($this->org, 'bob@exemple.fr');
});

it('liste les pièces partagées avec leur nom, leur type et leur taille, sans identifiant de fichier', function (): void {
    $piece = R::piece($this->org, $this->p['mandate'], [], 'Diagnostic électrique.pdf');

    $reponse = R::lire($this, $this->p['user'], '/documents')->assertOk()->assertJsonCount(1, 'data');
    $doc = $reponse->json('data.0');

    expect($doc)->toMatchArray(['id' => $piece->id, 'kind' => 'diagnostic', 'name' => 'Diagnostic électrique.pdf', 'mime_type' => 'application/pdf', 'uploaded_by' => 'agency'])
        ->and($doc['size_bytes'])->toBeGreaterThan(0)
        ->and($doc['mandate']['reference'])->toBe($this->p['mandate']->reference)
        ->and(R::texte($reponse))->not->toContain($piece->stored_file_id)->and(R::texte($reponse))->not->toContain('stored_file')->and(R::texte($reponse))->not->toContain('shared_by');
});

it('ne sert jamais une pièce non partagée ni dont le partage est retiré', function (): void {
    $partagee = R::piece($this->org, $this->p['mandate']);
    $nonPartagee = R::piece($this->org, $this->p['mandate'], ['shared_at' => null, 'shared_by_user_id' => null]);
    $retiree = R::piece($this->org, $this->p['mandate'], ['revoked_at' => now()]);

    $ids = collect(R::lire($this, $this->p['user'], '/documents')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$partagee->id]);
    R::lire($this, $this->p['user'], '/documents/'.$nonPartagee->id.'/download')->assertNotFound()->assertJsonPath('code', 'owner_document_not_found');
    R::lire($this, $this->p['user'], '/documents/'.$retiree->id.'/download')->assertNotFound();
    R::lire($this, $this->p['user'], '/documents/'.$partagee->id.'/download')->assertOk();
});

it('ne sert ni ne télécharge la pièce d\'un autre propriétaire de la même agence', function (): void {
    $sienne = R::piece($this->org, $this->autre['mandate']);
    $mienne = R::piece($this->org, $this->p['mandate']);

    expect(collect(R::lire($this, $this->p['user'], '/documents')->json('data'))->pluck('id')->all())->toBe([$mienne->id]);
    R::lire($this, $this->p['user'], '/documents/'.$sienne->id.'/download')->assertNotFound();
    R::lire($this, $this->autre['user'], '/documents/'.$mienne->id.'/download')->assertNotFound();
});

it('ne sert rien d\'une autre agence, même sous un mandat au même identifiant de mandant', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $piege = O::mandat($autreOrg, O::mandant($autreOrg, 'x@exemple.fr'), MandateStatus::Active, ['mandant_party_id' => $this->p['party']->id]);
    $etrangere = R::piece($autreOrg, $piege);

    expect(R::lire($this, $this->p['user'], '/documents')->assertOk()->json('data'))->toBe([]);
    R::lire($this, $this->p['user'], '/documents/'.$etrangere->id.'/download')->assertNotFound();
});

it('masque les pièces d\'un mandat brouillon ou archivé', function (): void {
    $brouillon = O::mandat($this->org, $this->p['party'], MandateStatus::Draft);
    $archive = O::mandat($this->org, $this->p['party'], MandateStatus::Active, ['archived_at' => now()]);
    R::piece($this->org, $brouillon);
    R::piece($this->org, $archive);

    expect(R::lire($this, $this->p['user'], '/documents')->assertOk()->json('data'))->toBe([]);
});

it('télécharge en privé et no-store, avec le contenu exact, et journalise le téléchargement', function (): void {
    $piece = R::piece($this->org, $this->p['mandate'], [], 'assurance.pdf');

    $reponse = R::lire($this, $this->p['user'], '/documents/'.$piece->id.'/download')->assertOk();

    expect($reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')
        ->and($reponse->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($reponse->headers->get('Content-Disposition'))->toContain('attachment')->toContain('assurance.pdf')
        ->and($reponse->streamedContent())->toBe("%PDF-1.4\n% diagnostic\n");

    $actions = AuditLog::query()->where('actor_user_id', $this->p['user']->id)->pluck('action')->all();
    expect($actions)->toContain('documents.file.downloaded')->toContain('mandates.document.downloaded');
    $ligne = AuditLog::query()->where('action', 'mandates.document.downloaded')->firstOrFail();
    expect($ligne->organization_id)->toBe($this->org->id)->and(json_encode($ligne->metadata))->not->toContain('assurance');
});

it('lit les pièces en un nombre de requêtes indépendant de leur nombre', function (): void {
    R::piece($this->org, $this->p['mandate']);
    $peu = R::requetes($this, $this->p['user'], '/documents?per_page=100');

    foreach (range(1, 5) as $_) {
        R::piece($this->org, $this->p['mandate']);
    }

    expect(R::requetes($this, $this->p['user'], '/documents?per_page=100'))->toBe($peu);
});

it('pagine par curseur', function (): void {
    foreach (range(1, 5) as $_) {
        R::piece($this->org, $this->p['mandate']);
    }
    $vus = [];
    $url = '/documents?per_page=2';

    do {
        $page = R::lire($this, $this->p['user'], $url)->assertOk();
        $vus = [...$vus, ...collect($page->json('data'))->pluck('id')->all()];
        $curseur = $page->json('meta.next_cursor');
        $url = '/documents?per_page=2&cursor='.$curseur;
    } while ($curseur !== null);

    expect($vus)->toHaveCount(5)->and(array_unique($vus))->toHaveCount(5);
});

it('refuse sans session et sans profil, avec un téléchargement limité à 30 par minute', function (): void {
    $this->getJson('/api/v1/owner/documents')->assertUnauthorized();
    $this->getJson('/api/v1/owner/documents/'.fake()->uuid().'/download')->assertUnauthorized();
    R::lire($this, T::locataire($this->org)['user'], '/documents')->assertForbidden();

    $route = collect(Route::getRoutes()->getRoutes())->first(fn ($r) => $r->getName() === 'mandates.owner.documents.download');
    expect($route->gatherMiddleware())->toContain('throttle:30,1,owner-downloads');
});

it('ne journalise aucun téléchargement quand le contenu du fichier est absent', function (): void {
    $piece = R::piece($this->org, $this->p['mandate'], [], 'assurance.pdf');
    $fichier = L::dans($this->org, fn () => DB::table('stored_files')->where('id', $piece->stored_file_id)->first());
    Storage::disk($fichier->disk)->delete($fichier->path);

    R::lire($this, $this->p['user'], '/documents/'.$piece->id.'/download')->assertStatus(500)->assertJsonPath('code', 'file_unavailable');

    expect(AuditLog::query()->whereIn('action', ['mandates.document.downloaded', 'documents.file.downloaded'])->count())->toBe(0);
});
