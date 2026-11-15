<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

final class MessageInput
{
    /**
     * @return array<string, list<mixed>>
     */
    public static function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:5000'],
            'attachments' => ['nullable', 'array', 'max:'.AttachmentStore::MAX_FICHIERS],
            'attachments.*' => AttachmentStore::rules(),
        ];
    }

    public static function body(FormRequest $request): string
    {
        return trim((string) $request->string('body'));
    }

    /**
     * @return list<UploadedFile>
     */
    public static function attachments(FormRequest $request): array
    {
        $fichiers = $request->file('attachments', []);

        return is_array($fichiers) ? array_values($fichiers) : [];
    }
}
