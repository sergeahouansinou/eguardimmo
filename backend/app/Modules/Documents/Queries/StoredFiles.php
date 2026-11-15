<?php

declare(strict_types=1);

namespace App\Modules\Documents\Queries;

use App\Modules\Documents\Models\StoredFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class StoredFiles
{
    public function exists(string $id): bool
    {
        $fichier = Str::isUuid($id) ? StoredFile::query()->find($id) : null;

        return $fichier !== null && Storage::disk($fichier->disk)->exists($fichier->path);
    }
}
