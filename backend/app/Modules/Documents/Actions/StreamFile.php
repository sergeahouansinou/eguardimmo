<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Models\StoredFile;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

final readonly class StreamFile
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(string $id): StreamedResponse
    {
        $fichier = (Str::isUuid($id) ? StoredFile::query()->find($id) : null) ?? throw ErrorCode::FileNotFound->problem();
        $disque = Storage::disk($fichier->disk);

        if (! $disque->exists($fichier->path)) {
            report(new RuntimeException("Contenu absent du fichier stocké {$fichier->id}."));

            throw ErrorCode::FileUnavailable->problem();
        }

        $this->audit->handle('documents.file.downloaded', subject: $fichier, metadata: [
            'category' => $fichier->category->value,
            'size_bytes' => $fichier->size_bytes,
        ]);

        $reponse = $disque->download($fichier->path, $fichier->display_name, [
            'Content-Type' => $fichier->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
        $reponse->setPrivate();

        return $reponse;
    }
}
