<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Documents\Models\StoredFile;
use Carbon\CarbonImmutable;

final class StoredFileMapper
{
    public static function data(StoredFile $fichier): StoredFileData
    {
        return new StoredFileData(
            $fichier->id,
            $fichier->display_name,
            $fichier->mime_type,
            $fichier->size_bytes,
            $fichier->sha256,
            $fichier->category,
            $fichier->subject_type !== null && $fichier->subject_id !== null ? new DocumentSubject($fichier->subject_type, $fichier->subject_id) : null,
            $fichier->retention_until === null ? null : CarbonImmutable::instance($fichier->retention_until),
            CarbonImmutable::instance($fichier->created_at),
        );
    }
}
