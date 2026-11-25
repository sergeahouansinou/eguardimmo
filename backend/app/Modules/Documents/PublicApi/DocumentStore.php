<?php

declare(strict_types=1);

namespace App\Modules\Documents\PublicApi;

use App\Modules\Documents\Actions\PurgeFile;
use App\Modules\Documents\Actions\ReadFile;
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
        private ReadFile $contenu,
        private PurgeFile $purge,
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

    /**
     * Lecture générique : refuse (404) une pièce de messagerie, un relevé bancaire, une pièce de compte de reversement et un fichier de l'espace locataire, qui ont leur route dédiée.
     * À utiliser pour tout fichier désigné par un identifiant que l'appelant n'a pas lui-même créé.
     */
    public function streamGeneric(string $id): StreamedResponse
    {
        return $this->lecture->handle($id, generic: true);
    }

    /**
     * Contenu d'un fichier de l'organisation courante, pour une pièce jointe : à n'utiliser que pour un envoi décidé par l'appelant.
     */
    public function contents(string $id): string
    {
        return $this->contenu->handle($id);
    }

    /**
     * Supprime le fichier et son contenu une fois la durée de conservation échue ; refuse (`retention_active`) avant, ou sans durée.
     * Sans effet sur un fichier déjà purgé.
     */
    public function purge(string $id): void
    {
        $this->purge->handle($id);
    }

    /**
     * Purge avant la durée de conservation : réservée au retrait d'une pièce envoyée par erreur ou illicite (ADR 0033, décision 5).
     * Le motif de l'appelant fait foi ; l'opération est journalisée (`documents.file.purged`, `early`).
     */
    public function purgeEarly(string $id): void
    {
        $this->purge->handle($id, early: true);
    }

    public function exists(string $id): bool
    {
        return $this->fichiers->exists($id);
    }

    /**
     * Description d'un fichier de l'organisation courante ; null s'il est inconnu ou d'une autre organisation.
     */
    public function find(string $id): ?StoredFileData
    {
        return $this->fichiers->data($id);
    }

    /**
     * Description de plusieurs fichiers de l'organisation courante en une requête ; les inconnus sont absents du résultat.
     *
     * @param  list<string>  $ids
     * @return array<string, StoredFileData> par identifiant
     */
    public function findMany(array $ids): array
    {
        return $this->fichiers->many($ids);
    }
}
