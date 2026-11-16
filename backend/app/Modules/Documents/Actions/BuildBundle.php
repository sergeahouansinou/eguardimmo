<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\GeneratedFile;
use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\Support\FileNames;
use App\Modules\Documents\Support\TempFile;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use ZipArchive;

final readonly class BuildBundle
{
    public function __construct(private StoreFile $stockage) {}

    /**
     * @param  list<string>  $storedFileIds
     * @param  list<GeneratedFile>  $generated
     */
    public function handle(
        array $storedFileIds,
        array $generated,
        string $name,
        ?DocumentSubject $subject = null,
        ?CarbonInterface $retentionUntil = null,
    ): StoredFileData {
        if (! class_exists(ZipArchive::class)) {
            throw ErrorCode::ZipUnavailable->problem();
        }

        if ($storedFileIds === [] && $generated === []) {
            throw ErrorCode::BundleEmpty->problem();
        }

        $temporaires = [];
        $archive = TempFile::create();
        $temporaires[] = $archive;

        try {
            $zip = new ZipArchive;

            if ($zip->open($archive, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new RuntimeException('Archive impossible à créer.');
            }

            $pris = [];

            foreach ($this->fichiers($storedFileIds) as $fichier) {
                $source = TempFile::create();
                $temporaires[] = $source;
                $this->copier($fichier, $source);
                $zip->addFile($source, FileNames::unique(FileNames::archiveEntry($fichier->display_name), $pris));
            }

            foreach ($generated as $genere) {
                $zip->addFromString(FileNames::unique(FileNames::archiveEntry($genere->name), $pris), $genere->contents);
            }

            if (! $zip->close()) {
                throw new RuntimeException('Archive impossible à écrire.');
            }

            return $this->stockage->handle(
                FileSource::path($archive),
                FileNames::display($name).'.zip',
                FileCategory::Bundle,
                $subject,
                $retentionUntil,
            );
        } finally {
            foreach ($temporaires as $chemin) {
                @unlink($chemin);
            }
        }
    }

    /**
     * @param  list<string>  $ids
     * @return list<StoredFile>
     */
    private function fichiers(array $ids): array
    {
        $uniques = array_values(array_unique($ids));
        $trouves = StoredFile::query()->whereIn('id', $uniques)->get()->keyBy('id');
        $fichiers = [];

        foreach ($uniques as $id) {
            $fichiers[] = $trouves->get($id) ?? throw ErrorCode::FileNotFound->problem();
        }

        return $fichiers;
    }

    private function copier(StoredFile $fichier, string $destination): void
    {
        $flux = Storage::disk($fichier->disk)->readStream($fichier->path);

        if (! is_resource($flux)) {
            throw ErrorCode::FileUnavailable->problem();
        }

        $sortie = fopen($destination, 'wb');

        if ($sortie === false) {
            fclose($flux);

            throw new RuntimeException('Fichier temporaire impossible à écrire.');
        }

        try {
            stream_copy_to_stream($flux, $sortie);
        } finally {
            fclose($flux);
            fclose($sortie);
        }

        if (! hash_equals($fichier->sha256, (string) hash_file('sha256', $destination))) {
            report(new RuntimeException("Empreinte du fichier stocké {$fichier->id} différente de celle enregistrée."));

            throw ErrorCode::FileUnavailable->problem();
        }
    }
}
