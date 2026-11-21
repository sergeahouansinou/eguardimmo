<?php

declare(strict_types=1);

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Subscriptions\Enums\Feature;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use App\Shared\Tenancy\MissingOrganizationContext;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Feature\Documents\DocumentsContext as D;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Subscriptions\QuotaContext as Q;

const OCTETS_PAR_MO_STOCKAGE = 1024 * 1024;

function occuperLeStockage(Organization $org, int $octets): void
{
    L::dans($org, fn (): StoredFile => StoredFile::query()->create([
        'disk' => 'documents', 'path' => $org->id.'/test/'.Str::uuid7()->toString().'.pdf', 'display_name' => 'existant.pdf', 'mime_type' => 'application/pdf',
        'size_bytes' => $octets, 'sha256' => hash('sha256', Str::random(8)), 'category' => FileCategory::Supporting,
    ]));
}

function octetsStockesDeLOrganisation(Organization $org): int
{
    return L::dans($org, fn (): int => (int) StoredFile::query()->sum('size_bytes'));
}

beforeEach(function (): void {
    Storage::fake('documents');
    Q::demarrer();
    $this->org = Q::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->autre = Q::organisation();
    $this->autreTitulaire = L::titulaire($this->autre);
    $this->envoyer = fn (Organization $org, $compte) => Q::comme($this, $compte)->postJson(D::url($org, '/files'), ['file' => D::pdf(), 'category' => 'supporting']);
    $this->limite = 50 * OCTETS_PAR_MO_STOCKAGE;
});

it('téléverse sous la limite de stockage du plan Gratuit', function (): void {
    Q::gratuit($this->org);
    occuperLeStockage($this->org, $this->limite - 1000);

    ($this->envoyer)($this->org, $this->titulaire)->assertCreated();

    expect(octetsStockesDeLOrganisation($this->org))->toBe($this->limite - 1000 + strlen(D::PDF));
});

it('accepte le fichier qui remplit exactement le plan et refuse l\'octet de trop avec 409 plan_quota_reached', function (): void {
    Q::gratuit($this->org);
    occuperLeStockage($this->org, $this->limite - strlen(D::PDF));
    ($this->envoyer)($this->org, $this->titulaire)->assertCreated();
    expect(octetsStockesDeLOrganisation($this->org))->toBe($this->limite);

    $reponse = ($this->envoyer)($this->org, $this->titulaire)->assertStatus(409);

    expect($reponse->json())->toMatchArray(['code' => 'plan_quota_reached', 'status' => 409, 'feature' => 'storage_mb', 'limit' => 50, 'current' => 50])
        ->and($reponse->headers->get('Content-Type'))->toContain('application/problem+json')
        ->and($reponse->json('detail'))->toContain('Silver')
        ->and(octetsStockesDeLOrganisation($this->org))->toBe($this->limite)
        ->and(Storage::disk('documents')->allFiles($this->org->id))->toHaveCount(1);
});

it('refuse un fichier qui dépasse le reste du plan même quand le volume actuel est sous la limite', function (): void {
    Q::gratuit($this->org);
    occuperLeStockage($this->org, $this->limite - strlen(D::PDF) + 1);

    ($this->envoyer)($this->org, $this->titulaire)->assertStatus(409)->assertJsonPath('code', 'plan_quota_reached');
});

it('laisse la lecture et l\'export ouverts au-delà de la limite', function (): void {
    Q::gratuit($this->org);
    $id = ($this->envoyer)($this->org, $this->titulaire)->assertCreated()->json('data.id');
    occuperLeStockage($this->org, $this->limite + 5 * OCTETS_PAR_MO_STOCKAGE);

    Q::comme($this, $this->titulaire)->get(D::url($this->org, "/files/{$id}/download"))->assertOk();
    Q::comme($this, $this->titulaire)->getJson(D::url($this->org, '/library'))->assertOk();
});

it('relève la limite par dérogation exprimée en Mo, puis refuse à la nouvelle limite', function (): void {
    Q::gratuit($this->org);
    occuperLeStockage($this->org, $this->limite);
    ($this->envoyer)($this->org, $this->titulaire)->assertStatus(409);

    Q::deroger($this->org, Feature::Storage, 51);

    ($this->envoyer)($this->org, $this->titulaire)->assertCreated();
    occuperLeStockage($this->org, OCTETS_PAR_MO_STOCKAGE);
    ($this->envoyer)($this->org, $this->titulaire)->assertStatus(409)->assertJsonPath('limit', 51);
});

it('lève la limite avec une dérogation illimitée et refuse net une fonction désactivée avec 403 feature_not_in_plan', function (): void {
    Q::gratuit($this->org);
    occuperLeStockage($this->org, $this->limite);

    Q::deroger($this->org, Feature::Storage, null);
    ($this->envoyer)($this->org, $this->titulaire)->assertCreated();

    Q::deroger($this->org, Feature::Storage, null, false);
    ($this->envoyer)($this->org, $this->titulaire)->assertForbidden()
        ->assertJsonPath('code', 'feature_not_in_plan')->assertJsonPath('feature', 'storage_mb');
});

it('ne limite pas une organisation sans abonnement', function (): void {
    Q::sansAbonnement($this->org);
    occuperLeStockage($this->org, $this->limite * 2);

    ($this->envoyer)($this->org, $this->titulaire)->assertCreated();
});

it('compte les octets de chaque organisation séparément', function (): void {
    Q::gratuit($this->org);
    Q::gratuit($this->autre);
    occuperLeStockage($this->org, $this->limite);
    occuperLeStockage($this->autre, 1000);

    ($this->envoyer)($this->autre, $this->autreTitulaire)->assertCreated();
    ($this->envoyer)($this->org, $this->titulaire)->assertStatus(409)->assertJsonPath('current', 50);
    expect(octetsStockesDeLOrganisation($this->autre))->toBe(1000 + strlen(D::PDF));
});

it('compte les pièces produites par la plateforme sans jamais les refuser, ainsi que les pièces de messagerie', function (): void {
    Q::gratuit($this->org);
    occuperLeStockage($this->org, $this->limite);
    $genere = fn (FileCategory $categorie, $sujet = null) => L::dans($this->org, fn () => app(DocumentStore::class)->store(FileSource::contents(D::PDF), 'piece.pdf', $categorie, $sujet));

    $genere(FileCategory::Issued);
    $genere(FileCategory::Supporting, new DocumentSubject(StoredFile::SUJET_MESSAGERIE, (string) Str::uuid7()));

    expect(octetsStockesDeLOrganisation($this->org))->toBe($this->limite + 2 * strlen(D::PDF));
    ($this->envoyer)($this->org, $this->titulaire)->assertStatus(409);
});

it('refuse aussi le dépôt d\'un autre module par le stockage probant, sans rien écrire', function (): void {
    Q::gratuit($this->org);
    occuperLeStockage($this->org, $this->limite);
    $avant = count(Storage::disk('documents')->allFiles());

    expect(fn () => L::dans($this->org, fn () => app(DocumentStore::class)->store(FileSource::contents(D::PDF), 'releve.pdf', FileCategory::Certificate)))
        ->toThrow(fn (ApiProblem $p) => expect([$p->problemCode, $p->status])->toBe(['plan_quota_reached', 409]));
    expect(count(Storage::disk('documents')->allFiles()))->toBe($avant);
});

it('échoue fermé sans organisation courante', function (): void {
    app()->forgetInstance(CurrentOrganization::class);

    expect(fn () => app(DocumentStore::class)->store(FileSource::contents(D::PDF), 'x.pdf', FileCategory::Supporting))
        ->toThrow(MissingOrganizationContext::class);
});
