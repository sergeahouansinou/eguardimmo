<?php

declare(strict_types=1);

use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\PublicApi\DocumentStore;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Documents\DocumentsContext as D;

beforeEach(function (): void {
    Storage::fake('documents');
    $this->org = D::organisation();
});

function documentsVieillir(string $chemin, int $heures): void
{
    touch(Storage::disk('documents')->path($chemin), time() - $heures * 3600);
}

it('supprime et journalise les fichiers sans ligne de plus de 24 heures, et garde le reste', function (): void {
    Log::spy();
    $connu = D::dans($this->org, fn () => app(DocumentStore::class)->store(FileSource::contents(D::PDF), 'bail.pdf', FileCategory::Supporting));
    $cheminConnu = D::dans($this->org, fn () => StoredFile::query()->findOrFail($connu->id)->path);
    Storage::disk('documents')->put('orphelin-ancien.pdf', 'x');
    Storage::disk('documents')->put('orphelin-recent.pdf', 'x');
    documentsVieillir($cheminConnu, 72);
    documentsVieillir('orphelin-ancien.pdf', 25);
    documentsVieillir('orphelin-recent.pdf', 23);

    $this->artisan('documents:sweep-orphans')->expectsOutputToContain('1 fichier(s) orphelin(s) supprimé(s).')->assertSuccessful();

    expect(Storage::disk('documents')->allFiles())->toEqualCanonicalizing([$cheminConnu, 'orphelin-recent.pdf']);
    Log::shouldHaveReceived('warning')->withArgs(fn (string $message, array $contexte): bool => $contexte['path'] === 'orphelin-ancien.pdf')->once();
});

it('ne fait rien quand tous les fichiers ont leur ligne', function (): void {
    D::dans($this->org, fn () => app(DocumentStore::class)->store(FileSource::contents(D::PDF), 'bail.pdf', FileCategory::Supporting));

    $this->artisan('documents:sweep-orphans')->expectsOutputToContain('0 fichier(s)')->assertSuccessful();

    expect(Storage::disk('documents')->allFiles())->toHaveCount(1);
});

it('est planifié chaque jour', function (): void {
    $evenements = collect(app(Schedule::class)->events())->filter(fn ($evenement): bool => str_contains((string) $evenement->command, 'documents:sweep-orphans'));

    expect($evenements)->toHaveCount(1)->and($evenements->first()->expression)->toBe('0 4 * * *');
});
