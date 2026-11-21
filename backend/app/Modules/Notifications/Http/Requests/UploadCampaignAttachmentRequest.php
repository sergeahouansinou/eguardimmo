<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

final class UploadCampaignAttachmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return ['file' => ['required', 'file', 'mimetypes:application/pdf', 'max:5120']];
    }

    public function document(): UploadedFile
    {
        /** @var UploadedFile $fichier */
        $fichier = $this->file('file');

        return $fichier;
    }
}
