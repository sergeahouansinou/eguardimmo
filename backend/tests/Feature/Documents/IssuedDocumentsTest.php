<?php

declare(strict_types=1);

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\IssuedDocumentData;
use App\Modules\Documents\Data\NewIssuedDocumentData;
use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\Models\IssuedDocument;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\PublicApi\IssuedDocuments;
use App\Shared\Audit\AuditLog;
use App\Shared\Http\ApiProblem;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Documents\DocumentsContext as D;

beforeEach(function (): void {
    Storage::fake('documents');
    $this->org = D::organisation();
    $this->autre = D::organisation();
    $this->api = app(IssuedDocuments::class);
});

function documentsEmettre(object $test, object $org, IssuedDocumentType $type = IssuedDocumentType::RentReceipt, string $locataire = 'Jean Dupont'): IssuedDocumentData
{
    return D::dans($org, fn (): IssuedDocumentData => $test->api->issue(new NewIssuedDocumentData(
        $type,
        ['recipient' => ['name' => $locataire, 'address' => '3 rue des Lilas, 75011 Paris'], 'lines' => [['label' => 'Loyer', 'amount' => 85000, 'currency' => 'EUR']]],
        'receipt-v1',
        FileSource::contents(D::PDF."% {$locataire}\n"),
        'quittance.pdf',
        new DocumentSubject('organization', $org->id),
    )));
}

it('émet une pièce : fichier PDF, empreinte du PDF, instantané et version du modèle figés', function (): void {
    $piece = documentsEmettre($this, $this->org);

    expect($piece->number)->toBe('QUI-000001')
        ->and($piece->sequence)->toBe(1)
        ->and($piece->templateVersion)->toBe('receipt-v1')
        ->and($piece->snapshot['recipient']['name'])->toBe('Jean Dupont')
        ->and($piece->fingerprint)->toBe($piece->file->sha256)
        ->and($piece->fingerprint)->toBe(hash('sha256', D::PDF."% Jean Dupont\n"))
        ->and($piece->file->mimeType)->toBe('application/pdf')
        ->and($piece->subject?->id)->toBe($this->org->id);

    $ligne = D::dans($this->org, fn () => IssuedDocument::query()->findOrFail($piece->id));

    expect($ligne->snapshot)->toEqual($piece->snapshot)
        ->and($ligne->stored_file_id)->toBe($piece->file->id)
        ->and(Storage::disk('documents')->allFiles())->toHaveCount(1);
});

it('numérote en continu par organisation et par type', function (): void {
    $numeros = [
        documentsEmettre($this, $this->org)->number,
        documentsEmettre($this, $this->org)->number,
        documentsEmettre($this, $this->org, IssuedDocumentType::Invoice)->number,
        documentsEmettre($this, $this->autre)->number,
        documentsEmettre($this, $this->org)->number,
        documentsEmettre($this, $this->org, IssuedDocumentType::Invoice)->number,
    ];

    expect($numeros)->toBe(['QUI-000001', 'QUI-000002', 'FAC-000001', 'QUI-000001', 'QUI-000003', 'FAC-000002']);
});

it('ne consomme aucun numéro quand l\'émission est annulée : la suite reste continue', function (): void {
    documentsEmettre($this, $this->org);

    try {
        DB::transaction(function (): void {
            documentsEmettre($this, $this->org);

            throw new RuntimeException('annulé');
        });
    } catch (RuntimeException) {
    }

    expect(documentsEmettre($this, $this->org)->number)->toBe('QUI-000002')
        ->and(D::dans($this->org, fn () => IssuedDocument::query()->pluck('number')->all()))->toBe(['QUI-000001', 'QUI-000002']);
});

it('refuse un contenu qui n\'est pas un PDF, un instantané vide, et n\'écrit rien', function (): void {
    $pdf = fn (FileSource $source, array $snapshot): NewIssuedDocumentData => new NewIssuedDocumentData(IssuedDocumentType::Letter, $snapshot, 'v1', $source, 'courrier.pdf');

    expect(fn () => D::dans($this->org, fn () => $this->api->issue($pdf(FileSource::contents("\x89PNG\r\n\x1a\n"), ['a' => 1]))))->toThrow(ApiProblem::class)
        ->and(fn () => D::dans($this->org, fn () => $this->api->issue($pdf(FileSource::contents(D::PDF), []))))->toThrow(InvalidArgumentException::class)
        ->and(Storage::disk('documents')->allFiles())->toBe([])
        ->and(D::dans($this->org, fn () => IssuedDocument::query()->count()))->toBe(0);
});

it('ne laisse modifier ni supprimer une pièce émise, ni par le modèle ni par SQL', function (): void {
    $piece = documentsEmettre($this, $this->org);

    D::dans($this->org, function () use ($piece): void {
        $ligne = IssuedDocument::query()->findOrFail($piece->id);

        expect(fn () => $ligne->update(['snapshot' => ['recipient' => ['name' => 'Autre']]]))->toThrow(LogicException::class)
            ->and(fn () => $ligne->delete())->toThrow(LogicException::class)
            ->and(fn () => DB::table('issued_documents')->where('id', $piece->id)->update(['snapshot' => '{}']))->toThrow(QueryException::class)
            ->and(fn () => DB::table('issued_documents')->where('id', $piece->id)->delete())->toThrow(QueryException::class)
            ->and(IssuedDocument::query()->findOrFail($piece->id)->snapshot['recipient']['name'])->toBe('Jean Dupont');
    });
});

it('garde l\'instantané quand la fiche source change et ne l\'écrit pas en clair dans le journal', function (): void {
    $piece = documentsEmettre($this, $this->org, locataire: 'Jean Dupont');

    $entree = AuditLog::query()->where('action', 'issued_document.created')->firstOrFail();

    expect(json_encode($entree->changes))->not->toContain('Dupont')
        ->and(D::dans($this->org, fn () => IssuedDocument::query()->findOrFail($piece->id)->snapshot['recipient']['address']))->toBe('3 rue des Lilas, 75011 Paris');
});

it('cloisonne les pièces émises et leurs fichiers par organisation', function (): void {
    documentsEmettre($this, $this->org);

    expect(D::dans($this->autre, fn () => IssuedDocument::query()->count()))->toBe(0)
        ->and(D::dans($this->autre, fn () => StoredFile::query()->count()))->toBe(0);
});

it('efface le PDF écrit quand la transaction de l\'appelant est annulée après l\'émission', function (): void {
    documentsEmettre($this, $this->org);

    try {
        DB::transaction(function (): void {
            documentsEmettre($this, $this->org, IssuedDocumentType::Invoice, 'Marie Curie');

            throw new RuntimeException('annulé par l\'appelant');
        });
    } catch (RuntimeException) {
    }

    expect(Storage::disk('documents')->allFiles())->toHaveCount(1)
        ->and(DB::table('stored_files')->count())->toBe(1);
});

it('n\'écrit le PDF qu\'avant de prendre le numéro : un échec à l\'insertion n\'en laisse aucun', function (): void {
    IssuedDocument::creating(fn (): never => throw new RuntimeException('refus'));

    expect(fn () => documentsEmettre($this, $this->org))->toThrow(RuntimeException::class)
        ->and(Storage::disk('documents')->allFiles())->toBe([])
        ->and(DB::table('stored_files')->count())->toBe(0)
        ->and(DB::table('document_sequences')->count())->toBe(0);
});
