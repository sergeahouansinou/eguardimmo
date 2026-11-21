<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Enums\ScanStatus;
use App\Modules\Documents\Jobs\ScanStoredFile;
use App\Modules\Documents\Models\StoredFile;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

final readonly class StoredFileWriter
{
    public const DISK = 'documents';

    public function __construct(
        private CurrentOrganization $organisation,
        private ScanPolicy $politique,
    ) {}

    public function write(
        FileSource $source,
        string $displayName,
        FileCategory $category,
        ?DocumentSubject $subject,
        ?CarbonInterface $retentionUntil,
    ): StoredFile {
        if ($subject !== null && $subject->type !== DocumentSubject::TENANT_SPACE && Relation::getMorphedModel($subject->type) === null) {
            throw new InvalidArgumentException("Type d'objet inconnu : {$subject->type}.");
        }

        $temporaire = $source->path === null ? $this->temporaire((string) $source->contents) : null;
        $chemin = $source->path ?? (string) $temporaire;

        try {
            return $this->store($chemin, $displayName, $category, $subject, $retentionUntil);
        } finally {
            if ($temporaire !== null) {
                @unlink($temporaire);
            }
        }
    }

    private function store(string $chemin, string $nom, FileCategory $categorie, ?DocumentSubject $sujet, ?CarbonInterface $conservation): StoredFile
    {
        $probleme = FileInspector::problem($chemin, $categorie);

        if ($probleme !== null) {
            throw $probleme->problem();
        }

        $type = (string) FileInspector::detectedType($chemin);
        $nettoye = ImageSanitizer::applies($type) ? ImageSanitizer::clean($chemin, $type) : null;

        try {
            return $this->persist($nettoye ?? $chemin, $type, $nom, $categorie, $sujet, $conservation);
        } finally {
            if ($nettoye !== null) {
                @unlink($nettoye);
            }
        }
    }

    private function persist(string $chemin, string $type, string $nom, FileCategory $categorie, ?DocumentSubject $sujet, ?CarbonInterface $conservation): StoredFile
    {
        $extension = $categorie->allowedTypes()[$type];
        $stocke = $this->organisation->id().'/'.now()->format('Y/m').'/'.Str::uuid7()->toString().'.'.$extension;

        $flux = fopen($chemin, 'rb');

        if ($flux === false) {
            throw new RuntimeException('Fichier source illisible.');
        }

        try {
            $ecrit = Storage::disk(self::DISK)->put($stocke, $flux);
        } finally {
            fclose($flux);
        }

        if (! $ecrit) {
            throw new RuntimeException('Écriture du fichier impossible.');
        }

        DB::afterRollBack(function () use ($stocke): void {
            try {
                Storage::disk(self::DISK)->delete($stocke);
            } catch (Throwable $erreur) {
                report($erreur);
            }
        });

        try {
            $fichier = StoredFile::query()->create([
                'disk' => self::DISK,
                'path' => $stocke,
                'display_name' => FileNames::aligned($nom, self::extensions($type, $extension)),
                'mime_type' => $type,
                'size_bytes' => (int) filesize($chemin),
                'sha256' => (string) hash_file('sha256', $chemin),
                'category' => $categorie,
                'subject_type' => $sujet?->type,
                'subject_id' => $sujet?->id,
                'retention_until' => $conservation,
                'scan_status' => $this->politique->initial($categorie),
                'uploaded_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ]);
        } catch (Throwable $erreur) {
            Storage::disk(self::DISK)->delete($stocke);

            throw $erreur;
        }

        if ($fichier->scan_status === ScanStatus::Pending) {
            ScanStoredFile::dispatch($this->organisation->id(), $fichier->id)->afterCommit();
        }

        return $fichier;
    }

    /**
     * @return list<string>
     */
    private static function extensions(string $type, string $stockee): array
    {
        return $type === 'image/jpeg' ? ['jpg', 'jpeg'] : [$stockee];
    }

    private function temporaire(string $contenu): string
    {
        $chemin = TempFile::create();

        if (file_put_contents($chemin, $contenu) === false) {
            @unlink($chemin);

            throw new RuntimeException('Fichier temporaire impossible à écrire.');
        }

        return $chemin;
    }
}
