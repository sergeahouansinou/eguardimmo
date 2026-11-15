<?php

declare(strict_types=1);

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\MissingOrganizationContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Documents\DocumentsContext as D;

beforeEach(function (): void {
    Storage::fake('documents');
    $this->org = D::organisation();
    $this->autre = D::organisation();
    $this->store = app(DocumentStore::class);
});

function documentsRefus(Closure $appel): ?string
{
    try {
        $appel();
    } catch (ApiProblem $probleme) {
        return $probleme->problemCode;
    }

    return null;
}

it('stocke un contenu ou un chemin temporaire avec empreinte, type, sujet et conservation', function (): void {
    $conservation = CarbonImmutable::parse('2036-11-15 23:59:59');
    $chemin = tempnam(sys_get_temp_dir(), 'test');
    file_put_contents($chemin, D::PDF);

    [$a, $b] = D::dans($this->org, fn (): array => [
        $this->store->store(FileSource::contents(D::PDF), 'depuis-memoire.pdf', FileCategory::Supporting, new DocumentSubject('organization', $this->org->id), $conservation),
        $this->store->store(FileSource::path($chemin), 'depuis-chemin.pdf', FileCategory::Certificate),
    ]);
    unlink($chemin);

    expect($a->sha256)->toBe(hash('sha256', D::PDF))
        ->and($a->mimeType)->toBe('application/pdf')
        ->and($a->sizeBytes)->toBe(strlen(D::PDF))
        ->and($a->subject?->id)->toBe($this->org->id)
        ->and($a->retentionUntil?->toDateString())->toBe('2036-11-15')
        ->and($b->sha256)->toBe($a->sha256)
        ->and($b->category)->toBe(FileCategory::Certificate)
        ->and($b->retentionUntil)->toBeNull()
        ->and(Storage::disk('documents')->allFiles())->toHaveCount(2);
});

it('refuse un contenu hors liste blanche, trop gros ou contenant du PHP, et n\'écrit rien', function (): void {
    D::dans($this->org, function (): void {
        expect(documentsRefus(fn () => $this->store->store(FileSource::contents('<?php echo 1;'), 'a.pdf', FileCategory::Supporting)))->toBe('file_type_refused')
            ->and(documentsRefus(fn () => $this->store->store(FileSource::contents("%PDF-1.4\n<?php echo 1;"), 'a.pdf', FileCategory::Supporting)))->toBe('file_unsafe')
            ->and(documentsRefus(fn () => $this->store->store(FileSource::contents("%PDF-1.4\n".str_repeat(' ', 10 * 1024 * 1024)), 'a.pdf', FileCategory::Supporting)))->toBe('file_too_large')
            ->and(documentsRefus(fn () => $this->store->store(FileSource::contents(D::PDF), 'a.zip', FileCategory::Bundle)))->toBe('file_type_refused');
    });

    expect(Storage::disk('documents')->allFiles())->toBe([]);
});

it('exige un contexte d\'organisation', function (): void {
    expect(fn () => $this->store->store(FileSource::contents(D::PDF), 'a.pdf', FileCategory::Supporting))->toThrow(MissingOrganizationContext::class);
});

it('refuse un type d\'objet absent de la morph map', function (): void {
    expect(fn () => D::dans($this->org, fn () => $this->store->store(FileSource::contents(D::PDF), 'a.pdf', FileCategory::Supporting, new DocumentSubject('inconnu', fake()->uuid()))))
        ->toThrow(InvalidArgumentException::class);
});

it('cloisonne exists() et stream() par organisation', function (): void {
    $fichier = D::dans($this->org, fn () => $this->store->store(FileSource::contents(D::PDF), 'a.pdf', FileCategory::Supporting));

    expect(D::dans($this->org, fn () => $this->store->exists($fichier->id)))->toBeTrue()
        ->and(D::dans($this->autre, fn () => $this->store->exists($fichier->id)))->toBeFalse()
        ->and(D::dans($this->org, fn () => $this->store->exists('pas-un-uuid')))->toBeFalse()
        ->and(D::dans($this->org, fn () => $this->store->exists(fake()->uuid())))->toBeFalse()
        ->and(documentsRefus(fn () => D::dans($this->autre, fn () => $this->store->stream($fichier->id))))->toBe('file_not_found');

    Storage::disk('documents')->deleteDirectory($this->org->id);

    expect(D::dans($this->org, fn () => $this->store->exists($fichier->id)))->toBeFalse();
});

it('n\'autorise aucune suppression avant la fin de la conservation, ni modification du contenu', function (): void {
    $sansDate = D::dans($this->org, fn () => $this->store->store(FileSource::contents(D::PDF), 'a.pdf', FileCategory::Supporting));
    $futur = D::dans($this->org, fn () => $this->store->store(FileSource::contents(D::PDF), 'b.pdf', FileCategory::Supporting, null, CarbonImmutable::now()->addYear()));

    D::dans($this->org, function () use ($sansDate, $futur): void {
        expect(fn () => StoredFile::query()->findOrFail($sansDate->id)->delete())->toThrow(LogicException::class)
            ->and(fn () => StoredFile::query()->findOrFail($futur->id)->delete())->toThrow(LogicException::class)
            ->and(fn () => StoredFile::query()->findOrFail($futur->id)->update(['sha256' => str_repeat('a', 64)]))->toThrow(LogicException::class)
            ->and(fn () => StoredFile::query()->findOrFail($futur->id)->update(['retention_until' => now()->addDay()]))->toThrow(LogicException::class)
            ->and(StoredFile::query()->count())->toBe(2);

        StoredFile::query()->findOrFail($futur->id)->update(['retention_until' => now()->addYears(2)]);
    });

    $this->travelTo(now()->addYears(3));

    D::dans($this->org, function () use ($futur): void {
        StoredFile::query()->findOrFail($futur->id)->delete();

        expect(StoredFile::query()->count())->toBe(1);
    });
});
