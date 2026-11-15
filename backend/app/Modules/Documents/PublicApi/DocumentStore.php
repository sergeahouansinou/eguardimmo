<?php

declare(strict_types=1);

namespace App\Modules\Documents\PublicApi;

use App\Modules\Documents\Actions\StoreFile;
use App\Modules\Documents\Actions\StreamFile;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Queries\StoredFiles;
use Carbon\CarbonInterface;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Stockage probant de l'organisation courante : disque privé hors racine web, type détecté sur le contenu, empreinte SHA-256.
 */
final readonly class DocumentStore
{
    public function __construct(
        private StoreFile $stockage,
        private StreamFile $lecture,
        private StoredFiles $fichiers,
    ) {}

    /**
     * Refuse un type hors liste blanche de la catégorie, un fichier trop gros ou contenant du code PHP (problème RFC 9457).
     * Un fichier ne se supprime pas avant `$retentionUntil` ; sans date, il est conservé sans limite.
     */
    public function store(
        FileSource $source,
        string $displayName,
        FileCategory $category,
        ?DocumentSubject $subject = null,
        ?CarbonInterface $retentionUntil = null,
    ): StoredFileData {
        return $this->stockage->handle($source, $displayName, $category, $subject, $retentionUntil);
    }

    /**
     * Réponse privée (`attachment`, `nosniff`, `no-store`) ; le téléchargement est journalisé (`documents.file.downloaded`).
     */
    public function stream(string $id): StreamedResponse
    {
        return $this->lecture->handle($id);
    }

    public function exists(string $id): bool
    {
        return $this->fichiers->exists($id);
    }
}
