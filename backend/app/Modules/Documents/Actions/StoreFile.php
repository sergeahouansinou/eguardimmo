<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\Support\StoredFileMapper;
use App\Modules\Documents\Support\StoredFileWriter;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\PublicApi\Entitlements;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

final readonly class StoreFile
{
    public function __construct(private StoredFileWriter $ecriture, private Entitlements $droits, private CurrentOrganization $organisation) {}

    public function handle(
        FileSource $source,
        string $displayName,
        FileCategory $category,
        ?DocumentSubject $subject = null,
        ?CarbonInterface $retentionUntil = null,
    ): StoredFileData {
        return DB::transaction(function () use ($source, $displayName, $category, $subject, $retentionUntil): StoredFileData {
            if ($this->plafonne($category, $subject)) {
                $this->droits->assertWithin(
                    $this->organisation->id(),
                    Feature::Storage,
                    fn (): int => (int) StoredFile::query()->sum('size_bytes'),
                    $source->path !== null ? (int) filesize($source->path) : strlen((string) $source->contents),
                );
            }

            return StoredFileMapper::data($this->ecriture->write($source, $displayName, $category, $subject, $retentionUntil));
        });
    }

    /**
     * Les pièces que la plateforme produit (quittances, factures, paquets) et celles des échanges de messagerie ou de l'espace locataire
     * comptent dans le volume mais ne sont jamais refusées : une obligation légale ou un tiers ne butent pas sur le plan de l'organisation.
     */
    private function plafonne(FileCategory $category, ?DocumentSubject $subject): bool
    {
        return in_array($category->value, FileCategory::scanned(), true)
            && ($subject === null || ! in_array($subject->type, [StoredFile::SUJET_MESSAGERIE, DocumentSubject::TENANT_SPACE], true));
    }
}
