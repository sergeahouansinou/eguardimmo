<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Requests;

use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Inspections\Data\NewRemarkPhotoData;
use App\Modules\Inspections\Enums\RemarkKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

final class RecordInspectionRemarkRequest extends FormRequest
{
    public const MAX_PHOTOS = 6;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * Le type réel des photos est vérifié par Documents sur le contenu, qui en retire aussi les métadonnées.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'kind' => ['required', 'string', Rule::enum(RemarkKind::class)],
            'body' => ['required', 'string', 'min:2', 'max:2000'],
            'client_id' => ['required', 'uuid'],
            'photos' => ['sometimes', 'array', 'max:'.self::MAX_PHOTOS],
            'photos.*' => ['file', 'mimes:jpg,jpeg,png,webp', 'max:'.(int) (FileCategory::Supporting->maxBytes() / 1024)],
        ];
    }

    /**
     * @return list<NewRemarkPhotoData>
     */
    public function photos(): array
    {
        $photos = [];

        foreach ((array) $this->file('photos', []) as $fichier) {
            if ($fichier instanceof UploadedFile) {
                $photos[] = new NewRemarkPhotoData(FileSource::path((string) $fichier->getRealPath()), $fichier->getClientOriginalName());
            }
        }

        return $photos;
    }
}
