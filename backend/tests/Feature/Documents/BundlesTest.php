<?php

declare(strict_types=1);

use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\GeneratedFile;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\PublicApi\Bundles;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Shared\Http\ApiProblem;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Documents\DocumentsContext as D;

beforeEach(function (): void {
    Storage::fake('documents');
    $this->org = D::organisation();
    $this->autre = D::organisation();
    $this->store = app(DocumentStore::class);
    $this->bundles = app(Bundles::class);
});

function documentsEntrees(string $contenuZip): array
{
    $chemin = tempnam(sys_get_temp_dir(), 'lec');
    file_put_contents($chemin, $contenuZip);
    $zip = new ZipArchive;
    expect($zip->open($chemin))->toBeTrue();
    $entrees = [];

    for ($i = 0; $i < $zip->numFiles; $i++) {
        $entrees[(string) $zip->getNameIndex($i)] = (string) $zip->getFromIndex($i);
    }

    $zip->close();
    unlink($chemin);

    return $entrees;
}

it('construit un ZIP lisible avec les fichiers stockés et générés, stocké avec son SHA-256', function (): void {
    $bail = D::dans($this->org, fn () => $this->store->store(FileSource::contents(D::PDF."% bail\n"), 'Bail.pdf', FileCategory::Supporting));
    $avis = D::dans($this->org, fn () => $this->store->store(FileSource::contents(D::PDF."% avis\n"), 'Avis échéance mars.pdf', FileCategory::Supporting));

    $zip = D::dans($this->org, fn () => $this->bundles->zip(
        [$bail->id, $avis->id],
        [new GeneratedFile('decompte.csv', "echeance;montant\n2026-03;85000\n")],
        'Dossier RC-2026-0001',
    ));

    $contenu = (string) Storage::disk('documents')->get(D::dans($this->org, fn () => StoredFile::query()->findOrFail($zip->id))->path);

    expect($zip->category)->toBe(FileCategory::Bundle)
        ->and($zip->mimeType)->toBe('application/zip')
        ->and($zip->displayName)->toBe('Dossier RC-2026-0001.zip')
        ->and($zip->sha256)->toBe(hash('sha256', $contenu))
        ->and($zip->sizeBytes)->toBe(strlen($contenu))
        ->and(documentsEntrees($contenu))->toBe([
            'Bail.pdf' => D::PDF."% bail\n",
            'Avis échéance mars.pdf' => D::PDF."% avis\n",
            'decompte.csv' => "echeance;montant\n2026-03;85000\n",
        ]);
});

it('assainit les noms d\'entrée : pas de chemin, de point initial ni de doublon', function (): void {
    $a = D::dans($this->org, fn () => $this->store->store(FileSource::contents(D::PDF.'% a'), 'quittance.pdf', FileCategory::Supporting));
    $b = D::dans($this->org, fn () => $this->store->store(FileSource::contents(D::PDF.'% b'), 'quittance.pdf', FileCategory::Supporting));

    $zip = D::dans($this->org, fn () => $this->bundles->zip([$a->id, $b->id], [
        new GeneratedFile('../../etc/passwd', 'x'),
        new GeneratedFile('..\\..\\windows\\system.ini', 'y'),
        new GeneratedFile('.htaccess', 'z'),
        new GeneratedFile("nul\0.txt", 'w'),
        new GeneratedFile('', 'v'),
    ], '../évasion'));

    $contenu = (string) Storage::disk('documents')->get(D::dans($this->org, fn () => StoredFile::query()->findOrFail($zip->id))->path);

    expect(array_keys(documentsEntrees($contenu)))->toBe(['quittance.pdf', 'quittance (2).pdf', 'passwd', 'system.ini', 'htaccess', 'nul.txt', 'fichier'])
        ->and($zip->displayName)->toBe('..évasion.zip');
});

it('refuse le fichier d\'une autre organisation, un identifiant inconnu et un paquet vide', function (): void {
    $etranger = D::dans($this->autre, fn () => $this->store->store(FileSource::contents(D::PDF), 'secret.pdf', FileCategory::Supporting));
    $essai = function (array $ids, array $generes) {
        try {
            D::dans($this->org, fn () => $this->bundles->zip($ids, $generes, 'paquet'));
        } catch (ApiProblem $probleme) {
            return $probleme->problemCode;
        }

        return null;
    };

    expect($essai([$etranger->id], []))->toBe('file_not_found')
        ->and($essai([fake()->uuid()], []))->toBe('file_not_found')
        ->and($essai([], []))->toBe('bundle_empty')
        ->and(Storage::disk('documents')->allFiles())->toHaveCount(1);
});

it('refuse un fichier dont le contenu ne correspond plus à l\'empreinte enregistrée', function (): void {
    $bail = D::dans($this->org, fn () => $this->store->store(FileSource::contents(D::PDF."% bail\n"), 'Bail.pdf', FileCategory::Supporting));
    $chemin = D::dans($this->org, fn () => StoredFile::query()->findOrFail($bail->id)->path);
    Storage::disk('documents')->put($chemin, D::PDF."% altéré\n");

    $appel = fn () => D::dans($this->org, fn () => $this->bundles->zip([$bail->id], [], 'Dossier'));

    expect(fn () => $appel())->toThrow(ApiProblem::class);
});
