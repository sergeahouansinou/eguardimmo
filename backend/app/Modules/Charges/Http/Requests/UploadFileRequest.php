<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

final class UploadFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return ['file' => ['required', 'file', 'max:10240']];
    }

    public function upload(): UploadedFile
    {
        $fichier = $this->file('file');

        return $fichier instanceof UploadedFile ? $fichier : throw new \LogicException('Fichier absent après validation.');
    }
}
