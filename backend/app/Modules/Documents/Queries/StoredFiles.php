<?php

declare(strict_types=1);

namespace App\Modules\Documents\Queries;

use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\Support\StoredFileMapper;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class StoredFiles
{
    public function exists(string $id): bool
    {
        $fichier = Str::isUuid($id) ? StoredFile::query()->find($id) : null;

        return $fichier !== null && Storage::disk($fichier->disk)->exists($fichier->path);
    }

    public function data(string $id): ?StoredFileData
    {
        $fichier = Str::isUuid($id) ? StoredFile::query()->find($id) : null;

        return $fichier === null ? null : StoredFileMapper::data($fichier);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, StoredFileData> par identifiant ; un fichier inconnu ou d'une autre organisation est absent
     */
    public function many(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids, fn (string $id): bool => Str::isUuid($id))));

        if ($ids === []) {
            return [];
        }

        $donnees = [];

        foreach (StoredFile::query()->whereIn('id', $ids)->get() as $fichier) {
            $donnees[$fichier->id] = StoredFileMapper::data($fichier);
        }

        return $donnees;
    }
}
