<?php

declare(strict_types=1);

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Feature\Documents\DocumentsContext as D;

beforeEach(function (): void {
    Storage::fake('documents');
    $this->org = D::organisation();
    $this->store = app(DocumentStore::class);
    $this->titulaire = D::titulaire($this->org);
});

function ranger(mixed $test, FileCategory $categorie, ?DocumentSubject $sujet, string $nom = 'piece.pdf'): string
{
    return D::dans($test->org, fn (): string => $test->store->store(FileSource::contents(D::PDF), $nom, $categorie, $sujet, CarbonImmutable::now()->addYears(5))->id);
}

it('refuse la purge anticipée d\'un fichier à conservation légale', function (string $categorie, ?string $sujet): void {
    $id = ranger($this, FileCategory::from($categorie), $sujet === null ? null : new DocumentSubject($sujet, (string) Str::uuid7()));

    expect(documentsRefusPurge(fn () => D::dans($this->org, fn () => $this->store->purgeEarly($id))))->toBe('early_purge_refused')
        ->and(D::dans($this->org, fn () => $this->store->exists($id)))->toBeTrue()
        ->and(Storage::disk('documents')->allFiles())->toHaveCount(1);
})->with([
    'bail signé (pièce émise)' => ['issued', 'lease'],
    'facture émise' => ['issued', null],
    'certificat' => ['certificate', 'unit'],
    'justificatif rattaché à un bail' => ['supporting', 'lease'],
    'justificatif rattaché à une fiche' => ['supporting', 'party'],
]);

it('purge avant l\'échéance une pièce de messagerie, ou un justificatif sans objet', function (?string $sujet): void {
    $id = ranger($this, FileCategory::Supporting, $sujet === null ? null : new DocumentSubject($sujet, (string) Str::uuid7()));

    D::dans($this->org, fn () => $this->store->purgeEarly($id));

    expect(D::dans($this->org, fn () => $this->store->exists($id)))->toBeFalse()->and(Storage::disk('documents')->allFiles())->toHaveCount(0);
})->with(['sans objet' => [null], 'pièce de messagerie' => ['conversation_message']]);

it('ne sert pas une pièce de messagerie par le téléchargement générique des documents', function (): void {
    $piece = ranger($this, FileCategory::Supporting, new DocumentSubject('conversation_message', (string) Str::uuid7()));
    $libre = ranger($this, FileCategory::Supporting, null);
    $url = D::url($this->org, '/files');

    foreach ([$this->titulaire, D::membre($this->org, MemberRole::Accountant), D::membre($this->org, MemberRole::Manager)] as $compte) {
        D::changerDeCompte($this, $compte);
        $this->getJson("{$url}/{$piece}/download")->assertNotFound()->assertJsonPath('code', 'file_not_found');
        $this->get("{$url}/{$libre}/download")->assertOk();
    }

    expect(D::dans($this->org, fn () => $this->store->find($piece)))->not->toBeNull()
        ->and(D::dans($this->org, fn () => $this->store->stream($piece)->getStatusCode()))->toBe(200);
});

it('aligne l\'extension du nom affiché sur le type détecté', function (string $nom, string $attendu): void {
    $id = D::dans($this->org, fn (): string => $this->store->store(FileSource::contents(D::PDF), $nom, FileCategory::Supporting)->id);

    expect(StoredFile::query()->withoutGlobalScopes()->findOrFail($id)->display_name)->toBe($attendu);
})->with([
    'html renommé' => ['x.html', 'x.pdf'],
    'exécutable renommé' => ['facture.exe', 'facture.pdf'],
    'sans extension' => ['scan', 'scan.pdf'],
    'déjà aligné' => ['bail.pdf', 'bail.pdf'],
    'casse conservée' => ['BAIL.PDF', 'BAIL.PDF'],
    'double extension' => ['archive.tar.gz', 'archive.tar.pdf'],
]);

it('garde jpg et jpeg pour une image JPEG, et corrige une image PNG nommée .pdf', function (): void {
    $photoJpeg = UploadedFile::fake()->image('a.jpeg', 20, 20);
    $photoPng = UploadedFile::fake()->image('a.png', 20, 20);
    $jpeg = D::dans($this->org, fn (): string => $this->store->store(FileSource::path((string) $photoJpeg->getRealPath()), 'photo.jpeg', FileCategory::Supporting)->id);
    $png = D::dans($this->org, fn (): string => $this->store->store(FileSource::path((string) $photoPng->getRealPath()), 'photo.pdf', FileCategory::Supporting)->id);
    $liste = StoredFile::query()->withoutGlobalScopes()->pluck('display_name', 'id');

    expect($liste[$png])->toBe('photo.png')->and($liste[$jpeg])->toBe('photo.jpeg');
});

function documentsRefusPurge(Closure $appel): ?string
{
    try {
        $appel();
    } catch (ApiProblem $probleme) {
        return $probleme->problemCode;
    }

    return null;
}
