<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\Support\ScanGate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

final readonly class ReadFile
{
    public function handle(string $id): string
    {
        $fichier = (Str::isUuid($id) ? StoredFile::query()->find($id) : null) ?? throw ErrorCode::FileNotFound->problem();
        ScanGate::assertReadable($fichier);
        $contenu = Storage::disk($fichier->disk)->get($fichier->path);

        if (! is_string($contenu)) {
            report(new RuntimeException("Contenu absent du fichier stocké {$fichier->id}."));

            throw ErrorCode::FileUnavailable->problem();
        }

        return $contenu;
    }
}
